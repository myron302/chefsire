import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { assertInternalClosureMutationAllowed } from "./closure-feature";

/**
 * Part 3b internal tombstone primitive. THIS IS NOT THE CLOSURE ENGINE.
 *
 * It must never be exposed to an endpoint or scheduled job. The future closure
 * transaction must first lock users.id, validate live provider obligations,
 * prove every financial/retention/DM/media precondition, and erase nonfinancial
 * content under the SAME transaction. Running this alone would strand PII.
 * No caller currently imports this module.
 */
export type ClosedMemberIdentity = Readonly<{
  username: string;
  email: string;
  displayName: "Deleted user";
}>;

export function newClosedMemberIdentity(): ClosedMemberIdentity {
  // Neither public value encodes the member's stable id, old email or username.
  // 128 random bits in both namespaces also minimize unique-index collision.
  const nonce = randomBytes(16).toString("hex");
  return {
    username: `deleted-${nonce}`,
    email: `deleted+${nonce}@deleted.invalid`,
    displayName: "Deleted user",
  };
}

const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);

/**
 * Mutates ONLY the users row and account_status, and only when its caller has
 * already performed every irreversible closure gate. This has intentionally
 * no exported end-user or back-office route.
 *
 * Never store the old username/email/phone in the audit event.
 */
export async function applyClosedMemberIdentityWithinTransaction(
  tx: any,
  userId: string,
  identity: ClosedMemberIdentity,
): Promise<void> {
  assertInternalClosureMutationAllowed();
  const [member] = rowsOf(await tx.execute(sql`
    SELECT id FROM users WHERE id = ${userId} FOR UPDATE
  `));
  if (!member) throw new Error("Account cannot be closed: member not found");

  const [status] = rowsOf(await tx.execute(sql`
    SELECT status FROM account_status WHERE user_id = ${userId}
  `));
  if (status?.status === "closed") throw new Error("Account is already closed");

  const updated = rowsOf(await tx.execute(sql`
    UPDATE users
    SET username = ${identity.username},
        email = ${identity.email},
        display_name = 'Deleted user',
        phone = NULL,
        password = NULL,
        first_name = NULL,
        last_name = NULL,
        royal_title = NULL,
        show_full_name = false,
        bio = NULL,
        avatar = NULL,
        is_private = true,
        specialty = NULL,
        is_chef = false,
        catering_enabled = false,
        catering_location = NULL,
        catering_latitude = NULL,
        catering_longitude = NULL,
        catering_radius = NULL,
        catering_bio = NULL,
        catering_available = false,
        subscription_tier = 'free',
        subscription_status = 'inactive',
        subscription_ends_at = NULL,
        nutrition_premium = false,
        nutrition_trial_ends_at = NULL,
        wedding_tier = 'free',
        wedding_status = 'inactive',
        wedding_ends_at = NULL,
        vendor_tier = 'free',
        vendor_status = 'inactive',
        vendor_ends_at = NULL,
        followers_count = 0,
        following_count = 0,
        posts_count = 0,
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
        auth_version = coalesce(auth_version, 1) + 1
    WHERE id = ${userId}
    RETURNING id
  `));
  if (updated.length !== 1) throw new Error("Account tombstone failed");

  // Closed is terminal; the transaction commits status + erased user together.
  await tx.execute(sql`
    INSERT INTO account_status (user_id, status, reason, changed_by)
    VALUES (${userId}, 'closed', 'Permanent closure', NULL)
    ON CONFLICT (user_id) DO UPDATE
    SET status = 'closed', reason = 'Permanent closure', changed_by = NULL, changed_at = now()
  `);
}
