import { sql } from "drizzle-orm";
import { assertInternalClosureMutationAllowed } from "./closure-feature";

/** Minimal, PII-free closure audit. Must be in the SAME transaction as closure. */
export type ClosureActor =
  | { kind: "member"; memberId: string }
  | { kind: "staff"; staffId: string; reason: string };

export type ClosureAuditCounts = {
  personalContentRows: number;
  messagesRedacted: number;
  productsUnpublished: number;
  mediaCandidatesQueued: number;
};

export function validateClosureAudit(input: {
  memberId: string;
  actor: ClosureActor;
  counts: ClosureAuditCounts;
}): void {
  if (!input.memberId) throw new Error("Missing member target");
  if (input.actor.kind === "member") {
    if (!input.actor.memberId || input.actor.memberId !== input.memberId)
      throw new Error("Member may only close own account");
  } else {
    if (!input.actor.staffId || input.actor.reason.trim().length < 3 || input.actor.reason.length > 500)
      throw new Error("Staff closure must carry a recorded reason");
  }
  for (const count of Object.values(input.counts)) {
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid closure audit count");
  }
}

/**
 * The audit stores only counts and opaque IDs, not the old name, email, phone,
 * message text, attachment URLs or any previous login identity.
 * Staff permission/step-up/owner protection must be verified outside this
 * helper under the closure transaction's account-row lock.
 */
export async function writeMemberClosureAuditWithinTransaction(
  tx: any,
  input: { memberId: string; actor: ClosureActor; counts: ClosureAuditCounts },
): Promise<void> {
  assertInternalClosureMutationAllowed();
  validateClosureAudit(input);
  const reason = input.actor.kind === "staff" ? input.actor.reason.trim() : "Requested by member";
  const details = JSON.stringify({ ...input.counts, actorKind: input.actor.kind });
  if (input.actor.kind === "staff") {
    await tx.execute(sql`
      INSERT INTO admin_audit_log
        (actor_type, actor_id, actor_label, action, target_type, target_id, reason, details)
      VALUES ('staff', ${input.actor.staffId},
        (SELECT display_name || ' (' || login || ')' FROM staff_users WHERE id = ${input.actor.staffId}),
        'member.closed', 'user', ${input.memberId}, ${reason}, ${details}::jsonb)
    `);
  } else {
    await tx.execute(sql`
      INSERT INTO admin_audit_log
        (actor_type, actor_id, actor_label, action, target_type, target_id, reason, details)
      VALUES ('member', ${input.memberId}, 'Deleted user',
        'member.closed', 'user', ${input.memberId}, ${reason}, ${details}::jsonb)
    `);
  }
}
