/**
 * Shared harness for Square connection tests that need real concurrency: a REAL PostgreSQL schema built from the repository's
 * migrations, the REAL `square` SDK against a local fake Square, a controllable service clock, and a gate that can hold one
 * matching write on the pool (so production code carries no test hook). Callers must have set the Square application and
 * encryption-key environment variables before use.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { applyMigration } from "../scripts/migration-runner";
import { parseLocalTestDatabaseUrl } from "./local-test-database";
import { startFakeSquare, type FakeSquareState } from "./fake-square";
import { createSquareConnectionService, type SqlPool } from "../lib/square-connection-service";
import { createSquareProviderApi } from "../lib/square-integration";
import { decryptSecret } from "../lib/secret-box";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const sqlOf = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const MIGRATIONS = [
  "server/migrations/20261007_square_connection_hardening.sql",
  "server/migrations/20261008_square_credential_generation.sql",
  "server/migrations/20261009_square_merchant_revocation.sql",
  "server/migrations/20261010_square_merchant_revocations.sql",
  "server/migrations/20261011_square_credential_pair_repair.sql",
  "server/migrations/20261012_square_merchant_id_width.sql",
  "server/migrations/20261013_square_verification_ordering.sql",
];

export type Gate = { armed: boolean; pattern: RegExp; reached: Promise<void>; release: () => void; before?: () => Promise<void>; _reached: () => void; _released: Promise<void> };

export function newGate(pattern: RegExp): Gate {
  let reachedResolve!: () => void;
  let releaseResolve!: () => void;
  const released = new Promise<void>((resolve) => { releaseResolve = resolve; });
  return { armed: true, pattern, reached: new Promise<void>((resolve) => { reachedResolve = resolve; }), release: () => releaseResolve(), _reached: () => reachedResolve(), _released: released };
}

export const withTimeout = <T>(promise: Promise<T>, label: string) =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out: ${label}`)), 20_000))]);

export async function createSquareHarness(databaseUrl: string, options: { fake?: Partial<FakeSquareState> } = {}) {
  const config = parseLocalTestDatabaseUrl(databaseUrl);
  const namespace = `sqh_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new pg.Client(config);
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${namespace}`);
  const pool = new pg.Pool({ ...config, options: `-c search_path=${namespace}`, max: 16 });
  await pool.query(`CREATE TABLE users (id varchar PRIMARY KEY)`);
  await pool.query(sqlOf("server/drizzle/20251108_marketplace_monetization.sql").match(/CREATE TABLE IF NOT EXISTS payment_methods \([\s\S]*?\n\);/)![0]);
  await pool.query(`CREATE TABLE _app_migrations (filename text primary key, applied_at timestamptz not null default now())`);
  const client = await pool.connect();
  try { for (const file of MIGRATIONS) await applyMigration(client as never, `server:${path.basename(file)}`, sqlOf(file)); } finally { client.release(); }

  const fake = await startFakeSquare(options.fake);
  const logs: { event: string; fields: Record<string, unknown> }[] = [];
  let gate: Gate | null = null;
  let clock: Date | null = null;
  const gated = {
    query: async (text: string, params?: unknown[]) => {
      const g = gate;
      if (g?.armed && g.pattern.test(text)) {
        g.armed = false;
        g._reached();
        await g._released;
        if (g.before) await g.before();
      }
      return pool.query(text, params);
    },
    connect: () => pool.connect(),
  };
  const service = createSquareConnectionService({
    pool: gated as unknown as SqlPool,
    api: createSquareProviderApi({ baseUrl: fake.baseUrl }),
    now: () => clock ?? new Date(),
    log: { warn: (event, fields) => { logs.push({ event, fields }); } },
  });

  const h = {
    pool, fake, service, logs,
    setClock(value: Date | null) { clock = value; },
    arm(pattern: RegExp, before?: () => Promise<void>) { gate = newGate(pattern); gate.before = before; return gate; },
    /** Point the fake Square at merchant `merchantId` so the NEXT authorization is for it. */
    useMerchant(merchantId: string, tokens: { access: string; refresh: string }, extra: Partial<FakeSquareState> = {}) {
      fake.resetGrants();
      Object.assign(fake.state, {
        merchantId, profileMerchantId: merchantId, statusMerchantId: merchantId,
        grants: [{ access_token: tokens.access, refresh_token: tokens.refresh, expires_at: "2099-01-01T00:00:00Z", merchant_id: merchantId }],
        locations: [{ id: `LOC_${merchantId}`, name: `Kitchen ${merchantId}`, status: "ACTIVE", capabilities: ["CREDIT_CARD_PROCESSING"], merchant_id: merchantId, currency: "USD" }],
        ...extra,
      });
    },
    async addUser(userId: string) { await pool.query(`INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]); },
    /** The whole callback path for `userId`: verify with Square, then persist inside a transaction. */
    async connect(userId: string) {
      await h.addUser(userId);
      const verification = await h.service.verifyAuthorizationCode("auth-code");
      assert.equal(verification.ok, true);
      if (!verification.ok) return;
      await h.persist(userId, verification.verified);
    },
    async persist(userId: string, verified: Parameters<typeof service.persistVerifiedConnection>[2]) {
      const tx = await pool.connect();
      try {
        await tx.query("BEGIN");
        await service.persistVerifiedConnection(tx as never, userId, verified);
        await tx.query("COMMIT");
      } catch (error) { await tx.query("ROLLBACK"); throw error; } finally { tx.release(); }
    },
    async row(userId: string) { return (await pool.query(`SELECT * FROM payment_methods WHERE user_id = $1`, [userId])).rows[0]; },
    async rows() { return (await pool.query(`SELECT * FROM payment_methods ORDER BY user_id`)).rows; },
    generation: async (userId: string) => Number((await h.row(userId)).credential_generation),
    accessOf: (row: { id: string; encrypted_access_token: string }) => decryptSecret(row.encrypted_access_token, `payment_methods:${row.id}:square_access_token`),
    refreshOf: (row: { id: string; encrypted_refresh_token: string }) => decryptSecret(row.encrypted_refresh_token, `payment_methods:${row.id}:square_refresh_token`),
    async cleanup() {
      await fake.close();
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`);
      await admin.end();
    },
  };
  return h;
}
export type SquareHarness = Awaited<ReturnType<typeof createSquareHarness>>;

export async function withSquareHarness(databaseUrl: string, options: Parameters<typeof createSquareHarness>[1], fn: (h: SquareHarness) => Promise<void>) {
  const h = await createSquareHarness(databaseUrl, options);
  try { await fn(h); } finally { await h.cleanup(); }
}
