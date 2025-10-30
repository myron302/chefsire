// tools/check-missing-coffee.js
// Lists TSX files that reference Coffee but don't import it.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const SRC_DIR = path.join(repoRoot, "client", "src");
const SCAN_DIRS = [path.join(SRC_DIR, "pages", "drinks")];

async function walk(dir) {
  let out = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) out = out.concat(await walk(full));
      else if (e.isFile() && full.endsWith(".tsx")) out.push(full);
    }
  } catch {}
  return out;
}

function isMissing(content) {
  const uses = /\bCoffee\b/.test(content);
  const imported = /import\s*{[^}]*\bCoffee\b[^}]*}\s*from\s*['"]lucide-react['"]/.test(content);
  return uses && !imported;
}

(async () => {
  const files = (await Promise.all(SCAN_DIRS.map(walk))).flat();
  const missing = [];
  for (const f of files) {
    const src = await readFile(f, "utf8");
    if (isMissing(src)) missing.push(path.relative(repoRoot, f));
  }
  if (!missing.length) {
    console.log("✅ No missing Coffee imports.");
  } else {
    console.log("❌ Missing Coffee imports in:");
    missing.forEach((m) => console.log(" -", m));
    process.exitCode = 1;
  }
})();
