import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import zlib from "node:zlib";
import { adoptLegacy, DEFAULT_ROOT, importBatch, loadRecords, recordDecision, sha256Hex, verify } from "../lib/core.mjs";
import { inspectPng } from "../lib/png.mjs";
import { makePng, makeRoot, makeTar, makeZip, tmpDir, writeInput } from "./helpers.mjs";

const NOW = new Date("2026-10-20T12:00:00Z");
const run = (root, input, extra = {}) => importBatch({ root, input, batchId: "test-batch-1", now: NOW, ...extra });
const reasons = (r) => r.rejected.map((x) => x.reason).join("\n");
const snapshot = (dir) => Object.fromEntries(fs.readdirSync(dir, { recursive: true }).filter((f) => fs.statSync(path.join(dir, f)).isFile()).sort().map((f) => [f, sha256Hex(fs.readFileSync(path.join(dir, f)))]));

test("single-file import preserves exact bytes and records hash, size and dimensions", () => {
  const root = makeRoot(); const png = makePng(30, 20, 1);
  const r = run(root, writeInput({ "drinks-hub-original.png": png }));
  assert.equal(r.imported.length, 1); assert.equal(r.rejected.length, 0);
  const dest = path.join(root, "batches/test-batch-1/masters/drinks-hub-original.png");
  assert.ok(fs.readFileSync(dest).equals(png), "master must be byte-identical");
  const [rec] = loadRecords(root);
  assert.equal(rec.sha256, sha256Hex(png)); assert.equal(rec.bytes, png.length);
  assert.deepEqual([rec.width, rec.height], [30, 20]);
  assert.equal(rec.route, "/drinks"); assert.equal(rec.generation.prompt, null, "missing metadata must stay null, not invented");
  assert.equal(verify(root).ok, true, verify(root).errors.join("\n"));
});

test("multi-file import from a directory, with metadata from batch.json", () => {
  const root = makeRoot();
  const r = run(root, writeInput({
    "drinks-hub-original.png": makePng(12, 8, 1), "gin-original.png": makePng(12, 8, 2),
    "batch.json": { defaults: { provider: "OpenAI image generation" }, files: { "gin-original.png": { generationId: "abc", prompt: "p" } } },
  }));
  assert.equal(r.imported.length, 2);
  const gin = loadRecords(root).find((x) => x.categoryId === "gin");
  assert.equal(gin.generation.provider, "OpenAI image generation"); assert.equal(gin.generation.generationId, "abc");
  assert.equal(verify(root).ok, true);
});

test("zip archive (deflate and stored) and tar.gz batches import in one go", () => {
  for (const [label, make] of [["zip", (e) => makeZip(e)], ["zip-stored", (e) => makeZip(e, { deflate: false })], ["tar.gz", (e) => zlib.gzipSync(makeTar(e))]]) {
    const root = makeRoot(); const dir = tmpDir();
    const a = makePng(12, 8, 3); const b = makePng(12, 8, 4);
    const ext = label.startsWith("zip") ? "zip" : "tar.gz";
    const file = path.join(dir, `batch.${ext}`);
    fs.writeFileSync(file, make({ "inbox/drinks-hub-original.png": a, "inbox/gin-original.png": b, "__MACOSX/._x": Buffer.from("x") }));
    const r = run(root, file);
    assert.equal(r.imported.length, 2, `${label}: ${reasons(r)}`);
    assert.ok(fs.readFileSync(path.join(root, "batches/test-batch-1/masters/gin-original.png")).equals(b), `${label}: bytes`);
  }
});

test("archive path traversal and duplicate names are rejected", () => {
  const root = makeRoot(); const dir = tmpDir(); const file = path.join(dir, "evil.zip");
  fs.writeFileSync(file, makeZip({ "../escape.png": makePng(), "a/gin-original.png": makePng(12, 8, 1), "b/gin-original.png": makePng(12, 8, 2) }));
  const r = run(root, file);
  assert.equal(r.imported.length, 0); assert.match(reasons(r), /path traversal/); assert.match(reasons(r), /duplicate file name/);
  assert.equal(fs.existsSync(path.join(dir, "escape.png")), false);
});

test("repeated import is idempotent and rewrites nothing", () => {
  const root = makeRoot(); const input = writeInput({ "gin-original.png": makePng(12, 8, 5) });
  run(root, input); const before = snapshot(root);
  const again = run(root, input);
  assert.equal(again.imported.length, 0); assert.equal(again.unchanged.length, 1); assert.equal(again.rejected.length, 0);
  assert.deepEqual(snapshot(root), before);
  assert.equal(run(root, input, {}).unchanged.length, 1);
});

test("a different image for an already-preserved category is a conflict and never overwrites", () => {
  const root = makeRoot(); const original = makePng(12, 8, 6);
  run(root, writeInput({ "gin-original.png": original })); const before = snapshot(root);
  const r = run(root, writeInput({ "gin-original.png": makePng(12, 8, 7) }));
  assert.equal(r.imported.length, 0); assert.match(reasons(r), /conflicting hash/);
  assert.deepEqual(snapshot(root), before);
});

