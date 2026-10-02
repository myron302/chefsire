/**
 * Side-effect import for suites that exercise routes through a database double.
 *
 * Authentication now consults the live account row (`users.auth_version`), which these suites have no
 * table for. Importing this registers a directory in which every id is a live account at auth version 1,
 * so a token minted with `av: 1` is honoured exactly as a real session would be. Tokens WITHOUT the claim
 * are still rejected -- the revocation rules themselves are tested in auth-account-prehijack.test.ts.
 */
process.env.NODE_ENV = process.env.NODE_ENV || "test";
import { setSessionLookupForTests } from "../lib/auth-session";

setSessionLookupForTests(async (id) => ({ id, authVersion: 1 }) as { authVersion: number });
