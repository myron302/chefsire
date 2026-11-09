import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./feed.tsx", import.meta.url), "utf8");

// Launch-journey audit: after liking a post, its detail window said "0 likes" right above "Liked by king-myron".
test("the post window's like count comes from the freshly fetched liker list", () => {
  assert.match(src, /\{selectedPostLikesLoaded \? selectedPostLikes\.length : selectedPost\.likesCount \|\| 0\} likes/);
});

test("demo feed content never shows invented popularity", () => {
  assert.doesNotMatch(src, /(likesCount|commentsCount): [1-9]/);
});
