import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { is } from "drizzle-orm";
import * as primarySchema from "./schema";
import * as directMessageSchema from "./schema.dm";

/**
 * The tables Drizzle is allowed to manage: exactly the pgTable objects exported by the declared schema modules
 * (the same two entry points `drizzle.config.ts` lists as `schema`). Derived, never hand-listed, so it can never become a second source of
 * schema truth. `drizzle.config.ts` hands this to `tablesFilter`, which makes `drizzle-kit push` blind to every other table in the database:
 * a table that exists in Neon but is not declared here (migration-ledger, audit, quarantine or runtime-created tables) can neither be
 * dropped nor altered by a push.
 */
export function declaredTableNames(): string[] {
  const names = new Set<string>();
  for (const moduleExports of [primarySchema, directMessageSchema]) {
    for (const value of Object.values(moduleExports)) {
      if (is(value as never, PgTable)) names.add(getTableConfig(value as PgTable).name);
    }
  }
  return Array.from(names).sort();
}
