import { sql } from "drizzle-orm";
import { CLOSURE_FK_CLASSES, type ClosureFkClass } from "./closure-fk-inventory";

/**
 * Direct user FK inventory is NOT enough to authorize private-content erasure.
 * A post/comment/plan may have downstream consumers whose rows carry independent
 * financial, contractual or other members' rights. This read-only walk inspects
 * every public FK reachable from a candidate private table, including multi-hop
 * cascades. Every non-private child is a manual-review blocker.
 *
 * The classification is schema-source reviewed, not a legal retention decision.
 * This reports schema-level dependencies even if the closing member currently
 * has no rows. Future execution must separately resolve per-row dependencies.
 */
export type ClosureCascadeRisk = {
  parentTable: string;
  childTable: string;
  constraint: string;
  deleteAction: "CASCADE" | "RESTRICT" | "NO ACTION" | "SET NULL" | "SET DEFAULT" | "UNKNOWN";
  depth: number;
  childClass: ClosureFkClass | "unclassified";
};

const tableKinds = new Map<string, ClosureFkClass>();
for (const [kind, names] of Object.entries(CLOSURE_FK_CLASSES) as [ClosureFkClass, readonly string[]][]) {
  for (const name of names) {
    if (tableKinds.has(name)) throw new Error(`Duplicate closure table classification: ${name}`);
    tableKinds.set(name, kind);
  }
}
const rowsOf = (r: any): any[] => r?.rows ?? (Array.isArray(r) ? r : []);

/**
 * All paths from erase_private parents are treated as needing review unless
 * the child is also erase_private. Even SET NULL and RESTRICT matter:
 * those actions may alter shared evidence or make the closure transaction fail.
 */
export async function inspectPrivateErasureCascadeRisks(tx: any): Promise<ClosureCascadeRisk[]> {
  const rows = rowsOf(await tx.execute(sql`
    WITH RECURSIVE dependency AS (
      SELECT parent.relname::text AS parent_table,
             child.relname::text AS child_table,
             c.conname::text AS constraint_name,
             c.confdeltype AS delete_action,
             1 AS depth,
             ARRAY[parent.oid,child.oid]::oid[] AS path
      FROM pg_constraint c
      JOIN pg_class child ON child.oid = c.conrelid
      JOIN pg_class parent ON parent.oid = c.confrelid
      JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
      JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
      WHERE c.contype = 'f' AND child_ns.nspname = 'public'
        AND parent_ns.nspname = 'public'
        AND parent.relname::text IN (${sql.join(CLOSURE_FK_CLASSES.erase_private.map(name => sql`${name}`), sql`, `)})
      UNION ALL
      SELECT d.child_table, child.relname::text, c.conname::text,
             c.confdeltype, d.depth + 1, d.path || child.oid
      FROM dependency d
      JOIN pg_class p ON p.relname = d.child_table
      JOIN pg_namespace pn ON pn.oid = p.relnamespace AND pn.nspname = 'public'
      JOIN pg_constraint c ON c.confrelid = p.oid AND c.contype = 'f'
      JOIN pg_class child ON child.oid = c.conrelid
      JOIN pg_namespace cn ON cn.oid = child.relnamespace AND cn.nspname = 'public'
      WHERE d.depth < 10 AND NOT child.oid = ANY(d.path)
    )
    SELECT parent_table AS "parentTable", child_table AS "childTable",
           constraint_name AS "constraint",
           CASE delete_action WHEN 'c' THEN 'CASCADE'
                              WHEN 'r' THEN 'RESTRICT'
                              WHEN 'a' THEN 'NO ACTION'
                              WHEN 'n' THEN 'SET NULL'
                              WHEN 'd' THEN 'SET DEFAULT'
                              ELSE 'UNKNOWN' END AS "deleteAction",
           depth FROM dependency
    ORDER BY parent_table, child_table, depth, constraint_name
  `));
  return rows.filter((r) => tableKinds.get(String(r.childTable)) !== "erase_private")
    .map((r): ClosureCascadeRisk => ({
      parentTable: String(r.parentTable),
      childTable: String(r.childTable),
      constraint: String(r.constraint),
      deleteAction: r.deleteAction,
      depth: Number(r.depth),
      childClass: tableKinds.get(String(r.childTable)) ?? "unclassified",
    }));
}
