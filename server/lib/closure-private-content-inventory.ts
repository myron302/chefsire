import { sql } from "drizzle-orm";
import { CLOSURE_FK_CLASSES } from "./closure-fk-inventory";

/**
 * READ-ONLY candidate count for directly user-owned private rows.
 * Counts come from the live FK catalog rather than guessed column names:
 * follows has follower_id + following_id, e.g., not a user_id column.
 *
 * This never authorizes deletes: indirect references and retained-party data
 * require separate FK, legal and media reviews. A schema/catalog failure
 * bubbles up and the closure preview fails closed.
 */
const erasePrivate = new Set<string>(CLOSURE_FK_CLASSES.erase_private);
const rowsOf = (r: any): any[] => r?.rows ?? (Array.isArray(r) ? r : []);

export type ClosurePrivateTableCount = { table: string; candidateRows: number };
export type ClosurePrivateContentInventory = {
  tables: ClosurePrivateTableCount[];
  totalCandidates: number;
};

const validIdentifier = /^[a-z_][a-z0-9_]*$/;

export async function inspectClosurePrivateContent(
  tx: any,
  userId: string,
): Promise<ClosurePrivateContentInventory> {
  const columns = rowsOf(await tx.execute(sql`
    SELECT child.relname AS "table", attr.attname AS "column"
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = child.relnamespace
    JOIN LATERAL unnest(con.conkey) AS key(attnum) ON true
    JOIN pg_attribute attr ON attr.attrelid = child.oid AND attr.attnum = key.attnum
    WHERE con.contype = 'f' AND con.confrelid = 'public.users'::regclass
      AND ns.nspname = 'public'
    ORDER BY child.relname, attr.attname
  `));
  const byTable = new Map<string, string[]>();
  for (const item of columns) {
    const table = String(item.table);
    if (!erasePrivate.has(table)) continue;
    const column = String(item.column);
    if (!validIdentifier.test(table) || !validIdentifier.test(column)) {
      throw new Error("Unreviewed user foreign-key identifier");
    }
    const existing = byTable.get(table) ?? [];
    if (!existing.includes(column)) existing.push(column);
    byTable.set(table, existing);
  }
  const tables: ClosurePrivateTableCount[] = [];
  for (const [table, userColumns] of [...byTable.entries()].sort((a,b)=>a[0].localeCompare(b[0]))) {
    const predicate = sql.join(userColumns.map((column) =>
      sql`${sql.raw('"' + column + '"')} = ${userId}`
    ), sql` OR `);
    const [row] = rowsOf(await tx.execute(sql`
      SELECT count(*)::int AS n FROM ${sql.raw('public."' + table + '"')}
      WHERE (${predicate})
    `));
    const count = Number(row?.n ?? NaN);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("Unverifiable private content row count");
    tables.push({ table, candidateRows: count });
  }
  return { tables, totalCandidates: tables.reduce((acc, value) => acc + value.candidateRows, 0) };
}
