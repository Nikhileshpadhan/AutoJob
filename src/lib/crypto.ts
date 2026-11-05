import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * Derives a deterministic 32-byte key from ENCRYPTION_SECRET or ENCRYPTION_KEY.
 * Works seamlessly in cloud serverless environments (Vercel, GitHub Actions)
 * without requiring file system persistence.
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_SECRET ||
    process.env.ENCRYPTION_KEY ||
    "autojob-saas-platform-encryption-secret-default-key";

  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM (BYOK security).
 * Output format: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `enc:v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Gracefully returns original text if not prefixed with enc:v1:.
 */
export function decryptSecret(ciphertext: string): string {
  if (!ciphertext) return "";
  if (!ciphertext.startsWith("enc:v1:")) {
    return ciphertext;
  }

  const parts = ciphertext.split(":");
  if (parts.length !== 5) {
    return "";
  }

  const [, , ivHex, tagHex, dataHex] = parts;
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const encryptedData = Buffer.from(dataHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (err) {
    console.error("[Crypto] Failed to decrypt secret:", err);
    return "";
  }
}
