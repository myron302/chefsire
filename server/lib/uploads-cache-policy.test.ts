/**
 * The `/uploads` cache policy, split between canonical and legacy objects.
 *
 * THE FINDING, AND THE HISTORY THAT MAKES IT REAL. `maxAge: "365d", immutable: true` is on `main` at caafde3 --
 * this PR did not introduce it. Reproduced against main's handler verbatim, a legacy object was served as:
 *
 *   GET /uploads/legacy-attack.html
 *     Content-Type : text/html; charset=UTF-8
 *     Cache-Control: public, max-age=31536000, immutable
 *
 * So every legacy `.html` and `.svg` went out under a stable URL with a one-year immutable lease. A client
 * holding one will not revalidate, and no header this server sends later can reach back and cancel it. What the
 * split below fixes is the forward half: legacy objects stop being handed new leases, so every request reaches
 * the repaired handler. The residual exposure is stated in the pull request, not assumed away.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";

const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "chefsire-cache-policy-"));
process.env.UPLOADS_DIR = uploadsDir;

const {
  IMMUTABLE_CACHE_CONTROL,
  LEGACY_CACHE_CONTROL,
  isCanonicalUploadName,
  uploadResponseHeaders,
  uploadsStaticHandler,
} = await import("./uploads-static");

const UUID = "11111111-1111-4111-8111-111111111111";
const files: Record<string, string> = {
  // Names this repair's generators produce.
  [`${UUID}.jpg`]: "jpeg-bytes",
  [`${UUID}.webp`]: "webp-bytes",
  [`${UUID}_thumb.webp`]: "thumb-bytes",
  [`${UUID}.mp4`]: "video-bytes",
  [`avatar-${UUID}.png`]: "avatar-bytes",
  [`review-${UUID}.jpg`]: "review-bytes",
  // Names only the vulnerable paths could have written.
  [`${UUID}.html`]: "<script>alert(1)</script>",
  [`${UUID}.svg`]: "<svg><script>alert(1)</script></svg>",
  "legacy-attack.html": "<script>alert(1)</script>",
  "review-1699999999999-123456789.jpg": "old-review-bytes",
  [`${UUID}.jfif`]: "unusual-but-harmless",
};

let server: http.Server;
let origin: string;

before(async () => {
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(uploadsDir, name), body);
  const app = express();
  app.use("/uploads", uploadsStaticHandler(uploadsDir));
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(uploadsDir, { recursive: true, force: true });
});

const fetchUpload = (name: string) => fetch(`${origin}/uploads/${name}`);

/* ------------------------------------------------------------------ canonical objects keep long caching */

test("a canonical image keeps the immutable one-year policy", async () => {
  for (const name of [`${UUID}.jpg`, `${UUID}.webp`, `${UUID}_thumb.webp`, `avatar-${UUID}.png`, `review-${UUID}.jpg`]) {
    const response = await fetchUpload(name);
    assert.equal(response.status, 200, name);
    assert.equal(response.headers.get("cache-control"), IMMUTABLE_CACHE_CONTROL, name);
    assert.equal(response.headers.get("content-disposition"), null, `${name} still renders inline`);
  }
});

test("a canonical video keeps the immutable one-year policy", async () => {
  const response = await fetchUpload(`${UUID}.mp4`);
  assert.equal(response.headers.get("cache-control"), IMMUTABLE_CACHE_CONTROL);
  assert.equal(response.headers.get("content-type"), "video/mp4");
  assert.equal(response.headers.get("content-disposition"), null);
});

/* ------------------------------------------------------------------ legacy objects do not */

test("a legacy .html object is inert AND is never given a new immutable lease", async () => {
  for (const name of [`${UUID}.html`, "legacy-attack.html"]) {
    const response = await fetchUpload(name);
    assert.equal(response.status, 200, name);
    assert.equal(response.headers.get("content-type"), "application/octet-stream", name);
    assert.equal(response.headers.get("content-disposition"), "attachment", name);
    assert.equal(response.headers.get("cache-control"), LEGACY_CACHE_CONTROL, name);
    assert.equal(response.headers.get("cache-control")!.includes("immutable"), false, name);
  }
});

