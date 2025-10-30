// tools/fix-missing-coffee-imports.js
// Bulk-fixes files that USE `Coffee` but forgot to import it from "lucide-react".
// Safe: only adds Coffee to an existing lucide import OR inserts a new import.
// ESM script (package.json has "type":"module").

import { promises as fs } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const SEARCH_DIR = join(ROOT, "client", "src", "pages", "drinks");

// Recursively collect all .tsx files under SEARCH_DIR
async function listTsxFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      const kids = await listTsxFiles(p);
      out.push(...kids);
    } else if (e.isFile() && e.name.endsWith(".tsx")) {
      out.push(p);
    }
  }
  return out;
}

const HAS_COFFEE_IMPORT_RE =
  /import\s*{\s*([^}]*)\s*}\s*from\s*['"]lucide-react['"]\s*;?/m;
const COFFEE_IN_IMPORT_LIST_RE = /\bCoffee\b/;
const HAS_ANY_IMPORT_RE = /^\s*import\s/m;

// crude check to see if the file references Coffee symbol anywhere
const USES_COFFEE_RE = /(^|[^.$\w])Coffee([^$\w]|$)/m;

function addCoffeeToImport(importLine) {
  // import { A, B, C } from "lucide-react"
  const m = importLine.match(HAS_COFFEE_IMPORT_RE);
  if (!m) return null;

  const inner = m[1]; // "A, B, C"
  // split items by comma, preserve ordering, trim
  const parts = inner
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!parts.includes("Coffee")) {
    parts.push("Coffee");
  }

  const rebuilt = importLine.replace(
    HAS_COFFEE_IMPORT_RE,
    `import { ${parts.join(", ")} } from "lucide-react";`
  );
  return rebuilt;
}

function insertCoffeeImportAtTop(source) {
  // place after the last import statement for neatness
  const lines = source.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImportIdx = i;
    else if (lastImportIdx !== -1 && lines[i].trim() && !/^\s*\/\//.test(lines[i])) {
      // we hit a non-import non-empty line → stop scanning
      break;
    }
  }
  const coffeeImport = `import { Coffee } from "lucide-react";`;
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, coffeeImport);
  } else {
    // no imports found at all; put it at very top
    lines.unshift(coffeeImport);
  }
  return lines.join("\n");
}

async function processFile(path) {
  let src = await fs.readFile(path, "utf8");

  // If file does not use Coffee symbol at all, skip.
  if (!USES_COFFEE_RE.test(src)) {
    return { path, changed: false, reason: "no Coffee usage" };
  }

  // If it already imports Coffee from lucide-react, skip.
  const lucideImportMatch = src.match(HAS_COFFEE_IMPORT_RE);
  if (lucideImportMatch && COFFEE_IN_IMPORT_LIST_RE.test(lucideImportMatch[1])) {
    return { path, changed: false, reason: "already imports Coffee" };
  }

  let newSrc = src;

  if (lucideImportMatch) {
    // Add Coffee to existing lucide named import
    const fullImportLine = lucideImportMatch[0];
    const rebuilt = addCoffeeToImport(fullImportLine);
    if (rebuilt && rebuilt !== fullImportLine) {
      newSrc = newSrc.replace(fullImportLine, rebuilt);
    }
  } else {
    // No lucide named import; just insert a new line after last import
    newSrc = insertCoffeeImportAtTop(newSrc);
  }

  if (newSrc !== src) {
    // optional: write a .bak once (comment out if not wanted)
    // await fs.writeFile(path + ".bak", src, "utf8");
    await fs.writeFile(path, newSrc, "utf8");
    return { path, changed: true };
  } else {
    return { path, changed: false, reason: "no edit needed" };
  }
}

async function main() {
  console.log(`[fix-coffee] scanning under: ${SEARCH_DIR}`);
  let files = [];
  try {
    files = await listTsxFiles(SEARCH_DIR);
  } catch (e) {
    console.error(`[fix-coffee] ERROR: cannot read ${SEARCH_DIR}`, e);
    process.exit(1);
  }

  let changed = 0;
  for (const f of files) {
    try {
      const res = await processFile(f);
      if (res.changed) {
        changed++;
        console.log(`✔ fixed: ${f}`);
      } else {
        // uncomment for verbose:
        // console.log(`skip: ${f} (${res.reason})`);
      }
    } catch (e) {
      console.warn(`⚠ failed: ${f}`, e?.message || e);
    }
  }
  console.log(`[fix-coffee] done. files changed: ${changed}/${files.length}`);
}

main().catch((e) => {
  console.error("[fix-coffee] fatal", e);
  process.exit(1);
});
