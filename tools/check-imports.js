// tools/check-imports.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "client", "src");

// match things like: import X from "@/components/ui/button"
// and: import { X } from "../somewhere"
const IMPORT_RE =
  /(?:import\s+[^'"]+\s+from\s+|import\s*\(\s*)["']([^"']+)["']/g;

const exts = [".tsx", ".ts", ".jsx", ".js"];
const tried = new Set();

const aliasPrefix = "@/";

function resolveImport(importerFile, spec) {
  let target;
  if (spec.startsWith(aliasPrefix)) {
    target = path.join(SRC_DIR, spec.slice(aliasPrefix.length));
  } else if (spec.startsWith(".") || spec.startsWith("/")) {
    target = path.resolve(path.dirname(importerFile), spec);
  } else {
    // external package -> ignore
    return null;
  }

  // Try as file
  for (const ext of exts) {
    const f = target + ext;
    if (fs.existsSync(f)) return f;
  }
  // Try as folder index
  for (const ext of exts) {
    const f = path.join(target, "index" + ext);
    if (fs.existsSync(f)) return f;
  }
  return target; // unresolved path (no ext)
}

function* walk(dir) {
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

const issues = [];

for (const file of walk(SRC_DIR)) {
  const code = fs.readFileSync(file, "utf8");
  let m;
  while ((m = IMPORT_RE.exec(code))) {
    const spec = m[1];
    const resolved = resolveImport(file, spec);
    if (!resolved) continue;
    if (!/\.(tsx|ts|jsx|js)$/.test(resolved)) {
      // unresolved
      const key = `${file} -> ${spec} (${resolved})`;
      if (!tried.has(key)) {
        tried.add(key);
        issues.push({ file, spec, resolved });
      }
    }
  }
}

if (!issues.length) {
  console.log("✅ All imports resolved.");
  process.exit(0);
}

for (const i of issues) {
  console.log("❌ Missing import target:");
  console.log(`  In: ${path.relative(ROOT, i.file)}`);
  console.log(`  Import: ${i.spec}`);
  console.log(
    `  Resolved: ${path.relative(ROOT, i.resolved)}{.tsx|.ts|.jsx|.js}`
  );
}
process.exit(1);
