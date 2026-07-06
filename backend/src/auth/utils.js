import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function createToken({ userId, projectId, email }) {
  return jwt.sign(
    { sub: userId, project_id: projectId, email },
    env.jwtSecret,
    { expiresIn: `${env.jwtExpireDays}d` }
  );
}

export function decodeToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export function generateInviteToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function getBearerToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return req.cookies?.access_token || "";
}
