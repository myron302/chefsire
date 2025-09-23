// tools/generate-import-shims.js
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

const tsExts = [".tsx", ".ts", ".jsx", ".js"];

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

function ensureFile(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, "", "utf8");
}

const created = [];

for (const base of TARGET_DIRS) {
  for (const file of walk(base)) {
    const rel = path.relative(SRC_DIR, file);
    const dir = path.dirname(rel);
    const baseName = path.basename(file).replace(/\.(tsx|ts|jsx|js)$/, "");

    // Only care about PascalCase or camel names that people often import in kebab
    if (!/[A-Z]/.test(baseName)) continue;

    const kebab = pascalToKebab(baseName); // e.g. PostCard -> post-card
    const shimPath = path.join(SRC_DIR, dir, `${kebab}.ts`);

    // Skip if a real lower-case file already exists
    const candidates = tsExts.map((e) =>
      path.join(SRC_DIR, dir, `${kebab}${e}`)
    );
    if (candidates.some((c) => fs.existsSync(c))) continue;

    // Write a one-line re-export shim
    const relFromShim = path
      .relative(path.dirname(shimPath), file)
      .replace(/\\/g, "/")
      .replace(/\.(tsx|ts|jsx|js)$/, "");

    const content =
      `// AUTO-GENERATED SHIM. Do not edit.\n` +
      `export * from "./${relFromShim}";\n` +
      `export { default } from "./${relFromShim}";\n`;

    ensureFile(shimPath);
    fs.writeFileSync(shimPath, content, "utf8");
    created.push(path.relative(ROOT, shimPath));
  }
}

console.log("Generating import shims…");
if (created.length) {
  for (const c of created) console.log("  +", c);
  console.log("Done.");
  process.exit(0);
} else {
  console.log("No shims needed.");
  process.exit(0);
}
