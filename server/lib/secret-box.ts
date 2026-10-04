import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Authenticated encryption for secrets that must be recoverable by the server (OAuth access/refresh tokens).
 *
 * Algorithm: AES-256-GCM with a fresh random 96-bit nonce per value and the 128-bit authentication tag.
 *
 * Wire format (single ASCII string, safe for a text column):
 *
 *     sqenc:v1:<keyId>:<iv>:<ciphertext>:<tag>
 *
 *   - `v1`      the format/algorithm version, so a later algorithm can be introduced without ambiguity.
 *   - `keyId`   the first 8 hex chars of SHA-256 over the key, so a ciphertext names the key that sealed it and
 *               key rotation can be done by adding a new key while the old one stays available to decrypt.
 *   - the rest  unpadded base64url of the nonce, ciphertext and tag.
 *
 * The caller supplies ASSOCIATED DATA (`aad`). It is authenticated but not stored, so a ciphertext copied to a
 * different row or column fails to open. Every decrypt failure -- wrong key, wrong aad, truncated or altered text,
 * unknown version -- is the same `SecretBoxError`, which never carries plaintext, key material or ciphertext.
 *
 * KEY FORMAT. `SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY` is exactly 32 random bytes encoded as base64 or base64url
 * (43 characters unpadded, or 44 with `=`). Generate one with:  openssl rand -base64 32
 * An optional `SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY_PREVIOUS` is accepted for decryption only, which is what allows a
 * rotation: set the new key as current, keep the old one as previous, re-encrypt, then drop the previous.
 *
 * There is deliberately NO plaintext fallback anywhere in this module.
 */

export const SECRET_BOX_KEY_ENV = "SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY";
export const SECRET_BOX_PREVIOUS_KEY_ENV = "SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY_PREVIOUS";

const PREFIX = "sqenc";
const VERSION = "v1";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SEGMENT = /^[A-Za-z0-9_-]+$/;

export type SecretBoxErrorCode = "KEY_MISSING" | "KEY_INVALID" | "CIPHERTEXT_INVALID" | "PLAINTEXT_INVALID";

/** A message that is safe to log: it never includes a secret, a key or any part of a ciphertext. */
export class SecretBoxError extends Error {
  constructor(readonly code: SecretBoxErrorCode, message: string) {
    super(message);
    this.name = "SecretBoxError";
  }
}

type Key = { id: string; bytes: Buffer };

function keyIdOf(bytes: Buffer): string {
  return createHash("sha256").update("sqenc-key-id:").update(bytes).digest("hex").slice(0, 8);
}

function parseKey(raw: string | undefined, envName: string, required: boolean): Key | null {
  const value = raw?.trim();
  if (!value) {
    if (required) throw new SecretBoxError("KEY_MISSING", `${envName} is not configured.`);
    return null;
  }
  if (!/^(?:[A-Za-z0-9_-]{43}|[A-Za-z0-9+/]{43}=)$/.test(value)) {
    throw new SecretBoxError("KEY_INVALID", `${envName} must be 32 random bytes encoded as base64 (43 or 44 characters).`);
  }
  const bytes = Buffer.from(value, "base64");
  // Node's decoder is lenient; a canonical round trip is what proves the encoding really was 32 bytes.
  const canonical = bytes.toString("base64url");
  if (bytes.length !== KEY_BYTES || canonical !== value.replace(/=$/, "").replace(/\+/g, "-").replace(/\//g, "_")) {
    throw new SecretBoxError("KEY_INVALID", `${envName} must be 32 random bytes encoded as base64 (43 or 44 characters).`);
  }
  if (bytes.every((byte) => byte === bytes[0])) {
    throw new SecretBoxError("KEY_INVALID", `${envName} must not be a constant-byte value.`);
  }
  return { id: keyIdOf(bytes), bytes };
}

function currentKey(): Key {
  return parseKey(process.env[SECRET_BOX_KEY_ENV], SECRET_BOX_KEY_ENV, true)!;
}

function keyring(): Map<string, Key> {
  const ring = new Map<string, Key>();
  const current = currentKey();
  ring.set(current.id, current);
  const previous = parseKey(process.env[SECRET_BOX_PREVIOUS_KEY_ENV], SECRET_BOX_PREVIOUS_KEY_ENV, false);
  if (previous) ring.set(previous.id, previous);
  return ring;
}

/** Whether the current key is present and well-formed. Never throws and never reveals why it is not. */
export function isSecretBoxConfigured(): boolean {
  try {
    keyring();
    return true;
  } catch {
    return false;
  }
}

/** Throws a `SecretBoxError` unless encryption is fully configured. Call before accepting any secret. */
export function assertSecretBoxConfigured(): void {
  keyring();
}

export function isSealedSecret(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(`${PREFIX}:`);
}

export function encryptSecret(plaintext: string, aad: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new SecretBoxError("PLAINTEXT_INVALID", "A non-empty secret is required.");
  }
  const key = currentKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key.bytes, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, VERSION, key.id, iv.toString("base64url"), ciphertext.toString("base64url"), tag.toString("base64url")].join(":");
}

export function decryptSecret(sealed: string, aad: string): string {
  const fail = (): never => {
    throw new SecretBoxError("CIPHERTEXT_INVALID", "The stored secret could not be decrypted.");
  };
  if (typeof sealed !== "string") return fail();
  const parts = sealed.split(":");
  if (parts.length !== 6 || parts[0] !== PREFIX || parts[1] !== VERSION) return fail();
  const [, , keyId, ivText, ciphertextText, tagText] = parts;
  if (![keyId, ivText, ciphertextText, tagText].every((segment) => SEGMENT.test(segment))) return fail();
  // A missing or malformed key is a configuration fault, reported as such rather than as a bad ciphertext.
  const key = keyring().get(keyId);
  if (!key) return fail();
  const iv = Buffer.from(ivText, "base64url");
  const tag = Buffer.from(tagText, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return fail();
  try {
    const decipher = createDecipheriv("aes-256-gcm", key.bytes, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return fail();
  }
}

/** True when a sealed value was written under a key other than the current one, so a rotation should re-seal it. */
export function sealedSecretNeedsRotation(sealed: string): boolean {
  const parts = typeof sealed === "string" ? sealed.split(":") : [];
  return parts.length === 6 && parts[2] !== currentKey().id;
}
