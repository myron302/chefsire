import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyWeddingEnrollmentConsent } from "./wedding-square-enrollment-consent";
import { WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";
import { weddingSquareSandboxPreflight } from "./wedding-square-enrollment-preflight";
import { createWeddingEnrollmentReservationService, WeddingEnrollmentReservationError } from "./wedding-square-enrollment-reservation";

const sandboxEnv = {
  SQUARE_ENV: "sandbox",
  SQUARE_ACCESS_TOKEN: "test-token",
  SQUARE_LOCATION_ID: "location",
  WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: "premium-plan",
  WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: "elite-plan",
  WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
};
const consent = verifyWeddingEnrollmentConsent({
  userId: "user-1",
  now: new Date("2026-10-28T12:00:00Z"),
  trialExpiresAt: new Date("2026-11-10T14:00:00Z"),
  request: {
    tier: "premium", consentVersion: WEDDING_CONSENT_VERSION,
    acceptedAutomaticMonthlyRenewal: true, acceptedAmountCents: 2499,
    acceptedCurrency: "USD", acknowledgedFirstChargeStartDate: "2026-11-11",
  },
});
const config = weddingSquareSandboxPreflight(sandboxEnv, "premium");
const input = { consent, config, verifiedSquareCustomerId: "customer", verifiedSquareCardId: "card" };

function fakeDatabase(insertRows: { id: string }[] = [{ id: "attempt-1" }]) {
  const statements: { text: string; values?: unknown[] }[] = [];
  let released = false;
  return {
    statements,
    get released() { return released; },
    connect: async () => ({
      query: async (text: string, values?: unknown[]) => {
        statements.push({ text, values });
        if (text.includes("INSERT INTO")) return { rows: insertRows };
        return { rows: [] };
      },
      release: () => { released = true; },
    }),
  };
}

test("transactionally reserves one attempt and persists stable key before any provider call", async () => {
  const original = { enabled: process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED, square: process.env.SQUARE_ENV };
  process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "true";
  process.env.SQUARE_ENV = "sandbox";
  try {
    const database = fakeDatabase();
    const result = await createWeddingEnrollmentReservationService(database as any).reserve(input);
    assert.equal(result.status, "reserved");
    assert.equal(result.attemptId, "attempt-1");
    assert.match(result.idempotencyKey, /^[a-f0-9-]{36}$/);
    assert.deepEqual(database.statements.map(s => s.text === "BEGIN" ? "BEGIN" :
      s.text === "COMMIT" ? "COMMIT" :
      s.text.includes("pg_advisory") ? "LOCK" :
      s.text.includes("INSERT INTO") ? "INSERT" : s.text), ["BEGIN", "LOCK", "INSERT", "COMMIT"]);
    const insert = database.statements.find(s => s.text.includes("INSERT INTO"))!;
    assert.equal(insert.values?.[0], "user-1");
    assert.equal(insert.values?.[12], result.idempotencyKey);
    assert.equal((insert.values?.[13] as string).length, 64);
    assert.equal(database.released, true);
  } finally {
    if (original.enabled === undefined) delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
    else process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = original.enabled;
    if (original.square === undefined) delete process.env.SQUARE_ENV;
    else process.env.SQUARE_ENV = original.square;
  }
});

test("enrollment remains disabled and opens no database connection by default", async () => {
  const original = process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
  delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
  try {
    const database = fakeDatabase();
    await assert.rejects(createWeddingEnrollmentReservationService(database as any).reserve(input), WeddingEnrollmentReservationError);
    assert.equal(database.statements.length, 0);
  } finally {
    if (original !== undefined) process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = original;
  }
});

test("conflicting attempt rolls back and never reports a reservation", async () => {
  const original = { enabled: process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED, square: process.env.SQUARE_ENV };
  process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "true";
  process.env.SQUARE_ENV = "sandbox";
  try {
    const database = fakeDatabase([]);
    await assert.rejects(createWeddingEnrollmentReservationService(database as any).reserve(input), WeddingEnrollmentReservationError);
    assert.equal(database.statements.at(-1)?.text, "ROLLBACK");
    assert.equal(database.released, true);
  } finally {
    if (original.enabled === undefined) delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
    else process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = original.enabled;
    if (original.square === undefined) delete process.env.SQUARE_ENV;
    else process.env.SQUARE_ENV = original.square;
  }
});

test("database acquisition failures return the sanitized reservation error", async () => {
  const original = { enabled: process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED, square: process.env.SQUARE_ENV };
  process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "true";
  process.env.SQUARE_ENV = "sandbox";
  try {
    let called = 0;
    const database = { connect: async () => { called++; throw new Error("sensitive postgres connection detail"); } };
    await assert.rejects(
      createWeddingEnrollmentReservationService(database as any).reserve(input),
      (error: unknown) => error instanceof WeddingEnrollmentReservationError &&
        !error.message.includes("sensitive postgres"),
    );
    assert.equal(called, 1);
    await assert.rejects(
      createWeddingEnrollmentReservationService(null as any).reserve(input),
      WeddingEnrollmentReservationError,
    );
  } finally {
    if (original.enabled === undefined) delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
    else process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = original.enabled;
    if (original.square === undefined) delete process.env.SQUARE_ENV;
    else process.env.SQUARE_ENV = original.square;
  }
});

test("failed rollback discards the unsafe pooled connection", async () => {
  const original = { enabled: process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED, square: process.env.SQUARE_ENV };
  process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "true";
  process.env.SQUARE_ENV = "sandbox";
  try {
    const releases: (Error | undefined)[] = [];
    const database = {
      connect: async () => ({
        query: async (text: string) => {
          if (text === "ROLLBACK") throw new Error("rollback failed");
          if (text.includes("INSERT INTO")) return { rows: [] };
          return { rows: [] };
        },
        release: (error?: Error) => { releases.push(error); },
      }),
    };
    await assert.rejects(
      createWeddingEnrollmentReservationService(database as any).reserve(input),
      WeddingEnrollmentReservationError,
    );
    assert.equal(releases.length, 1);
    assert.ok(releases[0] instanceof Error, "release must discard the broken connection");
  } finally {
    if (original.enabled === undefined) delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
    else process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = original.enabled;
    if (original.square === undefined) delete process.env.SQUARE_ENV;
    else process.env.SQUARE_ENV = original.square;
  }
});
