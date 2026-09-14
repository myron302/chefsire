// server/lib/admin-authority.ts
/**
 * ChefSire's admin model, in one place.
 *
 * ChefSire has no database role column: administrators are the accounts whose email address is
 * listed in `INTERNAL_ADMIN_EMAILS`. That policy is fine -- what was not fine is *which* email it
 * was applied to. `requireAdmin` compared the allowlist against `req.user.email`, and that field
 * is populated from the JWT payload. Anyone able to mint a token (before this repair, anyone at
 * all, because the signing secret had a committed fallback) could put an administrator's address
 * in the payload and be treated as an administrator, and a token issued while an address still
 * qualified kept working after the account's address changed.
 *
 * So: the token says *which account* is asking, and the database says *what that account is
 * allowed to do right now*. Admin authority is always evaluated against the current stored record.
 */
import { storage } from "../storage";

/**
 * Parse `INTERNAL_ADMIN_EMAILS` into a normalised allowlist: comma separated, trimmed,
 * empty entries dropped, compared case-insensitively (ChefSire stores and matches emails
 * case-insensitively elsewhere -- see `storage.getUserByEmail`).
 */
export function parseAdminEmailAllowlist(
  raw: string | undefined = process.env.INTERNAL_ADMIN_EMAILS,
): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/** Is this email address configured as an internal administrator? */
export function isAllowlistedAdminEmail(
  email: string | null | undefined,
  raw: string | undefined = process.env.INTERNAL_ADMIN_EMAILS,
): boolean {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalized) return false;
  return parseAdminEmailAllowlist(raw).includes(normalized);
}

/**
 * Decide whether the authenticated account currently holds admin authority.
 *
 * `userId` must be the id carried by a *verified* token. Everything else -- the email that is
 * actually checked, and whether the account still exists -- is read from the database at the
 * moment of the request. A token whose account has been deleted, or whose current stored address
 * is no longer on the allowlist, does not qualify however valid its signature is.
 *
 * Returns `false` rather than throwing if the lookup fails: an admin gate that cannot establish
 * authority must deny, not guess.
 */
export async function hasCurrentAdminAuthority(userId: string | null | undefined): Promise<boolean> {
  const id = typeof userId === "string" ? userId.trim() : "";
  if (!id) return false;

  let currentUser: { email?: string | null } | undefined;
  try {
    currentUser = await storage.getUser(id);
  } catch (error) {
    console.error("[auth] Admin authority lookup failed; denying.", error);
    return false;
  }

  // Deleted or otherwise missing account: no authority, regardless of what the token claims.
  if (!currentUser) return false;

  return isAllowlistedAdminEmail(currentUser.email);
}
