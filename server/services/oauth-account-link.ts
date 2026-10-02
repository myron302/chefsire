// server/services/oauth-account-link.ts
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { emailVerificationTokens, users } from "../../shared/schema";
import { disconnectUserSockets } from "../realtime/socket-auth";
import { EMAIL_VERIFIED_VIA_GOOGLE } from "../lib/email-verification-provenance";

/**
 * Linking an OAuth identity to an existing ChefSire account that matches by email (P2-1).
 *
 * Two rules, both fail-closed:
 *
 * 1. Only a provider that authoritatively vouches for the email may link by email. Google reports
 *    `email_verified`; Facebook and TikTok do not, so they never link to (or take over) an
 *    existing account by email and never mint a verified account from an email they cannot vouch for.
 *
 * 2. Linking proves the *provider user* owns the address. It says nothing about who set the
 *    credentials already on a still-unverified account -- that was whoever called `POST /auth/signup`
 *    (or created the account through another provider) without proving ownership. So one atomic
 *    UPDATE verifies the account and, if it was unverified, discards every pre-verification
 *    credential in the same statement: the password hash and any other provider identity.
 *    An already-verified account keeps its password: its owner proved ownership earlier.
 */

type GoogleLikeProfile = {
  emails?: Array<{ value?: string; verified?: boolean | string }>;
  _json?: { email_verified?: boolean | string } | null;
};

const isTrue = (v: unknown) => v === true || v === "true";

/** Google asserts `email_verified` per address; anything but an explicit true is "not verified". */
export function googleProfileEmailIsVerified(profile: GoogleLikeProfile): boolean {
  const first = profile.emails?.[0];
  if (!first?.value) return false;
  if (first.verified !== undefined) return isTrue(first.verified);
  return isTrue(profile._json?.email_verified);
}

export type LinkableProvider = { idColumn: "googleId"; provider: "google"; providerId: string };

export async function linkVerifiedProviderIdentity(
  userId: string,
  link: LinkableProvider,
  avatar: string,
) {
  const now = new Date();
  // "Unverified" means not *authoritatively* verified: a legacy timestamp with no provenance counts.
  const unverified = sql`${users.emailVerifiedVia} IS NULL`;
  const [updated] = await db
    .update(users)
    .set({
      [link.idColumn]: link.providerId,
      provider: link.provider,
      emailVerifiedAt: sql`COALESCE(${users.emailVerifiedAt}, ${now})`,
      emailVerifiedVia: sql`COALESCE(${users.emailVerifiedVia}, ${EMAIL_VERIFIED_VIA_GOOGLE})`,
      // Unverified account: the password and every other provider identity were set by someone who
      // had not proven the address. Verified account: left exactly as it was.
      // Credentials were reclaimed: invalidate every token issued before now, in the same statement.
      authVersion: sql`CASE WHEN ${unverified} THEN ${users.authVersion} + 1 ELSE ${users.authVersion} END`,
      password: sql`CASE WHEN ${unverified} THEN NULL ELSE ${users.password} END`,
      facebookId: sql`CASE WHEN ${unverified} THEN NULL ELSE ${users.facebookId} END`,
      tiktokId: sql`CASE WHEN ${unverified} THEN NULL ELSE ${users.tiktokId} END`,
      instagramId: sql`CASE WHEN ${unverified} THEN NULL ELSE ${users.instagramId} END`,
      avatar: sql`CASE WHEN ${unverified} THEN COALESCE(NULLIF(${avatar}, ''), ${users.avatar})
                       ELSE COALESCE(NULLIF(${users.avatar}, ''), ${avatar}) END`,
    })
    .where(
      and(
        eq(users.id, userId),
        // Never silently re-point an account already bound to a different Google identity.
        or(isNull(users.googleId), eq(users.googleId, link.providerId)),
      ),
    )
    .returning();

  if (updated) {
    disconnectUserSockets(userId);
    // Any link still in flight was issued before the account was proven; it must not outlive this.
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
  }
  return updated;
}