test("duplicate content: same image for two categories, in one batch or across batches", () => {
  const root = makeRoot(); const same = makePng(12, 8, 8);
  const r1 = run(root, writeInput({ "gin-original.png": same, "drinks-hub-original.png": same }));
  assert.equal(r1.imported.length, 0); assert.match(reasons(r1), /multiple categories/);
  run(root, writeInput({ "gin-original.png": same }));
  const r2 = importBatch({ root, input: writeInput({ "drinks-hub-original.png": same }), batchId: "test-batch-2", now: NOW });
  assert.match(reasons(r2), /already preserved for category "gin"/);
});

test("invalid mappings are rejected: unknown name, wrong id, non-canonical name, non-PNG", () => {
  const root = makeRoot();
  const r = run(root, writeInput({
    "mystery.png": makePng(), "notes.jpg": Buffer.from("jpeg"), "gin-original.png": makePng(12, 8, 9),
    "batch.json": { files: { "gin-original.png": { categoryId: "vodka" }, "mystery.png": { categoryId: "drinks-hub" } } },
  }));
  assert.equal(r.imported.length, 0);
  assert.match(reasons(r), /unknown category id "vodka"/); assert.match(reasons(r), /canonical master filename/); assert.match(reasons(r), /not a PNG/);
  assert.equal(loadRecords(root).length, 0);
});

test("corrupted PNGs are rejected: truncated, bad CRC, damaged image data, trailing bytes, garbage", () => {
  const root = makeRoot(); const good = makePng(12, 8, 10);
  const badCrc = Buffer.from(good); badCrc[badCrc.length - 20] ^= 0xff;
  const badData = Buffer.from(good); const idat = badData.indexOf("IDAT"); badData[idat + 6] ^= 0xff;
  const r = run(root, writeInput({
    "gin-original.png": good.subarray(0, good.length - 30), "drinks-hub-original.png": badCrc,
    "tropical-smoothies-original.png": Buffer.concat([good, Buffer.from("junk")]),
  }));
  assert.equal(r.imported.length, 0); assert.equal(r.rejected.length, 3);
  assert.ok(r.rejected.every((x) => /corrupted or invalid PNG/.test(x.reason)), reasons(r));
  assert.equal(inspectPng(badData).ok, false);
  assert.equal(inspectPng(Buffer.from("not a png at all, just text")).ok, false);
  assert.equal(inspectPng(good).ok, true);
});

test("hash mismatch (SHA256SUMS and batch.json) and missing declared files are rejected", () => {
  const root = makeRoot(); const png = makePng(12, 8, 11); const sha = sha256Hex(png);
  const r = run(root, writeInput({
    "gin-original.png": png, "drinks-hub-original.png": makePng(12, 8, 12),
    "SHA256SUMS": `${"0".repeat(64)}  gin-original.png\n${sha}  ghost-original.png\n`,
    "batch.json": { files: { "drinks-hub-original.png": { expectedSha256: "f".repeat(64) } } },
  }));
  assert.equal(r.imported.length, 0);
  assert.match(reasons(r), /hash mismatch/); assert.match(reasons(r), /ghost-original.png|missing from the input/);
  const ok = run(root, writeInput({ "gin-original.png": png, "SHA256SUMS": `${sha}  gin-original.png\n` }));
  assert.equal(ok.imported.length, 1);
});

test("fixtures declared in batch.json are never preserved as originals", () => {
  const root = makeRoot();
  const r = run(root, writeInput({ "gin-original.png": makePng(), "batch.json": { files: { "gin-original.png": { fixture: true } } } }));
  assert.equal(r.imported.length, 0); assert.match(reasons(r), /test fixture/);
});

test("dry run validates without writing", () => {
  const root = makeRoot(); const before = snapshot(root);
  const r = run(root, writeInput({ "gin-original.png": makePng(12, 8, 13) }), { dryRun: true });
  assert.equal(r.imported.length, 1); assert.deepEqual(snapshot(root), before);
});

test("an interrupted import (master without record) is adopted only if byte-identical", () => {
  const root = makeRoot(); const png = makePng(12, 8, 14);
  const dest = path.join(root, "batches/test-batch-1/masters/gin-original.png");
  fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, png);
  assert.equal(run(root, writeInput({ "gin-original.png": png })).imported.length, 1);
  const root2 = makeRoot(); const dest2 = path.join(root2, "batches/test-batch-1/masters/gin-original.png");
  fs.mkdirSync(path.dirname(dest2), { recursive: true }); fs.writeFileSync(dest2, makePng(12, 8, 99));
  assert.match(reasons(run(root2, writeInput({ "gin-original.png": png }))), /refusing to overwrite/);
});

