import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertPrivateRootIsolatedFrom, firstPrivateRootConflict, privateRootConflict, type PublicStaticRoot } from "./private-storage-path";
import { CLIENT_STATIC_DIR_CANDIDATES, resolveClientStaticDir } from "./public-static-dirs";

/**
 * Private storage must be isolated from EVERY unauthenticated static root, not just the uploads tree.
 *
 * `server/app.ts` mounts two `express.static` roots: UPLOADS_DIR at `/uploads`, and the built client bundle at `/`.
 * Validating only the first left `PRIVATE_STORAGE_DIR=dist/public` passing every check while every booking document
 * written under it was served to anyone who could guess its name. The client directory is resolved dynamically from
 * the working directory, so the check cannot hardcode `dist/public` either -- it has to read the same list the app
 * serves from, which is why that list now lives in one module both of them import.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(here, "..", "app.ts"), "utf8");
const storageSource = fs.readFileSync(path.join(here, "private-storage.ts"), "utf8");

const UPLOADS = path.resolve("/srv/chefsire/uploads");
const CLIENT = path.resolve("/srv/chefsire/dist/public");
const ROOTS: PublicStaticRoot[] = [
  { label: "public uploads directory served at /uploads", path: UPLOADS },
  { label: "built client directory served at /", path: CLIENT },
];

test("the app really does serve the client build statically, which is why this suite exists", () => {
  // Both mounts are unauthenticated: neither carries a guard, a session check or a middleware between it and the
  // static handler. A file under either is public.
  assert.equal(appSource.includes("express.static(UPLOADS_DIR"), true);
  assert.equal(appSource.includes("express.static(clientDir"), true);
  // And there is no third static mount that this suite would be unaware of.
  assert.equal((appSource.match(/express\.static\(/g) ?? []).length, 2);
});

test("a private root inside the built client tree is rejected exactly as one inside uploads is", () => {
  // The reported regression, verbatim: a directory under the client build passes an uploads-only check.
  assert.equal(privateRootConflict(path.join(CLIENT, "private-storage"), UPLOADS), null, "uploads alone cannot see it");
  const found = firstPrivateRootConflict(path.join(CLIENT, "private-storage"), ROOTS);
  assert.equal(found?.conflict, "inside_public");
  assert.equal(found?.root.path, CLIENT);
  // The client directory itself, and anything deeper, are refused too.
  assert.equal(firstPrivateRootConflict(CLIENT, ROOTS)?.conflict, "same");
  assert.equal(firstPrivateRootConflict(path.join(CLIENT, "a", "b", "c"), ROOTS)?.conflict, "inside_public");
});

test("every static root is checked, and a conflict with any one of them is enough", () => {
  // Isolated from the client tree but inside uploads: still refused, and the uploads root is what is named.
  assert.equal(firstPrivateRootConflict(path.join(UPLOADS, "private"), ROOTS)?.root.path, UPLOADS);
  // A private root that CONTAINS the client tree is refused for the same overlap reason as one that contains uploads.
  assert.equal(firstPrivateRootConflict("/srv/chefsire/dist", ROOTS)?.conflict, "contains_public");
  // A sibling that merely shares a name prefix is not a descendant and stays acceptable.
  assert.equal(firstPrivateRootConflict("/srv/chefsire/dist/public-private", ROOTS), null);
  assert.equal(firstPrivateRootConflict("/var/lib/chefsire-private", ROOTS), null);
});

test("the client static list is not hardcoded here: it is the same list app.ts serves from", () => {
  // The decisive anti-drift property. app.ts no longer resolves its own candidates, and the storage validator does
  // not restate them -- both read `public-static-dirs`, so a change to the real static configuration changes the
  // security check with it.
  assert.equal(appSource.includes('from "./lib/public-static-dirs"'), true);
  assert.equal(appSource.includes("resolveClientStaticDir()"), true);
  assert.equal(appSource.includes("possibleClientDirs"), false, "app.ts must not keep a private copy of the candidates");
  assert.equal(storageSource.includes("CLIENT_STATIC_DIR_CANDIDATES"), true);
  assert.equal(/"dist\/public"|'dist\/public'/.test(storageSource), false, "the validator must not hardcode the client path");
  // Every candidate is an absolute, already-resolved path, and the one being served is one of them.
  for (const dir of CLIENT_STATIC_DIR_CANDIDATES) assert.equal(path.isAbsolute(dir), true, dir);
  const served = resolveClientStaticDir();
  if (served !== null) assert.equal(CLIENT_STATIC_DIR_CANDIDATES.includes(served), true);
});

test("all candidate client directories are validated, not only the one that exists right now", () => {
  // Which candidate wins depends on the process working directory, which is not part of the storage configuration.
  // A private root that is safe only because a candidate has not been built yet is not safe.
  const roots = storageSource.slice(storageSource.indexOf("function publicStaticRoots"), storageSource.indexOf("function resolvePrivateRoot"));
  assert.equal(roots.includes("CLIENT_STATIC_DIR_CANDIDATES.map"), true, "every candidate must be checked");
  assert.equal(roots.includes("resolveClientStaticDir"), false, "checking only the resolved directory would leave the others unchecked");
  assert.equal(roots.includes("UPLOADS_DIR"), true);
  // And the check itself runs on the whole set rather than on uploads alone.
  assert.equal(storageSource.includes("assertPrivateRootIsolatedFrom(root, publicStaticRoots())"), true);
});

test("an unsafe client-tree configuration fails fast at startup and never falls back to a public location", () => {
  // The validation happens while resolving the root, so it throws at module initialization -- before any request,
  // and before a single document can be written.
  const resolve = storageSource.slice(storageSource.indexOf("function resolvePrivateRoot"), storageSource.indexOf("export const PRIVATE_STORAGE_ROOT"));
  assert.equal(resolve.includes("assertPrivateRootIsolatedFrom"), true);
  assert.equal(storageSource.includes("export const PRIVATE_STORAGE_ROOT: string = resolvePrivateRoot();"), true);
  // No rescue path: nothing catches the failure, and no alternative root is substituted.
  assert.equal(resolve.includes("catch"), false, "an unsafe configuration must not be recovered from");
  assert.throws(() => assertPrivateRootIsolatedFrom(path.join(CLIENT, "private"), ROOTS));
});

test("the startup failure names the offending mount and both resolved paths without guessing a replacement", () => {
  assert.throws(() => assertPrivateRootIsolatedFrom(path.join(CLIENT, "private"), ROOTS), (error: unknown) => {
    const message = (error as Error).message;
    assert.equal(message.includes("built client directory served at /"), true);
    assert.equal(message.includes(path.join(CLIENT, "private")), true);
    assert.equal(message.includes(CLIENT), true);
    assert.equal(message.includes("PRIVATE_STORAGE_DIR"), true);
    // It reports the uploads tree only when the uploads tree is the conflict -- the operator is told which one.
    assert.equal(message.includes(UPLOADS), false);
    return true;
  });
});

test("a symlink into a static tree is judged by where it points, not by how it is spelled", () => {
  const base = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "catering-client-tree-"));
  const client = path.join(base, "dist", "public");
  fs.mkdirSync(client, { recursive: true });
  const roots: PublicStaticRoot[] = [{ label: "built client directory served at /", path: client }];
  const alias = path.join(base, "looks-private");
  try {
    fs.symlinkSync(client, alias, "dir");
  } catch {
    fs.rmSync(base, { recursive: true, force: true });
    return; // symlinks unavailable on this platform
  }
  try {
    // Lexically `looks-private` is nowhere near the client tree; physically it IS the client tree.
    assert.equal(path.relative(client, alias).startsWith(".."), true);
    assert.equal(firstPrivateRootConflict(alias, roots)?.conflict, "same");
    // A not-yet-created directory beneath the alias is rejected before it is ever made.
    assert.equal(firstPrivateRootConflict(path.join(alias, "catering", "private"), roots)?.conflict, "inside_public");
    // A genuinely separate directory beside it stays acceptable.
    assert.equal(firstPrivateRootConflict(path.join(base, "private-storage"), roots), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("no filesystem path is disclosed to a client: the refusal is a startup error, not a response", () => {
  // The message is written for an operator reading server logs. Nothing in the request path re-throws it to a
  // caller: the storage module throws during initialization, so there is no handler that could serialize it.
  assert.equal(storageSource.includes("res."), false);
  assert.equal(storageSource.includes("json("), false);
  // And the R2 branch is untouched by any of this -- its isolation is a bucket comparison, not a path one.
  assert.equal(storageSource.includes("assertPrivateR2Isolated();"), true);
  assert.equal(storageSource.slice(storageSource.indexOf("export async function writePrivateObject")).includes('if (provider === "r2") return putPrivateObject(storageKey, body, contentType);'), true);
});
