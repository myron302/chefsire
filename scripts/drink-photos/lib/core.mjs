// Preservation core: inventory, batch import, review decisions, manifest/report generation, verification.
// Original image bytes are only ever hashed, inspected and written verbatim; they are never transformed.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractArchive, isArchive } from "./archive.mjs";
import { inspectPng } from "./png.mjs";

export const SCHEMA_VERSION = 1;
export const DEFAULT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../assets/drink-image-review");
export const APPROVAL_STATUSES = ["approved", "rejected", "pending"];
const BATCH_ID = /^[a-z0-9][a-z0-9-]{2,60}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const IGNORED_INPUT = /^(batch\.json|sha256sums|readme(\..*)?|\.gitkeep|\.ds_store|thumbs\.db)$/i;
const GENERATION_FIELDS = ["provider", "model", "generationId", "generatedAt", "prompt", "reference"];

export const sha256Hex = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

function writeFileAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

export function paths(root = DEFAULT_ROOT) {
  return {
    root,
    categories: path.join(root, "categories.json"),
    pilotRecords: path.join(root, "pilot-records.json"),
    recordsDir: path.join(root, "generation-records"),
    approvals: path.join(root, "approvals.json"),
    manifest: path.join(root, "manifest.json"),
    report: path.join(root, "REPORT.md"),
  };
}

// ---------------------------------------------------------------- inventory

export function loadInventory(root = DEFAULT_ROOT) {
  const inv = readJson(paths(root).categories);
  const errors = [];
  const seen = { id: new Set(), route: new Set(), file: new Set() };
  for (const c of inv.categories) {
    if (!/^[a-z0-9-]+$/.test(c.id)) errors.push(`invalid category id "${c.id}"`);
    if (!c.route?.startsWith("/drinks")) errors.push(`${c.id}: route must start with /drinks`);
    if (!/^[a-z0-9][a-z0-9-]*\.png$/.test(c.masterFilename ?? "")) errors.push(`${c.id}: invalid masterFilename`);
    for (const [k, v] of [["id", c.id], ["route", c.route], ["file", c.masterFilename]]) {
      if (seen[k].has(v)) errors.push(`duplicate ${k} "${v}" in categories.json`);
      seen[k].add(v);
    }
  }
  // Aliases (e.g. redirected routes) must not collide with any canonical or alias identity.
  for (const c of inv.categories) {
    for (const a of c.aliases ?? []) {
      if (!/^[a-z0-9-]+$/.test(a.id ?? "")) errors.push(`${c.id}: invalid alias id "${a.id}"`);
      if (!a.route?.startsWith("/drinks")) errors.push(`${c.id}: alias ${a.id} route must start with /drinks`);
      if (a.masterFilename != null && !/^[a-z0-9][a-z0-9-]*\.png$/.test(a.masterFilename)) errors.push(`${c.id}: alias ${a.id} has an invalid masterFilename`);
      const claims = [["id", a.id, seen.id], ["route", a.route, seen.route], ["file", a.masterFilename, seen.file]];
      for (const [k, v, set] of claims) {
        if (v == null) continue;
        if (set.has(v)) errors.push(`alias ${a.id}: ${k} "${v}" collides with another category or alias`);
        set.add(v);
      }
    }
  }
  if (inv.reconciliation?.status === "RECONCILED" && inv.reconciliation.expectedDestinationCount !== inv.categories.length) {
    errors.push(`inventory marked RECONCILED but lists ${inv.categories.length} canonical categories (expected ${inv.reconciliation.expectedDestinationCount})`);
  }
  if (errors.length) throw new Error(`categories.json invalid:\n  ${errors.join("\n  ")}`);
  return inv;
}

/** Lookup tables that normalise aliases to their canonical category. */
export function indexInventory(inv) {
  const byId = new Map();
  const byFilename = new Map();
  for (const c of inv.categories) {
    byId.set(c.id, c);
    byFilename.set(c.masterFilename, c);
    for (const a of c.aliases ?? []) {
      byId.set(a.id, c);
      if (a.masterFilename) byFilename.set(a.masterFilename, c);
    }
  }
  return { byId, byFilename };
}

