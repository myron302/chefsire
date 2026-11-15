import { sql } from "drizzle-orm";
import { assertInternalClosureMutationAllowed } from "./closure-feature";
import { CLOSURE_FK_CLASSES } from "./closure-fk-inventory";
import { inspectPrivateErasureCascadeRisks } from "./closure-cascade-risks";

/**
 * Closed-account private-content erasure is not exposed to production routes.
 * Only rows with a reviewed direct users.id foreign key may be erased. Before
 * touching anything it refuses downstream FKs into retained/shared/unknown data.
 * It NEVER deletes a user or financial ledger record. The transaction caller
 * must already hold the users-row lock and validate external obligations.
 */
export class ClosureContentDependencyError extends Error {
  readonly code = "CLOSURE_CONTENT_DEPENDENCY_REVIEW_REQUIRED";
  constructor(message: string) { super(message); }
}
const validIdentifier = /^[a-z_][a-z0-9_]*$/;
const privateNames = new Set<string>(CLOSURE_FK_CLASSES.erase_private);
const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);
export type ClosureContentEraseResult = { counts: { table: string; deleted: number }[]; totalDeleted: number };

/**
 * Child-before-parent ordering so NO ACTION and RESTRICT do not depend on accidental cascades.
 *
 * A self-referencing foreign key (a row in the table pointing at another row in the SAME table) is NOT something
 * table ordering can solve: within one table the rows still have to go in dependency order, and a parent row the
 * member does not own can point at a child row they do. Callers therefore refuse those tables outright, and this
 * function ignores the self-edge only because it has already been rejected. A cycle between two different tables
 * is unorderable and raises, before anything is deleted.
 */
function deletionOrder(tables: string[], edges: { child: string; parent: string }[]): string[] {
  const remaining = new Set(tables);
  const result: string[] = [];
  while (remaining.size) {
    const ready = Array.from(remaining).filter(table => !edges.some(e =>
      e.parent === table && remaining.has(e.child) && e.child !== table
    )).sort();
    if (!ready.length) throw new ClosureContentDependencyError("Private-content foreign-key cycle requires manual review");
    for (const table of ready) { result.push(table); remaining.delete(table); }
  }
  return result;
}

/** Candidate tables whose rows can reference each other. Row-level order is not reviewed, so refuse them. */
function assertNoSelfReferences(tables: Set<string>, edges: { child: string; parent: string }[]): void {
  const selfReferencing = Array.from(tables).filter(t => edges.some(e => e.child === t && e.parent === t)).sort();
  if (selfReferencing.length) {
    throw new ClosureContentDependencyError(
      `Private-content tables reference themselves and need reviewed row-level ordering; no rows deleted: ${selfReferencing.join(", ")}`
    );
  }
}

export async function eraseDirectMemberPrivateContentWithinClosure(
  tx: any,
  memberId: string,
): Promise<ClosureContentEraseResult> {
  assertInternalClosureMutationAllowed();
  if (!memberId) throw new ClosureContentDependencyError("Missing account identity");
  const risks = await inspectPrivateErasureCascadeRisks(tx);
  if (risks.length) throw new ClosureContentDependencyError(
    `There are ${risks.length} unreviewed downstream private-content dependencies; no rows deleted`
  );

  const direct = rowsOf(await tx.execute(sql`
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
  const byTable = new Map<string, Set<string>>();
  for (const row of direct) {
    const table = String(row.table), column = String(row.column);
    if (!privateNames.has(table)) continue;
    if (!validIdentifier.test(table) || !validIdentifier.test(column))
      throw new ClosureContentDependencyError("Unreviewed FK identifier");
    if (!byTable.has(table)) byTable.set(table, new Set());
    byTable.get(table)!.add(column);
  }
  const privateEdges = rowsOf(await tx.execute(sql`
    SELECT child.relname AS "child", parent.relname AS "parent"
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace nc ON nc.oid = child.relnamespace
    JOIN pg_namespace np ON np.oid = parent.relnamespace
    WHERE con.contype = 'f' AND nc.nspname='public' AND np.nspname='public'
  `)).map(r=>({child:String(r.child),parent:String(r.parent)}));
  // Refuse before any DELETE: ordering tables cannot make a self-referencing table safe.
  assertNoSelfReferences(new Set(byTable.keys()), privateEdges);
  const ordered = deletionOrder(Array.from(byTable.keys()), privateEdges);
  const counts: { table: string; deleted: number }[] = [];
  for (const table of ordered) {
    const cols = Array.from(byTable.get(table)!).sort();
    const predicate = sql.join(cols.map(column => sql`${sql.raw('"' + column + '"')} = ${memberId}`),sql` OR `);
    const deleted = rowsOf(await tx.execute(sql`
      DELETE FROM ${sql.raw('public."' + table + '"')}
      WHERE (${predicate}) RETURNING 1
    `)).length;
    counts.push({ table, deleted });
  }
  return { counts, totalDeleted: counts.reduce((sum,item)=>sum+item.deleted,0) };
}
