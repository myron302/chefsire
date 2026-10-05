/**
 * Staged plaintext enforcement. The initial deployment must stay compatible with a temporarily running OLD server, which keeps
 * writing plaintext OAuth tokens; only an explicit finalization step (run after old servers are drained) installs the constraint
 * that forbids them. Real PostgreSQL, the real `square` SDK against a local fake Square. Set TEST_DATABASE_URL to a loopback
 * database whose name contains "test"; skipped otherwise.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { withSquareHarness, type SquareHarness } from "../test-support/square-connection-harness";
import { finalizeSquarePlaintextEnforcement, plaintextEnforcementInstalled, plaintextRowIds, PLAINTEXT_CONSTRAINT } from "./square-plaintext-enforcement";
import type { SqlPool } from "./square-connection-service";
import { SECRET_BOX_KEY_ENV } from "./secret-box";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
process.env[SECRET_BOX_KEY_ENV] = randomBytes(32).toString("base64");
process.env.SQUARE_ENV = "sandbox";

if (!URL_ENV) {
  test("Square staged plaintext enforcement (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, {}, fn);
  const asPool = (h: SquareHarness) => h.pool as unknown as SqlPool;
  const EXPIRES_A = "2099-01-01T00:00:00Z";
  const EXPIRES_B = "2099-03-01T00:00:00Z";

  /** What the OLD application's OAuth callback did: upsert the connection with plaintext tokens in account_details. */
  async function oldServerCallback(h: SquareHarness, userId: string, tokens: { access: string; refresh: string; expires: string }) {
    await h.addUser(userId);
    const details = JSON.stringify({ merchantId: "MERCHANT_1", locationId: "OLD_LOC", accessToken: tokens.access, refreshToken: tokens.refresh, tokenExpiresAt: tokens.expires });
    const existing = await h.pool.query(`SELECT id FROM payment_methods WHERE user_id = $1 AND provider = 'square' ORDER BY created_at ASC LIMIT 1 FOR UPDATE`, [userId]);
    if (existing.rowCount) {
      await h.pool.query(`UPDATE payment_methods SET provider_id = $2, account_status = 'active', account_details = $3::jsonb, verified_at = now(), last_verified_at = now(), updated_at = now() WHERE id = $1`, [existing.rows[0].id, "MERCHANT_1", details]);
    } else {
      await h.pool.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_status, account_details, is_default, verified_at, last_verified_at) VALUES ($1, 'square', $2, 'active', $3::jsonb, true, now(), now())`, [userId, "MERCHANT_1", details]);
    }
  }

  test("initial deployment: an old server keeps writing plaintext tokens, INSERT and UPDATE, with every migration applied", async () => {
    await run(async (h) => {
      await oldServerCallback(h, "provider-1", { access: "old-access-1", refresh: "old-refresh-1", expires: EXPIRES_A });
      await oldServerCallback(h, "provider-1", { access: "old-access-2", refresh: "old-refresh-2", expires: EXPIRES_B }); // an old-server reconnect
      assert.equal((await h.row("provider-1")).account_details.accessToken, "old-access-2");
      assert.equal(await plaintextEnforcementInstalled(asPool(h)), false, "no migration installs enforcement");
      assert.deepEqual((await plaintextRowIds(asPool(h))).length, 1);
    });
  });

  test("mixed versions: a reconnect by an OLD server over a row the NEW application already converted is picked up, not ignored", async () => {
    await run(async (h) => {
      await oldServerCallback(h, "provider-1", { access: "mixed-access-1", refresh: "mixed-refresh-1", expires: EXPIRES_A });
      assert.equal((await h.service.getSquarePaymentReadiness("provider-1")).state, "active"); // the new app converts and verifies it
      const converted = await h.row("provider-1");
      assert.equal(h.accessOf(converted), "mixed-access-1");
      assert.equal(converted.account_details.accessToken, undefined);

      // The old server (still running) handles a reconnect and writes fresh plaintext over the converted row.
      await oldServerCallback(h, "provider-1", { access: "mixed-access-2", refresh: "mixed-refresh-2", expires: EXPIRES_B });
      const afterOld = await h.row("provider-1");
      assert.equal(h.accessOf(afterOld), "mixed-access-1", "until the new app looks, the sealed (older) credential is still stored");

      // The next time the new application checks the row it installs the NEWER credential, unverified, and re-verifies it.
      const readiness = await h.service.getSquarePaymentReadiness("provider-1");
      assert.equal(readiness.state, "active");
      const after = await h.row("provider-1");
      assert.equal(h.accessOf(after), "mixed-access-2");
      assert.equal(h.refreshOf(after), "mixed-refresh-2");
      assert.equal(after.account_details.accessToken, undefined);
      assert.equal(after.account_details.refreshToken, undefined);
      assert.ok(Number(after.credential_generation) > Number(converted.credential_generation), "the credential generation advanced");
      assert.equal(new Date(after.token_expires_at).toISOString(), "2099-03-01T00:00:00.000Z");
      assert.equal(after.location_id, "LOC_1", "location facts were re-verified with Square, not carried over from the old connection");
    });
  });

  test("plaintext that merely repeats the sealed credential is stale and is simply removed", async () => {
    await run(async (h) => {
      await oldServerCallback(h, "provider-1", { access: "stale-access-1", refresh: "stale-refresh-1", expires: EXPIRES_A });
      await h.service.getSquarePaymentReadiness("provider-1");
      const sealed = (await h.row("provider-1")).encrypted_access_token;
      await h.pool.query(`UPDATE payment_methods SET account_details = account_details || '{"accessToken":"stale-access-1","refreshToken":"stale-refresh-1","tokenExpiresAt":"${EXPIRES_A}"}'::jsonb`);
      await h.service.getSquarePaymentReadiness("provider-1");
      const after = await h.row("provider-1");
      assert.equal(after.encrypted_access_token, sealed, "the sealed credential was left alone");
      assert.equal(after.account_details.accessToken, undefined);
    });
  });

  test("a legacy row reconnected by the old server after a disconnect does not inherit the previous connection's facts", async () => {
    await run(async (h) => {
      h.useMerchant("MERCHANT_1", { access: "dc-access-1", refresh: "dc-refresh-1" });
      await h.connect("provider-1");
      await h.service.disconnect("provider-1");
      assert.equal((await h.row("provider-1")).location_id, "LOC_MERCHANT_1");
      await oldServerCallback(h, "provider-1", { access: "dc-access-2", refresh: "dc-refresh-2", expires: EXPIRES_B });
      await h.service.convertAllLegacyRows();
      const row = await h.row("provider-1");
      assert.equal(row.location_id, null);
      assert.equal(row.granted_scopes, null);
      assert.equal(row.last_verified_at, null, "everything must be verified afresh");
      assert.equal(row.account_status, "active");
    });
  });

  test("finalization refuses without explicit confirmation and changes nothing", async () => {
    await run(async (h) => {
      assert.deepEqual(await finalizeSquarePlaintextEnforcement(asPool(h), { oldServersDrained: false }), { ok: false, reason: "confirmation_required" });
      assert.equal(await plaintextEnforcementInstalled(asPool(h)), false);
    });
  });

  test("finalization refuses while any plaintext token remains, naming rows by id only, and installs nothing", async () => {
    await run(async (h) => {
      await oldServerCallback(h, "provider-1", { access: "remain-access-1", refresh: "remain-refresh-1", expires: EXPIRES_A });
      const result = await finalizeSquarePlaintextEnforcement(asPool(h), { oldServersDrained: true });
      assert.equal(result.ok, false);
      assert.equal(result.ok === false && result.reason, "plaintext_rows_remain");
      assert.deepEqual(result.ok === false && "rows" in result ? result.rows : [], [(await h.row("provider-1")).id]);
      assert.equal(JSON.stringify(result).includes("remain-access-1"), false, "no token in the report");
      assert.equal(await plaintextEnforcementInstalled(asPool(h)), false);
      // Old servers can still write: nothing was installed.
      await oldServerCallback(h, "provider-1", { access: "remain-access-2", refresh: "remain-refresh-2", expires: EXPIRES_B });
    });
  });

  test("once every row is converted, finalization installs and VALIDATES the constraint; afterwards plaintext writes are rejected; re-running is a no-op", async () => {
    await run(async (h) => {
      await oldServerCallback(h, "provider-1", { access: "final-access-1", refresh: "final-refresh-1", expires: EXPIRES_A });
      await oldServerCallback(h, "provider-2", { access: "final-access-2", refresh: "final-refresh-2", expires: EXPIRES_A });
      assert.equal((await h.service.convertAllLegacyRows()).converted, 2);
      assert.deepEqual(await plaintextRowIds(asPool(h)), []);

      assert.deepEqual(await finalizeSquarePlaintextEnforcement(asPool(h), { oldServersDrained: true }), { ok: true, state: "installed" });
      assert.equal(await plaintextEnforcementInstalled(asPool(h)), true);
      const constraint = (await h.pool.query(`SELECT convalidated FROM pg_constraint WHERE conname = $1 AND conrelid = 'payment_methods'::regclass`, [PLAINTEXT_CONSTRAINT])).rows[0];
      assert.equal(constraint.convalidated, true);

      // The old callback is now rejected, and so is any plaintext, nested or not.
      await assert.rejects(oldServerCallback(h, "provider-1", { access: "late-old-server", refresh: "late-old-server", expires: EXPIRES_B }), (error: { code?: string }) => error.code === "23514");
      await h.addUser("provider-3");
      await assert.rejects(h.pool.query(`INSERT INTO payment_methods (user_id, provider, provider_id, account_details) VALUES ('provider-3', 'square', 'M', '{"refreshToken":"x"}'::jsonb)`), (error: { code?: string }) => error.code === "23514");
      // The new application is unaffected.
      h.useMerchant("MERCHANT_1", { access: "post-final-access", refresh: "post-final-refresh" });
      await h.connect("provider-3");
      assert.equal((await h.service.getSquarePaymentReadiness("provider-3")).state, "active");

      assert.deepEqual(await finalizeSquarePlaintextEnforcement(asPool(h), { oldServersDrained: true }), { ok: true, state: "already_installed" });
    });
  });

  test("the finalization script is explicit and is not part of the automatic migration sequence", () => {
    const script = fs.readFileSync(path.join(root, "server/scripts/finalize-square-plaintext-enforcement.ts"), "utf8");
    assert.match(script, /--confirm-old-servers-drained/);
    assert.match(script, /--check/);
    assert.match(script, /never prints a token/i);
    // Without the flag it only reports; it never installs by default.
    assert.match(script, /process\.argv\.includes\("--check"\) \|\| !process\.argv\.includes\("--confirm-old-servers-drained"\)/);
    for (const dir of ["server/migrations", "server/drizzle"]) {
      for (const file of fs.readdirSync(path.join(root, dir)).filter((name) => name.endsWith(".sql"))) {
        assert.equal(fs.readFileSync(path.join(root, dir, file), "utf8").replace(/^--.*$/gm, "").includes("finalize-square"), false, file);
      }
    }
  });
}
