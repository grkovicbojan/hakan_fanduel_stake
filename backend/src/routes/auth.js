import crypto from "node:crypto";
import { SharedIdentity } from "../auth/sharedIdentity.js";
import { Router } from "express";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import {
  acceptInvite,
  addProjectMember,
  countAcceptedInvitesSent,
  createInvite,
  ensureDefaultProject,
  ensureUserFromIdentity,
  getInviteByToken,
  getProjectBySlug,
  getUserByEmail,
  HUB_ONLY_HASH,
  linkLegacyUser,
  userPayload,
} from "../auth/store.js";
import {
  decodeToken,
  generateInviteToken,
  getBearerToken,
  hubLoginUrl,
  hubRegisterUrl,
  verifyPassword,
} from "../auth/utils.js";

const sharedIdentity = new SharedIdentity({
  databaseUrl: env.hubDatabaseUrl,
  secret: env.authJwtSecret,
  cookieName: env.authCookieName,
  expireDays: env.authJwtExpireDays,
  appBaseUrl: env.appBaseUrl,
});

function trustedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  return [env.appBaseUrl, ...env.corsOrigins].some((candidate) => {
    try { return new URL(candidate).origin === origin; } catch { return false; }
  });
}

function rejectForeignOrigin(req, res, next) {
  if (!trustedOrigin(req)) return res.status(403).json({ message: "Request origin is not allowed." });
  next();
}

function throttleResponse(res, result) {
  res.set("Retry-After", String(result.retryAfter || 900));
  return res.status(429).json({ message: "Too many attempts. Try again later." });
}

async function verifiedIdentity(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const payload = decodeToken(token);
  const user = await sharedIdentity.validateSession(payload);
  if (!user) return null;
  return { payload, user };
}

