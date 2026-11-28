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
  // `follows` is created below and matches neither prefix, so it has to be named: without it the suite could be
  // run once and then failed on "relation already exists" for the rest of the session.
  await local.query(`DROP TABLE IF EXISTS ${[...owned, "follows", "users"].join(", ")} CASCADE`);
  await local.query(`
    ${ddl(schema.users, "users", ", UNIQUE (username), UNIQUE (email)")};
    ${ddl(schema.drinkRecipes, "drink_recipes")};
    ${ddl(schema.drinkEvents, "drink_events")};
    -- Was an id column and nothing else, which was enough while /community-search could not get this far: it
    -- failed on its external fetch first. With that stubbed, the route reached its own challenges query, which
    -- selects slug, and returned a 500 -- so the community-search leg of test I was asserting against an empty
    -- response and proving nothing. Built from the real schema now.
    ${ddl(schema.drinkChallenges, "drink_challenges")};
    -- GET /challenges leftJoins this. Without it that route answered 500 for everyone, so the R3 test below
    -- would have "failed" on an error body rather than on the disclosure it exists to catch.
    ${ddl(schema.drinkChallengeSubmissions, "drink_challenge_submissions")};
    -- /whats-new reads the viewer's follows. Without this table the route answered 500 for every signed-in
    -- viewer, so test K's audit of it was asserting against an error body.
    ${ddl(schema.follows, "follows")};
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
      // An hour back, a minute apart. Position is added_at then drink_slug, so these four have to sit unambiguously
      // BEHIND every item a later test adds with a bare now() -- and those tests all mean "past the preview".
      // Seeded at now()+0..3s, that held only while a test took longer than three seconds to reach them: on a warm
      // run K, L, M and both Ns saw their own item take a preview slot and read the gate as leaking. The one test
      // that wants the first preview slot asks for it explicitly, with an added_at a day earlier than this.
      await local.query(`INSERT INTO drink_collection_items (collection_id, drink_slug, added_at) VALUES ($1, $2, now() - interval '1 hour' + ($3 || ' minutes')::interval)`, [col[key], slug, String(i)]);
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
  const post = async (path: string, as: string, body: unknown) => {
    const res = await fetch(`${base()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...testAuthHeader(ids[as]) },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, text };
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
        assert.equal(r.status, 200, `${path} as ${as} answered ${r.status}`);
        const found = all("prem").filter((slug) => r.text.includes(slug));
        assert.deepEqual(found, all("prem"), `${path} as ${as}: every item of a collection they can access`);
      }
      // The member can reach the membership collection but not the purchase one.
      const member = await get(path, "member");
      assert.equal(member.status, 200, `${path} as member answered ${member.status}`);
      assert.deepEqual(all("memb").filter((s) => member.text.includes(s)), all("memb"), `${path} as member`);
      assert.deepEqual(leaked(member.text, "prem"), [], `${path} as member must not reach the purchase collection`);
      // Public collection items are public to everyone, signed in or not.
      for (const as of [undefined, "nonent"]) {
        const r = await get(path, as);
        assert.equal(r.status, 200, `${path} as ${as ?? "anon"} answered ${r.status}`);
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

    // Codex on #1530: /remixes, /most-remixed and /whats-new are all built FROM remixes, and nothing in this
    // fixture was a remix of anything, so asserting they disclose nothing proved nothing. Two shapes are needed:
    // a remix that is itself withheld (its own slug must not appear), and a public remix of a withheld drink (the
    // source's slug must not appear). /most-remixed and the trending sections of /whats-new are keyed ON the
    // source, so a withheld source has no visible form there at all.
    const paidRemix = "p24-k-paid-remix";    // in the premium collection, past its preview
    const publicRemix = "p24-k-public-remix"; // in no collection, remixed from the withheld premium drink
    const seeded = [paidRemix, publicRemix];
    try {
    await local.query(
      `INSERT INTO drink_recipes (id, slug, name, category, user_id, remixed_from_slug)
       VALUES (gen_random_uuid(), $1, $1, 'cocktails', $2, $3)`, [paidRemix, ids.creator, slugsOf("free")[0]]);
    await local.query(
      `INSERT INTO drink_collection_items (collection_id, drink_slug, added_at) VALUES ($1, $2, now())`, [col.prem, paidRemix]);
    await local.query(
      `INSERT INTO drink_recipes (id, slug, name, category, user_id, remixed_from_slug)
       VALUES (gen_random_uuid(), $1, $1, 'cocktails', $2, $3)`, [publicRemix, ids.creator, premSlug]);

    for (const as of [undefined, "nonent"]) {
      for (const path of ["/remixes", "/most-remixed", "/recommended", "/whats-new", `/creators/${ids.creator}`]) {
        const r = await get(path, as);
        assert.equal(r.status, 200, `${path} as ${as ?? "anon"} answered ${r.status}: a failed response discloses nothing and proves nothing`);
        assert.deepEqual(withheldOf(r.text), [], `${path} as ${as ?? "anon"}`);
        assert.equal(r.text.includes(paidRemix), false, `${path} as ${as ?? "anon"}: a remix that is itself withheld`);
      }
      // ... and the public remix is still there, so the assertions above are not passing on an empty feed.
      const feed = await get("/remixes", as);
      assert.ok(feed.text.includes(publicRemix), `as ${as ?? "anon"}: the public remix is public and still listed`);

      // Returns the requested drink itself, so a guessable slug was enough to read it. A withheld slug gets the
      // same answer as one that does not exist, which also stops the response confirming it is there.
      const chain = await get(`/remix-chain/${premSlug}`, as);
      assert.equal(chain.status, 404, "a withheld slug is indistinguishable from a missing one");

      // Echoes the slug the caller supplied, which discloses nothing; its items are other people's recipes and
      // are gated. It answers 200 for a slug that does not exist, so answering 404 for a withheld one would
      // itself say the drink is there -- the items are what must be judged, not the route's existence.
      const remixes = await get(`/remixes/${premSlug}`, as);
      assert.equal(remixes.status, 200);
      const named = remixes.json.items.map((entry: any) => entry.slug);
      assert.equal(named.includes(paidRemix), false, "a withheld remix of it is not named");
      assert.ok(named.includes(publicRemix), "a public remix of it is public and is named");
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
      // The entitled viewer still sees the withheld remix and the drink it came from, in the feeds too.
      const feed = await get("/remixes", as);
      assert.ok(feed.text.includes(paidRemix), `${as} still sees the remix they can reach`);
      assert.ok((await get("/most-remixed", as)).text.includes(premSlug), `${as} still sees the paid drink among the most remixed`);
    }
    } finally {
      await local.query(`DELETE FROM drink_collection_items WHERE drink_slug = ANY($1)`, [seeded]);
      await local.query(`DELETE FROM drink_recipes WHERE slug = ANY($1)`, [seeded]);
    }
  });

  test("L a drink in more than one collection, and who is allowed to make it public", async () => {
    // Greptile on #1530: every slug in the tests above sat in exactly one collection, so the rule that keeps a
    // drink searchable when one of its collections exposes it was never exercised -- an implementation that
    // withheld a slug the moment ANY collection locked it would have passed. These are the shared cases, and
    // they also pin the ownership condition Codex found missing.
    const premSlug = slugsOf("prem")[PREVIEW];
    // Asserting a slug is ABSENT from a body is only worth something if the body is a real answer: a 500 contains
    // no slugs either. Every case below goes through here, so the status is checked once, for all of them.
    const visible = async (path: string, as: string | undefined, slug: string) => {
      const r = await get(path, as);
      assert.equal(r.status, 200, `${path} as ${as ?? "anon"} answered ${r.status}`);
      return r.text.includes(slug);
    };

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

  test("N the attacker-owned-collection paths Codex named, each one tried", async () => {
    // Codex re-raised three claims against the current head. Rather than argue they were already fixed, each is
    // exercised here, so whichever is true fails and whichever is not stays covered.
    const premSlug = slugsOf("prem")[PREVIEW];
    const mine = async (accessType: string, isPublic: boolean) => (await local.query(
      `INSERT INTO drink_collections (user_id, name, description, is_public, access_type, is_premium, price_cents)
       VALUES ($1, $2, 'blurb', $3, $4, $5, 0) RETURNING id`,
      [ids.nonent, `attacker-${accessType}-${isPublic}`, isPublic, accessType, accessType !== "public"],
    )).rows[0].id;

    for (const [accessType, isPublic] of [["public", true], ["premium_purchase", true], ["membership_only", true], ["public", false]] as const) {
      const id = await mine(accessType, isPublic);
      // The attacker also puts a recipe of their own in, which is what qualified their collection before.
      await local.query(`INSERT INTO drink_recipes (id, slug, name, category, user_id) VALUES (gen_random_uuid(), $1, $1, 'cocktails', $2) ON CONFLICT DO NOTHING`, [`attacker-own-${accessType}-${isPublic}`, ids.nonent]);
      await local.query(`INSERT INTO drink_collection_items (collection_id, drink_slug, added_at) VALUES ($1, $2, now()), ($1, $3, now() + interval '1 second')`, [id, `attacker-own-${accessType}-${isPublic}`, premSlug]);

      const where = `${accessType}/is_public=${isPublic}`;
      // Not for the world, and not for the attacker either -- the owner_id exemption must not reach another
      // creator's item just because the attacker owns the collection it was added to.
      for (const as of [undefined, "nonent"]) {
        assert.equal(
          (await get("/search?q=p24", as)).text.includes(premSlug),
          false,
          `an attacker's ${where} collection must not publish another creator's paid drink (as ${as ?? "anon"})`,
        );
        assert.equal((await get(`/user/${premSlug}`, as)).status, 404, `nor make it readable (${where}, as ${as ?? "anon"})`);
        const storefront = await get(`/creators/${ids.creator}`, as);
        assert.equal(storefront.text.includes(premSlug), false, `nor enumerable on the creator storefront (${where})`);
      }
      // The people entitled to it are unaffected throughout.
      for (const as of ["buyer", "creator"]) {
        assert.equal((await get("/search?q=p24", as)).text.includes(premSlug), true, `${as} still finds it (${where})`);
        assert.equal((await get(`/user/${premSlug}`, as)).status, 200, `${as} can still read it (${where})`);
      }
      await local.query(`DELETE FROM drink_collections WHERE id = $1`, [id]);
    }
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
      assert.equal(r.status, 200, `as ${as ?? "anon"}: /search answered ${r.status}`);
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

  test("N the second review round: a collection nobody can open, and a remix that pointed at a paid original", async () => {
    const premSlug = slugsOf("prem")[PREVIEW];
    const withheldOf = (text: string) => leaked(text, "prem").concat(leaked(text, "memb"));
    const added = ["p24-remix-of-paid-1"];

    try {
      // 1. is_public was not consulted. A creator's PRIVATE collection whose access_type is 'public' -- the
      //    working "everything I have made" list -- was voting its items public for anonymous viewers, including
      //    the ones the creator sells in a locked collection. Nobody can open that collection, so it may not
      //    publish anything.
      const privatePublicAccess = (await local.query(
        `INSERT INTO drink_collections (user_id, name, description, is_public, access_type, is_premium, price_cents)
         VALUES ($1, 'private-but-access-public', 'blurb', false, 'public', false, 0) RETURNING id`, [ids.creator])).rows[0].id;
      await local.query(
        `INSERT INTO drink_collection_items (collection_id, drink_slug, added_at) VALUES ($1, $2, now())`, [privatePublicAccess, premSlug]);
      for (const as of [undefined, "nonent"]) {
        const r = await get("/search?q=p24", as);
        assert.equal(r.status, 200, `as ${as ?? "anon"}: /search answered ${r.status}`);
        assert.deepEqual(withheldOf(r.text), [], `as ${as ?? "anon"}: a collection they cannot open publishes nothing`);
        assert.equal((await get(`/user/${premSlug}`, as)).status, 404);
      }
      // the creator can open it, so for them it is reachable and unlocked, exactly as before
      assert.ok((await get("/search?q=p24", "creator")).text.includes(premSlug), "the creator still finds their own");
      assert.ok((await get("/search?q=p24", "buyer")).text.includes(premSlug), "and so does the buyer");
      // making that same collection public is the creator's own choice, and then it does publish
      await local.query(`UPDATE drink_collections SET is_public = true WHERE id = $1`, [privatePublicAccess]);
      assert.ok((await get("/search?q=p24", "nonent")).text.includes(premSlug), "published once the creator makes the collection public");
      await local.query(`DELETE FROM drink_collections WHERE id = $1`, [privatePublicAccess]);

      // 2. A remix result carries the slug it was remixed FROM, and only the remix's own slug was judged. A buyer
      //    publishing their remix of a paid drink outside any locked collection published the original with it.
      await local.query(
        `INSERT INTO drink_recipes (id, slug, name, category, user_id, remixed_from_slug)
         VALUES (gen_random_uuid(), $1, $1, 'cocktails', $2, $3)`, ["p24-remix-of-paid-1", ids.buyer, premSlug]);
      for (const as of [undefined, "nonent"]) {
        const r = await get("/community-search?q=p24", as);
        assert.equal(r.status, 200);
        assert.ok(r.text.includes("p24-remix-of-paid-1"), `as ${as ?? "anon"}: the remix itself is public and still listed`);
        assert.deepEqual(withheldOf(r.text), [], `as ${as ?? "anon"}: without naming the drink it was remixed from`);
        const remix = (r.json.results?.remixes ?? []).find((entry: any) => entry.slug === "p24-remix-of-paid-1");
        assert.ok(remix, "listed as a remix");
        assert.equal(remix.remixedFromSlug, null, "the reference is cleared, not the row dropped");
      }
      for (const as of ["buyer", "creator"]) {
        const r = await get("/community-search?q=p24", as);
        const remix = (r.json.results?.remixes ?? []).find((entry: any) => entry.slug === "p24-remix-of-paid-1");
        assert.equal(remix?.remixedFromSlug, premSlug, `${as} sees the real lineage`);
      }
    } finally {
      await local.query(`DELETE FROM drink_collections WHERE name = 'private-but-access-public'`);
      await local.query(`DELETE FROM drink_collection_items WHERE drink_slug = ANY($1)`, [added]);
      await local.query(`DELETE FROM drink_recipes WHERE slug = ANY($1)`, [added]);
    }
  });

  test("O a page of withheld newest matches does not swallow the public ones behind it", async () => {
    // The gate runs in JS, after the database has applied the route's LIMIT. With enough withheld items at the
    // top of the ordering, the page came back empty while public matches sat just past it -- and none of these
    // routes paginates, so there was no way to ask for them. Both routes here order by created_at desc and take
    // 24, so filling that page with withheld rows is deterministic; /search uses the same constant but has no
    // ORDER BY, so there is no page to pin.
    const BULK = 30;
    const bulk = Array.from({ length: BULK }, (_, i) => `p24-bulk-${String(i).padStart(2, "0")}`);
    try {
      for (const slug of bulk) {
        await local.query(
          `INSERT INTO drink_recipes (id, slug, name, category, user_id, remixed_from_slug, created_at)
           VALUES (gen_random_uuid(), $1, $1, 'cocktails', $2, $3, now())`, [slug, ids.creator, slugsOf("free")[0]]);
        await local.query(
          `INSERT INTO drink_collection_items (collection_id, drink_slug, added_at) VALUES ($1, $2, now())`, [col.prem, slug]);
      }
      // Everything that was already here is older, so the whole first page is the withheld bulk.
      await local.query(`UPDATE drink_recipes SET created_at = now() - interval '10 days' WHERE slug LIKE 'p24-%' AND slug NOT LIKE 'p24-bulk-%'`);

      for (const as of [undefined, "nonent"]) {
        const community = await get("/community-search?q=p24", as);
        assert.equal(community.status, 200);
        assert.deepEqual(leaked(community.text, "prem").concat(leaked(community.text, "memb")), [], `as ${as ?? "anon"}: still withheld`);
        for (const slug of bulk) assert.equal(community.text.includes(slug), false, `${slug} is past the preview of a locked collection`);
        const drinks = (community.json.results?.drinks ?? []).map((entry: any) => entry.slug);
        assert.ok(drinks.length > 0, `as ${as ?? "anon"}: the public matches behind the withheld page are still returned`);
        assert.ok(slugsOf("free").some((slug) => drinks.includes(slug)), "and they are the free collection's items");

        // /remixes/:slug: every bulk recipe is a remix of the free collection's first drink, and all are withheld.
        const remixes = await get(`/remixes/${slugsOf("free")[0]}`, as);
        assert.equal(remixes.status, 200);
        assert.deepEqual(remixes.json.items.map((entry: any) => entry.slug), [], `as ${as ?? "anon"}: withheld remixes are not named`);
      }
      // The creator is entitled to all of them, so for them the page is the bulk, and nothing is lost either way.
      const asCreator = await get(`/remixes/${slugsOf("free")[0]}`, "creator");
      assert.equal(asCreator.json.items.length, 24, "the creator's own page is full");
    } finally {
      await local.query(`DELETE FROM drink_collection_items WHERE drink_slug = ANY($1)`, [bulk]);
      await local.query(`DELETE FROM drink_recipes WHERE slug = ANY($1)`, [bulk]);
      await local.query(`UPDATE drink_recipes SET created_at = now() WHERE slug LIKE 'p24-%'`);
    }
  });

  test("Q a private premium collection inside a public bundle: the gate must not be stricter than the boundary", async () => {
    // Codex on #1530: the new is_public reachability term made the gate disagree with the boundary for one
    // collection shape. POST /bundles/:id/items accepts any premium_purchase collection of yours, public or not,
    // and resolveBundleWithCollections hands every included collection to resolveCollectionWithItems with no
    // is_public filter -- so the public bundle page already shows that collection's two preview recipes to
    // anonymous visitors. The gate was withholding those same two slugs, which does not hide anything (the
    // bundle names them) and leaves the page showing two links that 404. Reachability, not unlocking: the items
    // behind the preview stay withheld.
    const slugs = [1, 2, 3, 4].map((n) => `p24-bund-${n}`);
    let privateCol = "";
    let publicBundle = "";
    try {
      privateCol = (await local.query(
        `INSERT INTO drink_collections (user_id, name, description, is_public, access_type, is_premium, price_cents)
         VALUES ($1, 'p24-bundled-private', 'blurb', false, 'premium_purchase', true, 700) RETURNING id`, [ids.creator])).rows[0].id;
      for (const [i, slug] of slugs.entries()) {
        await local.query(
          `INSERT INTO drink_recipes (id, slug, name, category, user_id) VALUES (gen_random_uuid(), $1, $1, 'cocktails', $2)`, [slug, ids.creator]);
        await local.query(
          `INSERT INTO drink_collection_items (collection_id, drink_slug, added_at) VALUES ($1, $2, now() - interval '1 hour' + ($3 || ' minutes')::interval)`,
          [privateCol, slug, String(i)]);
      }
      publicBundle = (await local.query(
        `INSERT INTO drink_bundles (user_id, name, slug, is_public, is_premium, price_cents)
         VALUES ($1, 'p24-public-bundle', 'p24-public-bundle', true, true, 1200) RETURNING id`, [ids.creator])).rows[0].id;
      await local.query(`INSERT INTO drink_bundle_items (bundle_id, collection_id, sort_order) VALUES ($1, $2, 0)`, [publicBundle, privateCol]);

      const preview = slugs.slice(0, PREVIEW);
      const behind = slugs.slice(PREVIEW);
      for (const as of [undefined, "nonent"]) {
        // What the boundary itself says, through the bundle the creator chose to make public.
        const bundle = await get(`/bundles/${publicBundle}`, as);
        assert.equal(bundle.status, 200, `as ${as ?? "anon"}: the public bundle is readable`);
        for (const slug of preview) assert.ok(bundle.text.includes(slug), `as ${as ?? "anon"}: the bundle page names ${slug}`);
        for (const slug of behind) assert.equal(bundle.text.includes(slug), false, `as ${as ?? "anon"}: and not ${slug}`);

        // The gate has to agree with it, or those two links are dead.
        for (const slug of preview) {
          assert.equal((await get(`/user/${slug}`, as)).status, 200, `as ${as ?? "anon"}: ${slug} is a link the bundle page shows`);
        }
        for (const slug of behind) {
          assert.equal((await get(`/user/${slug}`, as)).status, 404, `as ${as ?? "anon"}: ${slug} is the payload`);
        }
        const search = await get("/search?q=p24-bund", as);
        assert.equal(search.status, 200);
        for (const slug of behind) assert.equal(search.text.includes(slug), false, `as ${as ?? "anon"}: ${slug} is not searchable`);
      }
      // Take the bundle out of public view and the collection is unreachable again, preview included.
      await local.query(`UPDATE drink_bundles SET is_public = false WHERE id = $1`, [publicBundle]);
      for (const slug of slugs) {
        assert.equal((await get(`/user/${slug}`)).status, 404, `${slug}: nothing public reaches this collection any more`);
      }
      // The creator never lost any of it.
      for (const slug of slugs) {
        assert.equal((await get(`/user/${slug}`, "creator")).status, 200, `${slug}: still the creator's own`);
      }
    } finally {
      if (publicBundle) await local.query(`DELETE FROM drink_bundles WHERE id = $1`, [publicBundle]);
      if (privateCol) await local.query(`DELETE FROM drink_collections WHERE id = $1`, [privateCol]);
      await local.query(`DELETE FROM drink_collection_items WHERE drink_slug = ANY($1)`, [slugs]);
      await local.query(`DELETE FROM drink_recipes WHERE slug = ANY($1)`, [slugs]);
    }
  });

  test("P the remix discovery feed pages the same way, and it is the page nobody can scroll past", async () => {
    // The fourth instance of the same shape, and the one that was missed when the other three were fixed: this
    // feed took its LIMIT from the database and then gated, so thirty withheld remixes at the top of either
    // ordering returned nothing at all. It is the worst place for that, because the client asks for the first
    // page and renders no next -- there is no second request that would eventually reach the public rows.
    const BULK = 30;
    const bulk = Array.from({ length: BULK }, (_, i) => `p24-feed-${String(i).padStart(2, "0")}`);
    const source = slugsOf("free")[0];
    const publicRemix = "p24-feed-public";
    try {
      // One remix that belongs to nobody's collection, so it is public on its own terms, and older than the rest.
      await local.query(
        `INSERT INTO drink_recipes (id, slug, name, category, user_id, remixed_from_slug, created_at)
         VALUES (gen_random_uuid(), $1, $1, 'cocktails', $2, $3, now() - interval '1 day')`,
        [publicRemix, ids.nonent, source]);
      // Thirty newer remixes, every one of them past the preview of the premium collection.
      for (const slug of bulk) {
        await local.query(
          `INSERT INTO drink_recipes (id, slug, name, category, user_id, remixed_from_slug, created_at)
           VALUES (gen_random_uuid(), $1, $1, 'cocktails', $2, $3, now())`, [slug, ids.creator, source]);
        await local.query(
          `INSERT INTO drink_collection_items (collection_id, drink_slug, added_at) VALUES ($1, $2, now())`, [col.prem, slug]);
      }

      for (const sort of ["recent", "popular"]) {
        for (const as of [undefined, "nonent"]) {
          const feed = await get(`/remixes?sort=${sort}&limit=${BULK}`, as);
          assert.equal(feed.status, 200, `${sort} as ${as ?? "anon"}: a real answer, not a 500 with no slugs in it`);
          const slugs = (feed.json.items ?? []).map((entry: any) => entry.slug);
          for (const slug of bulk) assert.equal(slugs.includes(slug), false, `${sort} as ${as ?? "anon"}: ${slug} is still withheld`);
          assert.ok(slugs.includes(publicRemix), `${sort} as ${as ?? "anon"}: the public remix behind the withheld page is still returned`);
        }
        // The creator is entitled to all thirty, so the fix must not cost them their own full page either.
        const asCreator = await get(`/remixes?sort=${sort}&limit=${BULK}`, "creator");
        const creatorSlugs = (asCreator.json.items ?? []).map((entry: any) => entry.slug);
        assert.equal(creatorSlugs.length, BULK, `${sort}: the creator's page is full, and no wider than asked for`);
        assert.equal(creatorSlugs.filter((slug: string) => !bulk.includes(slug)).length, 0, `${sort}: and it is their own newest thirty`);
      }
    } finally {
      await local.query(`DELETE FROM drink_collection_items WHERE drink_slug = ANY($1)`, [bulk]);
      await local.query(`DELETE FROM drink_recipes WHERE slug = ANY($1) OR slug = $2`, [bulk, publicRemix]);
    }
  });

  test("O a drink you are not allowed to see cannot be filed into a collection of your own", async () => {
    const premSlug = slugsOf("prem")[PREVIEW];
    const freeSlug = slugsOf("free")[PREVIEW];
    const mineId = (await local.query(
      `INSERT INTO drink_collections (user_id, name, description, is_public, access_type, is_premium, price_cents)
       VALUES ($1, 'nonent-own', 'blurb', true, 'public', false, 0) RETURNING id`,
      [ids.nonent],
    )).rows[0].id;
    const add = (slug: string, as: string) => post(`/collections/${mineId}/items`, as, { drinkSlug: slug });

    const refused = await add(premSlug, "nonent");
    assert.equal(refused.status, 403, `a paid item they have no grant for: ${refused.text.slice(0, 200)}`);
    assert.deepEqual(
      (await local.query(`SELECT drink_slug FROM drink_collection_items WHERE collection_id = $1`, [mineId])).rows,
      [],
      "and nothing was written",
    );

    // Everything they may legitimately see still files normally: a public collection's item, and -- once they
    // have bought it -- the paid one too.
    assert.equal((await add(freeSlug, "nonent")).status, 201, "a public drink files normally");
    await grant("nonent", "prem");
    assert.equal((await add(premSlug, "nonent")).status, 201, "and the paid one does once bought");
    await local.query(`DELETE FROM drink_collection_purchases WHERE user_id = $1 AND collection_id = $2`, [ids.nonent, col.prem]);
    await local.query(`DELETE FROM drink_collections WHERE id = $1`, [mineId]);
  });

  test("P the remix feed still fills a page when the newest remixes are all withheld", async () => {
    // Codex on #1530: overfetching a wider window made an empty page less likely, not impossible -- with enough
    // withheld rows at the top, a wider window is still all withheld. This seeds exactly that: more withheld
    // remixes than the first block holds, with public ones behind them, and asks for a small page.
    const seeded: string[] = [];
    const makeRemix = async (slug: string, owner: string, source: string) => {
      await local.query(
        `INSERT INTO drink_recipes (id, slug, name, category, user_id, remixed_from_slug, created_at)
         VALUES (gen_random_uuid(), $1, $1, 'cocktails', $2, $3, now() + ($4 || ' seconds')::interval)`,
        [slug, ids[owner], source, String(seeded.length)],
      );
      seeded.push(slug);
    };
    // Public remixes first (older), then a block of withheld ones on top of them.
    for (let i = 0; i < 3; i += 1) await makeRemix(`p24-feed-public-${i}`, "creator", slugsOf("free")[0]);
    const hidden: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      const slug = `p24-feed-paid-${i}`;
      await makeRemix(slug, "creator", slugsOf("free")[0]);
      await local.query(
        `INSERT INTO drink_collection_items (collection_id, drink_slug, added_at) VALUES ($1, $2, now() + ($3 || ' seconds')::interval)`,
        [col.prem, slug, String(100 + i)],
      );
      hidden.push(slug);
    }

    const feed = await get("/remixes?sort=recent&limit=2", "nonent");
    assert.equal(feed.status, 200, feed.text.slice(0, 200));
    const returned: string[] = (feed.json?.items ?? []).map((item: any) => item.slug);
    assert.deepEqual(returned.filter((slug) => hidden.includes(slug)), [], "no withheld remix is named");
    assert.equal(returned.length, 2, `the page is filled from behind the withheld rows, got ${JSON.stringify(returned)}`);

    // The creator, who may see all of them, gets their own newest first.
    const owner = await get("/remixes?sort=recent&limit=2", "creator");
    assert.equal((owner.json?.items ?? []).length, 2);

    for (const slug of seeded) {
      await local.query(`DELETE FROM drink_collection_items WHERE drink_slug = $1`, [slug]);
      await local.query(`DELETE FROM drink_recipes WHERE slug = $1`, [slug]);
    }
  });

  test("R the three non-paginated routes scan past more than one block of withheld rows", async () => {
    // Codex on #1530, second pass: a bounded multiple only moves the cliff. /search, /community-search and
    // /remixes/:slug read no limit or offset from the request at all -- /search and /community-search take only
    // q, /remixes/:slug only the slug -- so a short page is the whole answer and no client can ask for more.
    // Raising the multiple cannot fix that; with one block's worth of withheld rows on top, a single widened
    // window is still entirely withheld. All three scan now, so this seeds more withheld rows than one block
    // holds (the largest block here is 24 * 5 = 120) and asserts the public match behind them still comes back.
    const BULK = 130;
    const bulk = Array.from({ length: BULK }, (_, i) => `p24-scan-w${String(i).padStart(3, "0")}`);
    const publicSlug = "p24-scan-public";
    const source = slugsOf("free")[0];
    try {
      // The one public match, older than every withheld row, so it sorts behind all of them in all three routes.
      await local.query(
        `INSERT INTO drink_recipes (id, slug, name, category, user_id, remixed_from_slug, created_at)
         VALUES (gen_random_uuid(), $1, $1, 'cocktails', $2, $3, now() - interval '1 day')`,
        [publicSlug, ids.nonent, source]);
      // And the wall of withheld ones in front of it: newer, and all past the preview of a locked collection.
      await local.query(
        `INSERT INTO drink_recipes (id, slug, name, category, user_id, remixed_from_slug, created_at)
         SELECT gen_random_uuid(), s, s, 'cocktails', $2, $3, now() FROM unnest($1::text[]) AS s`,
        [bulk, ids.creator, source]);
      await local.query(
        `INSERT INTO drink_collection_items (collection_id, drink_slug, added_at)
         SELECT $1, s, now() FROM unnest($2::text[]) AS s`, [col.prem, bulk]);

      const withheldNamed = (text: string) => bulk.filter((slug) => text.includes(slug));
      for (const as of [undefined, "nonent"]) {
        const who = as ?? "anon";

        const search = await get("/search?q=p24-scan", as);
        assert.equal(search.status, 200, `${who}: /search answered ${search.status}`);
        assert.deepEqual(withheldNamed(search.text), [], `${who}: /search names no withheld row`);
        assert.ok(search.text.includes(publicSlug), `${who}: /search still reaches the public match behind them`);

        const community = await get("/community-search?q=p24-scan", as);
        assert.equal(community.status, 200, `${who}: /community-search answered ${community.status}`);
        assert.deepEqual(withheldNamed(community.text), [], `${who}: /community-search names no withheld row`);
        assert.ok(community.text.includes(publicSlug), `${who}: /community-search still reaches it`);

        const remixes = await get(`/remixes/${source}`, as);
        assert.equal(remixes.status, 200, `${who}: /remixes/:slug answered ${remixes.status}`);
        const remixSlugs = (remixes.json.items ?? []).map((entry: any) => entry.slug);
        assert.deepEqual(remixSlugs.filter((slug: string) => bulk.includes(slug)), [], `${who}: /remixes/:slug names no withheld row`);
        assert.ok(remixSlugs.includes(publicSlug), `${who}: /remixes/:slug still reaches it`);
      }

      // The creator is entitled to all 130, so the scan must not cost them a full page either.
      const asCreatorSearch = await get("/search?q=p24-scan", "creator");
      assert.equal((asCreatorSearch.json.items ?? []).filter((item: any) => bulk.includes(item.slug)).length, 20,
        "the creator's /search page is full of their own");
      const asCreatorRemixes = await get(`/remixes/${source}`, "creator");
      assert.equal((asCreatorRemixes.json.items ?? []).length, 24, "and their /remixes/:slug page is full");
    } finally {
      await local.query(`DELETE FROM drink_collection_items WHERE drink_slug = ANY($1)`, [bulk]);
      await local.query(`DELETE FROM drink_recipes WHERE slug = ANY($1) OR slug = $2`, [bulk, publicSlug]);
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

  // ---- a reference slug is a slug: four more readers serialized one without applying the viewer ----------
  //
  // #1530 secured nine read routes against disclosing a withheld premium ITEM. Greptile's P1 on it
  // established the rule that matters here -- **the slug is the secret**, because the slug is what the recipe
  // route takes -- and the remix-chain route was taught to cut a lineage for that reason. What nobody then
  // checked is that the rule applies to every slug in a response, not only the one the route is named for.
  // Four readers serialize a REFERENCE slug with no viewer applied. Two were found by Codex on #1547 against
  // claims this suite's own PR had recorded as sound; the first below was found by answering a review
  // question instead of leaving it, and it is the widest of them.
  const refChild = "p24-public-child-of-withheld";
  const refParent = () => slugsOf("prem")[2];
  const seedReferenceChild = async (collectionId?: string) => {
    await local.query(
      `INSERT INTO drink_recipes (id, slug, name, category, user_id, remixed_from_slug)
       VALUES (gen_random_uuid(), $1, $1, 'cocktails', $2, $3)`,
      [refChild, ids.creator, refParent()],
    );
    if (collectionId) {
      // Position 0 of the collection, so it is unambiguously a VISIBLE item and not a withheld one -- the
      // point is that a public item leaks by reference, which proves nothing if the item is itself withheld.
      await local.query(
        `INSERT INTO drink_collection_items (collection_id, drink_slug, added_at)
         VALUES ($1, $2, now() - interval '2 days')`,
        [collectionId, refChild],
      );
    }
  };
  const unseedReferenceChild = async () => {
    await local.query(`DELETE FROM drink_collection_items WHERE drink_slug = $1`, [refChild]);
    await local.query(`DELETE FROM drink_recipes WHERE slug = $1`, [refChild]);
  };

  test("R1 a PUBLIC collection item does not name its withheld premium remix parent", async () => {
    // `resolveCollectionWithItems` is the single boundary EVERY collection route goes through, and it
    // serialized the parent TWICE -- once as `remixedFromSlug` and again inside `drink`. So this one reaches
    // explore, featured, the creator storefront, the bundle routes and the detail route: the nine routes
    // #1530 secured, leaking by reference rather than by item.
    await seedReferenceChild(col.free);
    try {
      for (const [label, as] of nonEntitled) {
        for (const path of [...listEndpoints(), `/collections/${col.free}`]) {
          const r = await get(path, as);
          assert.equal(r.status, 200, `${label} ${path}: ${r.text}`);
          assert.ok(r.text.includes(refChild), `${label}: ${path} must still carry the public item itself`);
          assert.ok(!r.text.includes(refParent()), `${label}: ${path} named its withheld premium parent`);
        }
      }
      // The entitled direction, or this is a broken feature rather than a gate.
      for (const as of ["buyer", "creator"]) {
        const r = await get(`/collections/${col.free}`, as);
        assert.ok(r.text.includes(refParent()), `${as} is entitled to the parent and must still see the lineage`);
      }
    } finally {
      await unseedReferenceChild();
    }
  });

  test("R2 Codex on #1547: GET /user/:slug does not name a withheld premium remix parent", async () => {
    // The route gates the requested recipe's OWN slug -- Codex's finding on #1530 -- and then returns
    // `...recipe`, parent reference included. The record had this written down as sound, on the reasoning that
    // the remix-chain route cuts the lineage. It does; this route is not that route.
    await seedReferenceChild();
    try {
      for (const [label, as] of nonEntitled) {
        const r = await get(`/user/${refChild}`, as);
        assert.equal(r.status, 200, `${label}: ${r.text}`);
        assert.ok(r.text.includes(refChild), `${label}: the public recipe itself must still be readable`);
        assert.ok(!r.text.includes(refParent()), `${label}: it named its withheld premium parent`);
      }
      const buyer = await get(`/user/${refChild}`, "buyer");
      assert.ok(buyer.text.includes(refParent()), "a buyer is entitled to the parent and must still see it");
    } finally {
      await unseedReferenceChild();
    }
  });

  test("R3 Codex on #1547: the challenge payloads do not name a withheld premium originalDrinkSlug", async () => {
    // `POST /challenges` has no authorization at all, so any member can write this field, and GET /challenges
    // selects it explicitly while GET /challenges/:slug returns `...challenge`. The record had this down as
    // "ungated and not a disclosure" because only getCanonicalDrinkBySlug reads it and a premium slug
    // hydrates to null. Returning `canonicalDrink: null` does not unsay the slug sitting beside it.
    const challengeSlug = "p24-ref-challenge";
    await local.query(
      `INSERT INTO drink_challenges (slug, title, description, original_drink_slug, starts_at, ends_at, is_active)
       SELECT $1, 'c', 'c', $2, now() - interval '1 day', now() + interval '30 days', true
       WHERE NOT EXISTS (SELECT 1 FROM drink_challenges WHERE slug = $1)`,
      [challengeSlug, refParent()],
    );
    try {
      for (const [label, as] of nonEntitled) {
        for (const path of ["/challenges", `/challenges/${challengeSlug}`]) {
          const r = await get(path, as);
          assert.equal(r.status, 200, `${label} ${path}: ${r.text}`);
          assert.ok(r.text.includes(challengeSlug), `${label}: ${path} must still carry the challenge itself`);
          assert.ok(!r.text.includes(refParent()), `${label}: ${path} named the withheld premium drink`);
        }
      }
      const buyer = await get(`/challenges/${challengeSlug}`, "buyer");
      assert.ok(buyer.text.includes(refParent()), "a buyer is entitled to it and must still see the reference");
    } finally {
      await local.query(`DELETE FROM drink_challenges WHERE slug = $1`, [challengeSlug]);
    }
  });
}