// ---------------------------------------------------------------- records & approvals

export function loadRecords(root = DEFAULT_ROOT) {
  const dir = paths(root).recordsDir;
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
    .map((f) => ({ ...readJson(path.join(dir, f)), recordPath: `generation-records/${f}` }));
}

export function loadApprovals(root = DEFAULT_ROOT) {
  const file = paths(root).approvals;
  return fs.existsSync(file) ? readJson(file) : { schemaVersion: SCHEMA_VERSION, decisions: [] };
}

/** Latest decision per (categoryId, sha256); undefined means no decision yet (pending). */
function latestDecision(approvals, categoryId, sha) {
  let found;
  for (const d of approvals.decisions) if (d.categoryId === categoryId && d.sha256 === sha) found = d;
  return found;
}

/** Group records by category; the active record is the one no other record supersedes. */
function recordsByCategory(records) {
  const map = new Map();
  for (const r of records) map.set(r.categoryId, [...(map.get(r.categoryId) ?? []), r]);
  const out = new Map();
  for (const [id, list] of map) {
    const superseded = new Set(list.map((r) => r.supersedes).filter(Boolean));
    const heads = list.filter((r) => !superseded.has(r.sha256));
    out.set(id, { all: list, heads, active: heads.length === 1 ? heads[0] : null });
  }
  return out;
}

// ---------------------------------------------------------------- derived outputs

export function buildManifest(root = DEFAULT_ROOT) {
  const inv = loadInventory(root);
  const approvals = loadApprovals(root);
  const byCat = recordsByCategory(loadRecords(root));
  const summarize = (r) => ({
    recordPath: r.recordPath, batch: r.batch, masterPath: r.masterPath, sha256: r.sha256,
    bytes: r.bytes, width: r.width, height: r.height,
  });
  const categories = inv.categories.map((c) => {
    const group = byCat.get(c.id);
    const active = group?.active ?? null;
    let approvalStatus = "none";
    if (active) approvalStatus = latestDecision(approvals, c.id, active.sha256)?.status ?? "pending";
    return {
      id: c.id, title: c.title, level: c.level, route: c.route, masterFilename: c.masterFilename,
      aliasRoutes: (c.aliases ?? []).map((a) => a.route),
      generationStatus: active ? "preserved" : "missing",
      approvalStatus,
      activeRecord: active ? summarize(active) : null,
      supersededRecords: (group?.all ?? []).filter((r) => r !== active).map(summarize),
    };
  });
  const count = (fn) => categories.filter(fn).length;
  return {
    schemaVersion: SCHEMA_VERSION,
    note: "Generated by scripts/drink-photos. Do not edit by hand; run `npm run photos:refresh`.",
    inventory: { status: inv.reconciliation?.status ?? "UNKNOWN", expected: inv.reconciliation?.expectedDestinationCount ?? null, listed: categories.length },
    counts: {
      total: categories.length,
      approved: count((c) => c.approvalStatus === "approved"),
      pendingReview: count((c) => c.approvalStatus === "pending"),
      rejectedNeedsReplacement: count((c) => c.approvalStatus === "rejected"),
      missing: count((c) => c.generationStatus === "missing"),
    },
    categories,
  };
}

