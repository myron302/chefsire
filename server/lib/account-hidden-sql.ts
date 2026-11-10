import { sql, type SQL } from "drizzle-orm";

/**
 * SQL: the account with this id is hidden from others (status 'suspended' in account_status). Use as
 * `NOT ${accountHidden(column)}`. Kept dependency-free so the storage layer can import it without a cycle.
 */
export function accountHidden(userIdColumn: SQL | any): SQL {
  return sql`EXISTS (SELECT 1 FROM account_status hidden_status WHERE hidden_status.user_id = ${userIdColumn} AND hidden_status.status = 'suspended')`;
}
