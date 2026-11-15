/**
 * Demo content must not claim popularity it never earned.
 *
 * server/seed.ts writes invented likesCount values onto the five sample posts -- 234, 156, 89, 178,
 * 145 -- with no like rows behind them. The harm is not only that the numbers are untrue to the
 * member reading them: getTrendingRecipes ranks by `likesCount * 2 + commentsCount`, so a demo post
 * claiming 234 likes outranks every real post anyone has actually earned. Invented numbers were
 * deciding what real people saw as popular.
 *
 * The authoritative counting rule, asserted here: a post's like and comment counts are however many
 * like and comment ROWS exist for it. Nothing else is evidence -- and for a sample post, a count
 * that cannot be established reports zero rather than falling back to the stored number, because
 * the stored number is the thing being corrected.
 *
 * Production rows are NOT rewritten. The correction happens at read time, so there is no second
 * source of truth to keep in step and nothing to undo when the demo rows are eventually deleted.
 */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";
import { isSamplePost, SAMPLE_POST_IDS, SAMPLE_AUTHOR_IDS } from "../../shared/social-sample";
import { withRealSampleCounts } from "./sample-post-counts";

test("the sample marker is the seeded id pair, so a real post can never be mistaken for a demo", () => {
  // Both halves must match. A real post authored by a demo account, or a demo id claimed by a real
  // member, is not a sample -- the same discipline as shared/marketplace-sample.ts.
  assert.equal(isSamplePost({ id: "post-1", userId: "user-1" }), true);
  assert.equal(isSamplePost({ id: "post-1", userId: "3f1b0c64-0000-4000-8000-000000000000" }), false);
  assert.equal(isSamplePost({ id: "3f1b0c64-0000-4000-8000-000000000000", userId: "user-1" }), false);
  assert.equal(isSamplePost({ id: "post-99", userId: "user-1" }), false);
  assert.equal(isSamplePost(null), false);
  assert.equal(isSamplePost({}), false);

  // The client-side demo feed shown to signed-out visitors is the second family.
  assert.equal(isSamplePost({ id: "demo-post-1", userId: "chef-1" }), true);
  assert.equal(isSamplePost({ id: "demo-post-1", userId: "user-1" }), false);

  // A caption or image can never make something a sample.
  assert.equal(isSamplePost({ id: "real", userId: "real" } as any), false);
});

test("demo posts are labelled in the feed, and the label cannot be driven by a caption", () => {
  const card = readFileSync(new URL("../../client/src/components/post-card.tsx", import.meta.url), "utf8");
  assert.match(card, /const isSample = isSamplePost\(post\)/);
  assert.match(card, /\{SAMPLE_POST_LABEL\}/, "the label text comes from the shared module");
  assert.doesNotMatch(card, /caption\s*[=.]*\s*(includes|startsWith|match).*[Ss]ample/,
    "the marker is identity, never the words in a post");
});

test("the seed is still the thing being corrected, so this suite stays relevant", () => {
  // If the seed ever stops writing invented counts, the read-time correction becomes a no-op and
  // this comment is the record of why it exists. The assertion is here so the suite notices.
  const seed = readFileSync(new URL("../seed.ts", import.meta.url), "utf8");
  const invented = seed.match(/likesCount: [1-9][0-9]{1,}/g) ?? [];
  assert.ok(invented.length > 0,
    "the seed no longer invents popularity -- the read-time correction can be retired, and this test with it");
});

