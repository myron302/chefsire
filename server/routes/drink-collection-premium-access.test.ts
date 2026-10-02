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
    CREATE TABLE drink_challenges (id varchar PRIMARY KEY);
  `);

  const { default: drinksRouter } = await import("./drinks");
  const app = express();
  app.use(express.json());
  app.use("/api/drinks", drinksRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.end(); });
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
