/**
 * Harness for Catering Phase 2Q tests that need REAL behaviour: a real PostgreSQL database built from the Drizzle schema (the same
 * `drizzle-kit push` production uses, cached as a template database keyed by a hash of the schema sources), the REAL Gate 0 Square
 * connection service with real sealed credentials, the REAL `square` SDK against a local fake Square, and the real settlement code.
 *
 * Only loopback databases whose name contains "test" are accepted (`parseLocalTestDatabaseUrl`); every test gets its own throw-away
 * database and drops it. Never production. Callers must set the Square application/encryption env before importing this module's
 * consumers (see `prepareCateringSquareEnvironment`).
 */
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../shared/schema";
import { parseLocalTestDatabaseUrl, type LocalTestDbConfig } from "./local-test-database";
import { startFakeSquare, type FakeSquareState } from "./fake-square";
import { createSquareConnectionService, type SqlPool } from "../lib/square-connection-service";
import { createSquareProviderApi } from "../lib/square-integration";
import { createSquareCheckoutApi } from "../lib/square-checkout";
import { createCateringSquarePayments, type CateringSquarePaymentsDeps } from "../services/catering-square-payments";
import { SECRET_BOX_KEY_ENV } from "../lib/secret-box";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Environment every Catering Square test needs: the sandbox, a Square application and a sealing key. Idempotent. */
export function prepareCateringSquareEnvironment() {
  process.env.SQUARE_APPLICATION_ID ||= "app-id-test";
  process.env.SQUARE_APPLICATION_SECRET ||= "app-secret-test";
  process.env[SECRET_BOX_KEY_ENV] ||= randomBytes(32).toString("base64");
  process.env.SQUARE_ENV = "sandbox";
  // Checkout is only enabled with the webhook configured (the durable completion path), so every suite that expects it enabled has it.
  process.env.SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL ||= "https://chefsire.test/api/catering/webhooks/square";
  process.env.SQUARE_CATERING_WEBHOOK_SIGNATURE_KEY ||= "catering-webhook-signature-key-test";
}

function walk(directory: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) files.push(full);
  }
  return files;
}

function schemaHash(): string {
  const hash = createHash("sha256");
  for (const file of [path.join(root, "shared", "schema.ts"), path.join(root, "shared", "schema.dm.ts"), ...walk(path.join(root, "shared", "schema")), path.join(root, "shared", "catering-booking-activity-events.ts"), path.join(root, "drizzle.config.ts")].sort()) {
    if (fs.existsSync(file)) hash.update(file).update(fs.readFileSync(file));
  }
  return hash.digest("hex").slice(0, 12);
}

const withDatabase = (config: LocalTestDbConfig, database: string): LocalTestDbConfig => ({ ...config, database });
const urlOf = (config: LocalTestDbConfig) => `postgres://${encodeURIComponent(config.user ?? "postgres")}${config.password ? `:${encodeURIComponent(config.password)}` : ""}@${config.host}:${config.port}/${config.database}`;

