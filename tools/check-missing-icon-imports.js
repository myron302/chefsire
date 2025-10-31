// tools/check-missing-icon-imports.js
// Usage:
//   node tools/check-missing-icon-imports.js Coffee
//   npm run check:coffee    (if package.json maps to this)

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Icon to check
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

// We only consider it a REAL icon usage if one of these is present:
//  1) JSX:          <Coffee ... />
//  2) Object:       icon: Coffee
//  3) Namespace:    Icons.Coffee  (with `import * as Icons from "lucide-react"`)
function usesIcon(code, icon) {
  const jsxTag = new RegExp(`<\\s*${icon}\\b`);
  const objectIcon = new RegExp(`\\bicon\\s*:\\s*${icon}\\b`);
  const nsUse = new RegExp(`\\bIcons\\.${icon}\\b`);
  return jsxTag.test(code) || objectIcon.test(code) || nsUse.test(code);
}

// Already imported if:
//  A) Named import:       import { ..., Coffee, ... } from "lucide-react"
//  B) Namespace import:   import * as Icons from "lucide-react" AND code uses Icons.Coffee
function hasIconImported(code, icon) {
  const named = new RegExp(
    `import\\s*\\{[^}]*\\b${icon}\\b[^}]*\\}\\s*from\\s*['"]lucide-react['"]`
  );
  const nsImport = /import\s*\*\s*as\s*Icons\s*from\s*['"]lucide-react['"]/;

  if (named.test(code)) return true;
  if (nsImport.test(code) && new RegExp(`\\bIcons\\.${icon}\\b`).test(code)) return true;
  return false;
}

const files = listFiles(TARGET_DIR);
const missing = [];

for (const file of files) {
  const code = read(file);
  if (!code) continue;
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
  `\nTip: run "npm run fix:${ICON.toLowerCase()}" for ${ICON} only, or:\n` +
  `  node tools/fix-missing-coffee-imports.js ${ICON}\n` +
  "to auto-fix these files."
);
process.exit(1);
