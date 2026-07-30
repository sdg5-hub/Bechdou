// Auth primitives built on node:crypto — no external dependencies.
// Password hashing uses scrypt; session tokens are HS256 JWT-style strings.
import crypto from "node:crypto";

const TOKEN_SECRET = process.env.BECHDOU_SECRET || "bechdou-dev-secret-change-me";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/* ---------- Passwords (scrypt) ---------- */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(password || ""), salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith("scrypt$")) return false;
  const [, saltHex, hashHex] = stored.split("$");
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(String(password || ""), salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/* ---------- Single-use links (email verification, password reset) ---------- */
// Only the hash is stored, so a database leak cannot yield usable reset links.
export function createLinkToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: hashLinkToken(token) };
}

export function hashLinkToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

/* ---------- Tokens (HS256, JWT-compatible encoding) ---------- */
function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

export function signToken(payload, ttl = TOKEN_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttl }));
  const data = `${header}.${body}`;
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(`${header}.${body}`).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}
