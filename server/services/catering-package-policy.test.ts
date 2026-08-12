import test from "node:test";
import assert from "node:assert/strict";
import { authorizePackageCoverUpload } from "./catering-package-policy";

const packageId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

test("cover upload allows the valid package owner", () => {
  assert.deepEqual(authorizePackageCoverUpload("owner", "owner", packageId, { providerId: "owner" }), { allowed: true });
});

test("cover upload rejects a nonexistent package before storage", () => {
  assert.equal(authorizePackageCoverUpload("owner", "owner", packageId, undefined).status, 404);
});

test("cover upload rejects another provider's package before storage", () => {
  assert.equal(authorizePackageCoverUpload("owner", "owner", packageId, { providerId: "other" }).status, 403);
});

test("cover upload rejects a malformed package ID before storage", () => {
  assert.equal(authorizePackageCoverUpload("owner", "owner", "bad-id", undefined).status, 400);
});

test("cover upload rejects a route-provider mismatch before storage", () => {
  assert.equal(authorizePackageCoverUpload("owner", "other", packageId, undefined).status, 403);
});