test("a legacy .svg object is inert AND is never given a new immutable lease", async () => {
  const response = await fetchUpload(`${UUID}.svg`);
  assert.equal(response.headers.get("content-type"), "application/octet-stream");
  assert.equal(response.headers.get("content-disposition"), "attachment");
  assert.equal(response.headers.get("cache-control"), LEGACY_CACHE_CONTROL);
});

test("an unknown legacy extension is inert and short-lived, never executable", async () => {
  const response = await fetchUpload(`${UUID}.jfif`);
  assert.equal(response.headers.get("content-type"), "application/octet-stream", "not guessed at");
  assert.equal(response.headers.get("content-disposition"), "attachment");
  assert.equal(response.headers.get("cache-control"), LEGACY_CACHE_CONTROL);
});

test("a legacy name carrying a canonical extension still loses the immutable lease", async () => {
  // Its bytes were never validated and the old review naming is not something this repair produces, so the
  // promise "this will never change" is not one we can make about it.
  const response = await fetchUpload("review-1699999999999-123456789.jpg");
  assert.equal(response.headers.get("content-type"), "image/jpeg", "it still serves as the image it claims");
  assert.equal(response.headers.get("cache-control"), LEGACY_CACHE_CONTROL);
});

/* ------------------------------------------------------------------ the other guarantees are untouched */

test("nosniff, the sandbox CSP and canonical types survive the cache split", async () => {
  for (const name of Object.keys(files)) {
    const response = await fetchUpload(name);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff", name);
    assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; sandbox", name);
    assert.equal(response.headers.get("content-type")!.startsWith("text/html"), false, name);
    assert.equal(response.headers.get("content-type")!.startsWith("image/svg"), false, name);
  }
});

/* ------------------------------------------------------------------ the name rule itself */

test("only names this repair's generators produce are treated as canonical", () => {
  for (const name of [`${UUID}.jpg`, `${UUID}_thumb.webp`, `avatar-${UUID}.png`, `review-${UUID}.webp`, `${UUID}.mp4`]) {
    assert.equal(isCanonicalUploadName(name), true, name);
  }
  for (const name of [
    "legacy-attack.html", "review-1699999999999-123456789.jpg", `${UUID}`, `${UUID}.`,
    `photo-${UUID}.jpg`, `${UUID}.verylongext`, `${UUID}_thumbnail.webp`, `AVATAR-${UUID}.png`,
    // A real UUID's hex letters must be lower case; this one upper-cases to something the rule rejects.
    "ABCDEF01-1111-4111-8111-111111111111.jpg", `../${UUID}.jpg`,
  ]) {
    assert.equal(isCanonicalUploadName(name), false, name);
  }
  // An unusual extension on an otherwise canonical name is still not canonical, because nothing generates it.
  assert.equal(uploadResponseHeaders(`/x/${UUID}.jfif`)["Cache-Control"], LEGACY_CACHE_CONTROL);
});

test("the negative control: main's handler really did hand legacy objects an immutable year", async () => {
  // main at caafde3, verbatim. This is what a client may still be holding, and why the split above exists.
  const legacyApp = express();
  const mainContentTypes: Record<string, string> = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm" };
  legacyApp.use("/uploads", express.static(uploadsDir, {
    maxAge: "365d",
    immutable: true,
    setHeaders: (res, filePath) => {
      const contentType = mainContentTypes[path.extname(filePath).toLowerCase()];
      if (contentType) res.setHeader("Content-Type", contentType);
    },
  }));
  const legacyServer = http.createServer(legacyApp);
  await new Promise<void>((resolve) => legacyServer.listen(0, "127.0.0.1", resolve));
  const legacyOrigin = `http://127.0.0.1:${(legacyServer.address() as { port: number }).port}`;
  try {
    const before = await fetch(`${legacyOrigin}/uploads/legacy-attack.html`);
    assert.equal(before.headers.get("content-type"), "text/html; charset=UTF-8", "served as a document");
    assert.equal(before.headers.get("cache-control"), "public, max-age=31536000, immutable", "for a year, without revalidation");

    const after = await fetchUpload("legacy-attack.html");
    assert.equal(after.headers.get("content-type"), "application/octet-stream");
    assert.equal(after.headers.get("cache-control"), LEGACY_CACHE_CONTROL);
  } finally {
    await new Promise<void>((resolve) => legacyServer.close(() => resolve()));
  }
});
