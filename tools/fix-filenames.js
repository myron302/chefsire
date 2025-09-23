// tools/fix-filenames.js
// Convert component & page filenames to kebab-case and fix "@/..." imports to match.
// Safe on Plesk/Linux: skips missing files, avoids duplicates, shows a summary.

import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "client", "src");

// --- helpers --------------------------------------------------------------

/** true if a filename base has capitals/underscores/spaces */
function needsKebab(base) {
  return /[A-Z_\s]/.test(base);
}

/** PascalCase|camelCase|snake_case|spaces -> kebab-case */
function toKebab(base) {
  return base
    .replace(/\.tsx?$/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2") // “FooBar” -> “Foo-Bar”
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

/** recursively yield absolute file paths under dir */
function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

/** read file safely; returns null on error */
function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/** write file ensuring parent exists */
function writeFileSafe(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
}

// --- 1) discover planned renames -----------------------------------------

const exts = new Set([".ts", ".tsx"]);
const candidates = []; // { fromAbs, toAbs, fromRel, toRel }

for (const abs of walk(SRC)) {
  const ext = path.extname(abs);
  if (!exts.has(ext)) continue;

  const base = path.basename(abs, ext);
  if (!needsKebab(base)) continue;

  const kebab = toKebab(base);
  if (kebab === base.toLowerCase()) continue; // nothing to normalize beyond case

  const dir = path.dirname(abs);
  const toAbs = path.join(dir, `${kebab}${ext}`);

  // Skip if from == to (case-insensitive FS protection)
  if (abs.toLowerCase() === toAbs.toLowerCase()) continue;

  const fromRel = path.relative(path.join(SRC), abs).replace(/\\/g, "/");
  const toRel = path.relative(path.join(SRC), toAbs).replace(/\\/g, "/");

  candidates.push({ fromAbs: abs, toAbs, fromRel, toRel });
}

// dedupe by fromAbs (in case previous scripts listed the same twice)
const seen = new Set();
const renames = candidates.filter((x) => {
  if (seen.has(x.fromAbs)) return false;
  seen.add(x.fromAbs);
  return true;
});

// Skip missing sources, warn conflicts for existing targets
const finalRenames = [];
const warnings = [];

for (const r of renames) {
  if (!fs.existsSync(r.fromAbs)) {
    warnings.push(`skip (missing): ${r.fromRel}`);
    continue;
  }
  if (fs.existsSync(r.toAbs)) {
    if (r.fromAbs === r.toAbs) {
      continue; // same file
    }
    warnings.push(
      `conflict (target exists): ${r.toRel} — not overwriting. Please resolve manually.`
    );
    continue;
  }
  finalRenames.push(r);
}

// --- show plan ------------------------------------------------------------

if (finalRenames.length === 0) {
  console.log("No filename changes needed.");
} else {
  console.log("Planned renames:");
  for (const r of finalRenames) {
    console.log(
      `  ${r.fromRel} → ${r.toRel}`
    );
  }
}

if (warnings.length) {
  console.log("\nWarnings:");
  for (const w of warnings) console.log("  " + w);
}

// --- 2) perform renames ---------------------------------------------------

for (const r of finalRenames) {
  // extra safety re-check
  if (!fs.existsSync(r.fromAbs)) continue;
  fs.renameSync(r.fromAbs, r.toAbs);
}

// --- 3) fix "@/..." imports that reference the old names ------------------

// Build a map of alias paths without extension
// from "components/FooBar" -> "components/foo-bar"
const importMap = new Map();
for (const r of finalRenames) {
  const fromNoExt = r.fromRel.replace(/\.(tsx|ts)$/i, "");
  const toNoExt = r.toRel.replace(/\.(tsx|ts)$/i, "");
  importMap.set(fromNoExt, toNoExt);
}

// If nothing changed, exit
if (importMap.size === 0) {
  console.log("\nDone (no imports to update).");
  process.exit(0);
}

// Update alias imports in all TS/TSX under client/src
let filesTouched = 0;
let replacements = 0;

for (const abs of walk(SRC)) {
  const ext = path.extname(abs);
  if (!exts.has(ext)) continue;

  let text = readFileSafe(abs);
  if (text == null) continue;

  let updated = text;
  for (const [fromNoExt, toNoExt] of importMap) {
    // Replace only alias imports "@/..."
    // e.g. from "@/components/FooBar" -> "@/components/foo-bar"
    const fromA = `@/${fromNoExt}`;
    const toA = `@/${toNoExt}`;

    // Replace in import/export/require lines and other string literals
    // Keep it simple: global string replace is fine because paths are exact.
    const before = updated;
    updated = updated.split(fromA).join(toA);
    if (updated !== before) replacements++;
  }

  if (updated !== text) {
    writeFileSafe(abs, updated);
    filesTouched++;
  }
}

console.log(
  `\nRenamed ${finalRenames.length} file(s). Updated imports in ${filesTouched} file(s) with ${replacements} replacement batch(es).`
);
console.log("Done.");
