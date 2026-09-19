/**
 * The `/uploads` cache policy.
 *
 * TWO FINDINGS, ONE FILE. The first was that `maxAge: "365d", immutable: true` -- which is on main at caafde3,
 * not introduced by this PR -- handed legacy `.html` and `.svg` objects a one-year lease under a stable URL. The
 * fix for that gated the lease on a filename shape.
 *
 * THAT FIX DID NOT WORK, and this file now tests why. The pre-repair writers produced the SAME name shapes the
 * new generators produce, so the shape proves nothing about provenance. Reproduced on head b558f5b: seven of the
 * eight historical name forms satisfied `isCanonicalUploadName` and were handed
 * `public, max-age=31536000, immutable` despite never having been byte-verified:
 *
 *   routes/upload.ts             `${randomUUID()}${path.extname(originalname)}`      MATCHED
 *   services/image-upload.ts     `${randomUUID()}.gif` / `${id}.webp` / `_thumb`     MATCHED
 *   routes/auth.ts               `avatar-${randomUUID()}${path.extname(...)}`        MATCHED
 *   lib/data-uri.ts              `${randomUUID()}.${ext}`                            MATCHED
 *   scripts/migrate-base64-images.ts  `${randomUUID()}.${ext}`                       MATCHED
 *   routes/reviews.ts            `review-${Date.now()}-${random}${ext}`              did not match
 *
 * So the filename is out of the decision entirely and nothing local is immutable any more. These tests exist to
 * keep it that way.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";

const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "chefsire-cache-policy-"));
process.env.UPLOADS_DIR = uploadsDir;

const {
  LEGACY_CACHE_CONTROL,
  LOCAL_MEDIA_CACHE_CONTROL,
  uploadResponseHeaders,
  uploadsStaticHandler,
} = await import("./uploads-static");

const UUID = "11111111-1111-4111-8111-111111111111";

/**
 * Every historical local name form, generated exactly the way the pre-repair code at caafde3 generated it. The
 * point of the list is that the NEW generators produce these same shapes -- there is nothing to tell apart.
 */
const historicalNames = {
  "upload.ts general upload": `${randomUUID()}.jpg`,
  "image-upload.ts gif branch": `${randomUUID()}.gif`,
  "image-upload.ts webp main": `${randomUUID()}.webp`,
  "image-upload.ts webp thumb": `${randomUUID()}_thumb.webp`,
  "auth.ts avatar": `avatar-${randomUUID()}.png`,
  "data-uri.ts persistDataUri": `${randomUUID()}.jpg`,
  "migrate-base64-images.ts": `${randomUUID()}.png`,
  "reviews.ts old naming": `review-${Date.now()}-123456789.jpg`,
};

