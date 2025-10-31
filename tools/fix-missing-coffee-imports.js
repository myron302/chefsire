// tools/fix-missing-coffee-imports.js
// Usage:
//   node tools/fix-missing-coffee-imports.js Coffee
//   npm run fix:coffee    (if package.json maps to this)

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Icon to fix
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
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && isTsLike(full)) out.push(full);
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
function write(file, content) {
  fs.writeFileSync(file, content, "utf8");
}

// --- detection rules (must match the checker) ---
function usesIcon(code, icon) {
  const jsxTag = new RegExp(`<\\s*${icon}\\b`);
  const objectIcon = new RegExp(`\\bicon\\s*:\\s*${icon}\\b`);
  const nsUse = new RegExp(`\\bIcons\\.${icon}\\b`);
  return jsxTag.test(code) || objectIcon.test(code) || nsUse.test(code);
}
function hasNamedIconImport(code, icon) {
  const named = new RegExp(
    `import\\s*\\{[^}]*\\b${icon}\\b[^}]*\\}\\s*from\\s*['"]lucide-react['"]`
  );
  return named.test(code);
}

// If there’s a named lucide import, add the icon into it
function addIconToNamedImport(code, icon) {
  const re = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/m;
  return code.replace(re, (m, group1) => {
    const names = group1
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!names.includes(icon)) names.push(icon);
    const joined = names.join(", ");
    return `import { ${joined} } from "lucide-react"`;
  });
}

// Otherwise, insert a brand-new named import after the last import line
function insertNewImport(code, icon) {
  const newLine = `import { ${icon} } from "lucide-react";\n`;
  const importBlock = code.match(/^(?:import .*\n)+/m);
  if (importBlock) {
    const end = importBlock.index + importBlock[0].length;
    return code.slice(0, end) + newLine + code.slice(end);
  }
  return newLine + code;
}

function fixFile(file, icon) {
  const before = read(file);
  if (!before) return false;

  // Only modify files that truly use the icon
  if (!usesIcon(before, icon)) return false;

  // Already has proper named import?
  if (hasNamedIconImport(before, icon)) return false;

  let after = before;

  if (/import\s*\{[^}]*\}\s*from\s*['"]lucide-react['"]/.test(before)) {
    after = addIconToNamedImport(before, icon);
  } else {
    after = insertNewImport(before, icon);
  }

  if (after !== before) {
    write(file, after);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------

const files = listFiles(TARGET_DIR);
const changed = [];

console.log(`[fix-${ICON.toLowerCase()}] scanning under: ${TARGET_DIR}`);

for (const file of files) {
  try {
    const did = fixFile(file, ICON);
    if (did) {
      console.log(`✔ fixed: ${file}`);
      changed.push(file);
    }
  } catch (e) {
    console.log(`⚠︎ skip (error): ${file} → ${e?.message || e}`);
  }
}

console.log(`[fix-${ICON.toLowerCase()}] done. files changed: ${changed.length}/${files.length}`);
