import { sql } from "drizzle-orm";
import { db } from "../db";
import { assertInternalClosureMutationAllowed } from "./closure-feature";
import { inspectLocalClosureObligations, type ClosureBlocker } from "./closure-obligations";
import { inspectClosureUserForeignKeys, closureForeignKeyInventoryClear } from "./closure-fk-inventory";
import { inspectClosureDmInventory } from "./closure-message-inventory";
import { inspectClosureStoreInventory } from "./closure-store-inventory";
import { eraseDirectMemberPrivateContentWithinClosure } from "./closure-private-content-erasure";
import { redactOrdinaryDmWithinClosure } from "./closure-message-redaction";
import { unpublishClosingSellerWithinTransaction } from "./closure-store-unpublish";
import { scrubMemberIdentityWithinClosure } from "./closure-identity-scrub";
import { writeMemberClosureAuditWithinTransaction, type ClosureActor } from "./closure-audit";

/**
 * ISOLATED TEST-ONLY closure composition, not a production API.
 *
 * This exercises atomicity and writer ordering. It deliberately cannot pass
 * the missing provider/legal/retention checks in production; the hard switch
 * prohibits invocation outside isolated PostgreSQL tests. A later audited
 * coordinator must add provider-backed reconciliation, legal holds, private
 * media ownership, full indirect data removal and staff/member step-up BEFORE
 * allowing closure requests. Do not expose this function through HTTP.
 */
export class ClosureRefusedError extends Error {
  readonly code = "CLOSURE_NOT_READY";
  constructor(message: string, readonly blockers: ClosureBlocker[] = []) { super(message); }
}
const rowsOf = (r: any): any[] => r?.rows ?? (Array.isArray(r) ? r : []);

export type ClosurePrototypeResult =
  | { changed: false; status: "closed" }
  | { changed: true; status: "closed"; privateRowsErased: number; messagesRedacted: number; productsUnpublished: number };

export async function executeIsolatedClosurePrototype(input: {
  userId: string; actor: ClosureActor;
}): Promise<ClosurePrototypeResult> {
  assertInternalClosureMutationAllowed();
  return db.transaction(async (tx: any): Promise<ClosurePrototypeResult> => {
    // Same lock as Marketplace order and payment-reservation writes; other
    // financial write paths must be retrofitted before this becomes production.
    const [user] = rowsOf(await tx.execute(sql`
      SELECT id, avatar FROM users WHERE id = ${input.userId} FOR UPDATE
    `));
    if (!user) throw new ClosureRefusedError("Account not found");
    const [status] = rowsOf(await tx.execute(sql`
      SELECT status FROM account_status WHERE user_id = ${input.userId}
    `));
    if (status?.status === "closed") return {changed:false,status:"closed"};
    const blockers = await inspectLocalClosureObligations(tx,input.userId);
    if (blockers.length) throw new ClosureRefusedError("Unresolved financial obligations",blockers);
    const foreignKeys = await inspectClosureUserForeignKeys(tx);
    if (!closureForeignKeyInventoryClear(foreignKeys)) {
      throw new ClosureRefusedError("User foreign-key dependencies require manual retention review");
    }
    const dm = await inspectClosureDmInventory(tx,input.userId);
    const storefront = await inspectClosureStoreInventory(tx,input.userId);
    // Enqueuing files without reference ownership is unsafe. Refuse rather
    // than erasing DB references and orphaning/deleting paid/shared media.
    if (user.avatar || dm.ordinaryAttachmentReferences || storefront.candidateProductImageReferences) {
      throw new ClosureRefusedError("Media references require verified outbox ownership before closure");
    }
    const erased = await eraseDirectMemberPrivateContentWithinClosure(tx,input.userId);
    const messagesRedacted = await redactOrdinaryDmWithinClosure(tx,input.userId);
    const unpublished = await unpublishClosingSellerWithinTransaction(tx,input.userId);
    await scrubMemberIdentityWithinClosure(tx,input.userId);
    await tx.execute(sql`
      INSERT INTO account_status (user_id,status,reason,changed_by)
      VALUES (${input.userId},'closed','Permanently closed',${input.userId})
      ON CONFLICT(user_id) DO UPDATE SET
        status='closed',reason='Permanently closed',changed_by=EXCLUDED.changed_by,changed_at=now()
    `);
    await writeMemberClosureAuditWithinTransaction(tx,{
      memberId:input.userId,actor:input.actor,
      counts:{ personalContentRows:erased.totalDeleted, messagesRedacted,
        productsUnpublished:unpublished.productsUnpublished, mediaCandidatesQueued:0 },
    });
    return {changed:true,status:"closed",privateRowsErased:erased.totalDeleted,
      messagesRedacted,productsUnpublished:unpublished.productsUnpublished};
  });
}