/** Builds (once per schema revision, serialized across test processes) the template database every harness clones. */
async function ensureTemplate(config: LocalTestDbConfig): Promise<string> {
  const name = `chefsire_test_c2q_${schemaHash()}`;
  const admin = new pg.Client(config);
  await admin.connect();
  try {
    await admin.query("SELECT pg_advisory_lock(7217001)");
    const exists = await admin.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [name]);
    if (exists.rowCount === 0) {
      const staging = `${name}_build_${process.pid}`;
      await admin.query(`CREATE DATABASE ${staging}`);
      const result = spawnSync("npx", ["drizzle-kit", "push", "--force"], { cwd: root, env: { ...process.env, DATABASE_URL: urlOf(withDatabase(config, staging)) }, encoding: "utf8", timeout: 300_000 });
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`.slice(-2000));
      await admin.query(`ALTER DATABASE ${staging} RENAME TO ${name}`);
    }
    await admin.query("SELECT pg_advisory_unlock(7217001)");
  } finally {
    await admin.end();
  }
  return name;
}

export type CateringSquareHarnessOptions = {
  fake?: Partial<FakeSquareState>;
  /** Replaces pieces of the payment service's dependencies (a clock, a notifier, `enabled`). Production wiring is the default. */
  deps?: Partial<CateringSquarePaymentsDeps>;
  /** Wraps the real Square checkout adapter (which needs the fake server's URL), e.g. to pause one caller between reading Square and settling. */
  wrapCheckout?: (api: ReturnType<typeof createSquareCheckoutApi>) => ReturnType<typeof createSquareCheckoutApi>;
};

export async function createCateringSquareHarness(databaseUrl: string, options: CateringSquareHarnessOptions = {}) {
  prepareCateringSquareEnvironment();
  const config = parseLocalTestDatabaseUrl(databaseUrl);
  const template = await ensureTemplate(config);
  const database = `chefsire_test_c2q_run_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const admin = new pg.Client(config);
  await admin.connect();
  await admin.query(`CREATE DATABASE ${database} TEMPLATE ${template}`);
  const pool = new pg.Pool({ ...withDatabase(config, database), max: 24 });
  // An idle client terminated by the database drop at cleanup is expected, and must not surface as an unhandled 'error' event.
  pool.on("error", () => undefined);
  const db = drizzle(pool, { schema });

  const fake = await startFakeSquare(options.fake);
  const notifications: { userId: string; type: string; linkUrl: string }[] = [];
  const logs: { event: string; fields: Record<string, unknown> }[] = [];
  let clock: Date | null = null;
  const now = () => clock ?? new Date();

  const connections = createSquareConnectionService({
    pool: pool as unknown as SqlPool,
    api: createSquareProviderApi({ baseUrl: fake.baseUrl }),
    now,
    log: { warn: () => undefined },
  });
  const payments = createCateringSquarePayments({
    db: db as never,
    connections,
    checkout: (options.wrapCheckout ?? ((api) => api))(createSquareCheckoutApi({ baseUrl: fake.baseUrl })),
    now,
    pollIntervalMs: -1,
    appBaseUrl: () => "https://app.test",
    log: { warn: (event, fields) => { logs.push({ event, fields }); } },
    notify: async (userId, notification) => { notifications.push({ userId, type: notification.type, linkUrl: notification.linkUrl }); },
    ...options.deps,
  });

  // The production wiring (services/catering-square-payments-instance.ts) registers exactly this: open checkouts are wound down before a credential is discarded.
  connections.setCredentialDiscardGuard(({ userId }) => payments.closeProviderCheckouts(userId));

  const h = {
    db, pool, fake, connections, payments, notifications, logs, database,
    setClock(value: Date | null) { clock = value; },
    q: async (text: string, params?: unknown[]) => (await pool.query(text, params)).rows,

    async user(label: string) {
      const id = `${label}-${randomUUID().slice(0, 8)}`;
      await pool.query(`INSERT INTO users (id, username, email, display_name) VALUES ($1::varchar, $1::text, $1::text || '@test.invalid', $1::text)`, [id]);
      return id;
    },

    /** Connects `providerId` to Square for real: Gate 0 verification, sealed credentials and a verified card-capable location. */
    async connectProvider(providerId: string, merchantId = `MERCHANT_${providerId}`, tokens = { access: `access-${providerId}`, refresh: `refresh-${providerId}` }) {
      fake.resetGrants();
      Object.assign(fake.state, {
        merchantId, profileMerchantId: merchantId, statusMerchantId: merchantId,
        grants: [{ access_token: tokens.access, refresh_token: tokens.refresh, expires_at: "2099-01-01T00:00:00Z", merchant_id: merchantId }],
        locations: [{ id: `LOC_${merchantId}`, name: `Kitchen ${merchantId}`, status: "ACTIVE", capabilities: ["CREDIT_CARD_PROCESSING"], merchant_id: merchantId, currency: "USD" }],
      });
      const verification = await connections.verifyAuthorizationCode("auth-code");
      assert.equal(verification.ok, true);
      if (!verification.ok) throw new Error("verification failed");
      const tx = await pool.connect();
      try {
        await tx.query("BEGIN");
        await connections.persistVerifiedConnection(tx as never, providerId, verification.verified);
        await tx.query("COMMIT");
      } catch (error) { await tx.query("ROLLBACK"); throw error; } finally { tx.release(); }
      return { merchantId, locationId: `LOC_${merchantId}`, accessToken: tokens.access };
    },

    /**
     * A confirmed booking with an agreed price and (optionally) a deposit/balance invoice already ISSUED, as the real billing routes
     * leave them. Rows are inserted directly because Phase 2L's own routes are not under test here.
     */
    async booking(input: { providerId: string; customerId: string; agreedPrice?: string; status?: string; invoices?: { kind: "deposit" | "balance" | "adjustment"; amountCents: number; number?: number; status?: string }[] }) {
      const inquiry = (await pool.query(`INSERT INTO catering_inquiries (customer_id, chef_id, event_date) VALUES ($1, $2, now()) RETURNING id`, [input.customerId, input.providerId])).rows[0].id as string;
      const booking = (await pool.query(
        `INSERT INTO catering_bookings (inquiry_id, provider_id, customer_id, event_date, status, agreed_price, currency) VALUES ($1, $2, $3, current_date + 30, $4, $5, 'USD') RETURNING id`,
        [inquiry, input.providerId, input.customerId, input.status ?? "confirmed", input.agreedPrice ?? "1000.00"],
      )).rows[0].id as string;
      const invoices: string[] = [];
      let number = 0;
      for (const invoice of input.invoices ?? []) {
        number += 1;
        const status = invoice.status ?? "issued";
        const row = (await pool.query(
          `INSERT INTO catering_booking_invoices (booking_id, invoice_number, invoice_kind, amount_cents, currency, status, issued_at, voided_at, voided_by, created_by)
           VALUES ($1, $2, $3, $4, 'USD', $5::varchar, now(), CASE WHEN $5::varchar = 'void' THEN now() END, CASE WHEN $5::varchar = 'void' THEN $6::varchar END, $6::varchar) RETURNING id`,
          [booking, invoice.number ?? number, invoice.kind, invoice.amountCents, status, input.providerId],
        )).rows[0].id as string;
        invoices.push(row);
      }
      return { bookingId: booking, invoiceIds: invoices };
    },

    /** A provider-recorded payment, as `POST /billing/payments` writes one. */
    async recordProviderPayment(bookingId: string, invoiceId: string, providerId: string, amountCents: number) {
      return (await pool.query(
        `INSERT INTO catering_booking_payments (booking_id, invoice_id, amount_cents, currency, payment_method, payment_source, status, received_on, recorded_by, idempotency_key)
         VALUES ($1, $2, $3, 'USD', 'cash', 'provider_recorded', 'recorded', current_date, $4, $5) RETURNING id`,
        [bookingId, invoiceId, amountCents, providerId, `idem-${randomUUID()}`],
      )).rows[0].id as string;
    },

    /** A provider-recorded Phase 2P credit or charge, which moves the obligation (and so the payable). */
    async adjustment(bookingId: string, providerId: string, kind: "credit" | "charge", amountCents: number) {
      return (await pool.query(
        `INSERT INTO catering_booking_adjustments (booking_id, entry_kind, source, status, amount_cents, currency, reason, idempotency_key, recorded_by)
         VALUES ($1, $2, 'provider_recorded', 'posted', $3, 'USD', 'test adjustment', $4, $5) RETURNING id`,
        [bookingId, kind, amountCents, `adj-${randomUUID()}`, providerId],
      )).rows[0].id as string;
    },

    async voidInvoice(invoiceId: string, providerId: string) {
      await pool.query(`UPDATE catering_booking_invoices SET status = 'void', voided_at = now(), voided_by = $2 WHERE id = $1`, [invoiceId, providerId]);
    },
    async cancelBooking(bookingId: string) { await pool.query(`UPDATE catering_bookings SET status = 'cancelled' WHERE id = $1`, [bookingId]); },
    row: async (userId: string) => (await h.q(`SELECT * FROM payment_methods WHERE user_id = $1`, [userId]))[0],
    ledger: async (bookingId: string) => h.q(`SELECT * FROM catering_booking_payments WHERE booking_id = $1 ORDER BY created_at, id`, [bookingId]),
    processorLedger: async (bookingId: string) => h.q(`SELECT * FROM catering_booking_payments WHERE booking_id = $1 AND payment_source = 'processor'`, [bookingId]),
    attempts: async (bookingId: string) => h.q(`SELECT * FROM catering_booking_payment_attempts WHERE booking_id = $1 ORDER BY created_at, id`, [bookingId]),
    attempt: async (attemptId: string) => (await h.q(`SELECT * FROM catering_booking_payment_attempts WHERE id = $1`, [attemptId]))[0],
    activity: async (bookingId: string) => h.q(`SELECT event_type, metadata FROM catering_booking_activity WHERE booking_id = $1 ORDER BY created_at, id`, [bookingId]),

    async cleanup() {
      await fake.close();
      await pool.end();
      await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      await admin.end();
    },
  };
  return h;
}
export type CateringSquareHarness = Awaited<ReturnType<typeof createCateringSquareHarness>>;

export async function withCateringSquareHarness(databaseUrl: string, options: CateringSquareHarnessOptions, fn: (h: CateringSquareHarness) => Promise<void>) {
  const h = await createCateringSquareHarness(databaseUrl, options);
  try { await fn(h); } finally { await h.cleanup(); }
}

export const withTimeout = <T>(promise: Promise<T>, label: string) =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out: ${label}`)), 30_000))]);
