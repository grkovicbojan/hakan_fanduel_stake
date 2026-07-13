import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import {
  createIdentityToken,
  decodeIdentityToken,
  getTokenFromRequest,
} from "/mnt/social_dataset/shared_auth/node/index.js";

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

export function decodeToken(token) {
  try {
    return decodeIdentityToken(token, env.authJwtSecret);
  } catch {
    return jwt.verify(token, env.jwtSecret);
  }
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