export function createAuthRouter() {
  const router = Router({ mergeParams: true });

  async function completeSignIn(req, res, result, status = 200) {
    sharedIdentity.setCookie(req, res, result.token);
    const slug = String(req.params.slug || env.defaultProjectSlug).toLowerCase();
    const project = await ensureDefaultProject(slug);
    try {
      const user = await ensureUserFromIdentity(result.user.id, result.user.email);
      await addProjectMember(project.id, user.id, "member");
      const invitesSent = await countAcceptedInvitesSent(user.id, project.id);
      return res.status(status).json({ user: userPayload(user, slug, invitesSent) });
    } catch (error) {
      if (error?.code === "link_required") {
        return res.status(409).json({ code: "link_required", email: error.email,
          message: "Enter your old SportBet password once to link this account." });
      }
      if (error?.code === "identity_conflict") {
        return res.status(409).json({ message: "This email belongs to another linked account." });
      }
      throw error;
    }
  }

  router.post("/auth/register", rejectForeignOrigin, async (req, res, next) => {
    try {
      const result = await sharedIdentity.register({
        email: req.body?.email, password: req.body?.password,
        ip: req.ip || "unknown", userAgent: req.headers["user-agent"] || "",
      });
      if (result.code === "unavailable") return res.status(503).json({ message: "Shared account database is not configured." });
      if (result.code === "invalid_email") return res.status(400).json({ message: "Enter a valid email address." });
      if (result.code === "invalid_password") return res.status(400).json({ message: result.message });
      if (result.code === "throttled") return throttleResponse(res, result);
      if (result.code === "exists") return res.status(409).json({ message: "Account already exists. Sign in instead." });
      return await completeSignIn(req, res, result, 201);
    } catch (error) { next(error); }
  });

  router.post("/auth/login", rejectForeignOrigin, async (req, res, next) => {
    try {
      const result = await sharedIdentity.login({
        email: req.body?.email, password: req.body?.password,
        ip: req.ip || "unknown", userAgent: req.headers["user-agent"] || "",
      });
      if (result.code === "unavailable") return res.status(503).json({ message: "Shared account database is not configured." });
      if (result.code === "invalid_input") return res.status(400).json({ message: "Email and password required." });
      if (result.code === "throttled") return throttleResponse(res, result);
      if (result.code === "disabled") return res.status(403).json({ message: "This account is suspended." });
      if (result.code === "invalid_credentials") {
        const email = String(req.body?.email || "").trim().toLowerCase();
        const legacy = await getUserByEmail(email);
        const password = req.body?.password;
        if (legacy && !legacy.hub_user_id && legacy.password_hash !== HUB_ONLY_HASH &&
            typeof password === "string" && verifyPassword(password, legacy.password_hash)) {
          const imported = await sharedIdentity.importLegacy({
            userId: legacy.id, email, passwordHash: legacy.password_hash,
            ip: req.ip || "unknown", userAgent: req.headers["user-agent"] || "",
          });
          if (imported.code === "ok") {
            await pool.query("UPDATE users SET hub_user_id = $1 WHERE id = $2 AND hub_user_id IS NULL",
              [legacy.id, legacy.id]);
            return await completeSignIn(req, res, imported);
          }
          if (imported.code === "exists") {
            return res.status(409).json({ code: "shared_account_exists",
              message: "This email has a shared account. Sign in with that password, then link the older SportBet account." });
          }
        }
        return res.status(401).json({ message: "Invalid email or password." });
      }
      return await completeSignIn(req, res, result);
    } catch (error) { next(error); }
  });

  router.post("/auth/logout", rejectForeignOrigin, async (req, res, next) => {
    try {
      const token = getBearerToken(req);
      if (token) {
        try { await sharedIdentity.revokeSession(decodeToken(token).jti); }
        catch { /* Clear cookie even if token is stale. */ }
      }
      sharedIdentity.clearCookie(req, res);
      res.json({ ok: true });
    } catch (error) { next(error); }
  });

  // Linking checks a password, so it is throttled like a login: five wrong
  // guesses per address-and-email in fifteen minutes, then a lockout.
  const LINK_WINDOW_MS = 15 * 60 * 1000;
  const LINK_LIMIT = 5;
  const linkFailures = new Map();
  function linkKey(req, email) {
    const ip = req.ip || "unknown";
    return `${ip}|${email}`;
  }
  function linkThrottled(key) {
    const now = Date.now();
    const q = (linkFailures.get(key) || []).filter((t) => t > now - LINK_WINDOW_MS);
    linkFailures.set(key, q);
    return q.length >= LINK_LIMIT;
  }
  function linkFailed(key) {
    linkFailures.set(key, [...(linkFailures.get(key) || []), Date.now()]);
  }

  /**
   * Attach the hub identity to a local account from before hub sign-in.
   *
   * Two credentials at once, which is what makes this safe where automatic
   * adoption is not: the hub cookie proves the hub account, and the password
   * proves the local one. The hub does not verify that a registrant owns their
   * address, so either alone would let a stranger claim the row.
   */
  router.post("/auth/link", rejectForeignOrigin, async (req, res, next) => {
    let identity;
    try {
      identity = await verifiedIdentity(req);
      if (!identity) return res.status(401).json({ message: "Sign in first, then link." });
    } catch {
      return res.status(401).json({ message: "Sign in first, then link." });
    }
    const email = String(identity.user.email || "").trim().toLowerCase();
    const password = String((req.body && req.body.password) || "");
    if (!password) return res.status(400).json({ message: "Password required" });
    const key = linkKey(req, email);
    if (linkThrottled(key)) {
      return res.status(429).json({ message: "Too many attempts. Try again in fifteen minutes." });
    }
    try {
      const result = await linkLegacyUser(identity.user.id, email, password);
      if (result.code === "bad_password") {
        linkFailed(key);
        return res.status(401).json({ message: "That password is not right." });
      }
      if (result.code === "not_linkable" || result.code === "conflict") {
        return res.status(409).json({ message: "This account cannot be linked automatically." });
      }
      linkFailures.delete(key);
      return res.json({ ok: true, email: result.user.email });
    } catch (error) { next(error); }
  });

  router.get("/auth/me", requireAuth, async (req, res) => {
    const invitesSent = await countAcceptedInvitesSent(req.auth.userId, req.auth.projectId);
    res.json(
      userPayload({ id: req.auth.userId, email: req.auth.email }, req.auth.projectSlug, invitesSent)
    );
  });

  router.post("/invites", requireAuth, async (req, res, next) => {
    try {
      const slug = req.auth.projectSlug;
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email required" });
      const token = generateInviteToken();
      const invite = await createInvite(req.auth.projectId, email, req.auth.userId, token);
      const link = `${env.appBaseUrl}/p/${slug}/invite/${token}`;
      res.json({
        invite: {
          email: invite.email,
          token,
          link,
          expires_at: invite.expires_at,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/invites/:token", async (req, res, next) => {
    try {
      const slug = String(req.params.slug || "").toLowerCase();
      const invite = await getInviteByToken(req.params.token);
      if (!invite) return res.status(404).json({ message: "Invite not found" });
      const project = await getProjectBySlug(slug);
      if (!project || project.id !== invite.project_id) {
        return res.status(404).json({ message: "Invite not found for this project" });
      }
      res.json({
        email: invite.email,
        accepted: Boolean(invite.accepted_at),
        expired: new Date(invite.expires_at) < new Date(),
        project_slug: slug,
        hub_auth_url: env.hubAuthUrl,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/invites/:token/accept", async (req, res, next) => {
    try {
      const slug = String(req.params.slug || "").toLowerCase();
      const invite = await getInviteByToken(req.params.token);
      if (!invite) return res.status(404).json({ message: "Invite not found" });
      const project = await getProjectBySlug(slug);
      if (!project || project.id !== invite.project_id) {
        return res.status(404).json({ message: "Invite not found for this project" });
      }

      const identity = await verifiedIdentity(req);
      if (!identity) {
        return res.status(401).json({
          message: "Sign in before accepting this invite",
        });
      }
      const user = await ensureUserFromIdentity(
        String(identity.user.id),
        String(identity.user.email || invite.email)
      );
      if (invite.email.toLowerCase() !== String(user.email).toLowerCase()) {
        return res.status(403).json({ message: "Signed-in hub account does not match invite email" });
      }

      if (!invite.accepted_at) {
        const accepted = await acceptInvite(req.params.token, user.id);
        if (!accepted) return res.status(400).json({ message: "Invite expired or invalid" });
      } else {
        await addProjectMember(project.id, user.id, "member");
      }

      const invitesSent = await countAcceptedInvitesSent(user.id, project.id);
      res.json({ user: userPayload(user, slug, invitesSent) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function requireAuth(req, res, next) {
  (async () => {
    const slug = String(req.params.slug || env.defaultProjectSlug).toLowerCase();
    try {
      const identity = await verifiedIdentity(req);
      if (!identity) {
        return res.status(401).json({
          message: "Authentication required",
        });
      }
      const payload = identity.payload;
      const project = await ensureDefaultProject(slug);

      if (payload.project_id && payload.project_id !== project.id) {
        return res.status(403).json({ message: "Token not valid for this project" });
      }

      const user = await ensureUserFromIdentity(String(identity.user.id), String(identity.user.email || ""));
      await addProjectMember(project.id, user.id, "member");

      req.auth = {
        userId: user.id,
        email: user.email,
        projectId: project.id,
        projectSlug: slug,
      };
      next();
    } catch (err) {
      if (err && err.code === "link_required") {
        // Deliberately no redirect: sending this person back to the hub would
        // loop, since they are already signed in there. The page reads the
        // code and offers the link step instead.
        return res.status(401).json({
          code: "link_required",
          email: err.email,
          message:
            "An account with this email already exists here from before. " +
            "Enter its password once to link it.",
        });
      }
      if (err?.code === "identity_conflict") {
        return res.status(409).json({ message: "This email is linked to another account." });
      }
      if (["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"].includes(err?.code)) {
        return res.status(503).json({ message: "Shared account database is unavailable." });
      }
      res.status(401).json({ message: "Invalid or expired token" });
    }
  })();
}

/**
 * Guards the scrape ingest endpoint, which the Chrome extension posts to.
 *
 * The extension has no user session, so it presents a shared secret instead.
 * Without this, anyone could inject fabricated odds into the compare pipeline
 * and drive false alerts.
 */
export function requireExtensionKey(req, res, next) {
  const expected = env.extensionApiKey;
  if (!expected) {
    return res.status(503).json({
      message: "Scrape ingest is not configured (set EXTENSION_API_KEY)."
    });
  }
  const presented = String(req.get("x-extension-key") || "");
  // Compare over fixed-length digests so length/content do not leak via timing.
  const a = crypto.createHash("sha256").update(presented).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ message: "Invalid extension key" });
  }
  next();
}

export async function requireDownloadUnlock(req, res, next) {
  requireAuth(req, res, async () => {
    if (res.headersSent) return;
    try {
      const count = await countAcceptedInvitesSent(req.auth.userId, req.auth.projectId);
      if (count < 1) {
        return res.status(403).json({
          message: "Invite at least one teammate and have them accept to unlock CSV downloads",
          can_download: false,
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  });
}
