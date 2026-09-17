/**
 * The upload routes themselves, over real HTTP, through the real `requireAuth` middleware, against a real
 * uploads directory.
 *
 * This file exists because the defect it covers was never in a helper. Each route parsed the request itself,
 * decided from `file.mimetype` whether to accept it, and named the stored object with
 * `path.extname(file.originalname)`. A unit test of a validator would have passed while
 * `POST /api/upload` still wrote `<uuid>.html` into the directory `express.static` serves at `/uploads`, so
 * everything here goes in through the route and, where it matters, comes back out through the static mount.
 *
 * The recorded pre-repair behaviour, reproduced on caafde3 before any change, is stated at each case: the
 * uploads below were accepted with HTTP 200 and served back from ChefSire's own origin as `text/html` and
 * `image/svg+xml`.
 */
process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import sharp from "sharp";

/** Every module below reads UPLOADS_DIR at import time, so the test's own directory has to exist first. */
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "chefsire-upload-route-test-"));
process.env.UPLOADS_DIR = uploadsDir;
for (const name of ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"]) delete process.env[name];

const express = (await import("express")).default;
const { signAuthToken } = await import("../lib/jwt-config");
const uploadRouter = (await import("./upload")).default;
const { uploadsStaticHandler } = await import("../lib/uploads-static");
const r2 = await import("../lib/r2");

const TOKEN = signAuthToken({ id: "11111111-1111-4111-8111-111111111111" });

/* ------------------------------------------------------------------ harness */

let server: http.Server;
let origin: string;

before(async () => {
  // The real router and the real `/uploads` handler, mounted exactly as `server/app.ts` mounts them. The rest of
  // the API is deliberately left out: it reaches for a database this test has no business needing, and the two
  // things under test here are the upload routes and what the static mount answers with.
  const app = express();
  app.use("/api/upload", uploadRouter);
  app.use("/uploads", uploadsStaticHandler(uploadsDir));
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(uploadsDir, { recursive: true, force: true });
});

type Part = { field: string; filename: string; contentType: string; body: Buffer };

function multipart(parts: Part[]): { body: Buffer; contentType: string } {
  const boundary = "----chefsireUploadTestBoundary";
  const chunks: Buffer[] = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${part.field}"; filename="${part.filename}"\r\nContent-Type: ${part.contentType}\r\n\r\n`, "utf8"));
    chunks.push(part.body, Buffer.from("\r\n", "utf8"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function upload(route: string, parts: Part[], options: { authenticated?: boolean } = {}) {
  const form = multipart(parts);
  const headers: Record<string, string> = { "content-type": form.contentType };
  if (options.authenticated !== false) headers.authorization = `Bearer ${TOKEN}`;
  const response = await fetch(`${origin}${route}`, { method: "POST", headers, body: form.body });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { status: response.status, payload };
}

const storedFiles = () => {
  const walk = (directory: string, prefix = ""): string[] => fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]);
  return walk(uploadsDir);
};

/* ------------------------------------------------------------------ fixtures */

const image = (format: "jpeg" | "png" | "webp" | "gif") =>
  (sharp({ create: { width: 24, height: 18, channels: 3, background: { r: 10, g: 120, b: 200 } } }) as never as Record<string, () => sharp.Sharp>)[format]().toBuffer();

/**
 * A structurally valid ISO-BMFF `ftyp` box: size, "ftyp", major brand, minor version, then compatible brands.
 *
 * The earlier version of this helper declared a size of 24 and then appended 64 zero bytes, so its "compatible
 * brands" were NUL padding. Nothing noticed while detection only read bytes 8..12; once the box is actually
 * parsed, that is not an `ftyp` at all. The fixture was wrong, so the fixture is what changed.
 */
const isoBmff = (major: string, compatible: string[] = [major]) => {
  const header = Buffer.alloc(16);
  header.writeUInt32BE(16 + compatible.length * 4, 0);
  header.write("ftyp", 4, "latin1");
  header.write(major, 8, "latin1");
  header.writeUInt32BE(0x200, 12);
  const moov = Buffer.alloc(16);
  moov.writeUInt32BE(16, 0);
  moov.write("moov", 4, "latin1");
  return Buffer.concat([header, ...compatible.map((brand) => Buffer.from(brand, "latin1")), moov]);
};
const mp4 = () => isoBmff("isom");
const mov = () => isoBmff("qt  ");
const webm = () => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from([0x01, 0x00, 0x00, 0x00]), Buffer.from("Bwebm", "latin1"), Buffer.alloc(64, 0)]);
const avi = () => Buffer.concat([Buffer.from("RIFF", "latin1"), Buffer.from([0, 0, 1, 0]), Buffer.from("AVI ", "latin1"), Buffer.alloc(64, 0)]);
const pdf = () => Buffer.from("%PDF-1.7\n1 0 obj\n<< >>\nendobj\nstartxref\n0\n%%EOF\n", "latin1");

