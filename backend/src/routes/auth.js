import crypto from "node:crypto";
import { rejectRevoked } from "../auth/hubSession.js";
import { Router } from "express";
import { env } from "../config/env.js";
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
  markUserHubOwned,
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

export function createAuthRouter() {
  const router = Router({ mergeParams: true });

  router.post("/auth/register", (req, res) => {
    const slug = String(req.params.slug || env.defaultProjectSlug).toLowerCase();
    res.status(401).json({
      message: "Register at the Weien Wong hub",
      redirect: hubRegisterUrl(`${env.appBaseUrl}/p/${slug}/auth`),
    });
  });

  router.post("/auth/login", (req, res) => {
    const slug = String(req.params.slug || env.defaultProjectSlug).toLowerCase();
    res.status(401).json({
      message: "Sign in at the Weien Wong hub",
      redirect: hubLoginUrl(`${env.appBaseUrl}/p/${slug}/auth`),
    });
  });

  // Linking checks a password, so it is throttled like a login: five wrong
  // guesses per address-and-email in fifteen minutes, then a lockout.
  const LINK_WINDOW_MS = 15 * 60 * 1000;
  const LINK_LIMIT = 5;
  const linkFailures = new Map();
  function linkKey(req, email) {
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || "";
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
  router.post("/auth/link", async (req, res) => {
    let identity;
    try {
      const token = getBearerToken(req);
      if (!token) return res.status(401).json({ message: "Sign in first, then link." });
      identity = decodeToken(token);
    } catch {
      return res.status(401).json({ message: "Sign in first, then link." });
    }
    const email = String(identity.email || "").trim().toLowerCase();
    const password = String((req.body && req.body.password) || "");
    if (!password) return res.status(400).json({ message: "Password required" });

    const row = email ? await getUserByEmail(email) : null;
    if (!row || (row.password_hash || "") === HUB_ONLY_HASH) {
      return res.status(404).json({ message: "There is no separate account here to link." });
    }
    const key = linkKey(req, email);
    if (linkThrottled(key)) {
      return res.status(429).json({ message: "Too many attempts. Try again in fifteen minutes." });
    }
    if (!verifyPassword(password, row.password_hash)) {
      linkFailed(key);
      return res.status(401).json({ message: "That password is not right." });
    }
    await markUserHubOwned(row.id);
    res.json({ ok: true, email: row.email });
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

      const token = getBearerToken(req);
      if (!token) {
        return res.status(401).json({
          message: "Sign in at the hub before accepting this invite",
          redirect: hubLoginUrl(`${env.appBaseUrl}/p/${slug}/invite/${req.params.token}`),
        });
      }

      const identity = decodeToken(token);
      await rejectRevoked(identity);
      const user = await ensureUserFromIdentity(
        String(identity.sub),
        String(identity.email || invite.email)
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
      const token = getBearerToken(req);
      if (!token) {
        return res.status(401).json({
          message: "Authentication required",
          redirect: hubLoginUrl(`${env.appBaseUrl}/p/${slug}/auth`),
        });
      }

      const payload = decodeToken(token);
      await rejectRevoked(payload);
      const project = await ensureDefaultProject(slug);

      if (payload.project_id && payload.project_id !== project.id) {
        return res.status(403).json({ message: "Token not valid for this project" });
      }

      const user = await ensureUserFromIdentity(String(payload.sub), String(payload.email || ""));
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
      res.status(401).json({
        message: "Invalid or expired token",
        redirect: hubLoginUrl(`${env.appBaseUrl}/p/${slug}/auth`),
      });
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
