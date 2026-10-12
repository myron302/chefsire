/**
 * Database protections that are NOT declared in the Drizzle schema because Drizzle cannot represent them (CHECK ... NOT VALID, partial and
 * conditional unique indexes) and are installed by the reviewed enforcement migrations instead. `drizzle-kit push` sees them as drift and plans
 * to drop them. The old design tolerated that drop because a script would restore them AFTER the push committed -- a window in which a financial
 * protection does not exist, and which never closes if the process dies or the script fails.
 *
 * Now: such a protection is never dropped by a push. If the plan drops one whose live definition is exactly the required one, the drop is removed
 * from the plan (the end state is the one wanted); if the live definition differs, or the object is one for which no required definition is
 * known, the push is refused outright (not acknowledgeable). And before COMMIT the apply transaction proves that every protection that existed
 * when it began is still there with an identical definition; otherwise it rolls back. No commit boundary ever separates removal from restoration.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { constraintFactKey, indexFactKey } from "./schema-push-plan";
import type { QueryClient } from "./schema-push-apply";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The sources of the enforcement DDL: the migrations the post-push scripts replay, and the scripts that carry their own DDL. */
const ENFORCEMENT_SOURCES = [
  "migrations/20260919_payout_integrity.sql",
  "migrations/20260920_marketplace_payment_fulfillment.sql",
  "migrations/20260922_atomic_marketplace_checkout.sql",
  "migrations/20260928_meal_plan_payment_fail_closed.sql",
  "scripts/enforce-marketplace-revenue-integrity.ts",
  "scripts/meal-plan-payment-enforcement.ts",
];

function matches(pattern: RegExp, text: string): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) out.push(match);
  return out;
}

export type ProtectedObjects = {
  /** `constraintFactKey(schema, table, name)` of every protected constraint (CHECK / UNIQUE the enforcement migrations install). */
  constraints: string[];
  /** `indexFactKey(schema, name)` of every protected index. */
  indexes: string[];
  /** Names only (the enforcement DDL does not always qualify tables), used for the snapshot queries. */
  constraintNames: string[];
  indexNames: string[];
};

/**
 * The protected object names, DERIVED from the enforcement DDL itself (no second list to forget to update): every `ADD CONSTRAINT <name>` and
 * `CREATE [UNIQUE] INDEX [IF NOT EXISTS] <name>` in the enforcement sources. The table of a constraint comes from the preceding `ALTER TABLE`.
 */
export function protectedObjects(readSource: (relative: string) => string = (relative) => readFileSync(path.join(root, relative), "utf8")): ProtectedObjects {
  const constraints = new Set<string>();
  const indexes = new Set<string>();
  const constraintNames = new Set<string>();
  const indexNames = new Set<string>();
  for (const relative of ENFORCEMENT_SOURCES) {
    const text = readSource(relative).replace(/--[^\n]*/g, "");
    for (const match of matches(/ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s+ADD\s+CONSTRAINT\s+"?([a-z_][a-z0-9_]*)"?/gi, text)) {
      constraints.add(constraintFactKey("public", match[1].toLowerCase(), match[2].toLowerCase()));
      constraintNames.add(match[2].toLowerCase());
    }
    for (const match of matches(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z_][a-z0-9_]*)"?/gi, text)) {
      indexes.add(indexFactKey("public", match[1].toLowerCase()));
      indexNames.add(match[1].toLowerCase());
    }
  }
  const sorted = (set: Set<string>) => Array.from(set).sort();
  return { constraints: sorted(constraints), indexes: sorted(indexes), constraintNames: sorted(constraintNames), indexNames: sorted(indexNames) };
}

/* ------------------------------------------------ the one protection a push is allowed to see as "drift" ------------------------------------------------ */

export const PAYOUT_CHECK = { schema: "public", table: "payouts", name: "payouts_completed_transfer_check" } as const;

/** The CHECK expression of `payouts_completed_transfer_check` exactly as the reviewed migration installs it. */
export function payoutCheckExpression(migrationSql: string = readFileSync(path.join(root, "migrations/20260919_payout_integrity.sql"), "utf8")): string {
  const text = migrationSql.replace(/--[^\n]*/g, "");
  const marker = /ADD\s+CONSTRAINT\s+payouts_completed_transfer_check\s+CHECK\s*\(/i.exec(text);
  if (!marker) throw new Error("The payout CHECK definition was not found in the enforcement migration.");
  let depth = 1;
  let quote = false;
  const start = marker.index + marker[0].length;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (char === "'") quote = !quote;
    if (quote) continue;
    if (char === "(") depth += 1;
    if (char === ")") { depth -= 1; if (depth === 0) return text.slice(start, i); }
  }
  throw new Error("The payout CHECK definition in the enforcement migration is unbalanced.");
}

