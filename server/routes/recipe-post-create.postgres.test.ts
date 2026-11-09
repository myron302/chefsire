import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";
import { buildRecipePostPayload } from "../../client/src/lib/recipe-post-payload";

// Launch-journey audit: the Create Post page posted `isRecipe: true` without `recipe` and then tried to add the
// recipe in a second request, so POST /api/posts refused every recipe post ("Recipe details are required").
test("the Create Post page sends the recipe inside the post request", () => {
  const src = readFileSync(new URL("../../client/src/pages/social/create-post.tsx", import.meta.url), "utf8");
  assert.match(src, /postData\.recipe = buildRecipePostPayload\(/);
  assert.doesNotMatch(src, /apiRequest\("POST", "\/api\/recipes"/, "no second request that could duplicate the recipe");
});

test("blank optional fields are omitted, not sent as null", () => {
  assert.deepEqual(
    buildRecipePostPayload({ title: " Pasta ", ingredients: ["1 lb spaghetti", " "], instructions: ["Boil", ""], cookTime: "", servings: "", difficulty: "", imageUrl: "" }),
    { title: "Pasta", ingredients: ["1 lb spaghetti"], instructions: ["Boil"] },
  );
  assert.deepEqual(
    buildRecipePostPayload({ title: "Pasta", ingredients: ["a"], instructions: ["b"], cookTime: "20", servings: "2", difficulty: "Easy", imageUrl: "https://x.test/p.jpg" }),
    { title: "Pasta", ingredients: ["a"], instructions: ["b"], cookTime: 20, servings: 2, difficulty: "Easy", imageUrl: "https://x.test/p.jpg" },
  );
  assert.equal(buildRecipePostPayload({ title: "P", ingredients: ["a"], instructions: ["b"], servings: "0" }).servings, undefined);
});

if (!PG_URL) {
  test("recipe post creation (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  test("a recipe post built the way the page builds it creates the post and its recipe once", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { default: postsRouter } = await import("./posts");
    const app = express();
    app.use(express.json());
    app.use("/api/posts", postsRouter);
    const server = app.listen(0, "127.0.0.1");
    try {
      await local.query(`
        DROP TABLE IF EXISTS recipes, posts, users CASCADE;
        ${ddl(schema.users, "users")};
        ${ddl(schema.posts, "posts")};
        ${ddl(schema.recipes, "recipes")};
      `);
      const id = (await local.query(
        "INSERT INTO users (username, email, display_name, password, auth_version) VALUES ('cook', 'cook@example.test', 'cook', 'fixture', 1) RETURNING id",
      )).rows[0].id;
      const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, () => id);
      const base = { caption: "Dinner", imageUrl: "https://images.example.test/pasta.jpg", additionalImages: [], tags: [], isRecipe: true };

      const old = await call("POST", "/api/posts", "cook", base);
      assert.equal(old.status, 400, "the old request shape is what failed in production");
      assert.match(old.json.message, /Recipe details are required/);

      const recipe = buildRecipePostPayload({
        title: "Garlic Butter Pasta", ingredients: ["1 lb spaghetti", "3 clove garlic"], instructions: ["Boil pasta", "Toss with garlic butter"],
        cookTime: "20", servings: "", difficulty: "Easy", imageUrl: base.imageUrl,
      });
      const created = await call("POST", "/api/posts", "cook", { ...base, recipe });
      assert.equal(created.status, 201, created.text);
      const rows = (await local.query("SELECT title, ingredients, instructions, cook_time, servings FROM recipes WHERE post_id = $1", [created.json.id])).rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].title, "Garlic Butter Pasta");
      assert.deepEqual(rows[0].ingredients, ["1 lb spaghetti", "3 clove garlic"]);
      assert.equal(rows[0].cook_time, 20);
      assert.equal(rows[0].servings, null);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query("DROP TABLE IF EXISTS recipes, posts, users CASCADE");
      await local.end();
    }
  });
}