export function buildReport(manifest, inventoryNote) {
  const short = (s) => `\`${s.slice(0, 12)}…\``;
  const rowFor = (c) => {
    const r = c.activeRecord;
    const alias = c.aliasRoutes?.length ? ` (alias: ${c.aliasRoutes.map((a) => `\`${a}\``).join(", ")})` : "";
    return `| ${c.title} | \`${c.route}\`${alias} | [${path.basename(r.masterPath)}](${r.masterPath}) | ${r.width} × ${r.height} | ${short(r.sha256)} | ${r.batch} |`;
  };
  const section = (title, list, empty) => [
    `## ${title} (${list.length})`, "",
    ...(list.length ? ["| Category | Route | Master | Dimensions | SHA-256 | Batch |", "|---|---|---|---|---|---|", ...list.map(rowFor)] : [empty]),
    "",
  ];
  const cats = manifest.categories;
  const lines = [
    "# ChefSire original drink photography — status report", "",
    "_Generated by `npm run photos:refresh` from `manifest.json`. Not integrated into the website._", "",
    `**${manifest.counts.approved} approved · ${manifest.counts.pendingReview} pending review · ${manifest.counts.rejectedNeedsReplacement} rejected (replacement needed) · ${manifest.counts.missing} not yet received** of ${manifest.counts.total} listed destinations.`, "",
  ];
  if (manifest.inventory.status !== "RECONCILED") {
    lines.push(`> **Inventory not reconciled:** ${inventoryNote ?? "see categories.json"}`, "");
  }
  lines.push(
    ...section("Completed — approved", cats.filter((c) => c.approvalStatus === "approved"), "None yet."),
    ...section("Pending owner review", cats.filter((c) => c.approvalStatus === "pending"), "None."),
    ...section("Rejected — replacement needed", cats.filter((c) => c.approvalStatus === "rejected"), "None."),
    `## Missing — no photograph received (${manifest.counts.missing})`, "",
    ...(manifest.counts.missing
      ? ["| Category | Route | Expected filename |", "|---|---|---|",
         ...cats.filter((c) => c.generationStatus === "missing").map((c) => `| ${c.title} | \`${c.route}\`${c.aliasRoutes?.length ? ` (alias: ${c.aliasRoutes.map((a) => `\`${a}\``).join(", ")})` : ""} | \`${c.masterFilename}\` |`)]
      : ["None."]),
    "",
  );
  return `${lines.join("\n")}\n`.replace(/\n{3,}/g, "\n\n");
}

export function refreshDerived(root = DEFAULT_ROOT) {
  const p = paths(root);
  const manifest = buildManifest(root);
  writeFileAtomic(p.manifest, stableJson(manifest));
  writeFileAtomic(p.report, buildReport(manifest, loadInventory(root).reconciliation?.note));
  return manifest;
}

// ---------------------------------------------------------------- import

function collectInput(input, scratch) {
  const stat = fs.statSync(input);
  const files = []; // { name, fullPath }
  const problems = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) problems.push({ file: e.name, reason: "symbolic link ignored for safety" });
      else if (e.isDirectory()) { if (e.name !== "__MACOSX") walk(full); }
      else if (e.isFile()) files.push({ name: e.name, fullPath: full });
    }
  };
  if (stat.isDirectory()) {
    walk(input);
    return { files, problems, source: { kind: "directory", name: path.basename(input) } };
  }
  if (!isArchive(input)) throw new Error(`input "${input}" is neither a directory nor a supported archive (.zip, .tar, .tar.gz, .tgz)`);
  const extracted = extractArchive(input, scratch);
  for (const p of extracted.problems) problems.push({ file: p.entry, reason: p.reason });
  walk(scratch);
  return { files, problems, source: { kind: "archive", name: path.basename(input) } };
}

function parseSums(text) {
  const sums = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64}) [ *](.+)$/.exec(line.trim());
    if (m) sums.set(path.basename(m[2].trim()), m[1].toLowerCase());
  }
  return sums;
}

