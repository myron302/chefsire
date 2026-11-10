import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Cryptography for the staff portal: authenticator codes (TOTP, RFC 6238), encryption of the authenticator secrets
 * at rest, and random tokens stored only as hashes.
 *
 * STAFF_SECRET_KEY (at least 32 characters) encrypts authenticator secrets. Without it the portal refuses to sign
 * anyone in (fail closed) rather than storing secrets unencrypted.
 */
export class StaffPortalConfigError extends Error {}

function secretKey(): Buffer {
  const raw = process.env.STAFF_SECRET_KEY ?? "";
  if (raw.length < 32) throw new StaffPortalConfigError("STAFF_SECRET_KEY is not configured");
  return createHash("sha256").update(`chefsire-staff-portal:${raw}`).digest();
}

export function staffPortalConfigured(): boolean {
  try {
    secretKey();
    return true;
  } catch {
    return false;
  }
}

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unreadable secret");
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

// ---- TOTP (RFC 6238: SHA-1, 6 digits, 30-second steps), compatible with Microsoft/Google Authenticator, Authy, 1Password.
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const TOTP_STEP_SECONDS = 30;
export const newTotpSecret = () => base32Encode(randomBytes(20));
export const totpStep = (atMs = Date.now()) => Math.floor(atMs / 1000 / TOTP_STEP_SECONDS);

export function totpCode(secretBase32: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secretBase32)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

/**
 * Checks a code against the current step and one step either side (clock drift). Returns the matched step, or null.
 * Callers refuse a step at or before the last one accepted, so a code can't be replayed.
 */
export function verifyTotp(secretBase32: string, code: string, atMs = Date.now()): number | null {
  const clean = String(code ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const now = totpStep(atMs);
  for (const step of [now - 1, now, now + 1]) {
    const expected = Buffer.from(totpCode(secretBase32, step));
    if (timingSafeEqual(expected, Buffer.from(clean))) return step;
  }
  return null;
}

export function otpauthUri(secretBase32: string, account: string, issuer = "ChefSire Staff"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_STEP_SECONDS}`;
}

/** Ten one-time recovery codes like "k7qd-2m9x-p4ta". */
export function newRecoveryCodes(count = 10): string[] {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(12);
    const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
  });
}
export const normalizeRecoveryCode = (code: string) => String(code ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