test("approval decisions are separate, bound to the hash, and a rejected master can be replaced without deleting it", () => {
  const root = makeRoot(); const first = makePng(12, 8, 15); const second = makePng(12, 8, 16);
  run(root, writeInput({ "gin-original.png": first }));
  const recordFile = path.join(root, loadRecords(root)[0].recordPath); const recordBytes = fs.readFileSync(recordFile);
  assert.throws(() => recordDecision({ root, categoryId: "gin", sha256: "0".repeat(64), status: "approved", decidedBy: "owner" }), /exact file content/);
  recordDecision({ root, categoryId: "gin", sha256: sha256Hex(first), status: "rejected", decidedBy: "owner", note: "too dark", now: NOW });
  assert.ok(fs.readFileSync(recordFile).equals(recordBytes), "generation record must not change when a decision is recorded");
  const r = importBatch({ root, input: writeInput({ "gin-original.png": second }), batchId: "replace-1", now: NOW });
  assert.equal(r.imported.length, 1, reasons(r));
  assert.ok(fs.readFileSync(path.join(root, "batches/test-batch-1/masters/gin-original.png")).equals(first), "rejected master stays preserved");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const gin = manifest.categories.find((c) => c.id === "gin");
  assert.equal(gin.approvalStatus, "pending"); assert.equal(gin.activeRecord.sha256, sha256Hex(second)); assert.equal(gin.supersededRecords.length, 1);
  recordDecision({ root, categoryId: "gin", sha256: sha256Hex(second), status: "approved", decidedBy: "owner", now: NOW });
  assert.equal(verify(root).ok, true, verify(root).errors.join("\n"));
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")).counts.approved, 1);
});

test("verify detects tampering with a preserved master, a stale manifest and stray files", () => {
  const root = makeRoot(); run(root, writeInput({ "gin-original.png": makePng(12, 8, 17) }));
  const master = path.join(root, "batches/test-batch-1/masters/gin-original.png");
  fs.chmodSync(master, 0o644); fs.appendFileSync(master, "x");
  fs.writeFileSync(path.join(root, "batches/test-batch-1/masters/stray.png"), "x");
  fs.writeFileSync(path.join(root, "manifest.json"), "{}\n");
  const v = verify(root);
  assert.equal(v.ok, false);
  const text = v.errors.join("\n");
  assert.match(text, /no longer matches/); assert.match(text, /unreferenced file/); assert.match(text, /manifest.json is out of date/);
});

test("report lists completed, pending, rejected and missing images", () => {
  const root = makeRoot(); const a = makePng(12, 8, 18); const b = makePng(12, 8, 19);
  run(root, writeInput({ "gin-original.png": a, "drinks-hub-original.png": b }));
  recordDecision({ root, categoryId: "gin", sha256: sha256Hex(a), status: "approved", decidedBy: "owner", now: NOW });
  recordDecision({ root, categoryId: "drinks-hub", sha256: sha256Hex(b), status: "rejected", decidedBy: "owner", now: NOW });
  const report = fs.readFileSync(path.join(root, "REPORT.md"), "utf8");
  assert.match(report, /1 approved · 0 pending review · 1 rejected \(replacement needed\) · 1 not yet received/);
  assert.match(report, /Missing[\s\S]*tropical-smoothies-original\.png/);
});

test("invalid inventory (duplicate ids/filenames) is refused", () => {
  const root = makeRoot();
  const file = path.join(root, "categories.json"); const inv = JSON.parse(fs.readFileSync(file, "utf8"));
  inv.categories.push({ ...inv.categories[0] }); fs.writeFileSync(file, JSON.stringify(inv));
  assert.throws(() => run(root, writeInput({ "gin-original.png": makePng() })), /duplicate/);
});

test("real repository: historical masters unchanged, inventory unique, legacy records and derived files current", () => {
  const v = verify(DEFAULT_ROOT);
  assert.equal(v.ok, true, v.errors.join("\n"));
  const pilot = JSON.parse(fs.readFileSync(path.join(DEFAULT_ROOT, "pilot-records.json"), "utf8"));
  for (const h of pilot) assert.equal(sha256Hex(fs.readFileSync(path.join(DEFAULT_ROOT, "masters", `${h.name}.png`))), h.sha256);
  assert.equal(loadRecords(DEFAULT_ROOT).filter((r) => r.batch === "pilot-2026-10-19").length, 5);
  // Re-adopting is a no-op, and importing a legacy category's filename with different bytes is refused.
  const copy = tmpDir("dpt-repo-"); fs.cpSync(DEFAULT_ROOT, copy, { recursive: true });
  assert.deepEqual(adoptLegacy({ root: copy }).created, []);
  const r = run(copy, writeInput({ "daiquiri-original.png": makePng(12, 8, 21) }));
  assert.equal(r.imported.length, 0); assert.match(reasons(r), /conflicting hash/);
  assert.equal(verify(copy).ok, true);
});