const html = Buffer.from("<!doctype html><html><body><script>alert(document.domain)</script></body></html>");
const svg = Buffer.from(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`);
const javascript = Buffer.from("fetch('/api/me').then(r => r.json());\n");
const xml = Buffer.from(`<?xml version="1.0"?><root><item>value</item></root>`);
const randomBytes = Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 37 + 11) % 251));

/* ------------------------------------------------------------------ authentication */

test("both upload routes require authentication before anything is parsed", async () => {
  for (const route of ["/api/upload", "/api/upload/image"]) {
    const result = await upload(route, [{ field: "file", filename: "photo.jpg", contentType: "image/jpeg", body: await image("jpeg") }], { authenticated: false });
    assert.equal(result.status, 401, route);
  }
  assert.deepEqual(storedFiles(), [], "an unauthenticated request stores nothing");
});

/* ------------------------------------------------------------------ the forged-MIME attack */

test("HTML bytes declared image/jpeg and named attack.html are refused and stored nowhere", async () => {
  // PRE-REPAIR: HTTP 200, `/uploads/<uuid>.html`, served back as `text/html; charset=UTF-8`.
  const before = storedFiles().length;
  const result = await upload("/api/upload", [{ field: "file", filename: "attack.html", contentType: "image/jpeg", body: html }]);
  assert.equal(result.status, 415);
  assert.equal(result.payload.ok, false);
  assert.equal(typeof result.payload.url, "undefined", "a rejected upload never answers with a URL");
  assert.equal(storedFiles().length, before, "and never reaches the served directory");
});

test("the same attack through the image route is refused", async () => {
  // PRE-REPAIR: HTTP 200, `/uploads/<uuid>.gif` holding the HTML verbatim.
  const before = storedFiles().length;
  const result = await upload("/api/upload/image", [{ field: "file", filename: "a.html", contentType: "image/gif", body: html }]);
  assert.equal(result.status, 415);
  assert.equal(storedFiles().length, before);
});

test("SVG is refused on both routes, declared as anything", async () => {
  // PRE-REPAIR: HTTP 200, `/uploads/<uuid>.svg`, served back as `image/svg+xml` on ChefSire's origin.
  const before = storedFiles().length;
  for (const route of ["/api/upload", "/api/upload/image"]) {
    for (const declared of ["image/png", "image/jpeg", "image/webp"]) {
      const result = await upload(route, [{ field: "file", filename: "logo.svg", contentType: declared, body: svg }]);
      assert.equal(result.status, 415, `${route} ${declared}`);
    }
  }
  assert.equal(storedFiles().length, before);
});

test("script, XML and random bytes declared as media are refused", async () => {
  const before = storedFiles().length;
  for (const [label, body] of [["javascript", javascript], ["xml", xml], ["random", randomBytes]] as const) {
    const result = await upload("/api/upload", [{ field: "file", filename: `payload.${label}`, contentType: "image/png", body }]);
    assert.equal(result.status, 415, label);
  }
  assert.equal(storedFiles().length, before);
});

test("an empty file is refused with the reason it actually failed for", async () => {
  const result = await upload("/api/upload", [{ field: "file", filename: "empty.html", contentType: "image/png", body: Buffer.alloc(0) }]);
  assert.equal(result.status, 400);
  assert.match(String(result.payload.error), /empty/i);
});

test("a truncated image is refused", async () => {
  const truncated = (await image("png")).subarray(0, 40);
  const result = await upload("/api/upload/image", [{ field: "file", filename: "half.png", contentType: "image/png", body: truncated }]);
  assert.equal(result.status, 415);
});

/* ------------------------------------------------------------------ the stored name */

test("a real JPEG named .html is stored under a generated name with a safe image extension", async () => {
  const result = await upload("/api/upload", [{ field: "file", filename: "photo.html", contentType: "image/jpeg", body: await image("jpeg") }]);
  assert.equal(result.status, 200);
  const url = String(result.payload.url);
  assert.match(url, /^\/uploads\/[0-9a-f-]{36}\.jpg$/, "the extension comes from the bytes, not the name");
  assert.equal(result.payload.mimetype, "image/jpeg", "and so does the type reported back");
});

test("a traversal filename cannot escape the uploads directory or name the object", async () => {
  const result = await upload("/api/upload", [{ field: "file", filename: "../../../../etc/cron.d/pwn.png", contentType: "image/png", body: await image("png") }]);
  assert.equal(result.status, 200);
  assert.match(String(result.payload.url), /^\/uploads\/[0-9a-f-]{36}\.png$/);
  // Nothing landed outside the directory, and nothing nested inside it either.
  for (const stored of storedFiles()) assert.equal(stored.includes(".."), false, stored);
  assert.equal(fs.existsSync("/etc/cron.d/pwn.png"), false);
});

test("uppercase and double extensions cannot steer the stored name", async () => {
  const result = await upload("/api/upload", [{ field: "file", filename: "PHOTO.JPG.HTML", contentType: "image/jpeg", body: await image("jpeg") }]);
  assert.equal(result.status, 200);
  assert.match(String(result.payload.url), /^\/uploads\/[0-9a-f-]{36}\.jpg$/);
});

test("a declared MIME cannot control the stored type", async () => {
  // Real PNG bytes, every declaration the pre-filter lets through -- the answer is the same every time.
  for (const declared of ["image/jpeg", "image/webp", "image/gif"]) {
    const result = await upload("/api/upload", [{ field: "file", filename: `x.${declared.split("/")[1]}`, contentType: declared, body: await image("png") }]);
    assert.equal(result.status, 200, declared);
    assert.match(String(result.payload.url), /\.png$/, declared);
    assert.equal(result.payload.mimetype, "image/png", declared);
  }
});

/* ------------------------------------------------------------------ legitimate media */

test("legitimate images are accepted by the image route and answer in the shape clients already read", async () => {
  for (const format of ["jpeg", "png", "webp", "gif"] as const) {
    const result = await upload("/api/upload/image", [{ field: "file", filename: `photo.${format}`, contentType: `image/${format}`, body: await image(format) }]);
    assert.equal(result.status, 200, format);
    assert.equal(result.payload.ok, true, format);
    assert.equal(typeof result.payload.url, "string", format);
    assert.equal(typeof result.payload.thumbUrl, "string", format);
    // GIF keeps its format so animation survives; everything else is re-encoded to WebP, as before this repair.
    assert.match(String(result.payload.url), format === "gif" ? /\.gif$/ : /\.webp$/, format);
  }
});

test("legitimate videos and documents are accepted by the general route", async () => {
  for (const [label, body, declared, extension] of [
    ["mp4", mp4(), "video/mp4", "mp4"],
    ["mov", mov(), "video/quicktime", "mov"],
    ["webm", webm(), "video/webm", "webm"],
    ["avi", avi(), "video/x-msvideo", "avi"],
    ["pdf", pdf(), "application/pdf", "pdf"],
  ] as const) {
    const result = await upload("/api/upload", [{ field: "file", filename: `media.${label}`, contentType: declared, body }]);
    assert.equal(result.status, 200, label);
    assert.equal(result.payload.ok, true, label);
    assert.match(String(result.payload.url), new RegExp(`^/uploads/[0-9a-f-]{36}\\.${extension}$`), label);
    assert.equal(typeof result.payload.filename, "string", label);
    assert.equal(typeof result.payload.size, "number", label);
  }
});

/* ------------------------------------------------------------------ parser bounds */

test("the general route accepts one file per request and refuses a second", async () => {
  const jpeg = await image("jpeg");
  const result = await upload("/api/upload", [
    { field: "file", filename: "a.jpg", contentType: "image/jpeg", body: jpeg },
    { field: "file", filename: "b.jpg", contentType: "image/jpeg", body: jpeg },
  ]);
  assert.equal(result.status, 400);
  assert.equal(result.payload.ok, false);
});

test("the size limit is enforced by the parser, before anything is classified", async () => {
  // 100MB is the general limit; this is a cheap proof the parser refuses rather than spooling.
  const oversize = Buffer.concat([await image("jpeg"), Buffer.alloc(101 * 1024 * 1024, 0)]);
  const result = await upload("/api/upload", [{ field: "file", filename: "huge.jpg", contentType: "image/jpeg", body: oversize }]);
  assert.equal(result.status, 400);
  assert.match(String(result.payload.error), /too large/i);
});

/* ------------------------------------------------------------------ serving */

test("stored media is served with the canonical type, nosniff, and no inline disposition", async () => {
  const result = await upload("/api/upload/image", [{ field: "file", filename: "photo.jpg", contentType: "image/jpeg", body: await image("jpeg") }]);
  const response = await fetch(`${origin}${result.payload.url}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-disposition"), null, "images the app renders inline stay inline");
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; sandbox");
});

