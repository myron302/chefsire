/**
 * Phase 3C (review follow-up #5): recipe reviews are exactly as visible as the recipe they review.
 *
 * Real HTTP, real reviews router, real SQL on a local PostgreSQL (CS_TEST_PG_URL; skipped otherwise). Authorization is evaluated after
 * canonical recipe identity resolution and against every linked id, and again on each review-level mutation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";
import { testAuthHeader } from "../test-support/auth-test-env";

const PRIVATE_REVIEW = "SECRET-REVIEW-TEXT";
const PRIVATE_PHOTO = "https://img.example/SECRET-PHOTO.jpg";

if (!PG_URL) {
  test("review privacy (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const local = await connectLocalPg();
  const schema = await import("../../shared/schema");
  await local.query(`
    DROP TABLE IF EXISTS users, posts, recipes, clubs, club_memberships, recipe_reviews, recipe_review_photos, review_helpful CASCADE;
    ${ddl(schema.users, "users", ", UNIQUE (username), UNIQUE (email)")};
    ${ddl(schema.posts, "posts")};
    ${ddl(schema.recipes, "recipes")};
    ${ddl(schema.clubs, "clubs")};
    ${ddl(schema.clubMemberships, "club_memberships")};
    ${ddl(schema.recipeReviews, "recipe_reviews")};
    ${ddl(schema.recipeReviewPhotos, "recipe_review_photos")};
    ${ddl(schema.reviewHelpful, "review_helpful")};
  `);
  const { default: reviewsRouter } = await import("./reviews");
  const app = express();
  app.use(express.json());
  app.use("/api/reviews", reviewsRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.end(); });

  const ids: Record<string, string> = {};
  const recipe: Record<string, string> = {};
  const review: Record<string, string> = {};
  let club = "";
  const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = makeCaller(base, (who) => ids[who]);
  const stats = async (id: string) => (await local.query(`SELECT review_count, average_rating FROM recipes WHERE id = $1`, [id])).rows[0];
  const reviewCount = async (id: string) => Number((await local.query(`SELECT count(*) FROM recipe_reviews WHERE recipe_id = $1`, [id])).rows[0].count);

  test.beforeEach(async () => {
    await local.query(`TRUNCATE users, posts, recipes, clubs, club_memberships, recipe_reviews, recipe_review_photos, review_helpful CASCADE`);
    for (const name of ["owner", "member", "outsider", "buyer"]) {
      ids[name] = (await local.query(`INSERT INTO users (username, email, display_name, password) VALUES ($1, $2, $1, 'x') RETURNING id`, [name, `${name}@example.com`])).rows[0].id;
    }
    club = (await local.query(`INSERT INTO clubs (creator_id, name, is_public) VALUES ($1, 'secret club', false) RETURNING id`, [ids.owner])).rows[0].id;
    await local.query(`INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'member')`, [club, ids.owner, ids.member]);
    const mk = async (key: string, cols: string, vals: unknown[]) => {
      recipe[key] = (await local.query(`INSERT INTO recipes (title, ingredients, instructions, ${cols}) VALUES ($1, '["x"]'::jsonb, '["y"]'::jsonb, ${vals.slice(1).map((_, i) => `$${i + 2}`).join(", ")}) RETURNING id`, vals)).rows[0].id;
    };
    await mk("private", "origin_club_id", [`${key0("private")}`, club]);
    await mk("public", "average_rating", ["public", "0"]);
    await mk("externalPublic", "external_source, external_id", ["ext", "mealdb", "52772"]);
    // A private club recipe that also carries an external identity: "mealdb_999" resolves to it.
    await mk("privateExternal", "origin_club_id, external_source, external_id", ["priv-ext", club, "mealdb", "999"]);
    review.private = (await local.query(`INSERT INTO recipe_reviews (recipe_id, user_id, rating, review_text) VALUES ($1, $2, 4, $3) RETURNING id`, [recipe.private, ids.member, PRIVATE_REVIEW])).rows[0].id;
    await local.query(`INSERT INTO recipe_review_photos (review_id, photo_url) VALUES ($1, $2)`, [review.private, PRIVATE_PHOTO]);
    review.public = (await local.query(`INSERT INTO recipe_reviews (recipe_id, user_id, rating, review_text) VALUES ($1, $2, 5, 'public review') RETURNING id`, [recipe.public, ids.buyer])).rows[0].id;
  });
  function key0(_: string) { return "private-recipe"; }

  const rate = (as: string, recipeId: string, rating = 5) => call("POST", "/api/reviews", as, { recipeId, rating, reviewText: "mine" });

  test("reads: anonymous and unauthorized users get a non-disclosing 404; members and owners read reviews and photos", async () => {
    const missing = await call("GET", "/api/reviews/recipe/does-not-exist", "anon");
    for (const who of ["anon", "outsider", "buyer"]) {
      const r = await call("GET", `/api/reviews/recipe/${recipe.private}`, who);
      assert.equal(r.status, 404, who);
      assert.deepEqual(r.json, { error: "Recipe not found" });
      assert.ok(!r.text.includes(PRIVATE_REVIEW) && !r.text.includes("SECRET-PHOTO"));
    }
    assert.equal(missing.status, 200, "a recipe that is not stored locally behaves as before (empty list)");
    for (const who of ["member", "owner"]) {
      const r = await call("GET", `/api/reviews/recipe/${recipe.private}`, who);
      assert.equal(r.status, 200, who);
      assert.equal(r.json[0].reviewText, PRIVATE_REVIEW);
      assert.equal(r.json[0].photos[0].photoUrl, PRIVATE_PHOTO);
    }
  });

  test("losing membership revokes the reads immediately", async () => {
    assert.equal((await call("GET", `/api/reviews/recipe/${recipe.private}`, "member")).status, 200);
    await local.query(`DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2`, [club, ids.member]);
    assert.equal((await call("GET", `/api/reviews/recipe/${recipe.private}`, "member")).status, 404);
  });

  test("public and external recipe reviews keep working for everyone", async () => {
    const pub = await call("GET", `/api/reviews/recipe/${recipe.public}`, "anon");
    assert.equal(pub.status, 200);
    assert.equal(pub.json[0].reviewText, "public review");
    assert.equal((await call("GET", "/api/reviews/recipe/mealdb_52772", "anon")).status, 200);
    const created = await rate("outsider", "mealdb_52772", 4);
    assert.equal(created.status, 201, created.text);
    assert.equal(created.json.recipeId, recipe.externalPublic);
    assert.equal((await rate("outsider", recipe.public, 3)).status, 201);
  });

  test("an external or alternate reference cannot be used to reach a private recipe's reviews", async () => {
    await local.query(`INSERT INTO recipe_reviews (recipe_id, user_id, rating, review_text) VALUES ($1, $2, 5, $3)`, [recipe.privateExternal, ids.owner, PRIVATE_REVIEW]);
    const read = await call("GET", "/api/reviews/recipe/mealdb_999", "outsider");
    assert.equal(read.status, 404);
    assert.ok(!read.text.includes(PRIVATE_REVIEW));
    const write = await rate("outsider", "mealdb_999", 1);
    assert.equal(write.status, 404);
    assert.equal(await reviewCount(recipe.privateExternal), 1, "no review was added");
    assert.equal((await call("GET", "/api/reviews/recipe/mealdb_999", "owner")).status, 200);
  });

  test("create: outsiders cannot rate a private recipe (no row, no stats change); members and owners can", async () => {
    const before = await stats(recipe.private);
    for (const who of ["anon", "outsider"]) {
      const r = await rate(who, recipe.private, 1);
      assert.ok([401, 404].includes(r.status), `${who}: ${r.status}`);
    }
    const denied = await rate("outsider", recipe.private, 1);
    assert.equal(denied.status, 404);
    assert.deepEqual(denied.json, { error: "Recipe not found" });
    assert.equal(await reviewCount(recipe.private), 1);
    assert.deepEqual(await stats(recipe.private), before);
    assert.equal((await rate("owner", recipe.private, 5)).status, 201);
    assert.equal(await reviewCount(recipe.private), 2);
  });

  test("a removed member cannot rate, edit, add photos or mark helpful, but can still withdraw their own contributions", async () => {
    await local.query(`DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2`, [club, ids.member]);
    const before = await stats(recipe.private);
    assert.equal((await rate("member", recipe.private, 2)).status, 404);
    const edit = await call("PUT", `/api/reviews/${review.private}`, "member", { rating: 1, reviewText: "changed" });
    assert.equal(edit.status, 404);
    assert.deepEqual(edit.json, { error: "Review not found" });
    assert.equal((await local.query(`SELECT rating, review_text FROM recipe_reviews WHERE id = $1`, [review.private])).rows[0].rating, 4);
    // photo upload: multipart with a tiny but valid PNG; refused before anything is stored
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const form = new FormData();
    form.append("photo", new Blob([png], { type: "image/png" }), "x.png");
    const photo = await fetch(`${base()}/api/reviews/${review.private}/photos`, { method: "POST", headers: testAuthHeader(ids.member), body: form });
    assert.equal(photo.status, 404);
    assert.equal(Number((await local.query(`SELECT count(*) FROM recipe_review_photos WHERE review_id = $1`, [review.private])).rows[0].count), 1);
    assert.equal((await call("POST", `/api/reviews/${review.private}/helpful`, "member")).status, 404);
    assert.equal((await local.query(`SELECT helpful_count FROM recipe_reviews WHERE id = $1`, [review.private])).rows[0].helpful_count, 0);
    assert.deepEqual(await stats(recipe.private), before);
    // Withdrawing their own review is their own data and stays possible.
    assert.equal((await call("DELETE", `/api/reviews/${review.private}`, "member")).status, 200);
    assert.equal(await reviewCount(recipe.private), 0);
  });

  test("helpful votes: outsiders are refused on private reviews; members and everyone on public ones succeed; unknown review is 404", async () => {
    assert.equal((await call("POST", `/api/reviews/${review.private}/helpful`, "outsider")).status, 404);
    assert.equal((await call("POST", `/api/reviews/${review.private}/helpful`, "owner")).status, 200);
    assert.equal((await call("POST", `/api/reviews/${review.public}/helpful`, "outsider")).status, 200);
    assert.equal((await call("POST", `/api/reviews/no-such-review/helpful`, "outsider")).status, 404);
    assert.equal((await call("DELETE", `/api/reviews/${review.public}/helpful`, "outsider")).status, 200);
  });

  test("ownership and moderation rules are unchanged for authorized users", async () => {
    assert.equal((await call("PUT", `/api/reviews/${review.private}`, "owner", { rating: 1 })).status, 403, "cannot edit someone else's review");
    assert.equal((await call("DELETE", `/api/reviews/${review.private}`, "owner")).status, 403);
    const edit = await call("PUT", `/api/reviews/${review.private}`, "member", { rating: 2 });
    assert.equal(edit.status, 200);
    assert.equal(edit.json.rating, 2);
  });
}
