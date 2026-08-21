import jwt from "jsonwebtoken";

export const AUTH_COOKIE_NAME = "ww_access_token";
export const AUTH_ISSUER = "weienwong.online";

export function createIdentityToken({ userId, email, secret, expireDays = 7, extraClaims = {} }) {
  return jwt.sign(
    {
      sub: userId,
      email,
      iss: AUTH_ISSUER,
      ...extraClaims,
    },
    secret,
    { expiresIn: `${expireDays}d` }
  );
}

export function decodeIdentityToken(token, secret) {
  // `iss` is required, not merely checked when present. Every token this
  // module mints sets it, so demanding it costs nothing -- and accepting a
  // token that omits the claim would let anything holding the shared secret
  // pass the issuer check by not making an issuer.
  const payload = jwt.verify(token, secret, {
    algorithms: ["HS256"],
    issuer: [AUTH_ISSUER, `https://${AUTH_ISSUER}`],
  });
  if (!payload.iss) {
    const error = new Error("Invalid token issuer");
    error.status = 401;
    throw error;
  }
  return payload;
}

function parseCookies(req) {
  if (req.cookies && typeof req.cookies === "object") {
    return req.cookies;
  }
  const header = req.headers?.cookie || "";
  const out = {};
  for (const part of String(header).split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (!key) continue;
    const raw = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(raw);
    } catch {
      out[key] = raw;
    }
  }
  return out;
}

function isUsableToken(token) {
  if (!token || typeof token !== "string") return false;
  const value = token.trim();
  // Frontends sometimes store the placeholder "cookie" for SSO sessions.
  if (!value || value === "cookie") return false;
  return true;
}

export function getTokenFromRequest(req, cookieName = AUTH_COOKIE_NAME) {
  const auth = req.headers?.authorization || "";
  if (auth.startsWith("Bearer ")) {
    const bearer = auth.slice(7).trim();
    if (isUsableToken(bearer)) return bearer;
  }
  const cookies = parseCookies(req);
  if (isUsableToken(cookies.access_token)) return cookies.access_token;
  if (isUsableToken(cookies[cookieName])) return cookies[cookieName];
  return "";
}
