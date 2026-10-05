/**
 * Verification writes for ONE credential generation are ordered: each attempt takes a ticket before it asks Square, and a write is applied
 * only while no later-ticketed attempt has been applied. An older provider observation can therefore never overwrite a newer one, in
 * either direction, without holding a row lock across the network call. Deterministic: the older attempt is parked at its write by a
 * database gate while the newer one runs to completion. Real PostgreSQL; set TEST_DATABASE_URL (loopback, name contains "test").
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { withSquareHarness, withTimeout, type SquareHarness } from "../test-support/square-connection-harness";
import { SECRET_BOX_KEY_ENV } from "./secret-box";

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
process.env.SQUARE_ENV = "sandbox";

const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
const VERIFY_WRITE = /SET granted_scopes/;
const READY = [{ id: "LOC_1", name: "Main Kitchen", status: "ACTIVE", capabilities: ["CREDIT_CARD_PROCESSING"], merchant_id: "MERCHANT_1", currency: "USD", created_at: "2024-01-01T00:00:00Z" }];
const NOT_READY = [{ ...READY[0], status: "INACTIVE" }];

if (!URL_ENV) {
  test("Square verification ordering (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, { fake: { grants: [{ access_token: "order-access-1", refresh_token: "order-refresh-1", expires_at: "2099-01-01T00:00:00Z", merchant_id: "MERCHANT_1" }] } }, fn);
  const tickets = async (h: SquareHarness) => (await h.pool.query(`SELECT verification_attempt::int AS attempt, verification_applied::int AS applied, location_id, last_verified_at FROM payment_methods WHERE user_id = 'p'`)).rows[0];

  /** A starts first and is parked at its write; B starts later and completes; then A is released and finishes LAST. */
  async function race(h: SquareHarness, aSees: typeof READY, bSees: typeof READY) {
    h.fake.state.locations = aSees;
    const gate = h.arm(VERIFY_WRITE);
    const a = h.service.getSquarePaymentReadiness("p", { force: true });
    await withTimeout(gate.reached, "A reached its write");
    h.fake.state.locations = bSees;
    const b = await h.service.getSquarePaymentReadiness("p", { force: true });
    gate.release();
    const aResult = await withTimeout(a, "A finished");
    return { aResult, b };
  }

  test("A (older) sees READY, B (newer) sees NOT ready: A returns last and cannot overwrite B -- the newer not-ready facts persist", async () => {
    await run(async (h) => {
      await h.connect("p");
      const generation = await h.generation("p");
      const { aResult, b } = await race(h, READY, NOT_READY);
      assert.equal(b.state, "no_payment_location");
      assert.equal(aResult.state, "no_payment_location", "A re-reads the authoritative row and reports B's newer facts");
      assert.equal(aResult.paymentReady, false);
      const row = await h.row("p");
      assert.equal(row.location_id, null, "B's not-ready facts persist; A's READY location was never written");
      assert.equal(await h.generation("p"), generation, "same credential generation throughout");
      const state = await tickets(h);
      assert.equal(state.applied, state.attempt, "the newest ticket is the one applied");
    });
  });

  test("A (older) sees NOT ready, B (newer) sees READY: the newer ready facts persist and are not overwritten by A", async () => {
    await run(async (h) => {
      await h.connect("p");
      const { aResult, b } = await race(h, NOT_READY, READY);
      assert.equal(b.state, "active");
      assert.equal(aResult.state, "active");
      assert.equal(aResult.paymentReady, true);
      assert.equal((await h.row("p")).location_id, "LOC_1");
      const state = await tickets(h);
      assert.equal(state.applied, state.attempt);
    });
  });

  test("the final state is deterministic: whichever order the two requests RETURN in, the persisted facts are the newer attempt's", async () => {
    for (const [aSees, bSees, expected] of [[READY, NOT_READY, null], [NOT_READY, READY, "LOC_1"]] as const) {
      await run(async (h) => {
        await h.connect("p");
        await race(h, aSees as never, bSees as never);
        assert.equal((await h.row("p")).location_id, expected);
      });
    }
  });

  test("ordering does not bypass credential-generation matching: a reconnect while an older attempt is parked still rejects its write", async () => {
    await run(async (h) => {
      await h.connect("p");
      const before = await h.generation("p");
      const gate = h.arm(VERIFY_WRITE);
      h.fake.state.locations = NOT_READY;
      const a = h.service.getSquarePaymentReadiness("p", { force: true });
      await withTimeout(gate.reached, "A reached its write");
      h.useMerchant("MERCHANT_1", { access: "order-access-2", refresh: "order-refresh-2" });
      await h.connect("p");
      assert.equal(await h.generation("p"), before + 1);
      gate.release();
      await withTimeout(a, "A finished");
      assert.equal(h.accessOf(await h.row("p")), "order-access-2", "the reconnected credential is untouched");
      assert.equal(await h.generation("p"), before + 1);
      assert.equal((await h.row("p")).location_id, "LOC_MERCHANT_1", "A's observation of the OLD credential was not written over the new connection's facts");
    });
  });

  test("a disconnect while an older attempt is parked still prevents its write (generation binding intact)", async () => {
    await run(async (h) => {
      await h.connect("p");
      const gate = h.arm(VERIFY_WRITE);
      const a = h.service.getSquarePaymentReadiness("p", { force: true });
      await withTimeout(gate.reached, "A reached its write");
      await h.service.disconnect("p");
      gate.release();
      assert.equal((await withTimeout(a, "A finished")).state, "not_connected");
      assert.equal((await h.row("p")).account_status, "disconnected");
    });
  });

  test("TTL semantics: the winning attempt's facts are fresh, so an immediate non-forced check does not ask Square again; merchant identity is still enforced", async () => {
    await run(async (h) => {
      await h.connect("p");
      await race(h, READY, READY);
      const calls = h.fake.calls("/v2/locations");
      assert.equal((await h.service.getSquarePaymentReadiness("p")).state, "active");
      assert.equal(h.fake.calls("/v2/locations"), calls, "within the TTL, no new provider call");
      // A different merchant on the verification call is still rejected as a mismatch.
      h.fake.state.profileMerchantId = "SOMEONE_ELSE";
      assert.equal((await h.service.getSquarePaymentReadiness("p", { force: true })).state, "needs_reauthorization");
    });
  });

  test("tickets are monotonic and independent attempts each take one", async () => {
    await run(async (h) => {
      await h.connect("p");
      for (let i = 0; i < 3; i += 1) await h.service.getSquarePaymentReadiness("p", { force: true });
      const state = await tickets(h);
      assert.ok(state.attempt >= 3);
      assert.equal(state.applied, state.attempt);
    });
  });
}
