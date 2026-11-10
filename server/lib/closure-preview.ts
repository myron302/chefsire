import { sql } from "drizzle-orm";
import { db } from "../db";
import { inspectLocalClosureObligations, type ClosureBlocker } from "./closure-obligations";
import { inspectClosureDmInventory, type ClosureDmInventory } from "./closure-message-inventory";
import { inspectClosureStoreInventory, type ClosureStoreInventory } from "./closure-store-inventory";

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
  verification: "local_only" | "unavailable";
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
        verification: "local_only",
        reasons: ["Account not found", "Permanent account closure is not enabled"],
      };
      const [statusRow] = rowsOf(await tx.execute(sql`
        SELECT status FROM account_status WHERE user_id = ${userId}
      `));
      const localBlockers = await inspectLocalClosureObligations(tx, userId);
      const dmInventory = await inspectClosureDmInventory(tx, userId);
      const storeInventory = await inspectClosureStoreInventory(tx, userId);
      return {
        permanentlyDisabled: true, accountExists: true,
        status: statusRow?.status ?? "active",
        localBlockers, dmInventory, storeInventory,
        verification: "local_only",
        reasons: [
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
      reasons: ["Closure eligibility cannot be verified; no account data was changed"],
    };
  }
}
