// tools/fix-missing-icons.js
// Purpose: add missing lucide-react icon imports (default: Coffee) to any TSX file that uses them.
// Usage examples:
//   node tools/fix-missing-icons.js
//   node tools/fix-missing-icons.js Coffee
//   node tools/fix-missing-icons.js Coffee Beer Martini

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const SRC_DIR = path.join(repoRoot, "client", "src");

// Directories to scan — safe & focused. Add more if needed.
const SCAN_DIRS = [
  path.join(SRC_DIR, "pages", "drinks"),
  path.join(SRC_DIR, "pages", "recipes"),
  path.join(SRC_DIR, "pages", "social"),
];

// Icons to ensure are imported:
const ICONS = process.argv.slice(2).length ? process.argv.slice(2) : ["Coffee"];

// ---------- helpers ----------
async function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out; // dir may not exist
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(await walk(full));
    else if (e.isFile() && full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function needsIcon(content, icon) {
  const isUsed = new RegExp(`\\b${icon}\\b`).test(content);
  if (!isUsed) return false;
  const alreadyImported = new RegExp(
    `import\\s*{[^}]*\\b${icon}\\b[^}]*}\\s*from\\s*['"]lucide-react['"]`,
    "m"
  ).test(content);
  return !alreadyImported;
}

function addIconToExistingLucideImport(importLine, iconsToAdd) {
  // import { A, B } from "lucide-react";
  return importLine.replace(
    /import\s*{([^}]*)}\s*from\s*['"]lucide-react['"]/,
    (m, inside) => {
      const names = inside
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const icon of iconsToAdd) {
        if (!names.includes(icon)) names.push(icon);
      }
      return `import { ${names.join(", ")} } from "lucide-react"`;
    }
  );
}

function injectImports(src, iconsToAdd) {
  const lines = src.split(/\r?\n/);

  // Find lucide-react import (if any)
  let lucideIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/from\s+['"]lucide-react['"]\s*;?\s*$/.test(lines[i])) {
      lucideIdx = i;
      break;
    }
  }

  if (lucideIdx >= 0) {
    // Extend existing lucide import
    lines[lucideIdx] = addIconToExistingLucideImport(lines[lucideIdx], iconsToAdd);
    return lines.join("\n");
  }

  // No lucide import; insert a new one after the last import line
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s+/.test(lines[i])) insertAt = i + 1;
    else if (lines[i].trim() && !lines[i].startsWith("/*") && !lines[i].startsWith("//")) break;
  }
  const newImport = `import { ${iconsToAdd.join(", ")} } from "lucide-react";`;
  lines.splice(insertAt, 0, newImport);
  return lines.join("\n");
}

// ---------- main ----------
(async () => {
  const files = (await Promise.all(SCAN_DIRS.map(walk))).flat();
  let changed = 0;

  for (const file of files) {
    const src = await readFile(file, "utf8");
    const iconsNeeded = ICONS.filter((icon) => needsIcon(src, icon));
    if (!iconsNeeded.length) continue;

    const next = injectImports(src, iconsNeeded);
    if (next !== src) {
      await writeFile(file, next, "utf8");
      changed++;
      console.log(`✔ Fixed: ${path.relative(repoRoot, file)} (+ ${iconsNeeded.join(", ")})`);
    }
  }

  if (!changed) {
    console.log("No missing icon imports found.");
  } else {
    console.log(`\n✅ Completed. ${changed} file(s) updated.`);
  }
})().catch((e) => {
  console.error("❌ fix-missing-icons failed:", e);
  process.exit(1);
});
