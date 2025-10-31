// tools/check-missing-icon-imports.js
// ESM-friendly (package.json has "type":"module")
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

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
