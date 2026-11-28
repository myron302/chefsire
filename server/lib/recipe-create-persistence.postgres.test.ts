/**
 * What `storage.createRecipe` actually writes, and what it refuses to write.
 *
 * This exists because `the __tests__/recipe.test.ts` -- a directory created by a mistyped command -- claimed to
 * cover exactly this and could never have run: it imports `../src/storage`, which does not exist, and is
 * written in Jest's `describe`/`it`/`expect`, which this repository has no runner for. It was the only test
 * file outside CI with no reason recorded, so it was the last gap in "every suite runs in CI". The assertions
 * it meant to make are made here instead, against a real database, and the dead file is removed.
 *
 * One of its expectations was wrong and is corrected rather than carried over: it passed
 * `instructions: 'Cook pasta, add sauce, serve.'` and asserted the value came back identical. `instructions`
 * is `jsonb` declared `string[]` and NOT NULL, so a bare string is stored as a JSON string and read back as
 * one -- the assertion would have passed while the column held something no reader expects. The shape the
 * schema declares is asserted instead.
 */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";

if (!PG_URL) {
  test("recipe create persistence requires CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  const TABLES = "recipes, posts, users";

  async function fixture() {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { storage } = await import("../storage");
    await local.query(`
      DROP TABLE IF EXISTS ${TABLES} CASCADE;
      ${ddl(schema.users, "users")};
      ${ddl(schema.posts, "posts")};
      ${ddl(schema.recipes, "recipes")};
    `);
    // `ddl()` builds a bare table from the Drizzle column list and emits no constraints, so the uniqueness of
    // recipes.post_id -- declared `.unique()` in shared/schema and created for real by
    // server/migrations/20260509_posts_feed_indexes.sql:10 -- is absent unless it is added here. Without it the
    // third test below would assert a property of the harness rather than of the schema or the code.
    await local.query(`CREATE UNIQUE INDEX recipes_post_id_idx ON recipes (post_id)`);
    const [author] = (await local.query(
      "INSERT INTO users(username,email,display_name) VALUES('recipe-author','recipe-author@example.test','Author') RETURNING id",
    )).rows;
    const post = await storage.createPost({ userId: author.id as string, caption: "Dinner", imageUrl: "/uploads/test.jpg" });
    return { local, storage, authorId: author.id as string, post };
  }

  test("a recipe is persisted with the fields it was given, attached to its post", async () => {
    const { local, storage, post } = await fixture();
    try {
      const input = {
        postId: post.id,
        title: "Test Pasta",
        ingredients: ["pasta", "tomato", "basil"],
        instructions: ["Cook pasta", "Add sauce", "Serve"],
      };
      const returned = await storage.createRecipe(input);
      assert.ok(returned?.id, "createRecipe must return the row it inserted");

      // Read the row back out of the database rather than trusting the return value: an implementation that
      // returned its own argument without inserting would satisfy a return-value-only assertion.
      const rows = (await local.query(
        "SELECT id, post_id, title, ingredients, instructions FROM recipes WHERE id = $1",
        [returned.id],
      )).rows;
      assert.equal(rows.length, 1, "exactly one row, found by the id createRecipe returned");
      const row = rows[0];
      assert.equal(row.post_id, post.id);
      assert.equal(row.title, input.title);
      // jsonb declared string[]: it must come back as an array, not a string containing one.
      assert.ok(Array.isArray(row.ingredients), `ingredients is ${typeof row.ingredients}, not an array`);
      assert.ok(Array.isArray(row.instructions), `instructions is ${typeof row.instructions}, not an array`);
      assert.deepEqual(row.ingredients, input.ingredients);
      assert.deepEqual(row.instructions, input.instructions);
    } finally {
      await local.end();
    }
  });

  test("a recipe for a post that does not exist is refused, and nothing is written", async () => {
    const { local, storage } = await fixture();
    try {
      await assert.rejects(
        () => storage.createRecipe({
          postId: "00000000-0000-4000-8000-0000000000ff",
          title: "Orphan",
          ingredients: ["x"],
          instructions: ["y"],
        }),
        /Recipe post no longer exists/,
        "createRecipe locks the post's author, so it has to refuse a post it cannot find",
      );
      const count = (await local.query("SELECT count(*)::int AS n FROM recipes")).rows[0].n;
      assert.equal(count, 0, "the refusal must leave no row behind");
    } finally {
      await local.end();
    }
  });

  test("one post carries at most one recipe, and the second is refused rather than overwriting", async () => {
    // recipes.post_id is unique, so a second recipe on the same post is a constraint violation. What matters
    // here is the shape of the failure: createRecipe must let it surface rather than swallow it, and the first
    // recipe must still be there afterwards.
    const { local, storage, post } = await fixture();
    try {
      const first = await storage.createRecipe({ postId: post.id, title: "First", ingredients: ["a"], instructions: ["b"] });
      await assert.rejects(
        () => storage.createRecipe({ postId: post.id, title: "Second", ingredients: ["c"], instructions: ["d"] }),
        "a second recipe on the same post must be refused",
      );
      const rows = (await local.query("SELECT id, title FROM recipes")).rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, first.id, "the first recipe survives");
      assert.equal(rows[0].title, "First", "and is not overwritten by the refused one");
    } finally {
      await local.end();
    }
  });
}
