import test from "node:test";
import assert from "node:assert/strict";
import { looksLikePhone, normalizePhone } from "./phone";

test("US/Canada numbers in common formats normalize to E.164", () => {
  for (const raw of ["(860) 555-1234", "860.555.1234", "860-555-1234", "8605551234", "1-860-555-1234", "+1 860 555 1234", " 860 555 1234 "]) {
    assert.equal(normalizePhone(raw), "+18605551234", raw);
  }
});

test("international numbers need a leading +", () => {
  assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958");
  assert.equal(normalizePhone("+33 1 23 45 67 89"), "+33123456789");
});

test("anything else is rejected rather than guessed", () => {
  for (const raw of ["", "abc", "555-1234", "860-555-123", "0605551234", "8601551234", "12345678901234567", "+0 123 456 789",
    "860555123x", "860-555-1234 ext 5", "++18605551234", "1+8605551234", "860/555/1234", null, undefined, 8605551234]) {
    assert.equal(normalizePhone(raw as unknown), null, String(raw));
  }
});

test("phone-shaped login identifiers are distinguished from usernames", () => {
  assert.equal(looksLikePhone("(860) 555-1234"), true);
  assert.equal(looksLikePhone("+44 20 7946 0958"), true);
  assert.equal(looksLikePhone("king-abc123"), false);
  assert.equal(looksLikePhone("myron200"), false);
  assert.equal(looksLikePhone("123"), false);
});