if (!PG_URL) {
  test("Sample post counts (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  test("a sample post reports the rows it actually has, not the number the seed invented", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { db } = await import("../db");
    const tables = "comments, likes, posts, users";
    try {
      await local.query(`
        DROP TABLE IF EXISTS ${tables} CASCADE;
        ${ddl(schema.users, "users")};
        ${ddl(schema.posts, "posts")};
        ${ddl(schema.likes, "likes")};
        ${ddl(schema.comments, "comments")};
      `);
      // The demo account and post ids are fixed strings, exactly as the seed writes them.
      const [demoAuthor] = SAMPLE_AUTHOR_IDS;
      const [samplePostId] = SAMPLE_POST_IDS;
      await local.query("INSERT INTO users(id,username,email,display_name) VALUES ($1,'demo','demo@example.test','Demo')", [demoAuthor]);
      const [realMember] = (await local.query(
        "INSERT INTO users(username,email,display_name) VALUES ('real','real@example.test','Real') RETURNING id",
      )).rows;

      // The invented popularity, as seeded: 234 likes and 12 comments with nothing behind them.
      await local.query(
        `INSERT INTO posts(id,user_id,caption,image_url,likes_count,comments_count)
         VALUES ($1,$2,'Seeded sample','/uploads/sample.jpg',234,12)`, [samplePostId, demoAuthor]);
      // A real post with its own counts, to prove real content is left alone.
      const [realPost] = (await local.query(
        `INSERT INTO posts(user_id,caption,image_url,likes_count,comments_count)
         VALUES ($1,'Real post','/uploads/real.jpg',7,3) RETURNING id`, [String(realMember.id)])).rows;

      // Two actual likes and one actual comment on the sample post.
      await local.query("INSERT INTO likes(user_id,post_id) VALUES ($1,$2),($3,$2)",
        [demoAuthor, samplePostId, String(realMember.id)]);
      await local.query("INSERT INTO comments(user_id,post_id,content) VALUES ($1,$2,'Nice')",
        [String(realMember.id), samplePostId]);

      const corrected = await withRealSampleCounts(db, [
        { id: samplePostId, userId: demoAuthor, likesCount: 234, commentsCount: 12 },
        { id: String(realPost.id), userId: String(realMember.id), likesCount: 7, commentsCount: 3 },
      ]);

      assert.equal(corrected[0].likesCount, 2, "the sample post reports its two real likes, not 234");
      assert.equal(corrected[0].commentsCount, 1, "and its one real comment, not 12");
      assert.equal(corrected[1].likesCount, 7, "a real post's own counts are never touched");
      assert.equal(corrected[1].commentsCount, 3);

      // Nothing was written: the stored row still holds what the seed put there.
      const stored = (await local.query("SELECT likes_count, comments_count FROM posts WHERE id = $1", [samplePostId])).rows[0];
      assert.equal(Number(stored.likes_count), 234, "the correction is read-time; production rows are not rewritten");
      assert.equal(Number(stored.comments_count), 12);

      // A sample post whose row cannot be counted reports zero, not its invented number.
      const missing = await withRealSampleCounts(db, [
        { id: "post-5", userId: "user-5", likesCount: 145, commentsCount: 9 },
      ]);
      assert.equal(missing[0].likesCount, 0, "an uncountable sample post must not fall back to the invented value");
      assert.equal(missing[0].commentsCount, 0);

      // A feed of only real posts costs no extra query, which is why the common case is unaffected.
      const untouched = await withRealSampleCounts(
        { execute: async () => { throw new Error("no query should run for a page without sample posts"); } },
        [{ id: String(realPost.id), userId: String(realMember.id), likesCount: 7, commentsCount: 3 }],
      );
      assert.equal(untouched[0].likesCount, 7);
    } finally {
      await local.query(`DROP TABLE IF EXISTS ${tables} CASCADE`);
      await local.end();
    }
  });

  test("invented popularity cannot put a demo post in the trending list", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { storage } = await import("../storage");
    const tables = "recipes, comments, likes, posts, users";
    try {
      await local.query(`
        DROP TABLE IF EXISTS ${tables} CASCADE;
        ${ddl(schema.users, "users")};
        ${ddl(schema.posts, "posts")};
        ${ddl(schema.likes, "likes")};
        ${ddl(schema.comments, "comments")};
        ${ddl(schema.recipes, "recipes")};
      `);
      const [demoAuthor] = SAMPLE_AUTHOR_IDS;
      const [samplePostId] = SAMPLE_POST_IDS;
      await local.query("INSERT INTO users(id,username,email,display_name) VALUES ($1,'demo2','demo2@example.test','Demo')", [demoAuthor]);
      const [realMember] = (await local.query(
        "INSERT INTO users(username,email,display_name) VALUES ('real2','real2@example.test','Real') RETURNING id",
      )).rows;

      // The demo post claims 234 likes; the real one has an honest 5. On the raw ranking the demo
      // post wins by a mile, which is exactly what used to happen.
      await local.query(
        `INSERT INTO posts(id,user_id,caption,image_url,likes_count,comments_count,is_recipe)
         VALUES ($1,$2,'Seeded sample','/uploads/sample.jpg',234,12,true)`, [samplePostId, demoAuthor]);
      const [realPost] = (await local.query(
        `INSERT INTO posts(user_id,caption,image_url,likes_count,comments_count,is_recipe)
         VALUES ($1,'Real recipe','/uploads/real.jpg',5,1,true) RETURNING id`, [String(realMember.id)])).rows;
      await local.query(
        `INSERT INTO recipes(post_id,title,ingredients,instructions)
         VALUES ($1,'Sample dish',$3,$4),($2,'Real dish',$3,$4)`,
        [samplePostId, String(realPost.id), JSON.stringify(["an ingredient"]), JSON.stringify(["a step"])]);

      const trending = await storage.getTrendingRecipes(10);
      const ids = trending.map((row: any) => String(row.post?.id));
      assert.ok(!ids.includes(samplePostId),
        `a demo post must not appear in trending at all; got ${JSON.stringify(ids)}`);
      assert.ok(ids.includes(String(realPost.id)),
        "and the real recipe it was outranking must still be there");
    } finally {
      await local.query(`DROP TABLE IF EXISTS ${tables} CASCADE`);
      await local.end();
    }
  });
}
