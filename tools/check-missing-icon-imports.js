// tools/check-missing-icon-imports.js
// Lists every TSX file that USES an icon (e.g. Coffee) but does NOT import it from "lucide-react".
// Usage:
//   node tools/check-missing-icon-imports.js            # checks for Coffee by default
//   node tools/check-missing-icon-imports.js Coffee     # explicit single icon
//   node tools/check-missing-icon-imports.js Coffee Wine Martini  # multiple icons
//
// Exit code:
//   0 => no missing imports
//   1 => at least one file is missing at least one icon import

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const SRC_DIR = path.join(repoRoot, "client", "src");

// Directories to scan (add more if you like).
const SCAN_DIRS = [
  path.join(SRC_DIR, "pages", "drinks"),
  path.join(SRC_DIR, "pages", "recipes"),
  path.join(SRC_DIR, "pages", "social"),
  path.join(SRC_DIR, "components"),
];

const ICONS = process.argv.slice(2).length ? process.argv.slice(2) : ["Coffee"];

// ---------------- helpers ----------------
async function walk(dir) {
  let out = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        out = out.concat(await walk(full));
      } else if (e.isFile() && full.endsWith(".tsx")) {
        out.push(full);
      }
    }
  } catch {
    // dir may not exist; ignore
  }
  return out;
}

function fileUsesIcon(src, icon) {
  // Looks for the bare identifier (JSX or object use)
  return new RegExp(`\\b${icon}\\b`).test(src);
}

function fileImportsIcon(src, icon) {
  // Looks for an existing lucide-react named import that includes this icon
  return new RegExp(
    `import\\s*{[^}]*\\b${icon}\\b[^}]*}\\s*from\\s*['"]lucide-react['"]`,
    "m"
  ).test(src);
}

// ---------------- main ----------------
(async () => {
  const files = (await Promise.all(SCAN_DIRS.map(walk))).flat();

  const results = [];
  for (const file of files) {
    const src = await readFile(file, "utf8");
    const missing = [];
    for (const icon of ICONS) {
      if (fileUsesIcon(src, icon) && !fileImportsIcon(src, icon)) {
        missing.push(icon);
      }
    }
    if (missing.length) {
      results.push({ file, missing });
    }
  }

  if (!results.length) {
    console.log(`✅ No missing ${ICONS.join(", ")} imports found.`);
    process.exit(0);
  }

  console.log("❌ Missing lucide-react icon imports detected:\n");
  for (const r of results) {
    const rel = path.relative(repoRoot, r.file);
    console.log(`- ${rel}`);
    console.log(`    ↳ missing: ${r.missing.join(", ")}`);
  }
  console.log(
    `\nTip: run "npm run fix:coffee" for Coffee only, or:\n` +
      `  node tools/fix-missing-coffee-imports.js ${ICONS.join(" ")}\n` +
      `to auto-fix these files.`
  );
  process.exit(1);
})().catch((e) => {
  console.error("check-missing-icon-imports failed:", e);
  process.exit(1);
});
