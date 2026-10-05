/**
 * Verification TICKETS govern DESTRUCTIVE outcomes too. An older verification attempt that comes back late with an invalid-credential,
 * merchant-mismatch or lost-scope result must not clear credentials, mark the connection needs_reauthorization or advance its credential
 * generation once a newer attempt has been applied (or is the newest in flight). A newer destructive result still applies. Deterministic:
 * the older attempt is parked at its database write by a gate while the newer one runs to completion. Real PostgreSQL; set TEST_DATABASE_URL.
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
const REAUTH_WRITE = /SET account_status = 'needs_reauthorization'/;

if (!URL_ENV) {
  test("Square destructive verification ordering (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, { fake: { grants: [{ access_token: "dest-access-1", refresh_token: "dest-refresh-1", expires_at: "2099-01-01T00:00:00Z", merchant_id: "MERCHANT_1" }] } }, fn);

  const destructive: Array<[string, (h: SquareHarness) => void, (h: SquareHarness) => void]> = [
    ["invalid credential (401)", (h) => { h.fake.state.failures.merchant = 401; }, (h) => { h.fake.state.failures.merchant = undefined; }],
    ["merchant mismatch", (h) => { h.fake.state.profileMerchantId = "SOMEONE_ELSE"; }, (h) => { h.fake.state.profileMerchantId = "MERCHANT_1"; }],
    ["lost scope", (h) => { h.fake.state.scopes = ["MERCHANT_PROFILE_READ"]; }, (h) => { h.fake.state.scopes = [...REQUIRED]; }],
  ];
  let REQUIRED: string[] = [];

  for (const [name, breakIt, fixIt] of destructive) {
    test(`older ${name} (returns LATE) cannot clear, demote or re-generation a connection a NEWER attempt verified`, async () => {
      await run(async (h) => {
        await h.connect("p");
        REQUIRED = [...h.fake.state.scopes];
        const generation = await h.generation("p");
        const gate = h.arm(REAUTH_WRITE);
        breakIt(h);
        const a = h.service.getSquarePaymentReadiness("p", { force: true }); // A: older ticket, destructive result, parked at its write
        await withTimeout(gate.reached, "A reached its destructive write");
        fixIt(h);
        const b = await h.service.getSquarePaymentReadiness("p", { force: true }); // B: newer ticket, success, applied first
        assert.equal(b.state, "active");
        gate.release();
        const aResult = await withTimeout(a, "A finished");
        assert.equal(aResult.state, "active", "A re-reads the authoritative row: B's verified state");
        const row = await h.row("p");
        assert.equal(row.account_status, "active");
        assert.equal(h.accessOf(row), "dest-access-1", "credentials not cleared");
        assert.equal(await h.generation("p"), generation, "generation not advanced");
        assert.equal(h.logs.some((entry) => entry.event === "square_connection_needs_reauthorization"), false);
      });
    });
  }

  test("a NEWER destructive result still applies when it owns the newest ticket, and an OLDER success cannot overwrite it", async () => {
    await run(async (h) => {
      await h.connect("p");
      const generation = await h.generation("p");
      const gate = h.arm(VERIFY_WRITE);
      const a = h.service.getSquarePaymentReadiness("p", { force: true }); // A: older, success, parked at its write
      await withTimeout(gate.reached, "A reached its success write");
      h.fake.state.failures.merchant = 401;
      const b = await h.service.getSquarePaymentReadiness("p", { force: true }); // B: newest ticket, destructive
      assert.equal(b.state, "needs_reauthorization");
      gate.release();
      assert.equal((await withTimeout(a, "A finished")).state, "needs_reauthorization");
      const row = await h.row("p");
      assert.equal(row.account_status, "needs_reauthorization");
      assert.equal(row.encrypted_access_token, null);
      assert.equal(await h.generation("p"), generation + 1, "advanced exactly once, by the newer destructive outcome");
    });
  });

  test("an older destructive result is also dropped while a NEWER attempt is still in flight (only the newest attempt may demote)", async () => {
    await run(async (h) => {
      await h.connect("p");
      const generation = await h.generation("p");
      const gate = h.arm(REAUTH_WRITE);
      h.fake.state.failures.merchant = 401;
      const a = h.service.getSquarePaymentReadiness("p", { force: true });
      await withTimeout(gate.reached, "A reached its destructive write");
      await h.pool.query(`UPDATE payment_methods SET verification_attempt = verification_attempt + 1 WHERE user_id = 'p'`); // a newer attempt took its ticket
      h.fake.state.failures.merchant = undefined;
      gate.release();
      await withTimeout(a, "A finished");
      const row = await h.row("p");
      assert.equal(row.account_status, "active");
      assert.equal(h.accessOf(row), "dest-access-1");
      assert.equal(await h.generation("p"), generation);
    });
  });

  test("a lone destructive verification (no competitor) still takes effect: ordering never blocks the newest attempt", async () => {
    for (const [, breakIt] of destructive) {
      await run(async (h) => {
        await h.connect("p");
        breakIt(h);
        assert.equal((await h.service.getSquarePaymentReadiness("p", { force: true })).state, "needs_reauthorization");
        const row = await h.row("p");
        assert.equal(row.account_status, "needs_reauthorization");
        assert.equal(row.encrypted_access_token, null);
      });
    }
  });

  test("generation matching still participates: a reconnect while an older destructive result is parked keeps the NEW credential", async () => {
    await run(async (h) => {
      await h.connect("p");
      const before = await h.generation("p");
      const gate = h.arm(REAUTH_WRITE);
      h.fake.state.failures.merchant = 401;
      const a = h.service.getSquarePaymentReadiness("p", { force: true });
      await withTimeout(gate.reached, "A reached its destructive write");
      h.fake.state.failures.merchant = undefined;
      h.useMerchant("MERCHANT_1", { access: "dest-access-2", refresh: "dest-refresh-2" });
      await h.connect("p");
      gate.release();
      await withTimeout(a, "A finished");
      const row = await h.row("p");
      assert.equal(row.account_status, "active");
      assert.equal(h.accessOf(row), "dest-access-2");
      assert.equal(await h.generation("p"), before + 1);
    });
  });

  test("a disconnect while an older destructive result is parked is not undone or double-counted", async () => {
    await run(async (h) => {
      await h.connect("p");
      const before = await h.generation("p");
      const gate = h.arm(REAUTH_WRITE);
      h.fake.state.failures.merchant = 401;
      const a = h.service.getSquarePaymentReadiness("p", { force: true });
      await withTimeout(gate.reached, "A reached its destructive write");
      h.fake.state.failures.merchant = undefined;
      await h.service.disconnect("p");
      gate.release();
      assert.equal((await withTimeout(a, "A finished")).state, "not_connected");
      const row = await h.row("p");
      assert.equal(row.account_status, "disconnected");
      assert.equal(await h.generation("p"), before + 1, "only the disconnect advanced it");
    });
  });
}
