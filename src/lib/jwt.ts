/**
 * Zero-dependency Web Crypto JWT (HS256) implementation.
 * Fully compatible with Next.js Edge Middleware, Node.js 18+, and browser environments.
 */

export interface TokenPayload {
  userId: string;
  email: string;
  exp?: number;
  iat?: number;
}

export const AUTH_COOKIE_NAME = "autojob_token";
export const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getSecretKey(secret?: string): string {
  return (
    secret ||
    process.env.JWT_SECRET ||
    "autojob-saas-platform-super-secret-jwt-key-minimum-32-chars"
  );
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getSubtleCryptoKey(secretStr: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secretStr),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Signs a JWT with HS256 using Web Crypto (Edge compatible).
 */
export async function signJwt(
  payload: TokenPayload,
  customSecret?: string,
  expiresInSeconds: number = TOKEN_EXPIRY_SECONDS
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = { alg: "HS256", typ: "JWT" };
  const enc = new TextEncoder();

  const headerEncoded = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadEncoded = base64UrlEncode(enc.encode(JSON.stringify(fullPayload)));
  const dataToSign = `${headerEncoded}.${payloadEncoded}`;

  const key = await getSubtleCryptoKey(getSecretKey(customSecret));
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(dataToSign)
  );

  const signatureEncoded = base64UrlEncode(new Uint8Array(signatureBuffer));
  return `${dataToSign}.${signatureEncoded}`;
}

/**
 * Verifies a JWT and extracts payload. Returns null if invalid or expired.
 */
export async function verifyJwt(
  token: string,
  customSecret?: string
): Promise<TokenPayload | null> {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const [headerB64, payloadB64, signatureB64] = parts;
    const dataToVerify = `${headerB64}.${payloadB64}`;
    const enc = new TextEncoder();

    const signatureBytes = base64UrlDecode(signatureB64);
    const key = await getSubtleCryptoKey(getSecretKey(customSecret));

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes as unknown as BufferSource,
      enc.encode(dataToVerify)
    );

    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload: TokenPayload = JSON.parse(payloadJson);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    if (!payload.userId) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts the auth token from Request headers (Cookie or Authorization Bearer).
 */
export function getAuthTokenFromRequest(request: Request): string | null {
  // 1. Authorization header (Bearer token)
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const bearer = authHeader.substring(7).trim();
    if (bearer) return bearer;
  }

  // 2. Cookie header
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const c of cookies) {
      if (c.startsWith(`${AUTH_COOKIE_NAME}=`)) {
        return decodeURIComponent(c.substring(AUTH_COOKIE_NAME.length + 1));
      }
    }
  }

  return null;
}
