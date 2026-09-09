import crypto from "crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import {
  createIdentityToken,
  decodeIdentityToken,
  getTokenFromRequest,
} from "../vendor/shared_auth/index.js";

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function createToken({ userId, projectId, email }) {
  return createIdentityToken({
    userId,
    email,
    secret: env.authJwtSecret,
    expireDays: env.jwtExpireDays,
    extraClaims: { project_id: projectId },
  });
}

// Verify a hub identity token. Anything else throws.
//
// The JWT_SECRET fall-back that used to sit in the catch is gone. Nothing here
// mints such a token any more, and it verified with no issuer and no required
// claims -- so a token with no exp never expired. It was also reachable in a
// worse way: authJwtSecret falls back to JWT_SECRET when AUTH_JWT_SECRET is
// unset, and wherever that default applied the catch re-judged, under weaker
// rules, the very token decodeIdentityToken had just rejected.
export function decodeToken(token) {
  return decodeIdentityToken(token, env.authJwtSecret);
}

export function generateInviteToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function getBearerToken(req) {
  return getTokenFromRequest(req, env.authCookieName);
}

export function hubLoginUrl(returnTo = "") {
  const base = `${env.hubAuthUrl}/login`;
  if (!returnTo) return base;
  return `${base}?return_to=${encodeURIComponent(returnTo)}`;
}

export function hubRegisterUrl(returnTo = "") {
  const base = `${env.hubAuthUrl}/register`;
  if (!returnTo) return base;
  return `${base}?return_to=${encodeURIComponent(returnTo)}`;
}
