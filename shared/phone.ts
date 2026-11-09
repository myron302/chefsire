/**
 * Phone numbers for sign-in. Stored in E.164 ("+18605551234"); users.phone has a CHECK for that shape and a
 * unique index. Phones are NOT verified: they identify an account at login (the password is still required) and are
 * never proof of ownership for recovery, linking or other sensitive changes.
 *
 * Parsing is deliberately strict rather than "strip every non-digit": only digits, spaces, dots, dashes, parentheses
 * and one leading "+" are allowed. Default region is the US/Canada (+1):
 *   "(860) 555-1234", "860.555.1234", "1-860-555-1234"  -> "+18605551234"
 *   "+44 20 7946 0958"                                   -> "+442079460958"
 */
const ALLOWED = /^\+?[\d\s().-]+$/;

export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 32 || !ALLOWED.test(value) || value.indexOf("+") > 0) return null;
  const digits = value.replace(/\D/g, "");
  if (value.startsWith("+")) {
    // International: country code first, 8-15 digits in total (E.164).
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  // US/Canada (NANP): area code and exchange start with 2-9.
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(national) ? `+1${national}` : null;
}

/** True when a login identifier looks like a phone number rather than a username (no letters, enough digits). */
export function looksLikePhone(identifier: string): boolean {
  const value = identifier.trim();
  return ALLOWED.test(value) && value.replace(/\D/g, "").length >= 10;
}
