import crypto from "node:crypto";
import {
  signJwt,
  verifyJwt,
  getAuthTokenFromRequest,
  AUTH_COOKIE_NAME,
  TOKEN_EXPIRY_SECONDS,
  type TokenPayload,
} from "./jwt";

export {
  signJwt,
  verifyJwt,
  getAuthTokenFromRequest,
  AUTH_COOKIE_NAME,
  TOKEN_EXPIRY_SECONDS,
  type TokenPayload,
};

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

/**
 * Hashes a password securely using Node.js scrypt with a 16-byte random salt.
 * Format: scrypt:<salt_hex>:<hash_hex>
 */
export function hashPassword(password: string): string {
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verifies a password against the stored scrypt hash using timingSafeEqual.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash || !storedHash.startsWith("scrypt:")) {
    return false;
  }
  const parts = storedHash.split(":");
  if (parts.length !== 3) {
    return false;
  }
  const [, saltHex, hashHex] = parts;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expectedHash = Buffer.from(hashHex, "hex");
    const actualHash = crypto.scryptSync(password, salt, expectedHash.length);
    return crypto.timingSafeEqual(expectedHash, actualHash);
  } catch {
    return false;
  }
}

/**
 * Requires a valid user session for API route handlers.
 * Throws AuthError (401) if missing or expired.
 */
export async function requireAuth(
  request: Request
): Promise<{ userId: string; email: string }> {
  const token = getAuthTokenFromRequest(request);
  if (!token) {
    throw new AuthError("Authentication required. Please sign in.", 401);
  }

  const payload = await verifyJwt(token);
  if (!payload || !payload.userId) {
    throw new AuthError("Session expired or invalid. Please sign in again.", 401);
  }

  return {
    userId: payload.userId,
    email: payload.email,
  };
}

/**
 * Formats a Set-Cookie header value for HttpOnly session cookie.
 */
export function createAuthCookieHeader(token: string): string {
  const isProd = process.env.NODE_ENV === "production";
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(
    token
  )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TOKEN_EXPIRY_SECONDS}${
    isProd ? "; Secure" : ""
  }`;
}

/**
 * Formats a Set-Cookie header value to clear the session cookie.
 */
export function clearAuthCookieHeader(): string {
  const isProd = process.env.NODE_ENV === "production";
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${
    isProd ? "; Secure" : ""
  }`;
}