test("a document is served as an attachment, so it is never a document on ChefSire's origin", async () => {
  const result = await upload("/api/upload", [{ field: "file", filename: "menu.pdf", contentType: "application/pdf", body: pdf() }]);
  const response = await fetch(`${origin}${result.payload.url}`);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("content-disposition"), "attachment");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("an object left by an older build is served inert, not as a same-origin document", async () => {
  // No route can write these any more. They are already on disk in real deployments, which is the whole point.
  fs.writeFileSync(path.join(uploadsDir, "legacy-attack.html"), html);
  fs.writeFileSync(path.join(uploadsDir, "legacy-attack.svg"), svg);
  for (const legacy of ["legacy-attack.html", "legacy-attack.svg"]) {
    const response = await fetch(`${origin}/uploads/${legacy}`);
    assert.equal(response.status, 200, legacy);
    assert.equal(response.headers.get("content-type"), "application/octet-stream", legacy);
    assert.equal(response.headers.get("content-disposition"), "attachment", legacy);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff", legacy);
  }
});

test("the promotion directory is not reachable over HTTP, even by exact URL", async () => {
  // `<UPLOADS_DIR>/.promote` holds a validated file for the instant between "copied" and "published" on a
  // cross-filesystem promotion. It has to live on the uploads filesystem for the publishing rename to be atomic,
  // so the mount denies dotfiles rather than relying on the name being unguessable.
  fs.mkdirSync(path.join(uploadsDir, ".promote"), { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, ".promote", "in-flight.part"), await image("jpeg"));
  for (const url of ["/uploads/.promote/in-flight.part", "/uploads/.promote/"]) {
    const response = await fetch(`${origin}${url}`);
    assert.equal(response.status === 403 || response.status === 404, true, `${url} answered ${response.status}`);
  }
});

/* ------------------------------------------------------------------ R2 */

test("R2 receives the verified content type and a generated key, and never receives a rejected file", async () => {
  const puts: { Key: string; ContentType: string }[] = [];
  const realSend = r2.r2Client.send;
  Object.assign(process.env, {
    R2_ENDPOINT: "https://example.invalid",
    R2_ACCESS_KEY_ID: "test-key",
    R2_SECRET_ACCESS_KEY: "test-secret",
    R2_BUCKET: "chefsire-test-public",
    R2_PUBLIC_BASE_URL: "https://media.example.invalid",
  });
  (r2.r2Client as { send: unknown }).send = async (command: { constructor: { name: string }; input: Record<string, string> }) => {
    if (command.constructor.name === "PutObjectCommand") puts.push({ Key: command.input.Key, ContentType: command.input.ContentType });
    return { ETag: '"chefsire-test"', $metadata: {} };
  };
  try {
    // Rejected first: nothing may be sent for it.
    const rejected = await upload("/api/upload/image", [{ field: "file", filename: "attack.html", contentType: "image/jpeg", body: html }]);
    assert.equal(rejected.status, 415);
    assert.equal(puts.length, 0, "a rejected upload is never sent to R2");

    const accepted = await upload("/api/upload/image", [{ field: "file", filename: "photo.html", contentType: "image/jpeg", body: await image("jpeg") }]);
    assert.equal(accepted.status, 200);
    assert.equal(String(accepted.payload.url).startsWith("https://media.example.invalid/posts/"), true);
    assert.equal(puts.length > 0, true);
    for (const put of puts) {
      assert.match(put.Key, /^posts\/[0-9a-f-]{36}(_thumb)?\.webp$/, put.Key);
      assert.equal(put.ContentType, "image/webp", put.Key);
    }
  } finally {
    (r2.r2Client as { send: unknown }).send = realSend;
    for (const name of ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"]) delete process.env[name];
  }
});

/* ------------------------------------------------------------------ the router in isolation */

test("the router mounts the two routes the clients call, and nothing else", () => {
  const routes = (uploadRouter as unknown as { stack: { route?: { path: string; methods: Record<string, boolean> } }[] }).stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route!.methods).join(",").toUpperCase()} ${layer.route!.path}`);
  assert.deepEqual(routes, ["POST /", "POST /image"]);
});
