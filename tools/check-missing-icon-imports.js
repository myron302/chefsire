// tools/check-missing-icon-imports.js
// ESM-friendly (package.json has "type":"module")
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
// tools/check-missing-icon-imports.js
// Usage:
//   node tools/check-missing-icon-imports.js Coffee
//   npm run check:coffee   (if package.json maps to this)

import fs from "fs";
import path from "path";
import url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Which icon are we checking?
const ICON = process.argv[2] || "Coffee";

// Where to scan
const ROOT = process.cwd();
const TARGET_DIR = path.resolve(ROOT, "client/src");

const isTsLike = (p) => p.endsWith(".ts") || p.endsWith(".tsx");

function listFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile() && isTsLike(full)) {
        out.push(full);
      }
    }
  }
  return out;
}

function read(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

// --- Detection rules --------------------------------------------------------
// We ONLY consider it a *real* icon usage if one of these is present:
//
//   1) JSX usage:          <Coffee ... />
//   2) Object usage:       icon: Coffee
//   3) Namespace usage:    Icons.Coffee  (when using `import * as Icons from "lucide-react"`)
//
// We consider it *already imported* if one of these is present:
//
//   A) Named import:       import { ..., Coffee, ... } from "lucide-react"
//   B) Namespace import:   import * as Icons from "lucide-react"  (and the code actually uses Icons.Coffee)

function usesIcon(code, icon) {
  const jsxTag = new RegExp(`<\\s*${icon}\\b`);
  const objectIcon = new RegExp(`icon\\s*:\\s*${icon}\\b`);
  const nsUse = new RegExp(`\\bIcons\\.${icon}\\b`);

  return jsxTag.test(code) || objectIcon.test(code) || nsUse.test(code);
}

function hasIconImported(code, icon) {
  const named = new RegExp(
    `import\\s*\\{[^}]*\\b${icon}\\b[^}]*\\}\\s*from\\s*['"]lucide-react['"]`
  );
  const nsImport = /import\s*\*\s*as\s*Icons\s*from\s*['"]lucide-react['"]/;

  if (named.test(code)) return true;
  if (nsImport.test(code) && new RegExp(`\\bIcons\\.${icon}\\b`).test(code)) return true;
  return false;
}

// ----------------------------------------------------------------------------

const files = listFiles(TARGET_DIR);
const missing = [];

for (const file of files) {
  const code = read(file);
  if (!code) continue;

  // Only flag when the icon is actually used as a component or an "icon: Coffee" field.
  if (usesIcon(code, ICON) && !hasIconImported(code, ICON)) {
    missing.push(file);
  }
}

if (missing.length === 0) {
  console.log(`✅ No missing lucide-react icon imports for ${ICON}.`);
  process.exit(0);
}

console.log(`\n❌ Missing lucide-react icon imports detected:\n`);
for (const m of missing) {
  console.log(`- ${m}\n    ↳ missing: ${ICON}`);
}
console.log(
  `\nTip: run "npm run fix:${ICON.toLowerCase()}" for ${ICON} only, or:\n  node tools/fix-missing-coffee-imports.js ${ICON}\n` +
  "to auto-fix these files."
);
process.exit(1);

const ICONS = process.argv.slice(2).filter(Boolean);
const TARGET_ICONS = ICONS.length ? ICONS : ["Coffee"];
const BASE_DIR = process.env.ICON_CHECK_DIR || path.resolve("client/src");

async function walk(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(p, out);
    } else if (e.isFile() && (p.endsWith(".tsx") || p.endsWith(".ts"))) {
      out.push(p);
    }
  }
  return out;
}

function hasIconUsage(code, icon) {
  // Heuristic: icon name appears outside of import line
  // Avoid counting the import itself
  const reAny = new RegExp(`\\b${icon}\\b`);
  if (!reAny.test(code)) return false;

  // If it's only present inside import from lucide-react, skip
  const imports = code.match(/import\s+{[^}]*}\s+from\s+['"]lucide-react['"]/g) || [];
  const imported = imports.some((line) => new RegExp(`\\b${icon}\\b`).test(line));
  if (imported) {
    // Could still be used in code; return true if it appears outside import lines
    // Remove all lucide-react import lines and check again
    const codeNoImports = code.replace(/import\s+{[^}]*}\s+from\s+['"]lucide-react['"];?\s*/g, "");
    return reAny.test(codeNoImports);
  }
  return true;
}

function hasLucideImportFor(code, icon) {
  // Named import
  const named = new RegExp(
    `import\\s+{[^}]*\\b${icon}\\b[^}]*}\\s+from\\s+['"]lucide-react['"]`
  ).test(code);
  if (named) return true;

  // Namespace import (rare): import * as Icons from 'lucide-react'
  // If user writes Icons.Coffee we can't be sure; but check for that usage too
  const nsImport = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]lucide-react['"]/.exec(code);
  if (nsImport) {
    const ns = nsImport[1];
    const nsUse = new RegExp(`\\b${ns}\\s*\\.\\s*${icon}\\b`).test(code);
    if (nsUse) return true;
  }
  return false;
}

async function main() {
  const files = await walk(BASE_DIR);
  const missing = [];

  for (const file of files) {
    const code = await fs.readFile(file, "utf8");
    const missingInFile = TARGET_ICONS.filter(
      (icon) => hasIconUsage(code, icon) && !hasLucideImportFor(code, icon)
    );
    if (missingInFile.length) {
      missing.push({ file, icons: missingInFile });
    }
  }

  if (!missing.length) {
    console.log("✅ No missing lucide-react icon imports. All good!");
    process.exit(0);
  }

  console.log("❌ Missing lucide-react icon imports detected:\n");
  for (const { file, icons } of missing) {
    console.log(`- ${file}`);
    for (const icon of icons) console.log(`    ↳ missing: ${icon}`);
  }
  console.log(
    `\nTip: run "npm run fix:coffee" for Coffee only, or:\n  node tools/fix-missing-coffee-imports.js ${TARGET_ICONS.join(
      " "
    )}\nto auto-fix these files.`
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
