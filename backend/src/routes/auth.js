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
  userPayload,
} from "../auth/store.js";
import {
  decodeToken,
  generateInviteToken,
  getBearerToken,
  hubLoginUrl,
  hubRegisterUrl,
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
    } catch {
      res.status(401).json({
        message: "Invalid or expired token",
        redirect: hubLoginUrl(`${env.appBaseUrl}/p/${slug}/auth`),
      });
    }
  })();
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
