/**
 * Test-only override for account status reads, kept free of imports so test setup files can register it without
 * loading the database module early (some suites configure DATABASE_URL after their first imports).
 */
export type AccountStatusTestRecord = { status: "active" | "restricted" | "suspended"; reason: string | null; changedBy: string | null; changedAt: string | Date | null };
type StatusReader = (userId: string) => Promise<AccountStatusTestRecord>;

let reader: StatusReader | null = null;

/** NODE_ENV=test only. */
export function setAccountStatusReaderForTests(fn: StatusReader | null): void {
  if (process.env.NODE_ENV !== "test") throw new Error("setAccountStatusReaderForTests is only available when NODE_ENV=test");
  reader = fn;
}

export function accountStatusTestReader(): StatusReader | null {
  return reader;
}
