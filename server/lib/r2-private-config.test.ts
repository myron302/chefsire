import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRIVATE_R2_REQUIRED_VARS, assertPrivateR2Configured, isPrivateR2Configured, missingPrivateR2Vars,
  privateBucketConflict, privateR2Configuration,
} from "./r2";

/**
 * Private R2 configuration has three states, and conflating two of them was the bug.
 *
 * `isPrivateR2Configured()` used to answer a plain "every required variable is set?", so an operator who set
 * R2_PRIVATE_BUCKET but whose credentials were missing got `false` -- indistinguishable from a deployment that
 * deliberately has no private bucket at all. `privateStorageProvider()` then chose LOCAL. In a multi-replica or
 * ephemeral deployment that is silent data loss: the metadata row records `storageProvider: "local"`, only the
 * instance that accepted the upload holds the bytes, no other replica can serve the download, a redeploy destroys
 * them -- and the operator is never told their configuration was incomplete.
 *
 * The bucket name is the intent signal. Once it is set, anything short of a complete configuration is an error.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const r2Source = fs.readFileSync(path.join(here, "r2.ts"), "utf8");
const storageSource = fs.readFileSync(path.join(here, "private-storage.ts"), "utf8");

const ENV = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PRIVATE_BUCKET", "R2_BUCKET"] as const;
const saved = new Map(ENV.map((name) => [name, process.env[name]]));
/** Sets exactly the given variables and clears the rest, so no test leaks configuration into another. */
function configure(values: Partial<Record<(typeof ENV)[number], string>>): void {
  for (const name of ENV) {
    const value = values[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
const COMPLETE = { R2_ENDPOINT: "https://account.r2.cloudflarestorage.com", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_PRIVATE_BUCKET: "chefsire-private" } as const;
test.after(() => { for (const [name, value] of saved) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });

test("1 & 13. every private R2 variable absent: local fallback is allowed", () => {
  configure({});
  assert.equal(privateR2Configuration(), "absent");
  assert.doesNotThrow(() => assertPrivateR2Configured());
  assert.equal(isPrivateR2Configured(), false, "an unconfigured deployment legitimately uses local storage");
});

test("2. public R2 configured but no private bucket: private storage still falls back locally", () => {
  configure({ R2_ENDPOINT: COMPLETE.R2_ENDPOINT, R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "chefsire-media" });
  assert.equal(privateR2Configuration(), "absent");
  assert.equal(isPrivateR2Configured(), false);
  // Public media R2 is untouched by any of this: it reads R2_BUCKET and has its own required-variable list.
  assert.equal(r2Source.includes('throw new Error("R2_BUCKET is required to upload media")'), true);
});

test("3 & 11. a complete private configuration selects R2, and cannot select local", () => {
  configure({ ...COMPLETE, R2_BUCKET: "chefsire-media" });
  assert.equal(privateR2Configuration(), "complete");
  assert.deepEqual(missingPrivateR2Vars(), []);
  assert.equal(isPrivateR2Configured(), true);
  // The provider function returns "local" only on a false answer, which a complete configuration never gives.
  const provider = storageSource.slice(storageSource.indexOf("export function privateStorageProvider"), storageSource.indexOf("export async function writePrivateObject"));
  assert.equal(provider.includes('if (!isPrivateR2Configured()) return "local";'), true);
  assert.equal(provider.includes('return "r2";'), true);
});

test("4, 5, 6 & 12. a bucket with any connection variable missing fails closed, never local", () => {
  for (const missing of ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const) {
    const partial: Record<string, string> = { ...COMPLETE };
    delete partial[missing];
    configure(partial);
    assert.equal(privateR2Configuration(), "partial", missing);
    assert.deepEqual(missingPrivateR2Vars(), [missing]);
    assert.throws(() => assertPrivateR2Configured(), /incomplete/, missing);
    // The decisive property: the question every caller asks THROWS rather than answering false.
    assert.throws(() => isPrivateR2Configured(), /incomplete/, missing);
  }
});

test("7. whitespace-only values count as missing, for every variable including the bucket", () => {
  configure({ ...COMPLETE, R2_ACCESS_KEY_ID: "   " });
  assert.equal(privateR2Configuration(), "partial");
  assert.deepEqual(missingPrivateR2Vars(), ["R2_ACCESS_KEY_ID"]);
  assert.throws(() => isPrivateR2Configured(), /R2_ACCESS_KEY_ID/);
  configure({ ...COMPLETE, R2_ENDPOINT: "" });
  assert.deepEqual(missingPrivateR2Vars(), ["R2_ENDPOINT"]);
  // A blank BUCKET is an absent bucket, not a partial configuration: nothing was asked for.
  configure({ ...COMPLETE, R2_PRIVATE_BUCKET: "   " });
  assert.equal(privateR2Configuration(), "absent");
  assert.equal(isPrivateR2Configured(), false);
});

test("8. several missing variables are all named, and no value is ever included", () => {
  configure({ R2_PRIVATE_BUCKET: "chefsire-private" });
  assert.deepEqual(missingPrivateR2Vars(), ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]);
  assert.throws(() => assertPrivateR2Configured(), (error: unknown) => {
    const message = (error as Error).message;
    for (const name of ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) assert.equal(message.includes(name), true, name);
    // It says what to do, and discloses nothing.
    assert.equal(message.includes("R2_PRIVATE_BUCKET"), true);
    for (const secret of ["chefsire-private", "secret", "key", "cloudflarestorage"]) assert.equal(message.includes(secret), false, secret);
    return true;
  });
});

test("9 & 10. the private/public bucket collision check is unchanged, including case and whitespace", () => {
  assert.equal(privateBucketConflict("chefsire-media", "chefsire-media"), "same_as_public");
  assert.equal(privateBucketConflict("  ChefSire-Media  ", "chefsire-media"), "same_as_public");
  assert.equal(privateBucketConflict("CHEFSIRE-MEDIA", "chefsire-media"), "same_as_public");
  assert.equal(privateBucketConflict("chefsire-private", "chefsire-media"), null);
  // An absent bucket on either side is the local-fallback case, not a collision.
  assert.equal(privateBucketConflict(undefined, "chefsire-media"), null);
  assert.equal(privateBucketConflict("chefsire-private", undefined), null);
  assert.equal(privateBucketConflict("   ", "chefsire-media"), null);
});

test("there is ONE canonical rule, and every decision resolves through it", () => {
  // The three-state function is the only place the environment is interpreted; the boolean and the assertion both
  // defer to it, so startup and runtime cannot disagree.
  assert.equal((r2Source.match(/privateR2Configuration\(\)/g) ?? []).length >= 3, true);
  const isConfigured = r2Source.slice(r2Source.indexOf("export function isPrivateR2Configured"), r2Source.indexOf("\n}", r2Source.indexOf("export function isPrivateR2Configured")));
  assert.equal(isConfigured.includes("assertPrivateR2Configured();"), true, "the boolean must refuse a partial configuration");
  assert.equal(isConfigured.includes('privateR2Configuration() === "complete"'), true);
  // The required list is declared once and reused, so a new variable cannot be validated in one place only.
  assert.deepEqual([...PRIVATE_R2_REQUIRED_VARS], ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PRIVATE_BUCKET"]);
  assert.equal((r2Source.match(/PRIVATE_R2_REQUIRED_VARS/g) ?? []).length, 2);
});

test("validation runs at startup as well as at every chokepoint", () => {
  // Module initialization, so a bad deployment fails before it can accept an upload.
  assert.equal(storageSource.includes("assertPrivateR2Configured();\nassertPrivateR2Isolated();"), true);
  // And defensively where the bucket is resolved, so a helper reached directly still refuses.
  const bucket = r2Source.slice(r2Source.indexOf("function privateBucket()"), r2Source.indexOf("\n}", r2Source.indexOf("function privateBucket()")));
  assert.equal(bucket.includes("assertPrivateR2Configured();"), true);
  assert.equal(bucket.includes("assertPrivateR2Isolated();"), true);
});

test("the documented deployment rule states all three states plainly", () => {
  const note = r2Source.slice(r2Source.indexOf("DEPLOYMENT RULE"), r2Source.indexOf("export const PRIVATE_R2_REQUIRED_VARS"));
  assert.equal(note.includes("R2_PRIVATE_BUCKET absent"), true);
  assert.equal(note.includes("CONFIGURATION ERROR"), true);
  assert.equal(note.includes("It does not fall back."), true);
  // The old wording implied any incomplete configuration simply used local storage.
  assert.equal(r2Source.includes("`isPrivateR2Configured()` is false and callers fall back to private local storage"), false);
});
