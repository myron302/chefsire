/**
 * Side-effect import for suites that issue sessions through a database double (no account_status table): every
 * account is active. Account status rules themselves are tested in admin-members.postgres.test.ts.
 */
process.env.NODE_ENV = process.env.NODE_ENV || "test";
import { setAccountStatusReaderForTests } from "../lib/account-status-test-hook";

setAccountStatusReaderForTests(async () => ({ status: "active", reason: null, changedBy: null, changedAt: null }));
