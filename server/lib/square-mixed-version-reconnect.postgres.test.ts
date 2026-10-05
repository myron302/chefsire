/**
 * Mixed-version reconnect: an OLD server (rolling deploy) reconnects a row the new application already sealed. It moves provider_id
 * to the new merchant and writes that merchant's tokens as PLAINTEXT, leaving the previous merchant's sealed pair behind. Disconnect
 * must normalize the row into one coherent merchant+credential snapshot BEFORE it chooses the merchant, the revoke token, the
 * shared-connection decision and the revocation-history target. Real PostgreSQL; set TEST_DATABASE_URL (loopback, name contains "test").
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { withSquareHarness, type SquareHarness } from "../test-support/square-connection-harness";
import { SECRET_BOX_KEY_ENV } from "./secret-box";

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
process.env.SQUARE_ENV = "sandbox";

const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
const EXPIRY = "2099-01-01T00:00:00Z";
const A_ACCESS = "merchant-a-access-token";
const A_REFRESH = "merchant-a-refresh-token";
const B_ACCESS = "merchant-b-access-token";
const B_REFRESH = "merchant-b-refresh-token";

if (!URL_ENV) {
  test("Square mixed-version reconnect (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, {}, fn);
  const revoked = (h: SquareHarness) => h.fake.requests.filter((request) => request.path === "/oauth2/revoke").map((request) => (JSON.parse(request.body || "{}") as { access_token?: string }).access_token);
  const epochs = async (h: SquareHarness) => (await h.pool.query(`SELECT merchant_id, revocation_epoch FROM square_merchant_revocations ORDER BY merchant_id`)).rows.map((row) => `${row.merchant_id}:${row.revocation_epoch}`);

  /** What an OLD server's reconnect statement does: new merchant id + that merchant's plaintext tokens; sealed columns untouched. */
  const oldServerReconnect = (h: SquareHarness, userId: string, merchant: string, details: Record<string, unknown>) =>
    h.pool.query(
      `UPDATE payment_methods SET provider_id = $2, account_status = 'active', account_details = jsonb_build_object('merchantId', $2::text) || $3::jsonb WHERE user_id = $1`,
      [userId, merchant, JSON.stringify(details)],
    );
  const plain = (access: string, refresh: string) => ({ accessToken: access, refreshToken: refresh, tokenExpiresAt: EXPIRY });

  async function connectedToA(h: SquareHarness, userId = "owner") {
    h.useMerchant("MERCHANT_A", { access: A_ACCESS, refresh: A_REFRESH });
    await h.connect(userId);
  }

  test("1-10. A -> B by an old server: disconnect reconciles FIRST, Square receives B's token never A's, B (not A) is the history target, A's other connection is untouched", async () => {
    await run(async (h) => {
      h.useMerchant("MERCHANT_A", { access: "other-a-access", refresh: "other-a-refresh" });
      await h.connect("other-a-user"); // a second ChefSire account on merchant A
      await connectedToA(h);
      const generationBefore = await h.generation("owner");
      await oldServerReconnect(h, "owner", "MERCHANT_B", plain(B_ACCESS, B_REFRESH));
      const stale = await h.row("owner");
      assert.equal(h.accessOf(stale), A_ACCESS, "precondition: A's sealed pair is still there, under B's provider_id");

      const result = await h.service.disconnect("owner");
      assert.deepEqual(result, { changed: true, providerRevocation: "revoked", providerRevoked: true });
      assert.deepEqual(revoked(h), [B_ACCESS], "Square was told to revoke B's credential and only B's");
      assert.equal(revoked(h).includes(A_ACCESS), false, "A's credential never reached Square");
      assert.deepEqual(await epochs(h), ["MERCHANT_B:1"], "B is the revocation-history target; A has no history");

      const other = await h.row("other-a-user");
      assert.equal(other.account_status, "active", "merchant A's other connection is untouched");
      assert.equal(h.accessOf(other), "other-a-access");

      const after = await h.row("owner");
      assert.equal(after.account_status, "disconnected");
      assert.equal(after.encrypted_access_token, null);
      assert.deepEqual(after.account_details, { merchantId: "MERCHANT_B" }, "plaintext gone, nothing sealed left behind");
      // reconcile (+1: the plaintext was a new credential) then disconnect (+1)
      assert.equal(Number(after.credential_generation), generationBefore + 2);
      assert.equal(JSON.stringify([h.logs]).includes(A_ACCESS) || JSON.stringify([h.logs]).includes(B_ACCESS), false, "no token in logs");
    });
  });

  test("the reconciled B credential is what is checked for sharing: another ACTIVE B connection means B is retained, not revoked", async () => {
    await run(async (h) => {
      h.useMerchant("MERCHANT_B", { access: "other-b-access", refresh: "other-b-refresh" });
      await h.connect("other-b-user");
      await connectedToA(h);
      await oldServerReconnect(h, "owner", "MERCHANT_B", plain(B_ACCESS, B_REFRESH));
      assert.deepEqual(await h.service.disconnect("owner"), { changed: true, providerRevocation: "retained_for_shared_connection", providerRevoked: false });
      assert.deepEqual(revoked(h), []);
      assert.deepEqual(await epochs(h), []);
    });
  });

  test("11. same merchant, a different fresh plaintext pair: the fresh pair is revoked, the stale sealed pair is not", async () => {
    await run(async (h) => {
      await connectedToA(h);
      await oldServerReconnect(h, "owner", "MERCHANT_A", plain("fresh-a-access", "fresh-a-refresh"));
      assert.equal((await h.service.disconnect("owner")).providerRevocation, "revoked");
      assert.deepEqual(revoked(h), ["fresh-a-access"]);
      assert.deepEqual(await epochs(h), ["MERCHANT_A:1"]);
    });
  });

  test("12. same merchant, the identical plaintext pair: redundant residue is removed and the (same) credential is revoked", async () => {
    await run(async (h) => {
      await connectedToA(h);
      const before = await h.generation("owner");
      await oldServerReconnect(h, "owner", "MERCHANT_A", plain(A_ACCESS, A_REFRESH));
      assert.equal((await h.service.disconnect("owner")).providerRevocation, "revoked");
      assert.deepEqual(revoked(h), [A_ACCESS]);
      assert.equal(await h.generation("owner"), before + 1, "no new credential: only the disconnect advanced the generation");
      assert.deepEqual((await h.row("owner")).account_details, { merchantId: "MERCHANT_A" });
    });
  });

  test("13. a different merchant with MALFORMED plaintext: fail closed -- nothing revoked, no history, stale sealed token not used, local disconnect completes", async () => {
    for (const details of [{ accessToken: B_ACCESS }, { accessToken: B_ACCESS, refreshToken: 12345, tokenExpiresAt: EXPIRY }, { accessToken: null }, { accessToken: B_ACCESS, refreshToken: B_REFRESH, tokenExpiresAt: "not-a-date" }]) {
      await run(async (h) => {
        await connectedToA(h);
        await oldServerReconnect(h, "owner", "MERCHANT_B", details);
        assert.deepEqual(await h.service.disconnect("owner"), { changed: true, providerRevocation: "unconfirmed", providerRevoked: false }, JSON.stringify(Object.keys(details)));
        assert.deepEqual(revoked(h), [], "no Square revoke, in particular not with A's stale sealed token");
        assert.deepEqual(await epochs(h), []);
        const after = await h.row("owner");
        assert.equal(after.account_status, "disconnected");
        assert.equal(after.encrypted_access_token, null);
        assert.deepEqual(after.account_details, { merchantId: "MERCHANT_B" });
      });
    }
  });

  test("14. the sealed pair cannot be opened while plaintext is present: unconfirmed, nothing revoked, local disconnect completes", async () => {
    await run(async (h) => {
      await connectedToA(h);
      await oldServerReconnect(h, "owner", "MERCHANT_B", plain(B_ACCESS, B_REFRESH));
      const saved = process.env[SECRET_BOX_KEY_ENV];
      process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
      try {
        assert.deepEqual(await h.service.disconnect("owner"), { changed: true, providerRevocation: "unconfirmed", providerRevoked: false });
      } finally { process.env[SECRET_BOX_KEY_ENV] = saved; }
      assert.deepEqual(revoked(h), []);
      assert.deepEqual(await epochs(h), []);
      const after = await h.row("owner");
      assert.equal(after.account_status, "disconnected");
      assert.deepEqual(after.account_details, { merchantId: "MERCHANT_B" });
    });
  });

  test("15. an encryption configuration failure during reconciliation: unconfirmed, nothing revoked, local disconnect completes", async () => {
    await run(async (h) => {
      await connectedToA(h);
      await oldServerReconnect(h, "owner", "MERCHANT_B", plain(B_ACCESS, B_REFRESH));
      const saved = process.env[SECRET_BOX_KEY_ENV];
      delete process.env[SECRET_BOX_KEY_ENV];
      try {
        assert.deepEqual(await h.service.disconnect("owner"), { changed: true, providerRevocation: "unconfirmed", providerRevoked: false });
      } finally { process.env[SECRET_BOX_KEY_ENV] = saved; }
      assert.deepEqual(revoked(h), []);
      assert.deepEqual(await epochs(h), []);
      assert.equal((await h.row("owner")).account_status, "disconnected");
    });
  });

  test("16. no confirmed revoke is ever recorded on an incoherent state, even when Square would have said success", async () => {
    await run(async (h) => {
      await connectedToA(h);
      await oldServerReconnect(h, "owner", "MERCHANT_B", { accessToken: B_ACCESS }); // one token only
      await h.service.disconnect("owner");
      assert.equal(h.fake.calls("/oauth2/revoke"), 0);
      assert.equal((await h.pool.query(`SELECT count(*)::int AS n FROM square_merchant_revocations`)).rows[0].n, 0);
    });
  });

  test("a clean sealed-only row is unaffected: the sealed token is revoked for its own merchant", async () => {
    await run(async (h) => {
      await connectedToA(h);
      assert.equal((await h.service.disconnect("owner")).providerRevocation, "revoked");
      assert.deepEqual(revoked(h), [A_ACCESS]);
      assert.deepEqual(await epochs(h), ["MERCHANT_A:1"]);
    });
  });

  test("a legacy expiry-only residue is stripped and the sealed credential is revoked normally", async () => {
    await run(async (h) => {
      await connectedToA(h);
      await h.pool.query(`UPDATE payment_methods SET account_details = account_details || '{"tokenExpiresAt":"2099-01-01T00:00:00Z"}'::jsonb WHERE user_id = 'owner'`);
      assert.equal((await h.service.disconnect("owner")).providerRevocation, "revoked");
      assert.deepEqual(revoked(h), [A_ACCESS]);
    });
  });

  test("long Square merchant ids (above 64 characters) persist and a confirmed disconnect records history and completes", async () => {
    for (const length of [65, 128, 255]) {
      await run(async (h) => {
        const merchant = `M${"x".repeat(length - 1)}`;
        h.useMerchant(merchant, { access: `long-${length}-access`, refresh: `long-${length}-refresh` });
        await h.connect("owner");
        assert.equal((await h.row("owner")).provider_id, merchant);
        assert.deepEqual(await h.service.disconnect("owner"), { changed: true, providerRevocation: "revoked", providerRevoked: true }, String(length));
        assert.deepEqual(await epochs(h), [`${merchant}:1`]);
        assert.equal((await h.row("owner")).account_status, "disconnected", "the local disconnect committed in the same transaction");
        // A second revocation of the same long id advances its epoch.
        h.useMerchant(merchant, { access: `long2-${length}-access`, refresh: `long2-${length}-refresh` });
        await h.connect("owner");
        assert.equal((await h.service.disconnect("owner")).providerRevocation, "revoked");
        assert.deepEqual(await epochs(h), [`${merchant}:2`]);
      });
    }
  });
}
