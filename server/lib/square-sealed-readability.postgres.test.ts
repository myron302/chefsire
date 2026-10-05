/**
 * A sealed credential counts only if it can actually be OPENED. (1) A same-merchant sibling suppresses a merchant-wide revoke only when both
 * its ciphertexts authenticate under the current/previous key with that row's own AAD; (2) key-rotation reseal opens every structurally
 * complete pair before calling it already-current. Tampered, malformed, retired-key and copied-from-another-row ciphertexts are unusable.
 * Real PostgreSQL; set TEST_DATABASE_URL (loopback, name contains "test").
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { withSquareHarness, type SquareHarness } from "../test-support/square-connection-harness";
import { SECRET_BOX_KEY_ENV, encryptSecret } from "./secret-box";

process.env.SQUARE_APPLICATION_ID = "app-id-test";
process.env.SQUARE_APPLICATION_SECRET = "app-secret-test";
const KEY_A = randomBytes(32).toString("base64"); // the previous key
const KEY_B = randomBytes(32).toString("base64"); // the current key
const KEY_C = randomBytes(32).toString("base64"); // a retired key: neither current nor previous
process.env[SECRET_BOX_KEY_ENV] = KEY_B;
process.env.SQUARE_ENV = "sandbox";
const PREVIOUS = "SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY_PREVIOUS";
process.env[PREVIOUS] = KEY_A;

const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
const SENTINEL = "rd-secret-";

if (!URL_ENV) {
  test("Square sealed readability (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: SquareHarness) => Promise<void>) => withSquareHarness(URL_ENV, {}, fn);
  async function underKey<T>(current: string, previous: string | undefined, fn: () => Promise<T>): Promise<T> {
    const saved = { c: process.env[SECRET_BOX_KEY_ENV], p: process.env[PREVIOUS] };
    process.env[SECRET_BOX_KEY_ENV] = current;
    if (previous === undefined) delete process.env[PREVIOUS]; else process.env[PREVIOUS] = previous;
    try { return await fn(); } finally {
      process.env[SECRET_BOX_KEY_ENV] = saved.c;
      if (saved.p === undefined) delete process.env[PREVIOUS]; else process.env[PREVIOUS] = saved.p;
    }
  }
  /** Connect `user` to `merchant` with the given tokens, sealed under `key` (current) -- the previous key is irrelevant while connecting. */
  const connectUnder = (h: SquareHarness, key: string, user: string, merchant: string, n: string) =>
    underKey(key, undefined, async () => { h.useMerchant(merchant, { access: `${SENTINEL}access-${n}`, refresh: `${SENTINEL}refresh-${n}` }); await h.connect(user); });

  /** Flip a ciphertext character so authentication fails while the value still looks sealed. */
  const tamper = (sealed: string) => {
    const parts = sealed.split(":");
    parts[4] = (parts[4][0] === "A" ? "B" : "A") + parts[4].slice(1);
    return parts.join(":");
  };
  const setColumn = (h: SquareHarness, user: string, column: "encrypted_access_token" | "encrypted_refresh_token", value: string) =>
    h.pool.query(`UPDATE payment_methods SET ${column} = $2 WHERE user_id = $1`, [user, value]);

  /* ---------------- shared-merchant decision ---------------- */
  const siblingMakers: Array<[string, (h: SquareHarness) => Promise<void>]> = [
    ["tampered access ciphertext", async (h) => setColumn(h, "other", "encrypted_access_token", tamper((await h.row("other")).encrypted_access_token))],
    ["tampered refresh ciphertext", async (h) => setColumn(h, "other", "encrypted_refresh_token", tamper((await h.row("other")).encrypted_refresh_token))],
    ["retired-key ciphertext", async (h) => {
      const row = await h.row("other");
      await underKey(KEY_C, undefined, async () => {
        await setColumn(h, "other", "encrypted_access_token", encryptSecret("x-access", `payment_methods:${row.id}:square_access_token`));
        await setColumn(h, "other", "encrypted_refresh_token", encryptSecret("x-refresh", `payment_methods:${row.id}:square_refresh_token`));
      });
    }],
    ["malformed sqenc-looking ciphertext", async (h) => setColumn(h, "other", "encrypted_access_token", "sqenc:v1:garbage")],
    ["ciphertext sealed for ANOTHER row (AAD mismatch)", async (h) => {
      const main = await h.row("main");
      await setColumn(h, "other", "encrypted_access_token", main.encrypted_access_token);
      await setColumn(h, "other", "encrypted_refresh_token", main.encrypted_refresh_token);
    }],
  ];
  const twoOnMerchant = async (h: SquareHarness, otherKey: string) => {
    await connectUnder(h, otherKey, "other", "MERCHANT_1", "other");
    await connectUnder(h, KEY_B, "main", "MERCHANT_1", "main");
  };

  for (const [name, make] of siblingMakers) {
    test(`shared merchant: a sibling with ${name} is NOT usable -- the disconnect revokes at Square and records history instead of claiming it was retained`, async () => {
      await run(async (h) => {
        await twoOnMerchant(h, KEY_B);
        await make(h);
        const before = JSON.stringify(await h.row("other"));
        const result = await h.service.disconnect("main");
        assert.deepEqual(result, { changed: true, providerRevocation: "revoked", providerRevoked: true });
        assert.equal(h.fake.calls("/oauth2/revoke"), 1);
        assert.deepEqual((await h.pool.query(`SELECT merchant_id FROM square_merchant_revocations`)).rows, [{ merchant_id: "MERCHANT_1" }]);
        assert.equal(JSON.stringify(await h.row("other")), before, "the unreadable sibling is preserved for remediation, not altered");
        assert.equal(JSON.stringify(h.logs).includes(SENTINEL), false, "no token material in logs");
      });
    });
  }

  test("shared merchant: a healthy CURRENT-key sibling still suppresses the revoke", async () => {
    await run(async (h) => {
      await twoOnMerchant(h, KEY_B);
      assert.deepEqual(await h.service.disconnect("main"), { changed: true, providerRevocation: "retained_for_shared_connection", providerRevoked: false });
      assert.equal(h.fake.calls("/oauth2/revoke"), 0);
    });
  });

  test("shared merchant: a healthy PREVIOUS-key sibling (still decryptable during the rotation window) still suppresses the revoke", async () => {
    await run(async (h) => {
      await twoOnMerchant(h, KEY_A); // the sibling is sealed under the previous key; current is KEY_B with KEY_A as previous
      assert.deepEqual(await h.service.disconnect("main"), { changed: true, providerRevocation: "retained_for_shared_connection", providerRevoked: false });
    });
  });

  test("shared merchant, concurrency: two usable same-merchant accounts disconnecting at once still revoke exactly once", async () => {
    await run(async (h) => {
      await twoOnMerchant(h, KEY_B);
      const results = await Promise.all([h.service.disconnect("main"), h.service.disconnect("other")]);
      assert.deepEqual(results.map((result) => result.providerRevocation).sort(), ["retained_for_shared_connection", "revoked"]);
      assert.equal(h.fake.calls("/oauth2/revoke"), 1);
    });
  });

  /* ---------------- reseal ---------------- */
  type Scenario = { user: string; key: string; n: string; mutate?: (h: SquareHarness) => Promise<void> };
  const scenarios: Scenario[] = [
    { user: "bad-access", key: KEY_B, n: "1", mutate: async (h) => setColumn(h, "bad-access", "encrypted_access_token", tamper((await h.row("bad-access")).encrypted_access_token)) },
    { user: "bad-refresh", key: KEY_B, n: "2", mutate: async (h) => setColumn(h, "bad-refresh", "encrypted_refresh_token", tamper((await h.row("bad-refresh")).encrypted_refresh_token)) },
    { user: "mal-access", key: KEY_B, n: "3", mutate: async (h) => setColumn(h, "mal-access", "encrypted_access_token", "sqenc:v1:bad") },
    { user: "mal-refresh", key: KEY_B, n: "4", mutate: async (h) => setColumn(h, "mal-refresh", "encrypted_refresh_token", "sqenc:v1:bad") },
    { user: "retired", key: KEY_C, n: "5" },
    { user: "prev-1", key: KEY_A, n: "6" },
    { user: "current-1", key: KEY_B, n: "7" },
    { user: "prev-2", key: KEY_A, n: "8" },
  ];
  const BAD = ["bad-access", "bad-refresh", "mal-access", "mal-refresh", "retired"];

  test("reseal: unreadable complete pairs are FAILED (not alreadyCurrent), later healthy rows still rotate, dry run and real run agree", async () => {
    await run(async (h) => {
      for (const scenario of scenarios) {
        await connectUnder(h, scenario.key, scenario.user, `M_${scenario.user}`, scenario.n);
        await scenario.mutate?.(h);
      }
      const id = async (user: string) => String((await h.row(user)).id);
      const snapshot = async () => JSON.stringify((await h.pool.query(`SELECT * FROM payment_methods ORDER BY user_id`)).rows);
      const before = await snapshot();
      const expectedFailed = (await Promise.all(BAD.map(id))).sort();

      const dry = await h.service.resealRotatedCredentials({ dryRun: true });
      assert.deepEqual(dry.failed.map((entry) => entry.id).sort(), expectedFailed);
      assert.equal(dry.failed.every((entry) => entry.reason === "cannot_decrypt"), true);
      assert.equal(dry.alreadyCurrent, 1, "only the authenticated current-key pair is already current");
      assert.equal(dry.resealed, 2, "the two previous-key pairs");
      assert.equal(dry.checked, scenarios.length);
      assert.equal(await snapshot(), before, "dry run writes nothing");

      const real = await h.service.resealRotatedCredentials();
      assert.deepEqual(real, dry, "real run classifies exactly as the dry run");
      assert.equal(JSON.stringify(real).includes(SENTINEL), false, "failure reporting is ids and reasons only");
      assert.equal(JSON.stringify(h.logs).includes(SENTINEL), false);

      for (const user of ["prev-1", "prev-2"]) {
        const row = await h.row(user);
        assert.equal(h.accessOf(row), `${SENTINEL}access-${user === "prev-1" ? "6" : "8"}`, "both tokens re-sealed under the current key");
        assert.equal(h.refreshOf(row), `${SENTINEL}refresh-${user === "prev-1" ? "6" : "8"}`);
      }
      assert.equal((await h.row("current-1")).encrypted_access_token, JSON.parse(before).find((row: { user_id: string }) => row.user_id === "current-1").encrypted_access_token, "healthy current-key pair untouched");
      for (const user of BAD) {
        const was = JSON.parse(before).find((row: { user_id: string }) => row.user_id === user);
        const now = await h.row(user);
        assert.equal(now.encrypted_access_token, was.encrypted_access_token, `${user}: written with no replacement`);
        assert.equal(now.encrypted_refresh_token, was.encrypted_refresh_token);
      }

      // A second real run: the healthy rows are now current, the unreadable ones are reported again, never "alreadyCurrent".
      const again = await h.service.resealRotatedCredentials();
      assert.equal(again.alreadyCurrent, 3);
      assert.equal(again.resealed, 0);
      assert.deepEqual(again.failed.map((entry) => entry.id).sort(), expectedFailed);
    });
  });

  test("reseal: a valid current-key pair opens and is alreadyCurrent; valid previous-key pairs reseal (alone)", async () => {
    await run(async (h) => {
      await connectUnder(h, KEY_B, "current", "M_c", "1");
      await connectUnder(h, KEY_A, "previous", "M_p", "2");
      assert.deepEqual(await h.service.resealRotatedCredentials(), { checked: 2, resealed: 1, alreadyCurrent: 1, failed: [] });
    });
  });
}
