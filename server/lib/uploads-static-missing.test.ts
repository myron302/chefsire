/**
 * A missing `/uploads` object answers 404, not the single-page app.
 *
 * This is a regression test for something that was true in production: `express.static` calls `next()` on a
 * miss, the app's catch-all served index.html, and so a store photo whose file had been lost came back as 200
 * with 2,889 bytes of HTML -- byte-identical to the response for a filename invented on the spot. Nothing could
 * tell the two apart, which is how the loss went unnoticed.
 *
 * The real mount is exercised over a real socket, in the real order (static, then this), because the defect was
 * entirely in the ordering: each handler was correct on its own.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { AddressInfo } from "node:net";
import { uploadsNotFoundHandler, uploadsStaticHandler } from "./uploads-static";

const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "uploads-missing-"));
await fs.promises.writeFile(path.join(dir, "present.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01]));

const app = express();
app.use("/uploads", uploadsStaticHandler(dir));
app.use("/uploads", uploadsNotFoundHandler());
// The catch-all that used to swallow these, kept here so the test fails if the ordering regresses.
app.use((_req, res) => res.status(200).type("html").send("<!doctype html><html><body>app shell</body></html>"));

const server = app.listen(0);
const port = (server.address() as AddressInfo).port;
const get = async (urlPath: string) => {
  const response = await fetch(`http://127.0.0.1:${port}${urlPath}`);
  return { status: response.status, contentType: response.headers.get("content-type") ?? "", cacheControl: response.headers.get("cache-control") ?? "", body: await response.text() };
};

test.after(() => {
  server.close();
  return fs.promises.rm(dir, { recursive: true, force: true });
});

test("a stored object is still served", async () => {
  const response = await get("/uploads/present.jpg");
  assert.equal(response.status, 200);
  assert.match(response.contentType, /image\/jpeg/);
});

test("a missing object is 404 and never the app shell", async () => {
  const response = await get("/uploads/gone.jpg");
  assert.equal(response.status, 404);
  assert.doesNotMatch(response.contentType, /text\/html/, "HTML here means it fell through to the app");
  assert.ok(!response.body.includes("app shell"), "the app's catch-all must not answer for media");
  assert.ok(response.body.length < 200, "a short inert body, not a page");
});

test("a lost file and an invented name are no longer indistinguishable", async () => {
  // The exact shape of the production defect: both requests returned the same 200 HTML, so no caller, cache or
  // monitor could tell that one of these files had existed and been lost.
  const lost = await get("/uploads/32c41d3b-2240-4b7f-b5e5-26b6e6eab290.jpg");
  const invented = await get("/uploads/never-existed-at-all.jpg");
  assert.equal(lost.status, 404);
  assert.equal(invented.status, 404);
  assert.doesNotMatch(lost.contentType, /text\/html/);
});

test("an absence is not cached, so a file that reappears is not masked by it", async () => {
  const response = await get("/uploads/gone.jpg");
  assert.match(response.cacheControl, /no-store/);
});

test("a missing object under a subdirectory is 404 too, not the app shell", async () => {
  const response = await get("/uploads/posts/gone.webp");
  assert.equal(response.status, 404);
  assert.ok(!response.body.includes("app shell"));
});

test("the dotfile denial still refuses the promote directory rather than falling through", async () => {
  // `.promote` holds a validated file for the instant between copied and published. Denying dotfiles must not
  // become "hand it to the app", which would make a half-copied file addressable as a page.
  const response = await get("/uploads/.promote/pending.jpg");
  assert.equal(response.status, 404);
  assert.ok(!response.body.includes("app shell"));
});