const withoutNotValid = (definition: string) => definition.replace(/\s+NOT VALID\s*$/i, "").trim();

/**
 * PostgreSQL's own rendering of the REQUIRED payout CHECK, produced by attaching the migration's expression to a throw-away copy of the table's
 * columns (temp table, rolled-back transaction), so that it can be compared with the live constraint in the same spelling. Null if it cannot be built.
 */
export async function renderRequiredPayoutCheck(client: QueryClient): Promise<string | null> {
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("CREATE TEMP TABLE chefsire_required_payouts (LIKE public.payouts) ON COMMIT DROP");
    await client.query(`ALTER TABLE pg_temp.chefsire_required_payouts ADD CONSTRAINT payouts_completed_transfer_check CHECK (${payoutCheckExpression()}) NOT VALID`);
    const { rows } = await client.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'pg_temp.chefsire_required_payouts'::regclass AND conname = 'payouts_completed_transfer_check'");
    return rows.length === 1 ? withoutNotValid(String(rows[0].definition)) : null;
  } catch {
    return null;
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
  }
}

export type PreservationResult = { toApply: string[]; preserved: string[]; mismatched: string[] };

/**
 * Removes from the plan the drop of the payout CHECK when the live constraint IS the required one (so it is simply kept, never absent), and reports
 * a drop whose live definition is anything else (`mismatched`): that one must not run and is refused by the caller. Fails closed: if the live or
 * the required definition cannot be established, the drop is reported as mismatched.
 */
export async function preserveRequiredPayoutCheck(client: QueryClient, statements: readonly string[], isPayoutCheckDrop: (statement: string) => boolean): Promise<PreservationResult> {
  const toApply: string[] = [];
  const preserved: string[] = [];
  const mismatched: string[] = [];
  let required: string | null | undefined;
  for (const statement of statements) {
    if (!isPayoutCheckDrop(statement)) { toApply.push(statement); continue; }
    const { rows } = await client.query(
      "SELECT pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = $1 AND t.relname = $2 AND c.conname = $3 AND c.contype = 'c'",
      [PAYOUT_CHECK.schema, PAYOUT_CHECK.table, PAYOUT_CHECK.name]);
    if (required === undefined) required = await renderRequiredPayoutCheck(client);
    if (rows.length === 1 && required !== null && withoutNotValid(String(rows[0].definition)) === required) preserved.push(statement);
    else { mismatched.push(statement); toApply.push(statement); } // stays in the plan, where the classifier refuses it
  }
  return { toApply, preserved, mismatched };
}

/* ------------------------------------------------ the commit-time guarantee ------------------------------------------------ */

/** name -> definition of every protected constraint and index that exists right now (NOT VALID is ignored: validation is not removal). */
export async function protectedSnapshot(client: QueryClient, objects: ProtectedObjects): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  if (objects.constraintNames.length > 0) {
    const { rows } = await client.query(
      "SELECT n.nspname AS schema, t.relname AS tbl, c.conname AS name, pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE c.conname = ANY($1::text[])",
      [objects.constraintNames]);
    for (const row of rows) snapshot[`constraint:${constraintFactKey(row.schema, row.tbl, row.name)}`] = withoutNotValid(String(row.definition));
  }
  if (objects.indexNames.length > 0) {
    const { rows } = await client.query("SELECT schemaname AS schema, indexname AS name, indexdef AS definition FROM pg_indexes WHERE indexname = ANY($1::text[])", [objects.indexNames]);
    for (const row of rows) snapshot[`index:${indexFactKey(row.schema, row.name)}`] = String(row.definition);
  }
  return snapshot;
}

/** Throws unless every protection in `before` still exists, with an identical definition, in `after`. */
export function assertProtectionsIntact(before: Record<string, string>, after: Record<string, string>): void {
  const lost = Object.keys(before).filter((key) => after[key] === undefined);
  const changed = Object.keys(before).filter((key) => after[key] !== undefined && after[key] !== before[key]);
  if (lost.length === 0 && changed.length === 0) return;
  const describe = (keys: string[]) => keys.map((key) => key.replace(/^(constraint|index):/, "")).join(", ");
  throw new ProtectionLostError(`The plan would ${lost.length ? `remove ${describe(lost)}` : ""}${lost.length && changed.length ? " and " : ""}${changed.length ? `change ${describe(changed)}` : ""}, which are protections installed by the reviewed enforcement migrations. Nothing was applied.`);
}

export class ProtectionLostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtectionLostError";
  }
}
