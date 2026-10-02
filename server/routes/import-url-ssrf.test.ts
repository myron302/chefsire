/** CS-CL-02: the import-url route stays authenticated and never echoes network internals. */
import "../test-support/accept-test-sessions";
import "../test-support/auth-test-env";
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { testAuthHeader } from "../test-support/auth-test-env";
import importRouter from "./import-paprika";

const app = express();
app.use(express.json());
app.use("/api/recipes", importRouter);
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as any).port}`;
test.after(() => server.close());

const post = (url: string, as?: string) =>
  fetch(`${base}/api/recipes/import-url`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(as ? testAuthHeader(as) : {}) },
    body: JSON.stringify({ url }),
  });

test("anonymous callers are rejected with 401", async () => {
  assert.equal((await post("https://example.com/")).status, 401);
});

test("authenticated callers get a generic failure for internal targets, without leaking details", async () => {
  for (const u of ["http://127.0.0.1/", "http://169.254.169.254/latest/meta-data/", "http://[::1]/", "http://localhost/", "file:///etc/passwd", "https://u:p@example.com/", "http://example.com:6379/"]) {
    const r = await post(u, "user-1");
    assert.equal(r.status, 400, u);
    const body = await r.json();
    assert.equal(body.ok, false);
    assert.doesNotMatch(JSON.stringify(body), /127\.0\.0\.1|169\.254|::1|ECONN|ENOTFOUND|stack/i, u);
  }
});

test("route source uses the safe fetcher and no raw fetch()/redirect:follow", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./import-paprika.ts", import.meta.url), "utf8");
  assert.match(src, /safeFetchPublicHtml/);
  assert.doesNotMatch(src, /\bfetch\(/);
  assert.doesNotMatch(src, /redirect:\s*"follow"/);
});
