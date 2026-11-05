import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Retrieves or generates a 32-byte encryption key.
 * Prioritizes process.env.ENCRYPTION_KEY (hex or raw 32 bytes),
 * falling back to a persistent local keyfile in ./data/.secret_key.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    if (envKey.length === 64) {
      return Buffer.from(envKey, "hex");
    }
    return crypto.createHash("sha256").update(envKey).digest();
  }

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const keyFilePath = path.join(dataDir, ".secret_key");
  if (fs.existsSync(keyFilePath)) {
    const raw = fs.readFileSync(keyFilePath, "utf8").trim();
    if (raw.length === 64) {
      return Buffer.from(raw, "hex");
    }
  }

  // Generate a new 32-byte key and persist
  const newKey = crypto.randomBytes(32);
  try {
    fs.writeFileSync(keyFilePath, newKey.toString("hex"), { encoding: "utf8", mode: 0o600 });
  } catch {
    // If running in read-only environment, return hash of cwd
  }
  return newKey;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `enc:v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Returns plaintext directly if the value is not prefixed with enc:v1:.
 */
export function decryptSecret(ciphertext: string): string {
  if (!ciphertext) return "";
  if (!ciphertext.startsWith("enc:v1:")) {
    // Legacy plaintext string
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

    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    console.error("[Crypto] Failed to decrypt secret:", err);
    return "";
  }
}
