// tools/fix-filenames.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "client", "src");

const TARGET_DIRS = [
  path.join(SRC_DIR, "components"),
  path.join(SRC_DIR, "components", "ui"),
  path.join(SRC_DIR, "pages"),
  path.join(SRC_DIR, "lib"),
  path.join(SRC_DIR, "hooks")
];

const exts = [".tsx", ".ts", ".jsx", ".js"];

function pascalToKebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      yield* walk(abs);
    } else if (/\.(tsx|ts|jsx|js)$/.test(name)) {
      yield abs;
    }
  }
}

const moves = [];

for (const base of TARGET_DIRS) {
  for (const abs of walk(base)) {
    const dir = path.dirname(abs);
    const baseName = path.basename(abs).replace(/\.(tsx|ts|jsx|js)$/, "");
    const ext = path.extname(abs);
    if (!/[A-Z]/.test(baseName)) continue;

    const kebab = pascalToKebab(baseName); // PostCard -> post-card
    const target = path.join(dir, `${kebab}${ext}`);

    if (fs.existsSync(target)) continue; // already have a kebab file here
    moves.push([abs, target]);
  }
}

if (moves.length === 0) {
  console.log("No filenames need renaming.");
  process.exit(0);
}

console.log("Planned renames:");
moves.forEach(([from, to]) =>
  console.log("  ", path.relative(ROOT, from), "→", path.relative(ROOT, to))
);

// Perform renames
for (const [from, to] of moves) {
  fs.renameSync(from, to);
}
console.log("✅ Renamed", moves.length, "file(s).");
