// server/lib/email-verification-provenance.ts
/**
 * Where an account's `emailVerifiedAt` came from (`users.email_verified_via`).
 *
 * A bare timestamp is not proof of ownership: Facebook and TikTok historically stamped it without
 * their email being authoritative, and the signup flow once left attacker-chosen credentials in place.
 * Only these sources are proof that the account holder controls the address.
 */
export const EMAIL_VERIFIED_VIA_LINK = "email_link";
export const EMAIL_VERIFIED_VIA_GOOGLE = "google";

const AUTHORITATIVE = new Set<string>([EMAIL_VERIFIED_VIA_LINK, EMAIL_VERIFIED_VIA_GOOGLE]);

export function isEmailAuthoritativelyVerified(
  user: { emailVerifiedAt?: Date | string | null; emailVerifiedVia?: string | null } | null | undefined,
): boolean {
  return Boolean(user?.emailVerifiedAt) && typeof user?.emailVerifiedVia === "string" && AUTHORITATIVE.has(user.emailVerifiedVia);
}