function writeMasterNoOverwrite(dest, buf) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = path.join(path.dirname(dest), `.${path.basename(dest)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, buf, { flag: "wx" });
  try {
    fs.linkSync(tmp, dest); // atomic; fails with EEXIST rather than replacing an existing master
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  fs.chmodSync(dest, 0o444);
}

/**
 * Import PNGs from a directory or archive. Never overwrites an existing master. Safe to repeat.
 * Options: { root, input, batchId, now, dryRun, allowFixtures }
 */
export function importBatch({ root = DEFAULT_ROOT, input, batchId, now = new Date(), dryRun = false, allowFixtures = false }) {
  if (!BATCH_ID.test(batchId ?? "")) throw new Error("batch id is required and must match [a-z0-9][a-z0-9-]{2,60}");
  const p = paths(root);
  const inv = loadInventory(root);
  const records = loadRecords(root);
  const approvals = loadApprovals(root);
  const byCat = recordsByCategory(records);
  const shaOwner = new Map(records.map((r) => [r.sha256, r.categoryId]));
  const { byId, byFilename } = indexInventory(inv);

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "drink-photo-import-"));
  const result = { batchId, source: null, imported: [], unchanged: [], rejected: [], warnings: [], dryRun };
  const reject = (file, reason, categoryId = null) => result.rejected.push({ file, categoryId, reason });

  try {
    const { files, problems, source } = collectInput(input, scratch);
    result.source = source;
    for (const pr of problems) reject(pr.file, pr.reason);

    const meta = files.find((f) => f.name.toLowerCase() === "batch.json");
    let batchMeta = { defaults: {}, files: {} };
    if (meta) {
      try { batchMeta = { defaults: {}, files: {}, ...readJson(meta.fullPath) }; }
      catch (e) { throw new Error(`batch.json is not valid JSON: ${e.message}`); }
    }
    const sumsFile = files.find((f) => f.name.toLowerCase() === "sha256sums");
    const sums = sumsFile ? parseSums(fs.readFileSync(sumsFile.fullPath, "utf8")) : new Map();

    const candidates = files.filter((f) => !IGNORED_INPUT.test(f.name) && !f.name.startsWith("."));
    const nameCounts = new Map();
    for (const f of candidates) nameCounts.set(f.name, (nameCounts.get(f.name) ?? 0) + 1);

    // Files declared (batch.json / SHA256SUMS) but not delivered.
    const present = new Set(candidates.map((f) => f.name));
    for (const declared of new Set([...Object.keys(batchMeta.files), ...sums.keys()])) {
      if (!present.has(declared)) reject(declared, "listed in batch.json/SHA256SUMS but missing from the input");
    }

    // Plan each file.
    const plan = [];
    const seenNames = new Set();
    for (const f of candidates) {
      if (seenNames.has(f.name)) continue;
      seenNames.add(f.name);
      if (nameCounts.get(f.name) > 1) { reject(f.name, "duplicate file name appears more than once in the input"); continue; }
      if (!/\.png$/i.test(f.name)) { reject(f.name, "not a PNG file (only original PNG masters are accepted)"); continue; }

      const fm = batchMeta.files[f.name] ?? {};
      if (fm.fixture === true && !allowFixtures) { reject(f.name, "declared as a test fixture; fixtures are never preserved as ChefSire originals"); continue; }

      let category = byFilename.get(f.name);
      if (fm.categoryId !== undefined) {
        const declared = byId.get(fm.categoryId);
        if (!declared) { reject(f.name, `unknown category id "${fm.categoryId}"`); continue; }
        if (category && category.id !== declared.id) { reject(f.name, `batch.json assigns "${declared.id}" but the file name belongs to "${category.id}"`, declared.id); continue; }
        const allowedNames = [declared.masterFilename, ...(declared.aliases ?? []).map((a) => a.masterFilename).filter(Boolean)];
        if (!allowedNames.includes(f.name)) { reject(f.name, `file name must be the canonical master filename "${declared.masterFilename}"`, declared.id); continue; }
        category = declared;
      }
      if (!category) { reject(f.name, "file name does not match any category's canonical master filename"); continue; }

      const buf = fs.readFileSync(f.fullPath);
      const sha = sha256Hex(buf);
      const expected = (fm.expectedSha256 ?? sums.get(f.name))?.toLowerCase();
      if (fm.expectedSha256 && !SHA256.test(fm.expectedSha256.toLowerCase())) { reject(f.name, "expectedSha256 in batch.json is not a valid SHA-256", category.id); continue; }
      if (sums.has(f.name) && fm.expectedSha256 && sums.get(f.name) !== fm.expectedSha256.toLowerCase()) { reject(f.name, "batch.json and SHA256SUMS disagree about the expected hash", category.id); continue; }
      if (expected && expected !== sha) { reject(f.name, `hash mismatch: expected ${expected}, file is ${sha}`, category.id); continue; }

      const png = inspectPng(buf);
      if (!png.ok) { reject(f.name, `corrupted or invalid PNG: ${png.reason}`, category.id); continue; }
      plan.push({ f, fm, category, buf, sha, png });
    }

    // Two files resolving to the same canonical category (e.g. canonical + alias filename) are ambiguous: reject both.
    const perCategory = new Map();
    for (const e of plan) perCategory.set(e.category.id, [...(perCategory.get(e.category.id) ?? []), e]);
    for (const [id, list] of perCategory) {
      if (list.length > 1) {
        for (const e of list) reject(e.f.name, `duplicate category assignment: ${list.map((x) => x.f.name).join(" and ")} all resolve to canonical category "${id}"`, id);
        for (const e of list) plan.splice(plan.indexOf(e), 1);
      }
    }

    // The same image content submitted for two categories in one input is a conflict for both.
    const shaCount = new Map();
    for (const e of plan) shaCount.set(e.sha, [...(shaCount.get(e.sha) ?? []), e.category.id]);

    for (const e of plan) {
      const { f, fm, category, buf, sha, png } = e;
      if (shaCount.get(sha).length > 1) { reject(f.name, `identical image content supplied for multiple categories (${shaCount.get(sha).join(", ")})`, category.id); continue; }
      const group = byCat.get(category.id);
      const active = group?.active ?? null;
      if (group && !active) { reject(f.name, "category has an inconsistent record chain; run `npm run photos:verify`", category.id); continue; }

      if (active && active.sha256 === sha) {
        const onDisk = path.join(root, active.masterPath);
        if (!fs.existsSync(onDisk) || sha256Hex(fs.readFileSync(onDisk)) !== sha) {
          reject(f.name, "record exists but the preserved master is missing or altered; investigate before importing", category.id);
        } else result.unchanged.push({ file: f.name, categoryId: category.id, sha256: sha });
        continue;
      }
      const owner = shaOwner.get(sha);
      if (owner) { reject(f.name, `identical image already preserved for category "${owner}"`, category.id); continue; }

      let supersedes = null;
      if (active) {
        if (latestDecision(approvals, category.id, active.sha256)?.status !== "rejected") {
          reject(f.name, `conflicting hash: master already preserved with sha256 ${active.sha256}; originals are never overwritten (only a master the owner rejected can be replaced)`, category.id);
          continue;
        }
        supersedes = active.sha256;
      }

      const legacyFile = active == null && category.legacyBatch ? `masters/${category.masterFilename}` : null;
      if (legacyFile) { reject(f.name, "a legacy master is expected for this category but has no record; run adopt-legacy first", category.id); continue; }

      const masterPath = `batches/${batchId}/masters/${category.masterFilename}`;
      const dest = path.join(root, masterPath);
      const generation = {};
      for (const k of GENERATION_FIELDS) generation[k] = fm[k] ?? batchMeta.defaults?.[k] ?? null;

      const record = {
        schemaVersion: SCHEMA_VERSION,
        categoryId: category.id, route: category.route, masterFilename: category.masterFilename,
        batch: batchId, masterPath, sha256: sha, bytes: buf.length, width: png.width, height: png.height, format: "png",
        importedAt: now.toISOString(), importSource: result.source, originalFilename: f.name,
        ...(f.name !== category.masterFilename ? { resolvedFromAlias: f.name } : {}),
        generation, supersedes,
        usageTerms: "Generated with OpenAI image generation. Commercial use is subject to the applicable OpenAI terms and applicable law. Exclusive ownership or copyright protection is not guaranteed.",
      };
      if (png.width / png.height < 1.4 || png.width / png.height > 1.6) result.warnings.push(`${f.name}: aspect ratio ${(png.width / png.height).toFixed(2)} is not approximately 3:2`);

      const recordPath = path.join(p.recordsDir, `${category.id}--${sha.slice(0, 12)}.json`);
      if (dryRun) { result.imported.push({ file: f.name, categoryId: category.id, sha256: sha, masterPath, dryRun: true }); continue; }

      if (fs.existsSync(dest)) {
        // Orphan master from an interrupted earlier run: adopt only if byte-identical.
        if (sha256Hex(fs.readFileSync(dest)) !== sha) { reject(f.name, `different file already exists at ${masterPath}; refusing to overwrite`, category.id); continue; }
      } else {
        writeMasterNoOverwrite(dest, buf);
      }
      if (sha256Hex(fs.readFileSync(dest)) !== sha) throw new Error(`post-write verification failed for ${masterPath}`);
      fs.mkdirSync(p.recordsDir, { recursive: true });
      fs.writeFileSync(recordPath, stableJson(record), { flag: "wx", mode: 0o444 });
      result.imported.push({ file: f.name, categoryId: category.id, sha256: sha, masterPath });
      shaOwner.set(sha, category.id);
    }
    if (!dryRun && result.imported.length) refreshDerived(root);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  return result;
}

// ---------------------------------------------------------------- legacy adoption

/** Create generation records for the five PR #1322 masters, verifying them against pilot-records.json. Never touches the masters. */
export function adoptLegacy({ root = DEFAULT_ROOT, now = new Date() } = {}) {
  const p = paths(root);
  const inv = loadInventory(root);
  const pilot = readJson(p.pilotRecords);
  const out = { created: [], unchanged: [] };
  fs.mkdirSync(p.recordsDir, { recursive: true });
  for (const h of pilot) {
    const category = inv.categories.find((c) => c.legacyBatch && c.masterFilename === `${h.name}.png`);
    if (!category) throw new Error(`no legacy category for historical record "${h.name}"`);
    const masterPath = `masters/${category.masterFilename}`;
    const buf = fs.readFileSync(path.join(root, masterPath));
    const sha = sha256Hex(buf);
    if (sha !== h.sha256) throw new Error(`${masterPath}: sha256 ${sha} differs from historical record ${h.sha256}`);
    const png = inspectPng(buf);
    if (!png.ok || png.width !== h.width || png.height !== h.height || buf.length !== h.bytes) throw new Error(`${masterPath}: does not match its historical record`);
    const file = path.join(p.recordsDir, `${category.id}--${sha.slice(0, 12)}.json`);
    if (fs.existsSync(file)) { out.unchanged.push(category.id); continue; }
    const record = {
      schemaVersion: SCHEMA_VERSION,
      categoryId: category.id, route: category.route, masterFilename: category.masterFilename,
      batch: category.legacyBatch, masterPath, sha256: sha, bytes: buf.length, width: png.width, height: png.height, format: "png",
      importedAt: now.toISOString(), importSource: { kind: "repository", name: "PR #1322 (dbf650b)" }, originalFilename: category.masterFilename,
      generation: { provider: h.generator, model: null, generationId: null, generatedAt: null, prompt: null, reference: h.reference },
      historicalRecord: { file: "pilot-records.json", name: h.name, note: "Prompt, source path and approval state live in the unchanged historical record." },
      supersedes: null,
      usageTerms: "Generated with OpenAI image generation. Commercial use is subject to the applicable OpenAI terms and applicable law. Exclusive ownership or copyright protection is not guaranteed.",
    };
    fs.writeFileSync(file, stableJson(record), { flag: "wx", mode: 0o444 });
    out.created.push(category.id);
  }
  refreshDerived(root);
  return out;
}

// ---------------------------------------------------------------- review decisions

export function recordDecision({ root = DEFAULT_ROOT, categoryId: requestedId, sha256, status, decidedBy, note = null, now = new Date() }) {
  const categoryId = indexInventory(loadInventory(root)).byId.get(requestedId)?.id ?? requestedId;
  if (!APPROVAL_STATUSES.includes(status)) throw new Error(`status must be one of ${APPROVAL_STATUSES.join(", ")}`);
  if (!decidedBy) throw new Error("decidedBy is required");
  const group = recordsByCategory(loadRecords(root)).get(categoryId);
  if (!group?.active) throw new Error(`no preserved photograph for category "${categoryId}"`);
  if (group.active.sha256 !== sha256) throw new Error(`sha256 does not match the active preserved master (${group.active.sha256}); decisions are bound to exact file content`);
  const approvals = loadApprovals(root);
  const decision = { categoryId, sha256, status, decidedBy, decidedAt: now.toISOString(), note };
  approvals.decisions.push(decision);
  writeFileAtomic(paths(root).approvals, stableJson(approvals));
  refreshDerived(root);
  return decision;
}

// ---------------------------------------------------------------- verification

export function verify(root = DEFAULT_ROOT) {
  const p = paths(root);
  const errors = [];
  let inv;
  try { inv = loadInventory(root); } catch (e) { return { ok: false, errors: [e.message], warnings: [] }; }
  const warnings = [];
  if (inv.reconciliation?.status !== "RECONCILED") warnings.push(`inventory status ${inv.reconciliation?.status}: ${inv.categories.length} listed vs ${inv.reconciliation?.expectedDestinationCount} expected`);
  const byId = new Map(inv.categories.map((c) => [c.id, c]));
  const records = loadRecords(root);
  const referenced = new Set();
  const shas = new Map();

  for (const r of records) {
    const label = r.recordPath;
    const c = byId.get(r.categoryId);
    if (!c) { errors.push(`${label}: unknown category "${r.categoryId}"`); continue; }
    if (c.route !== r.route) errors.push(`${label}: route ${r.route} differs from inventory ${c.route}`);
    if (c.masterFilename !== r.masterFilename) errors.push(`${label}: master filename differs from inventory`);
    if (shas.has(r.sha256)) errors.push(`${label}: sha256 duplicates ${shas.get(r.sha256)}`);
    shas.set(r.sha256, label);
    referenced.add(r.masterPath);
    const file = path.join(root, r.masterPath);
    if (!fs.existsSync(file)) { errors.push(`${label}: master ${r.masterPath} is missing`); continue; }
    const buf = fs.readFileSync(file);
    if (sha256Hex(buf) !== r.sha256) errors.push(`${label}: master ${r.masterPath} no longer matches its recorded sha256`);
    if (buf.length !== r.bytes) errors.push(`${label}: byte size differs from record`);
    const png = inspectPng(buf);
    if (!png.ok) errors.push(`${label}: master is not a valid PNG (${png.reason})`);
    else if (png.width !== r.width || png.height !== r.height) errors.push(`${label}: dimensions differ from record`);
  }
  for (const [id, g] of recordsByCategory(records)) if (!g.active) errors.push(`category ${id}: record chain has ${g.heads.length} heads (expected exactly 1)`);

  // Historical PR #1322 masters must still match the unchanged historical records.
  if (fs.existsSync(p.pilotRecords)) {
    for (const h of readJson(p.pilotRecords)) {
      const f = path.join(root, "masters", `${h.name}.png`);
      if (!fs.existsSync(f)) errors.push(`historical master ${h.name}.png is missing`);
      else if (sha256Hex(fs.readFileSync(f)) !== h.sha256) errors.push(`historical master ${h.name}.png differs from pilot-records.json`);
      else referenced.add(`masters/${h.name}.png`);
    }
  }

  // Approvals must refer to real records.
  const known = new Set(records.map((r) => `${r.categoryId}:${r.sha256}`));
  for (const d of loadApprovals(root).decisions) {
    if (!APPROVAL_STATUSES.includes(d.status)) errors.push(`approvals.json: invalid status "${d.status}" for ${d.categoryId}`);
    if (!known.has(`${d.categoryId}:${d.sha256}`)) errors.push(`approvals.json: decision for ${d.categoryId} refers to an unknown record/hash`);
  }

  // No unreferenced images in master directories.
  const dirs = [path.join(root, "masters")];
  const batchesDir = path.join(root, "batches");
  if (fs.existsSync(batchesDir)) for (const b of fs.readdirSync(batchesDir)) dirs.push(path.join(batchesDir, b, "masters"));
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (f.startsWith(".")) continue;
      const rel = path.relative(root, path.join(d, f)).split(path.sep).join("/");
      if (!referenced.has(rel)) errors.push(`unreferenced file in masters: ${rel}`);
    }
  }

  // When run inside the ChefSire checkout, every canonical route must exist and every alias must really redirect.
  errors.push(...checkInventoryAgainstRepo(inv, path.resolve(root, "..", "..")));

  // Derived outputs must be current.
  try {
    const manifest = buildManifest(root);
    const expectedManifest = stableJson(manifest);
    if (!fs.existsSync(p.manifest) || fs.readFileSync(p.manifest, "utf8") !== expectedManifest) errors.push("manifest.json is out of date; run `npm run photos:refresh`");
    if (!fs.existsSync(p.report) || fs.readFileSync(p.report, "utf8") !== buildReport(manifest, inv.reconciliation?.note)) errors.push("REPORT.md is out of date; run `npm run photos:refresh`");
  } catch (e) { errors.push(`cannot build manifest: ${e.message}`); }

  return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------- inventory vs. application (read-only)

/** Compare the inventory with the route registry, hub pages and redirects. Skipped outside a ChefSire checkout. */
export function checkInventoryAgainstRepo(inv, repoRoot) {
  const registryFile = path.join(repoRoot, "client/src/data/drinks/route-registry.ts");
  const appFile = path.join(repoRoot, "client/src/App.tsx");
  if (!fs.existsSync(registryFile) || !fs.existsSync(appFile)) return [];
  const errors = [];
  const registryRoutes = new Set([...fs.readFileSync(registryFile, "utf8").matchAll(/route: "([^"]+)"/g)].map((m) => m[1]));
  const app = fs.readFileSync(appFile, "utf8");
  const aliasRoutes = new Map(); // alias route -> canonical route
  for (const c of inv.categories) for (const a of c.aliases ?? []) aliasRoutes.set(a.route, c.route);

  for (const c of inv.categories) {
    if (c.level === "leaf" && !registryRoutes.has(c.route)) errors.push(`canonical route ${c.route} (${c.id}) is not in the route registry`);
    if (c.level === "hub") {
      const page = c.route === "/drinks" ? "client/src/pages/drinks/index.tsx" : `client/src/pages/drinks/${c.route.split("/")[2]}/index.tsx`;
      if (!fs.existsSync(path.join(repoRoot, page))) errors.push(`hub route ${c.route} (${c.id}) has no page at ${page}`);
    }
  }
  const canonicalLeaves = new Set(inv.categories.filter((c) => c.level === "leaf").map((c) => c.route));
  for (const r of registryRoutes) {
    if (!canonicalLeaves.has(r) && !aliasRoutes.has(r)) errors.push(`registry route ${r} is neither a canonical category nor a declared alias`);
  }
  for (const [alias, canonical] of aliasRoutes) {
    const at = app.indexOf(`path="${alias}"`);
    const window = at < 0 ? "" : app.slice(at, at + 160);
    if (!window.includes(`<Redirect to="${canonical}"`)) errors.push(`alias ${alias} does not redirect to ${canonical} in client/src/App.tsx`);
    if (!inv.categories.some((c) => c.route === canonical)) errors.push(`alias ${alias} points at ${canonical}, which is not a canonical category`);
  }
  return errors;
}
