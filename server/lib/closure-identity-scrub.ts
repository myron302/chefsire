import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";

/**
 * Part 3b's identity scrub primitive. This is NOT a closure operation: calling
 * it alone would strand private content and financial records. It must only
 * run inside the eventual all-or-nothing closure transaction, AFTER a users
 * row FOR UPDATE lock, authorization, provider checks and retention gates.
 *
 * The user PK remains immutable for the ledger FKs. Tombstone identifiers are
 * random, never derived from the user's ID/email/name or reversible into them.
 * Profile and authentication secrets are cleared, but billing attributes and
 * monthly revenue are deliberately left untouched for retention/reconciliation.
 */
const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);

export type IdentityScrubResult = { userId: string; affected: 1; authVersion: number };

export async function scrubMemberIdentityWithinClosure(tx: any, userId: string): Promise<IdentityScrubResult> {
  const random = randomBytes(16).toString("hex");
  const anonymousName = `deleted-${random}`;
  const anonymousEmail = `deleted+${random}@deleted.invalid`;
  const rows = rowsOf(await tx.execute(sql`
    UPDATE users
    SET username = ${anonymousName},
        email = ${anonymousEmail},
        display_name = 'Deleted user',
        first_name = NULL,
        last_name = NULL,
        royal_title = NULL,
        show_full_name = false,
        phone = NULL,
        password = NULL,
        bio = NULL,
        avatar = NULL,
        is_private = true,
        specialty = NULL,
        is_chef = false,
        catering_enabled = false,
        catering_location = NULL,
        catering_latitude = NULL,
        catering_longitude = NULL,
        catering_bio = NULL,
        catering_available = false,
        daily_calorie_goal = NULL,
        macro_goals = NULL,
        dietary_restrictions = '[]'::jsonb,
        google_id = NULL,
        facebook_id = NULL,
        instagram_id = NULL,
        tiktok_id = NULL,
        provider = NULL,
        email_verified_at = NULL,
        email_verified_via = NULL,
        auth_version = auth_version + 1
    WHERE id = ${userId}
    RETURNING id, auth_version AS "authVersion"
  `));
  if (rows.length !== 1 || rows[0].id !== userId) {
    throw new Error("Identity scrub did not affect exactly one account");
  }
  const authVersion = Number(rows[0].authVersion);
  if (!Number.isSafeInteger(authVersion) || authVersion < 2) {
    throw new Error("Identity scrub did not reliably revoke sessions");
  }
  return { userId, affected: 1, authVersion };
}
