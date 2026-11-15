import { sql } from "drizzle-orm";
import { db } from "../db";
import { inspectLocalClosureObligations, type ClosureBlocker } from "./closure-obligations";
import { inspectClosureDmInventory, type ClosureDmInventory } from "./closure-message-inventory";
import { inspectClosureStoreInventory, type ClosureStoreInventory } from "./closure-store-inventory";
import { inspectClosureUserForeignKeys } from "./closure-fk-inventory";
import { inspectClosurePrivateContent, type ClosurePrivateContentInventory } from "./closure-private-content-inventory";
import { inspectPrivateErasureCascadeRisks, type ClosureCascadeRisk } from "./closure-cascade-risks";

/**
 * Read-only staff preview for Part 3b. Not authorization to close.
 *
 * Even a completely clear local snapshot is NOT sufficient: provider-backed
 * billing/dispute checks, held legal records, live table/FK audit, third-party
 * digital entitlements, and tested cleanup are still outstanding. The feature
 * remains OFF; no preview response must ever advertise closure eligibility.
 *
 * It takes NO row lock. An earlier version held the member's users row FOR SHARE
 * across the whole pass, which conflicts with UPDATE and FOR UPDATE on that row:
 * a staff member opening a preview could stall that member's own purchases and
 * sign-in while ~20 ledger counts and a full foreign-key traversal ran. Since the
 * preview authorizes nothing, a stalled live path is a worse outcome than a
 * slightly inconsistent read.
 *
 * The figures are therefore ADVISORY and not a single atomic snapshot: under READ
 * COMMITTED each statement takes its own snapshot, so a lock would not have made
 * them coherent either. Only the real closure coordinator takes the users lock and
 * rechecks obligations under it. The pass is bounded by a statement timeout, and a
 * timeout or any other failure returns "unavailable" rather than a clear result.
 *
 * Two bounds, because they do different jobs. statement_timeout caps a SINGLE statement, so on its own it would
 * not stop twenty quick-but-not-instant queries from running far longer in total. A deadline is therefore checked
 * between steps as well. Worst case the pass lasts the budget plus one statement timeout, which is a real bound on
 * how long a connection is held. (PostgreSQL 17's transaction_timeout would do this server-side in one setting;
 * production is on 16.)
 */
const PREVIEW_STATEMENT_TIMEOUT_MS = 4000;
export const PREVIEW_TOTAL_BUDGET_MS = 8000;

class ClosurePreviewTimeout extends Error {}
export type MemberClosurePreview = {
  permanentlyDisabled: true;
  accountExists: boolean;
  status: string | null;
  localBlockers: ClosureBlocker[];
  dmInventory: ClosureDmInventory | null;
  storeInventory: ClosureStoreInventory | null;
  privateContentInventory: ClosurePrivateContentInventory | null;
  /** "local_only": advisory local figures, not a locked snapshot. "unavailable": nothing could be verified. */
  verification: "local_only" | "unavailable";
  unknownForeignKeyTables: string[];
  manualReviewForeignKeyTables: string[];
  cascadeRisks: ClosureCascadeRisk[];
  reasons: string[];
};

const rowsOf = (r: any): any[] => r?.rows ?? (Array.isArray(r) ? r : []);

export async function inspectMemberClosurePreview(
  userId: string,
  options: { budgetMs?: number } = {},
): Promise<MemberClosurePreview> {
  const budgetMs = options.budgetMs ?? PREVIEW_TOTAL_BUDGET_MS;
  const startedAt = Date.now();
  /** Stop between steps once the budget is spent, so the whole pass is bounded, not just each statement. */
  const checkDeadline = () => {
    if (Date.now() - startedAt >= budgetMs) throw new ClosurePreviewTimeout("Closure preview exceeded its time budget");
  };
  try {
    return await db.transaction(async (tx: any): Promise<MemberClosurePreview> => {
      // Caps any ONE statement. Transaction-scoped, so it cannot leak to other work on this connection.
      await tx.execute(sql`SET LOCAL statement_timeout = ${sql.raw(String(PREVIEW_STATEMENT_TIMEOUT_MS))}`);
      checkDeadline();
      // Deliberately unlocked: see the note above.
      const [member] = rowsOf(await tx.execute(sql`
        SELECT id FROM users WHERE id = ${userId}
      `));
      if (!member) return {
        permanentlyDisabled: true, accountExists: false, status: null,
        localBlockers: [], dmInventory: null, storeInventory: null,
        privateContentInventory: null,
        verification: "local_only",
        unknownForeignKeyTables: [], manualReviewForeignKeyTables: [], cascadeRisks: [],
        reasons: ["Account not found", "Permanent account closure is not enabled"],
      };
      const [statusRow] = rowsOf(await tx.execute(sql`
        SELECT status FROM account_status WHERE user_id = ${userId}
      `));
      checkDeadline();
      const localBlockers = await inspectLocalClosureObligations(tx, userId);
      checkDeadline();
      const dmInventory = await inspectClosureDmInventory(tx, userId);
      checkDeadline();
      const storeInventory = await inspectClosureStoreInventory(tx, userId);
      checkDeadline();
      const foreignKeys = await inspectClosureUserForeignKeys(tx);
      checkDeadline();
      const privateContentInventory = await inspectClosurePrivateContent(tx, userId);
      checkDeadline();
      const cascadeRisks = await inspectPrivateErasureCascadeRisks(tx);
      return {
        permanentlyDisabled: true, accountExists: true,
        status: statusRow?.status ?? "active",
        localBlockers, dmInventory, storeInventory, privateContentInventory,
        verification: "local_only",
        unknownForeignKeyTables: foreignKeys.unknownTables,
        manualReviewForeignKeyTables: foreignKeys.manualReviewTables,
        cascadeRisks,
        reasons: [
          ...foreignKeys.unknownTables.map(t => `Unclassified account dependency: ${t}`),
          ...foreignKeys.manualReviewTables.map(t => `Manual retention review required: ${t}`),
          ...(cascadeRisks.length ? [`${cascadeRisks.length} indirect private-content dependencies require retention review`] : []),
          "Permanent account closure is disabled",
          "Provider subscription/payment/refund/dispute records are not yet independently reconciled",
          "Legal retention and media cleanup sign-off are not complete",
        ],
      };
    });
  } catch (error) {
    // Never turn a schema failure, missing table, slow pass or provider issue into a
    // positive preview. Do not reflect private SQL error details to staff. Running out
    // of time says so, so staff can retry rather than read it as a broken account.
    const timedOut = error instanceof ClosurePreviewTimeout;
    return {
      permanentlyDisabled: true, accountExists: true, status: null,
      localBlockers: [], dmInventory: null, storeInventory: null,
      privateContentInventory: null,
      verification: "unavailable",
      unknownForeignKeyTables: [], manualReviewForeignKeyTables: [], cascadeRisks: [],
      reasons: [timedOut
        ? "Closure eligibility check timed out; no account data was changed"
        : "Closure eligibility cannot be verified; no account data was changed"],
    };
  }
}
