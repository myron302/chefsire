/** Part 3b: shared social storage writes are gated on the locked author account. */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";
import { MemberContentWriteBlockedError } from "./member-content-write-lock";

if (!PG_URL) {
  test("Closure-safe storage writes require CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("closed members cannot create posts, comments, stories, likes or comment likes after stale-auth prechecks", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { storage } = await import("../storage");
    const tables = "comment_likes, likes, comments, stories, posts, users";
    try {
      await local.query(`
        DROP TABLE IF EXISTS ${tables} CASCADE;
        ${ddl(schema.users, "users")};
        ${ddl(schema.posts, "posts")};
        ${ddl(schema.stories, "stories")};
        ${ddl(schema.comments, "comments")};
        ${ddl(schema.likes, "likes")};
        ${ddl(schema.commentLikes, "comment_likes")};
      `);
      const [member] = (await local.query(
        "INSERT INTO users(username,email,display_name) VALUES('closing-author','closing-author@example.test','Author') RETURNING id",
      )).rows;
      const id = member.id as string;
      const post = await storage.createPost({ userId: id, caption: "Original", imageUrl: "/uploads/test.jpg" });
      const storyInput = { userId: id, imageUrl: "/uploads/story.jpg", mediaType: "image" as const,
        expiresAt: new Date(Date.now() + 3600000) };
      await storage.createStory(storyInput);
      const comment = await storage.createComment({ userId: id, postId: post.id, content: "Original comment" });
      await storage.likePost(id, post.id);
      await storage.likeComment(id, comment.id);
      const baseline = (await local.query(`
        SELECT
          (SELECT count(*)::int FROM posts) AS posts,
          (SELECT count(*)::int FROM comments) AS comments,
          (SELECT count(*)::int FROM stories) AS stories,
          (SELECT count(*)::int FROM likes) AS likes,
          (SELECT count(*)::int FROM comment_likes) AS comment_likes,
          (SELECT posts_count FROM users WHERE id=$1) AS posts_count,
          (SELECT comments_count FROM posts WHERE id=$2) AS comments_count,
          (SELECT likes_count FROM posts WHERE id=$2) AS likes_count
      `, [id, post.id])).rows[0];
      assert.equal(baseline.posts, 1);
      assert.equal(baseline.comments, 1);
      assert.equal(baseline.stories, 1);
      assert.equal(baseline.likes, 1);
      assert.equal(baseline.comment_likes, 1);

      await local.query("INSERT INTO account_status(user_id,status,reason) VALUES($1,'closed','closure test')", [id]);
      const denied = (task: () => Promise<unknown>) =>
        assert.rejects(task, (e: unknown) => e instanceof MemberContentWriteBlockedError);
      await denied(() => storage.createPost({ userId: id, imageUrl: "/uploads/resurrection.jpg" }));
      await denied(() => storage.createStory(storyInput));
      await denied(() => storage.createComment({ userId: id, postId: post.id, content: "after close" }));
      await denied(() => storage.likePost(id, post.id));
      await denied(() => storage.likeComment(id, comment.id));
      const after = (await local.query(`
        SELECT
          (SELECT count(*)::int FROM posts) AS posts,
          (SELECT count(*)::int FROM comments) AS comments,
          (SELECT count(*)::int FROM stories) AS stories,
          (SELECT count(*)::int FROM likes) AS likes,
          (SELECT count(*)::int FROM comment_likes) AS comment_likes,
          (SELECT posts_count FROM users WHERE id=$1) AS posts_count,
          (SELECT comments_count FROM posts WHERE id=$2) AS comments_count,
          (SELECT likes_count FROM posts WHERE id=$2) AS likes_count
      `, [id, post.id])).rows[0];
      assert.deepEqual(after, baseline, "failed stale-author writes must leave all rows and counters unchanged");
    } finally {
      await local.query(`DROP TABLE IF EXISTS ${tables} CASCADE`);
      await local.end();
    }
  });
}
