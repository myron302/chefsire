import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg } from "../test-support/authz-pg-harness";
import { eraseMemberSocialContentWithinTransaction, CLOSED_MEMBER_COMMENT_PLACEHOLDER } from "./closure-social-erasure";

const tables = [
  "meal_plan_entries", "recipe_allergens", "recipe_saves", "recipe_review_photos",
  "review_helpful", "recipe_reviews", "comment_likes", "comments", "likes",
  "follow_requests", "follows", "stories", "recipes", "posts", "orders", "users",
];

if (!PG_URL) {
  test("Part 3b social erasure requires CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("social cleanup preserves counterparty replies and paid ledgers, then fails atomically on referenced recipes", async () => {
    const local = await connectLocalPg();
    const { db } = await import("../db");
    try {
      await local.query(`
        DROP TABLE IF EXISTS ${tables.join(", ")} CASCADE;
        CREATE TABLE users(id varchar PRIMARY KEY);
        CREATE TABLE posts(id varchar PRIMARY KEY,user_id varchar REFERENCES users(id));
        CREATE TABLE recipes(id varchar PRIMARY KEY,post_id varchar REFERENCES posts(id));
        CREATE TABLE recipe_reviews(id varchar PRIMARY KEY,recipe_id varchar REFERENCES recipes(id),
          user_id varchar REFERENCES users(id),review_text text);
        CREATE TABLE recipe_review_photos(id varchar PRIMARY KEY,review_id varchar REFERENCES recipe_reviews(id));
        CREATE TABLE review_helpful(id varchar PRIMARY KEY,review_id varchar REFERENCES recipe_reviews(id),
          user_id varchar REFERENCES users(id));
        CREATE TABLE recipe_saves(id varchar PRIMARY KEY,recipe_id varchar REFERENCES recipes(id),
          user_id varchar REFERENCES users(id));
        CREATE TABLE recipe_allergens(id varchar PRIMARY KEY,recipe_id varchar REFERENCES recipes(id));
        CREATE TABLE comments(id varchar PRIMARY KEY,post_id varchar REFERENCES posts(id),
          user_id varchar REFERENCES users(id),parent_id varchar REFERENCES comments(id) ON DELETE CASCADE,
          content text);
        CREATE TABLE comment_likes(id varchar PRIMARY KEY,comment_id varchar REFERENCES comments(id) ON DELETE CASCADE,
          user_id varchar REFERENCES users(id));
        CREATE TABLE likes(id varchar PRIMARY KEY,post_id varchar REFERENCES posts(id),
          user_id varchar REFERENCES users(id));
        CREATE TABLE follows(id varchar PRIMARY KEY,follower_id varchar REFERENCES users(id),
          following_id varchar REFERENCES users(id));
        CREATE TABLE follow_requests(id varchar PRIMARY KEY,requester_id varchar REFERENCES users(id),
          target_id varchar REFERENCES users(id));
        CREATE TABLE stories(id varchar PRIMARY KEY,user_id varchar REFERENCES users(id));
        CREATE TABLE orders(id varchar PRIMARY KEY,buyer_id varchar REFERENCES users(id),amount_cents integer);
        CREATE TABLE meal_plan_entries(id varchar PRIMARY KEY,recipe_id varchar REFERENCES recipes(id));
        INSERT INTO users VALUES('closing'),('friend'),('buyer');
        INSERT INTO posts VALUES('own-post','closing'),('friend-post','friend');
        INSERT INTO recipes VALUES('own-recipe','own-post'),('friend-recipe','friend-post');
        INSERT INTO recipe_reviews VALUES ('own-review','friend-recipe','closing','erase this'),
          ('other-review','own-recipe','friend','review on deleted recipe');
        INSERT INTO recipe_review_photos VALUES('review-photo','own-review');
        INSERT INTO review_helpful VALUES('helpful','other-review','closing');
        INSERT INTO recipe_saves VALUES('saved','own-recipe','buyer');
        INSERT INTO recipe_allergens VALUES('allergen','own-recipe');
        INSERT INTO comments VALUES ('own-comment','friend-post','closing',null,'private'),
          ('reply','friend-post','friend','own-comment','keep this reply'),
          ('comment-on-post','own-post','friend',null,'lost with own post');
        INSERT INTO comment_likes VALUES('liked-redacted','own-comment','friend'),
          ('liked-post','comment-on-post','buyer');
        INSERT INTO likes VALUES('own-like','friend-post','closing'),('other-like','own-post','friend');
        INSERT INTO follows VALUES('f1','closing','friend'),('f2','friend','closing'),
          ('other-follow','friend','buyer');
        INSERT INTO follow_requests VALUES('req1','closing','friend');
        INSERT INTO stories VALUES('story','closing');
        INSERT INTO orders VALUES('purchase','buyer',3500);
      `);
      const result = await db.transaction((tx: any) => eraseMemberSocialContentWithinTransaction(tx, "closing"));
      assert.equal(result.posts, 1);
      assert.equal(result.recipes, 1);
      assert.equal(result.comments_redacted, 1);
      assert.equal(result.comments_on_deleted_posts, 1);
      assert.equal(result.follows, 2);
      assert.deepEqual((await local.query("SELECT id,content FROM comments ORDER BY id")).rows, [
        { id:"own-comment", content:CLOSED_MEMBER_COMMENT_PLACEHOLDER },
        { id:"reply", content:"keep this reply" },
      ]);
      assert.deepEqual((await local.query("SELECT id FROM comment_likes ORDER BY id")).rows,
        [{ id:"liked-redacted" }], "counterparty's engagement on retained reply thread remains");
      assert.deepEqual((await local.query("SELECT id FROM posts")).rows,[{id:"friend-post"}]);
      assert.deepEqual((await local.query("SELECT id FROM recipes")).rows,[{id:"friend-recipe"}]);
      assert.deepEqual((await local.query("SELECT id,amount_cents FROM orders")).rows,
        [{id:"purchase",amount_cents:3500}]);
      assert.equal((await db.transaction((tx: any) => eraseMemberSocialContentWithinTransaction(tx,"closing"))).posts,0);

      // When another member's meal plan references an owned recipe, the social
      // deletion must ABORT rather than silently removing the buyer's content.
      await local.query(`
        INSERT INTO posts VALUES('blocked-post','closing');
        INSERT INTO recipes VALUES('blocked-recipe','blocked-post');
        INSERT INTO meal_plan_entries VALUES('friend-plan-entry','blocked-recipe');
        INSERT INTO likes VALUES('will-rollback','friend-post','closing');
      `);
      await assert.rejects(db.transaction((tx: any) => eraseMemberSocialContentWithinTransaction(tx,"closing")),
        (error: any) => error?.code === "23503");
      assert.equal((await local.query("SELECT count(*)::int n FROM likes WHERE id='will-rollback'")).rows[0].n,1,
        "early DELETEs rolled back when the retained recipe dependency blocked deletion");
      assert.equal((await local.query("SELECT count(*)::int n FROM posts WHERE id='blocked-post'")).rows[0].n,1);
    } finally {
      await local.query(`DROP TABLE IF EXISTS ${tables.join(", ")} CASCADE`);
      await local.end();
    }
  });
}
