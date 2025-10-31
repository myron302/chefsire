// tools/fix-missing-coffee-imports.js
// ESM-friendly (package.json has "type":"module")
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ARGS = process.argv.slice(2).filter(Boolean);

// icons to fix (default Coffee)
const ICONS = ARGS.length && !ARGS[0].includes(".tsx") && !ARGS[0].includes(".ts")
  ? ARGS.filter((a) => !a.endsWith(".tsx") && !a.endsWith(".ts"))
  : ["Coffee"];

// optional explicit file paths after icons
const EXPLICIT_FILES = ARGS.filter((a) => a.endsWith(".tsx") || a.endsWith(".ts"));

const BASE_DIR = process.env.ICON_FIX_DIR || path.resolve("client/src");

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

function needsIcon(code, icon) {
  const usage = new RegExp(`\\b${icon}\\b`).test(code);
  if (!usage) return false;
  const imported = new RegExp(
    `import\\s+{[^}]*\\b${icon}\\b[^}]*}\\s+from\\s+['"]lucide-react['"]`
  ).test(code);
  if (imported) return false;

  // namespace import?
  const nsImport = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]lucide-react['"]/.exec(code);
  if (nsImport) {
    const ns = nsImport[1];
    const nsUse = new RegExp(`\\b${ns}\\s*\\.\\s*${icon}\\b`).test(code);
    if (nsUse) return false;
  }
  return true;
}

function insertNamedIntoExisting(line, iconsToAdd) {
  // line example: import { A, B, C } from 'lucide-react'
  return line.replace(
    /import\s+{([^}]*)}\s+from\s+(['"])lucide-react\2/,
    (m, inside, quote) => {
      const names = inside
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const set = new Set(names);
      for (const i of iconsToAdd) set.add(i);
      const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
      return `import { ${sorted.join(", ")} } from ${quote}lucide-react${quote}`;
    }
  );
}

function addOrExtendLucideImport(code, iconsToAdd) {
  // 1) If there is an existing named lucide import, extend it
  const namedRe = /import\s+{[^}]*}\s+from\s+['"]lucide-react['"]\s*;?/;
  if (namedRe.test(code)) {
    let done = false;
    const lines = code.split(/\r?\n/).map((line) => {
      if (!done && namedRe.test(line)) {
        done = true;
        return insertNamedIntoExisting(line, iconsToAdd);
      }
      return line;
    });
    return lines.join("\n");
  }

  // 2) If there is a namespace lucide import, add a separate named line (safe)
  const nsRe = /import\s+\*\s+as\s+\w+\s+from\s+['"]lucide-react['"]\s*;?/;
  const importLine = `import { ${iconsToAdd.join(", ")} } from "lucide-react";`;
  if (nsRe.test(code)) {
    // insert after the last import line
    const lines = code.split(/\r?\n/);
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*import\s+/.test(lines[i])) lastImport = i;
    }
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, importLine);
      return lines.join("\n");
    }
    return `${importLine}\n${code}`;
  }

  // 3) No lucide import at all → add new named import after last import or at top
  const lines = code.split(/\r?\n/);
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s+/.test(lines[i])) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, importLine);
    return lines.join("\n");
  }
  return `${importLine}\n${code}`;
}

async function fixFile(file, icons) {
  const code = await fs.readFile(file, "utf8");
  const needed = icons.filter((icon) => needsIcon(code, icon));
  if (!needed.length) return false;

  const newCode = addOrExtendLucideImport(code, needed);
  await fs.writeFile(file, newCode, "utf8");
  return true;
}

async function main() {
  const files = EXPLICIT_FILES.length ? EXPLICIT_FILES : await walk(BASE_DIR);

  console.log(`[fix-coffee] scanning under: ${EXPLICIT_FILES.length ? "(explicit files)" : BASE_DIR}`);
  let changed = 0;

  for (const file of files) {
    const did = await fixFile(file, ICONS);
    if (did) {
      changed++;
      console.log(`✔ fixed: ${file}`);
    }
  }

  console.log(`[fix-coffee] done. files changed: ${changed}/${files.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
