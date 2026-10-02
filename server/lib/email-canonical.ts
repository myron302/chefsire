// server/lib/email-canonical.ts
/**
 * ChefSire's single definition of "the same email address": trimmed and lower-cased.
 *
 * Stored emails are kept in this form, `users` is unique on `lower(email)`, and every lookup (signup,
 * login, resend, Google/Facebook/TikTok) goes through `storage.getUserByEmail`, which applies this rule.
 * Without one rule, `MyUser@Example.com` and `myuser@example.com` were two accounts for one mailbox.
 */
export function canonicalEmail(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}
