/**
 * P2-4: premium / membership-only drink-collection contents were returned by public list endpoints.
 *
 * Real HTTP against the real drinks router, the real requireAuth/optionalAuth and the real collection-access model
 * (completed purchase | owned bundle | active membership | creator), with the SQL executed by a REAL local PostgreSQL
 * (set CS_TEST_PG_URL; skipped otherwise; loopback-only guard first).
 *
 * Invariant: the full item list of a non-public collection is only ever serialized for a viewer the canonical access model
 * entitles. Everyone else gets, at most, the intentionally public preview (first PREVIEW items) plus the total count.
 */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import pg from "pg";
import type { AddressInfo } from "node:net";
import { getTableColumns, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";
import { testAuthHeader } from "../test-support/auth-test-env";

process.env.DATABASE_URL ||= "postgres://u:p@p24-tests.invalid/none";
const PG_URL = process.env.CS_TEST_PG_URL;

if (!PG_URL) {
  test("drink collection premium access (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const local = new pg.Pool(parseLocalTestDatabaseUrl(PG_URL));
  const { pool } = await import("../db/index");
  (pool as any).connect = () => local.connect();
  (pool as any).query = (q: any, params?: any[]) => (typeof q === "string" ? local.query(q, params) : local.query(params ? { ...q, values: params } : q));

  const schema = await import("../../shared/schema");
  const dialect = new PgDialect();
  const ddl = (table: any, name: string, extra = "") => {
    const cols = Object.values(getTableColumns(table)).map((c: any) => {
      const type = ({ PgInteger: "integer", PgBoolean: "boolean", PgTimestamp: "timestamp", PgJsonb: "jsonb", PgNumeric: "numeric", PgReal: "real", PgSerial: "serial" } as Record<string, string>)[c.columnType] ?? "text";
      let def = "";
      if (c.hasDefault && c.default !== undefined) {
        def = typeof c.default === "object" && c.default !== null && "queryChunks" in c.default
          ? ` DEFAULT ${dialect.sqlToQuery(c.default as SQL).sql}`
          : typeof c.default === "string" ? ` DEFAULT '${c.default.replace(/'/g, "''")}'` : ` DEFAULT ${c.default}`;
      }
      return `${c.name} ${type}${c.primary ? " PRIMARY KEY" : ""}${def}`;
    });
    return `CREATE TABLE ${name} (${cols.join(",")}${extra})`;
  };

  // Reset only the tables this suite owns (the lazily-created collection tables + their parents), not the whole schema.
  const owned = (await local.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND (tablename LIKE 'drink\\_%' OR tablename LIKE 'creator\\_%')`,
  )).rows.map((r: any) => `"${r.tablename}"`);
  await local.query(`DROP TABLE IF EXISTS ${[...owned, "users"].join(", ")} CASCADE`);
  await local.query(`
    ${ddl(schema.users, "users", ", UNIQUE (username), UNIQUE (email)")};
    ${ddl(schema.drinkRecipes, "drink_recipes")};
    ${ddl(schema.drinkEvents, "drink_events")};
    -- Was an id column and nothing else, which was enough while /community-search could not get this far: it
    -- failed on its external fetch first. With that stubbed, the route reached its own challenges query, which
    -- selects slug, and returned a 500 -- so the community-search leg of test I was asserting against an empty
    -- response and proving nothing. Built from the real schema now.
    ${ddl(schema.drinkChallenges, "drink_challenges")};
  `);

  const { default: drinksRouter } = await import("./drinks");
  const app = express();
  app.use(express.json());
  app.use("/api/drinks", drinksRouter);
  const server = app.listen(0);

  // The recommended-drinks route reaches thecocktaildb.com. That call is nothing to do with premium access, and
  // leaving it live made this suite depend on the internet: offline, the rejection landed AFTER the test that
  // triggered it had ended, so the runner reported the whole FILE as failed while all 29 subtests passed. Only
  // outbound requests are answered here; the suite's own requests to its loopback server go through untouched.
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Parameters<typeof realFetch>[0], init?: Parameters<typeof realFetch>[1]) => {
    const target = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(target)) return realFetch(input, init);
    return new Response(JSON.stringify({ drinks: null }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof realFetch;

  test.after(async () => { globalThis.fetch = realFetch; server.close(); await local.end(); });
  const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/drinks`;

  // Slugs deliberately unresolvable as canonical drinks so they are looked up in drink_recipes.
  const slugsOf = (prefix: string) => [1, 2, 3, 4].map((n) => `p24-${prefix}-${n}`);
  const PREVIEW = 2;
  const ids: Record<string, string> = {};
  const col: Record<string, string> = {};
  let bundleId = "";

  const user = async (key: string) => {
    ids[key] = (await local.query(
      `INSERT INTO users (username, email, display_name, password, subscription_tier, monthly_revenue, google_id)
       VALUES ($1, $2, $1, 'x', 'free', '0', NULL) RETURNING id`, [key, `${key}@example.test`],
    )).rows[0].id;
  };
  const collection = async (key: string, accessType: string, isPublic = true, price = 0) => {
    col[key] = (await local.query(
      `INSERT INTO drink_collections (user_id, name, description, is_public, access_type, is_premium, price_cents)
       VALUES ($1, $2, 'public blurb', $3, $4, $5, $6) RETURNING id`,
      [ids.creator, `col-${key}`, isPublic, accessType, accessType !== "public", price],
    )).rows[0].id;
    for (const [i, slug] of slugsOf(key).entries()) {
      await local.query(`INSERT INTO drink_recipes (id, slug, name, category, user_id) VALUES (gen_random_uuid(), $1, $1, 'cocktails', $2) ON CONFLICT DO NOTHING`, [slug, ids.creator]).catch(() => undefined);
      await local.query(`INSERT INTO drink_collection_items (collection_id, drink_slug, added_at) VALUES ($1, $2, now() + ($3 || ' seconds')::interval)`, [col[key], slug, String(i)]);
    }
  };
  const grant = (userKey: string, colKey: string, status = "completed") =>
    local.query(`INSERT INTO drink_collection_purchases (user_id, collection_id, status) VALUES ($1, $2, $3)`, [ids[userKey], col[colKey], status]);

  const get = async (path: string, as?: string, extraHeaders: Record<string, string> = {}) => {
    const res = await fetch(`${base()}${path}`, { headers: { ...(as ? testAuthHeader(ids[as]) : {}), ...extraHeaders } });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* non-json */ }
    return { status: res.status, text, json };
  };
  const leaked = (text: string, key: string) => slugsOf(key).slice(PREVIEW).filter((s) => text.includes(s));

  test.before(async () => {
    for (const k of ["creator", "anon_placeholder", "nonent", "buyer", "refunded", "revoked", "pending_refund", "bundler", "member", "expired_member"]) await user(k);
    // Warm the lazily-created collections schema (needs users) before seeding.
    await get("/collections/explore");
    await collection("free", "public");
    await collection("prem", "premium_purchase", true, 500);
    await collection("memb", "membership_only", true, 0);
    await grant("buyer", "prem");
    await grant("refunded", "prem", "refunded");
    await grant("revoked", "prem", "revoked");
    await grant("pending_refund", "prem", "refunded_pending");
    bundleId = (await local.query(`INSERT INTO drink_bundles (user_id, name, slug, is_public, is_premium, price_cents) VALUES ($1, 'bundle', 'p24-bundle', true, true, 900) RETURNING id`, [ids.creator])).rows[0].id;
    await local.query(`INSERT INTO drink_bundle_items (bundle_id, collection_id, sort_order) VALUES ($1, $2, 0)`, [bundleId, col.prem]);
    await local.query(`INSERT INTO drink_bundle_purchases (user_id, bundle_id, status) VALUES ($1, $2, 'completed')`, [ids.bundler, bundleId]);
    const plan = (await local.query(`INSERT INTO creator_membership_plans (creator_user_id, slug, name, price_cents) VALUES ($1, 'p24-plan', 'plan', 300) RETURNING id`, [ids.creator])).rows[0].id;
    await local.query(`INSERT INTO creator_memberships (user_id, creator_user_id, plan_id, status, ends_at) VALUES ($1, $2, $3, 'active', now() + interval '30 days')`, [ids.member, ids.creator, plan]);
    await local.query(`INSERT INTO creator_memberships (user_id, creator_user_id, plan_id, status, ends_at) VALUES ($1, $2, $3, 'active', now() - interval '1 day')`, [ids.expired_member, ids.creator, plan]);
  });

  const listEndpoints = (limitQuery = "") => [
    `/collections/explore${limitQuery}`,
    `/collections/featured${limitQuery}`,
    `/collections/public/${ids.creator}${limitQuery}`,
  ];
  const cardOf = (json: any, key: string) => (json.collections ?? []).find((c: any) => c.id === col[key]);
  const nonEntitled: Array<[string, string | undefined]> = [
    ["anonymous", undefined], ["authenticated non-entitled", "nonent"], ["refunded", "refunded"], ["revoked", "revoked"],
    ["refund-pending", "pending_refund"], ["expired membership", "expired_member"],
  ];

  for (const [label, as] of nonEntitled) {
    test(`A/B/G/L ${label}: public list endpoints expose only the preview of premium + membership collections`, async () => {
      for (const path of listEndpoints()) {
        const r = await get(path, as);
        assert.equal(r.status, 200, path);
        for (const key of ["prem", "memb"]) {
          const card = cardOf(r.json, key);
          assert.ok(card, `${path} still lists ${key} for discovery`);
          assert.deepEqual(leaked(r.text, key), [], `${path} leaked ${key} payload to ${label}`);
          assert.ok(card.items.length <= PREVIEW, `${path} ${key} items bounded to preview`);
          assert.equal(card.itemsCount, 4, "public total count preserved");
          assert.equal(card.isLocked, true);
          assert.equal(card.ownedByViewer, false);
          assert.equal(card.name, `col-${key}`);
        }
      }
    });

    test(`J ${label}: collection detail applies the entitlement gate (original vulnerable URLs)`, async () => {
      for (const key of ["prem", "memb"]) {
        const r = await get(`/collections/${col[key]}`, as);
        assert.equal(r.status, 200);
        assert.deepEqual(leaked(r.text, key), []);
        assert.equal(r.json.collection.isLocked, true);
        assert.ok(r.json.collection.items.length <= PREVIEW);
      }
    });

    test(`bundle endpoints for ${label} do not leak the included premium collection items`, async () => {
      for (const path of ["/bundles/explore", `/bundles/public/${ids.creator}`, `/bundles/${bundleId}`]) {
        const r = await get(path, as);
        assert.equal(r.status, 200, path);
        assert.deepEqual(leaked(r.text, "prem"), [], `${path} leaked premium items`);
      }
    });
  }

  test("H pagination / limit / offset cannot be used to page premium items out", async () => {
    for (const q of ["?limit=1", "?limit=1&offset=1", "?limit=100&offset=0", "?limit=1000", "?offset=1"]) {
      for (const path of listEndpoints(q)) {
        const r = await get(path, "nonent");
        assert.equal(r.status, 200, path);
        for (const key of ["prem", "memb"]) assert.deepEqual(leaked(r.text, key), [], `${path}${q}`);
      }
    }
  });

  test("I search / discovery / recommendation endpoints do not carry premium collection items", async () => {
    for (const path of ["/search?q=p24", "/community-search?q=p24", "/recommended", "/collections/wishlist", "/collections/purchased"]) {
      const r = await get(path, "nonent");
      for (const key of ["prem", "memb"]) assert.deepEqual(leaked(r.text, key), [], path);
    }
    const anon = await get("/search?q=p24-prem");
    assert.deepEqual(leaked(anon.text, "prem"), []);
  });

  test("K spoofed client fields cannot manufacture entitlement", async () => {
    const spoof = `ownedByViewer=true&isOwner=true&userId=${ids.buyer}&viewerId=${ids.buyer}&ownerId=${ids.creator}&accessType=public&isLocked=false&grant=direct_purchase&unlock=1`;
    const headers = { "x-user-id": ids.buyer, "x-viewer-id": ids.buyer, "x-forwarded-user": ids.buyer };
    for (const path of [...listEndpoints(`?${spoof}`), `/collections/${col.prem}?${spoof}`, `/bundles/${bundleId}?${spoof}`]) {
      for (const as of [undefined, "nonent"]) {
        const r = await get(path, as, headers);
        assert.deepEqual(leaked(r.text, "prem"), [], `${path} as ${as}`);
      }
    }
    // A forged / wrong-user bearer is just not authenticated: no entitlement either.
    const forged = await fetch(`${base()}/collections/${col.prem}`, { headers: { authorization: "Bearer not.a.jwt" } });
    assert.deepEqual(leaked(await forged.text(), "prem"), []);
  });

  const entitled: Array<[string, string]> = [
    ["C verified purchaser (completed)", "buyer"], ["E creator/owner", "creator"], ["bundle purchaser", "bundler"],
  ];
  for (const [label, as] of entitled) {
    test(`${label}: full premium contents remain available via list + detail`, async () => {
      for (const path of [...listEndpoints(), `/collections/${col.prem}`]) {
        const r = await get(path, as);
        const card = r.json.collection ?? cardOf(r.json, "prem");
        assert.equal(card.items.length, 4, path);
        assert.notEqual(card.isLocked, true, path);
        assert.equal(card.ownedByViewer, true, path);
      }
    });
  }

  test("active membership unlocks membership_only (and only that) collection", async () => {
    const memb = await get(`/collections/${col.memb}`, "member");
    assert.equal(memb.json.collection.items.length, 4);
    const prem = await get(`/collections/${col.prem}`, "member");
    assert.deepEqual(leaked(prem.text, "prem"), []);
    const list = await get("/collections/explore", "member");
    assert.equal(cardOf(list.json, "memb").items.length, 4);
    assert.ok(cardOf(list.json, "prem").items.length <= PREVIEW);
  });

  test("J search withholds the premium payload without hiding it from the people entitled to it", async () => {
    // The other half of the fix. Withholding is easy to get wrong in the generous direction (a buyer can no
    // longer find what they paid for) and that failure is invisible: search simply returns less. So the
    // entitled cases are asserted explicitly, and so is the free collection, whose items are public by the
    // creator's own choice and must never be touched by this.
    const all = (key: string) => slugsOf(key);
    for (const path of ["/search?q=p24", "/community-search?q=p24"]) {
      for (const as of ["buyer", "creator"]) {
        const r = await get(path, as);
        const found = all("prem").filter((slug) => r.text.includes(slug));
        assert.deepEqual(found, all("prem"), `${path} as ${as}: every item of a collection they can access`);
      }
      // The member can reach the membership collection but not the purchase one.
      const member = await get(path, "member");
      assert.deepEqual(all("memb").filter((s) => member.text.includes(s)), all("memb"), `${path} as member`);
      assert.deepEqual(leaked(member.text, "prem"), [], `${path} as member must not reach the purchase collection`);
      // Public collection items are public to everyone, signed in or not.
      for (const as of [undefined, "nonent"]) {
        const r = await get(path, as);
        assert.deepEqual(all("free").filter((s) => r.text.includes(s)), all("free"), `${path} as ${as}: free stays free`);
      }
      // And the preview really is the storefront preview, not nothing: a non-entitled viewer still sees it.
      const nonent = await get(path, "nonent");
      assert.deepEqual(
        all("prem").filter((s) => nonent.text.includes(s)),
        all("prem").slice(0, PREVIEW),
        `${path}: a non-entitled viewer sees exactly the preview, which also proves this path returns results`,
      );
    }
  });

  test("K every endpoint that reads drink_recipes applies the gate, or provably has nothing to gate", async () => {
    // Search was not the only route reading drink_recipes without going through the boundary -- it was the one a
    // test happened to cover. These are every other such route in the file. The ones that return nothing to gate
    // are asserted too, so that a later change which starts returning recipes from them fails here.
    const premSlug = slugsOf("prem")[PREVIEW];
    const withheldOf = (text: string) => leaked(text, "prem").concat(leaked(text, "memb"));

    for (const as of [undefined, "nonent"]) {
      for (const path of ["/remixes", "/most-remixed", "/recommended", "/whats-new", `/creators/${ids.creator}`]) {
        const r = await get(path, as);
        assert.deepEqual(withheldOf(r.text), [], `${path} as ${as ?? "anon"}`);
      }

      // Returns the requested drink itself, so a guessable slug was enough to read it. A withheld slug gets the
      // same answer as one that does not exist, which also stops the response confirming it is there.
      const chain = await get(`/remix-chain/${premSlug}`, as);
      assert.equal(chain.status, 404, "a withheld slug is indistinguishable from a missing one");

      // Echoes the slug the caller supplied, which discloses nothing; its items are other people's recipes and
      // are gated.
      const remixes = await get(`/remixes/${premSlug}`, as);
      assert.equal(remixes.status, 200);
      assert.deepEqual(remixes.json.items, [], "no remix of a withheld drink is named");
    }

    // The creator still sees their whole storefront, and the buyer still reaches the chain they paid for.
    const own = await get(`/creators/${ids.creator}`, "creator");
    assert.deepEqual(
      slugsOf("prem").filter((slug) => own.text.includes(slug)),
      slugsOf("prem"),
      "ownership is a grant: the creator sees every item of their own collection",
    );
    for (const as of ["creator", "buyer"]) {
      assert.equal((await get(`/remix-chain/${premSlug}`, as)).status, 200, `${as} can open the chain`);
    }
  });

  test("L a drink in more than one collection, and who is allowed to make it public", async () => {
    // Greptile on #1530: every slug in the tests above sat in exactly one collection, so the rule that keeps a
    // drink searchable when one of its collections exposes it was never exercised -- an implementation that
    // withheld a slug the moment ANY collection locked it would have passed. These are the shared cases, and
    // they also pin the ownership condition Codex found missing.
    const premSlug = slugsOf("prem")[PREVIEW];
    const visible = async (path: string, as: string | undefined, slug: string) =>
      (await get(path, as)).text.includes(slug);

    // Starting point: withheld from a non-entitled viewer.
    assert.equal(await visible("/search?q=p24", "nonent", premSlug), false);

    // The creator puts the same drink in their own public collection. That is the creator's own choice, so it
    // is public now -- the whole reason the rule is per slug and not per collection.
    await local.query(
      `INSERT INTO drink_collection_items (collection_id, drink_slug, added_at) VALUES ($1, $2, now())`,
      [col.free, premSlug],
    );
    assert.equal(await visible("/search?q=p24", "nonent", premSlug), true, "the creator can publish their own drink");
    await local.query(`DELETE FROM drink_collection_items WHERE collection_id = $1 AND drink_slug = $2`, [col.free, premSlug]);
    assert.equal(await visible("/search?q=p24", "nonent", premSlug), false, "and withdraw it again");

    // Someone else puts it in THEIR public collection. That must change nothing: otherwise anyone who learned a
    // withheld slug could publish another creator's paid item by adding it to a collection of their own.
    const foreign = (await local.query(
      `INSERT INTO drink_collections (user_id, name, description, is_public, access_type, is_premium, price_cents)
       VALUES ($1, 'foreign-public', 'blurb', true, 'public', false, 0) RETURNING id`,
      [ids.nonent],
    )).rows[0].id;
    await local.query(
      `INSERT INTO drink_collection_items (collection_id, drink_slug, added_at) VALUES ($1, $2, now())`,
      [foreign, premSlug],
    );
    for (const as of [undefined, "nonent"]) {
      assert.equal(
        await visible("/search?q=p24", as, premSlug),
        false,
        `a collection owned by someone else cannot publish another creator's paid drink (as ${as ?? "anon"})`,
      );
      assert.equal((await get(`/user/${premSlug}`, as)).status, 404, "nor make the recipe itself readable");
    }
    // And the people entitled to it are still unaffected by any of this.
    for (const as of ["buyer", "creator"]) {
      assert.equal(await visible("/search?q=p24", as, premSlug), true, `${as} still finds it`);
      assert.equal((await get(`/user/${premSlug}`, as)).status, 200, `${as} can still read it`);
    }
    await local.query(`DELETE FROM drink_collections WHERE id = $1`, [foreign]);

    // Inside the preview of a second locked collection the creator owns: visible, because the preview is public
    // by design. Position is added_at then slug, so inserting in the past puts it first.
    await local.query(
      `INSERT INTO drink_collection_items (collection_id, drink_slug, added_at) VALUES ($1, $2, now() - interval '1 day')`,
      [col.memb, premSlug],
    );
    assert.equal(await visible("/search?q=p24", "nonent", premSlug), true, "within a preview, so public");
    await local.query(`DELETE FROM drink_collection_items WHERE collection_id = $1 AND drink_slug = $2`, [col.memb, premSlug]);

    // A grant to only one of two locked collections is enough.
    await local.query(
      `INSERT INTO drink_collection_items (collection_id, drink_slug, added_at) VALUES ($1, $2, now())`,
      [col.memb, premSlug],
    );
    assert.equal(await visible("/search?q=p24", "nonent", premSlug), false, "locked in both, no grant to either");
    assert.equal(await visible("/search?q=p24", "buyer", premSlug), true, "a grant to one of the two is enough");
    await local.query(`DELETE FROM drink_collection_items WHERE collection_id = $1 AND drink_slug = $2`, [col.memb, premSlug]);
  });

  test("M the four review findings on the first pass of this gate", async () => {
    // Each of these passed the suite as it stood, which is the point: the gate was right about the case the
    // tests covered and wrong about four cases they did not reach. Every one is asserted from both sides --
    // the withheld thing stays withheld, and the public or entitled thing stays available.
    const premSlug = slugsOf("prem")[PREVIEW];
    const withheldOf = (text: string) => leaked(text, "prem").concat(leaked(text, "memb"));
    const recipe = (slug: string, owner: string, remixedFrom?: string) => local.query(
      `INSERT INTO drink_recipes (id, slug, name, category, user_id, remixed_from_slug)
       VALUES (gen_random_uuid(), $1, $1, 'cocktails', $2, $3)`, [slug, ids[owner], remixedFrom ?? null]);
    const item = (collectionId: string, slug: string, addedAt = "now()") => local.query(
      `INSERT INTO drink_collection_items (collection_id, drink_slug, added_at) VALUES ($1, $2, ${addedAt})`, [collectionId, slug]);
    const added = ["p24-stranger-1", "p24-prem-remix-1", "p24-public-remix-1"];

    try {
    // 1. A collection is qualified to speak for an item only about THAT item. Qualifying it by one of its items
    //    let it vote on every other item in it, so a stranger could carry a paid slug out of its collection by
    //    adding it to a public collection of their own alongside a recipe they really do own.
    const theirOwn = "p24-stranger-1";
    await recipe(theirOwn, "nonent");
    const theirs = (await local.query(
      `INSERT INTO drink_collections (user_id, name, description, is_public, access_type, is_premium, price_cents)
       VALUES ($1, 'stranger-public', 'blurb', true, 'public', false, 0) RETURNING id`, [ids.nonent])).rows[0].id;
    await item(theirs, theirOwn);
    await item(theirs, premSlug);
    for (const as of [undefined, "nonent"]) {
      const r = await get("/search?q=p24", as);
      assert.ok(r.text.includes(theirOwn), `as ${as ?? "anon"}: their own recipe is public and still found`);
      assert.deepEqual(withheldOf(r.text), [], `as ${as ?? "anon"}: and does not carry the paid slug out with it`);
      assert.equal((await get(`/user/${premSlug}`, as)).status, 404, "nor make the recipe itself readable");
    }
    await local.query(`DELETE FROM drink_collections WHERE id = $1`, [theirs]);
    await local.query(`DELETE FROM drink_recipes WHERE slug = $1`, [theirOwn]);

    // 2. /remixes/:slug decides access from req.user, so without optionalAuth a buyer's own cookie was invisible
    //    and the remixes they paid for silently disappeared.
    const paidRemix = "p24-prem-remix-1";
    await recipe(paidRemix, "creator", premSlug);
    await item(col.prem, paidRemix);
    assert.deepEqual((await get(`/remixes/${premSlug}`)).json.items, [], "anonymous: no remix of a withheld drink is named");
    for (const as of ["buyer", "creator"]) {
      const r = await get(`/remixes/${premSlug}`, as);
      assert.deepEqual(r.json.items.map((entry: any) => entry.slug), [paidRemix], `${as} still sees the remix they can reach`);
    }

    // 3. Removing the withheld NODES from a lineage left the withheld SLUG in the surviving nodes' parent
    //    references -- and the slug is the whole secret, because it is what the recipe route takes.
    const publicRemix = "p24-public-remix-1";
    await recipe(publicRemix, "creator", premSlug);
    for (const as of [undefined, "nonent"]) {
      const r = await get(`/remix-chain/${publicRemix}`, as);
      assert.equal(r.status, 200, "the public remix is still readable in its own right");
      assert.deepEqual(withheldOf(r.text), [], `as ${as ?? "anon"}: its lineage never names the withheld drink`);
      assert.equal(r.json.current.remixedFromSlug, null, "the reference is cleared, not just the node removed");
      assert.equal(r.json.parent, null);
    }
    const asCreator = await get(`/remix-chain/${publicRemix}`, "creator");
    assert.equal(asCreator.json.current.remixedFromSlug, premSlug, "the creator still sees the whole lineage");
    assert.equal(asCreator.json.parent?.slug, premSlug);

    // 4. Paging first and filtering after made the FIRST page of a storefront empty whenever the newest items
    //    were the paid ones -- and the storefront asks for no other page.
    await local.query(`UPDATE drink_recipes SET created_at = now() - interval '10 days' WHERE slug LIKE 'p24-%'`);
    await local.query(`UPDATE drink_recipes SET created_at = now() WHERE slug = ANY($1)`,
      [[...slugsOf("prem").slice(PREVIEW), ...slugsOf("memb").slice(PREVIEW), paidRemix]]);
    for (const as of [undefined, "nonent"]) {
      const page = await get(`/creators/${ids.creator}?limit=2`, as);
      assert.equal(page.status, 200);
      assert.equal((page.json.recentItems ?? []).length, 2, `as ${as ?? "anon"}: a first page of all-withheld newest must not come back empty`);
      assert.deepEqual(withheldOf(page.text), []);
    }
    const newest = [...slugsOf("prem").slice(PREVIEW), ...slugsOf("memb").slice(PREVIEW), paidRemix];
    const creatorPage = await get(`/creators/${ids.creator}?limit=2`, "creator");
    const creatorSlugs = (creatorPage.json.recentItems ?? []).map((entry: any) => entry.slug);
    assert.equal(creatorSlugs.length, 2);
    assert.deepEqual(
      creatorSlugs.filter((slug: string) => !newest.includes(slug)),
      [],
      "the creator's own first page is still their newest, withheld or not",
    );
    } finally {
      // Leave the fixture as the tests after this one expect it, even when an assertion above failed.
      await local.query(`DELETE FROM drink_collections WHERE name = 'stranger-public'`);
      await local.query(`DELETE FROM drink_collection_items WHERE drink_slug = ANY($1)`, [added]);
      await local.query(`DELETE FROM drink_recipes WHERE slug = ANY($1)`, [added]);
      await local.query(`UPDATE drink_recipes SET created_at = now() WHERE slug LIKE 'p24-%'`);
    }
  });

  test("F explicitly free/public collections keep their full item list for everyone", async () => {
    for (const as of [undefined, "nonent"]) {
      for (const path of [...listEndpoints(), `/collections/${col.free}`]) {
        const r = await get(path, as);
        const card = r.json.collection ?? cardOf(r.json, "free");
        assert.equal(card.items.length, 4, path);
        assert.notEqual(card.isLocked, true);
      }
    }
  });

  test("D/G entitlement is decided by the canonical access model, not by a stale or non-completed row", async () => {
    // Re-granting the refunded user as completed restores access (same model, no second system).
    await local.query(`UPDATE drink_collection_purchases SET status = 'completed' WHERE user_id = $1`, [ids.refunded]);
    const r = await get(`/collections/${col.prem}`, "refunded");
    assert.equal(r.json.collection.items.length, 4);
    await local.query(`UPDATE drink_collection_purchases SET status = 'refunded' WHERE user_id = $1`, [ids.refunded]);
    const again = await get(`/collections/${col.prem}`, "refunded");
    assert.deepEqual(leaked(again.text, "prem"), []);
  });

  test("preview is deterministic (oldest items first) and carries only public item metadata", async () => {
    const r = await get(`/collections/${col.prem}`, "nonent");
    assert.deepEqual(r.json.collection.items.map((i: any) => i.drinkSlug), slugsOf("prem").slice(0, PREVIEW));
    assert.equal(r.json.collection.previewLimit, PREVIEW);
  });
}
