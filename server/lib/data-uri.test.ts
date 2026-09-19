/**
 * `data:` URIs that arrive in a create-post or create-bite body.
 *
 * This is a second, quieter door into the same storage. `persistDataUri` used to map the URI's own declared media
 * type straight to a stored extension through a table containing `"image/svg+xml": "svg"`, and never looked at
 * the payload. Reproduced on caafde3 before this change:
 *
 *   persistDataUri("data:image/svg+xml;base64,<script-bearing SVG>")  ->  /uploads/<uuid>.svg
 *   persistDataUri("data:image/png;base64,<HTML bytes>")              ->  /uploads/<uuid>.png
 *
 * The first is a scriptable document on ChefSire's own origin. Both are now refused, and a payload that really is
 * an image is stored under a name this code generated.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import sharp from "sharp";

const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "chefsire-data-uri-test-"));
process.env.UPLOADS_DIR = uploadsDir;
for (const name of ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"]) delete process.env[name];

const { UnsupportedDataUriError, persistDataUri } = await import("./data-uri");

after(() => fs.rmSync(uploadsDir, { recursive: true, force: true }));

const dataUri = (mediaType: string, body: Buffer) => `data:${mediaType};base64,${body.toString("base64")}`;
const image = (format: "jpeg" | "png" | "webp" | "gif") =>
  (sharp({ create: { width: 24, height: 18, channels: 3, background: { r: 10, g: 120, b: 200 } } }) as never as Record<string, () => sharp.Sharp>)[format]().toBuffer();

const svg = Buffer.from(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.domain)</script></svg>`);
const html = Buffer.from("<!doctype html><script>alert(1)</script>");

test("a scriptable SVG data URI is refused instead of stored as a .svg", async () => {
  await assert.rejects(() => persistDataUri(dataUri("image/svg+xml", svg)), UnsupportedDataUriError);
  assert.deepEqual(fs.readdirSync(uploadsDir), [], "nothing reached the served directory");
});

test("HTML bytes wearing an image media type are refused", async () => {
  await assert.rejects(() => persistDataUri(dataUri("image/png", html)), UnsupportedDataUriError);
  await assert.rejects(() => persistDataUri(dataUri("image/jpeg", html)), UnsupportedDataUriError);
  assert.deepEqual(fs.readdirSync(uploadsDir), []);
});

test("a payload that decodes to nothing is refused, and one that is not a data URI at all is left alone", async () => {
  // Base64 padding that decodes to zero bytes reaches the validator and is refused as empty.
  await assert.rejects(() => persistDataUri("data:image/png;base64,===="), UnsupportedDataUriError);
  // A `data:` prefix with no payload does not match the URI grammar, so it is passed through untouched -- which
  // is the same outcome that matters here: nothing is written.
  const malformed = "data:image/png;base64,";
  assert.equal(await persistDataUri(malformed), malformed);
  assert.deepEqual(fs.readdirSync(uploadsDir), []);
});

test("a real image is stored under a generated name with the extension its bytes earned", async () => {
  // The declared media type is deliberately wrong; the stored name still follows the payload.
  const url = await persistDataUri(dataUri("image/svg+xml", await image("png")));
  assert.match(url, /^\/uploads\/[0-9a-f-]{36}\.png$/);
  assert.equal(fs.existsSync(path.join(uploadsDir, path.basename(url))), true);
});

test("a value that is not a data URI is returned untouched", async () => {
  for (const value of ["/uploads/existing.jpg", "https://media.example.com/x.png", "", "data:not-base64"]) {
    assert.equal(await persistDataUri(value), value);
  }
});
