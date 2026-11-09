import test from "node:test";
import assert from "node:assert/strict";
import { stripTitlePrefix, titlePrefix, typedUsername, withTitlePrefix } from "./signup-username";

const titles = ["king", "queen", "your-majesty", "your-highness", "chef", "royal-chef"];

test("choosing a title puts its prefix in front of the username", () => {
  assert.equal(titlePrefix("king"), "king-");
  assert.equal(titlePrefix(""), "");
  assert.equal(withTitlePrefix("", "king", titles), "king-");
  assert.equal(withTitlePrefix("abc123", "king", titles), "king-abc123");
});

test("switching or clearing the title replaces the old prefix, keeping what was typed", () => {
  assert.equal(withTitlePrefix("king-abc123", "queen", titles), "queen-abc123");
  assert.equal(withTitlePrefix("king-abc123", "your-majesty", titles), "your-majesty-abc123");
  assert.equal(withTitlePrefix("your-majesty-abc123", "chef", titles), "chef-abc123");
  assert.equal(withTitlePrefix("king-abc123", "", titles), "abc123");
  // Longest match wins: "royal-chef-" is not read as "royal" + "chef-...".
  assert.equal(stripTitlePrefix("royal-chef-sam", titles), "sam");
});

test("the prefix can't be typed away while a title is chosen", () => {
  // Backspacing into "king-" snaps back to "king-", never "king-king".
  assert.equal(typedUsername("king", "king", titles), "king-");
  assert.equal(typedUsername("kin", "king", titles), "king-");
  assert.equal(typedUsername("", "king", titles), "king-");
  assert.equal(typedUsername("king-a", "king", titles), "king-a");
  assert.equal(typedUsername("king--abc", "king", titles), "king-abc");
  // Pasting a whole name, or selecting all and typing, keeps the prefix in front.
  assert.equal(typedUsername("abc123", "king", titles), "king-abc123");
  // No title: exactly what was typed.
  assert.equal(typedUsername("abc", "", titles), "abc");
});