const files: Record<string, string> = {
  ...Object.fromEntries(Object.values(historicalNames).map((name) => [name, "legacy-bytes"])),
  [`${UUID}.mp4`]: "video-bytes",
  [`${UUID}.html`]: "<script>alert(1)</script>",
  [`${UUID}.svg`]: "<svg><script>alert(1)</script></svg>",
  "legacy-attack.html": "<script>alert(1)</script>",
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

/* ------------------------------------------------------------------ no filename earns an immutable lease */

test("no historical name form receives an immutable lease, whatever it looks like", async () => {
  // OBSERVED ON b558f5b: all but the last of these were served `public, max-age=31536000, immutable`.
  for (const [writer, name] of Object.entries(historicalNames)) {
    const response = await fetchUpload(name);
    assert.equal(response.status, 200, writer);
    assert.equal(response.headers.get("cache-control"), LOCAL_MEDIA_CACHE_CONTROL, writer);
    assert.equal(response.headers.get("cache-control")!.includes("immutable"), false, writer);
  }
});

test("nothing served from local /uploads is immutable, for any name or extension at all", async () => {
  for (const name of Object.keys(files)) {
    const response = await fetchUpload(name);
    assert.equal(response.headers.get("cache-control")!.includes("immutable"), false, name);
    assert.equal(response.headers.get("cache-control")!.includes("31536000"), false, name);
  }
  // And directly, across a spread of shapes a future refactor might be tempted to special-case.
  for (const name of [
    `${UUID}.jpg`, `${UUID}_thumb.webp`, `avatar-${UUID}.png`, `review-${UUID}.jpg`, `${UUID}.mp4`,
    "anything.jpg", "deeply/nested/file.png", `${randomUUID()}.webp`,
  ]) {
    assert.equal(uploadResponseHeaders(`/u/${name}`)["Cache-Control"]!.includes("immutable"), false, name);
  }
});

test("the filename plays no part in the cache decision -- only the extension does", () => {
  // Two names of completely different shape, same extension, same policy.
  assert.equal(uploadResponseHeaders(`/u/${UUID}.jpg`)["Cache-Control"], uploadResponseHeaders("/u/utterly-arbitrary.jpg")["Cache-Control"]);
  // Same name shape, different extension, different policy.
  assert.equal(uploadResponseHeaders(`/u/${UUID}.jpg`)["Cache-Control"], LOCAL_MEDIA_CACHE_CONTROL);
  assert.equal(uploadResponseHeaders(`/u/${UUID}.html`)["Cache-Control"], LEGACY_CACHE_CONTROL);
});

/* ------------------------------------------------------------------ what each class does get */

test("canonical media is cacheable, but only for a short revalidated window", async () => {
  for (const name of [`${UUID}.mp4`, historicalNames["image-upload.ts webp main"], historicalNames["auth.ts avatar"]]) {
    const response = await fetchUpload(name);
    assert.equal(response.headers.get("cache-control"), LOCAL_MEDIA_CACHE_CONTROL, name);
    assert.equal(response.headers.get("content-disposition"), null, `${name} still renders inline`);
    assert.equal(response.headers.get("etag") !== null || response.headers.get("last-modified") !== null, true, `${name} can be revalidated cheaply`);
  }
});

test("an active or unknown extension is inert and is never stored by a cache", async () => {
  for (const name of [`${UUID}.html`, `${UUID}.svg`, "legacy-attack.html", `${UUID}.jfif`]) {
    const response = await fetchUpload(name);
    assert.equal(response.headers.get("content-type"), "application/octet-stream", name);
    assert.equal(response.headers.get("content-disposition"), "attachment", name);
    assert.equal(response.headers.get("cache-control"), LEGACY_CACHE_CONTROL, name);
  }
});

/* ------------------------------------------------------------------ the other guarantees are untouched */

test("nosniff, the sandbox CSP and canonical types survive the policy change", async () => {
  for (const name of Object.keys(files)) {
    const response = await fetchUpload(name);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff", name);
    assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; sandbox", name);
    assert.equal(response.headers.get("content-type")!.startsWith("text/html"), false, name);
    assert.equal(response.headers.get("content-type")!.startsWith("image/svg"), false, name);
  }
});

test("the promotion directory is still unreachable", async () => {
  fs.mkdirSync(path.join(uploadsDir, ".promote"), { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, ".promote", "in-flight.part"), "partial");
  const response = await fetchUpload(".promote/in-flight.part");
  assert.equal(response.status === 403 || response.status === 404, true, `answered ${response.status}`);
});

/* ------------------------------------------------------------------ negative control */

test("the negative control: main's handler handed every one of these an immutable year", async () => {
  // main at caafde3, verbatim. This is what a client may still be holding -- and, because the historical names
  // are the same shapes the new generators produce, it is also why a filename rule could never have fixed it.
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
    const attack = await fetch(`${legacyOrigin}/uploads/legacy-attack.html`);
    assert.equal(attack.headers.get("content-type"), "text/html; charset=UTF-8", "served as a document");
    assert.equal(attack.headers.get("cache-control"), "public, max-age=31536000, immutable", "for a year, without revalidation");

    for (const name of Object.values(historicalNames)) {
      const response = await fetch(`${legacyOrigin}/uploads/${name}`);
      assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable", name);
    }

    // And now, through the repaired handler, none of them is immutable and the attack is inert.
    const repaired = await fetchUpload("legacy-attack.html");
    assert.equal(repaired.headers.get("content-type"), "application/octet-stream");
    assert.equal(repaired.headers.get("cache-control"), LEGACY_CACHE_CONTROL);
  } finally {
    await new Promise<void>((resolve) => legacyServer.close(() => resolve()));
  }
});
