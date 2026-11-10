import { sql } from "drizzle-orm";
import { db } from "../db";
import { inspectLocalClosureObligations, type ClosureBlocker } from "./closure-obligations";
import { inspectClosureDmInventory, type ClosureDmInventory } from "./closure-message-inventory";
import { inspectClosureStoreInventory, type ClosureStoreInventory } from "./closure-store-inventory";
import { inspectClosureUserForeignKeys } from "./closure-fk-inventory";
import { inspectClosurePrivateContent, type ClosurePrivateContentInventory } from "./closure-private-content-inventory";

/**
 * Read-only staff preview for Part 3b. Not authorization to close.
 *
 * Even a completely clear local snapshot is NOT sufficient: provider-backed
 * billing/dispute checks, held legal records, live table/FK audit, third-party
 * digital entitlements, and tested cleanup are still outstanding. The feature
 * remains OFF; no preview response must ever advertise closure eligibility.
 */
export type MemberClosurePreview = {
  permanentlyDisabled: true;
  accountExists: boolean;
  status: string | null;
  localBlockers: ClosureBlocker[];
  dmInventory: ClosureDmInventory | null;
  storeInventory: ClosureStoreInventory | null;
  privateContentInventory: ClosurePrivateContentInventory | null;
  verification: "local_only" | "unavailable";
  unknownForeignKeyTables: string[];
  manualReviewForeignKeyTables: string[];
  reasons: string[];
};

const rowsOf = (r: any): any[] => r?.rows ?? (Array.isArray(r) ? r : []);

export async function inspectMemberClosurePreview(userId: string): Promise<MemberClosurePreview> {
  try {
    return await db.transaction(async (tx: any): Promise<MemberClosurePreview> => {
      // Locks to give one coherent local view with write paths that participate
      // in closure row locking. No persisted changes in this transaction.
      const [member] = rowsOf(await tx.execute(sql`
        SELECT id FROM users WHERE id = ${userId} FOR SHARE
      `));
      if (!member) return {
        permanentlyDisabled: true, accountExists: false, status: null,
        localBlockers: [], dmInventory: null, storeInventory: null,
      privateContentInventory: null,
        privateContentInventory: null,
        verification: "local_only",
        unknownForeignKeyTables: [], manualReviewForeignKeyTables: [],
        reasons: ["Account not found", "Permanent account closure is not enabled"],
      };
      const [statusRow] = rowsOf(await tx.execute(sql`
        SELECT status FROM account_status WHERE user_id = ${userId}
      `));
      const localBlockers = await inspectLocalClosureObligations(tx, userId);
      const dmInventory = await inspectClosureDmInventory(tx, userId);
      const storeInventory = await inspectClosureStoreInventory(tx, userId);
      const foreignKeys = await inspectClosureUserForeignKeys(tx);
      const privateContentInventory = await inspectClosurePrivateContent(tx, userId);
      return {
        permanentlyDisabled: true, accountExists: true,
        status: statusRow?.status ?? "active",
        localBlockers, dmInventory, storeInventory, privateContentInventory,
        verification: "local_only",
        unknownForeignKeyTables: foreignKeys.unknownTables,
        manualReviewForeignKeyTables: foreignKeys.manualReviewTables,
        reasons: [
          ...foreignKeys.unknownTables.map(t => `Unclassified account dependency: ${t}`),
          ...foreignKeys.manualReviewTables.map(t => `Manual retention review required: ${t}`),
          "Permanent account closure is disabled",
          "Provider subscription/payment/refund/dispute records are not yet independently reconciled",
          "Legal retention and media cleanup sign-off are not complete",
        ],
      };
    });
  } catch {
    // Never turn a schema failure, missing table or provider issue into a
    // positive preview. Do not reflect private SQL error details to staff.
    return {
      permanentlyDisabled: true, accountExists: true, status: null,
      localBlockers: [], dmInventory: null, storeInventory: null,
      verification: "unavailable",
      unknownForeignKeyTables: [], manualReviewForeignKeyTables: [],
      reasons: ["Closure eligibility cannot be verified; no account data was changed"],
    };
  }
}
