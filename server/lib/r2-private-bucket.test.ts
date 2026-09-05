import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertPrivateBucketIsolated, privateBucketConflict } from "./r2";

/**
 * The private R2 bucket must never be the public one.
 *
 * `R2_BUCKET` exists to be served directly through `R2_PUBLIC_BASE_URL`. Pointing `R2_PRIVATE_BUCKET` at the same
 * bucket would put every "private" booking document in a publicly addressable namespace, which is precisely the
 * privacy contract Phase 2I promises. An absent private bucket is a different thing entirely -- that is the
 * supported local-fallback deployment -- so the two cases resolve differently on purpose.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const r2Source = fs.readFileSync(path.join(here, "r2.ts"), "utf8");
const privateStorageSource = fs.readFileSync(path.join(here, "private-storage.ts"), "utf8");
const filesRouteSource = fs.readFileSync(path.join(here, "..", "routes", "catering-booking-files.ts"), "utf8");

test("an absent private bucket is not a conflict, so local fallback stays available", () => {
  assert.equal(privateBucketConflict(undefined, "chefsire-public"), null);
  assert.equal(privateBucketConflict("", "chefsire-public"), null);
  assert.equal(privateBucketConflict("   ", "chefsire-public"), null);
  assert.doesNotThrow(() => assertPrivateBucketIsolated(undefined, "chefsire-public"));
});

test("a private bucket distinct from the public one is accepted", () => {
  assert.equal(privateBucketConflict("chefsire-private", "chefsire-public"), null);
  assert.equal(privateBucketConflict("chefsire-public-2", "chefsire-public"), null);
  assert.doesNotThrow(() => assertPrivateBucketIsolated("chefsire-private", "chefsire-public"));
});

test("a private bucket equal to the public bucket is rejected", () => {
  assert.equal(privateBucketConflict("chefsire-public", "chefsire-public"), "same_as_public");
  assert.throws(() => assertPrivateBucketIsolated("chefsire-public", "chefsire-public"));
});

test("whitespace and casing cannot evade the equality protection", () => {
  // R2 bucket names are lowercase by specification, so a differing spelling still names the same bucket.
  for (const spelling of [" chefsire-public", "chefsire-public ", "  chefsire-public  ", "CHEFSIRE-PUBLIC", "ChefSire-Public"]) {
    assert.equal(privateBucketConflict(spelling, "chefsire-public"), "same_as_public", spelling);
    assert.throws(() => assertPrivateBucketIsolated(spelling, "chefsire-public"), spelling);
  }
  assert.equal(privateBucketConflict("chefsire-public", " CHEFSIRE-PUBLIC "), "same_as_public");
});

test("a configured private bucket with no public bucket configured stays valid", () => {
  // A deployment that uses R2 only for booking documents has no public bucket to collide with.
  assert.equal(privateBucketConflict("chefsire-private", undefined), null);
  assert.equal(privateBucketConflict("chefsire-private", ""), null);
  assert.doesNotThrow(() => assertPrivateBucketIsolated("chefsire-private", undefined));
});

test("the collision error explains the fix without disclosing credentials", () => {
  assert.throws(() => assertPrivateBucketIsolated("chefsire-public", "chefsire-public"), (error: unknown) => {
    const message = (error as Error).message;
    assert.equal(message.includes("R2_PRIVATE_BUCKET"), true);
    assert.equal(message.includes("R2_BUCKET"), true);
    // Names are not secrets and make the misconfiguration fixable; keys and endpoints are never in the message.
    for (const secret of ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT"]) {
      assert.equal(message.includes(secret), false, secret);
    }
    return true;
  });
});

test("every private R2 operation resolves its bucket through the guarded chokepoint", () => {
  // put/get/head/delete all call privateBucket(), which asserts, so no helper can be called around the check.
  for (const helper of ["putPrivateObject", "getPrivateObject", "headPrivateObject", "deletePrivateObject"]) {
    const at = r2Source.indexOf(`export async function ${helper}`);
    assert.notEqual(at, -1, helper);
    const body = r2Source.slice(at, r2Source.indexOf("\n}", at));
    assert.equal(body.includes("privateBucket()"), true, helper);
    // And never the public bucket helper.
    assert.equal(body.includes("r2Bucket()"), false, helper);
  }
  assert.equal(r2Source.slice(r2Source.indexOf("function privateBucket()")).includes("assertPrivateR2Isolated();"), true);
});

test("an unsafe bucket collision fails closed rather than silently downgrading to local storage", () => {
  // The provider decision asserts before choosing R2; it does not treat a collision as "R2 unavailable".
  const provider = privateStorageSource.slice(privateStorageSource.indexOf("export function privateStorageProvider"));
  assert.equal(provider.includes("if (!isPrivateR2Configured()) return \"local\";"), true);
  assert.equal(provider.indexOf("assertPrivateR2Isolated();") < provider.indexOf('return "r2";'), true);
  // And it is surfaced at initialization too, not only when a participant first uploads.
  assert.equal(privateStorageSource.includes("assertPrivateR2Isolated();"), true);
});

test("no booking private storage path ever builds a public URL", () => {
  // `publicUrl` is the R2_PUBLIC_BASE_URL helper; nothing on the booking file path may reach it.
  for (const [label, source] of [["private-storage", privateStorageSource], ["files route", filesRouteSource]] as const) {
    assert.equal(source.includes("publicUrl"), false, label);
    assert.equal(source.includes("R2_PUBLIC_BASE_URL"), false, label);
  }
  // The private helpers in r2.ts are likewise free of it. The variable NAME appears in their prose and in the
  // collision error, which is why this asserts on the two things that would actually expose a document: calling the
  // public URL builder, and reading the public base URL out of the environment.
  const privateSection = r2Source.slice(r2Source.indexOf("export function isPrivateR2Configured"));
  assert.equal(privateSection.includes("publicUrl("), false);
  assert.equal(privateSection.includes("process.env.R2_PUBLIC_BASE_URL"), false);
  // `publicUrl` stays confined to the pre-existing public media helpers above the private section.
  assert.equal(r2Source.slice(0, r2Source.indexOf("export function isPrivateR2Configured")).includes("export function publicUrl"), true);
});
