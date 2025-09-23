import fs from "fs";
import path from "path";

// Helper to convert to PascalCase
function toPascalCase(filename) {
  return filename
    .replace(/\.[jt]sx?$/, "")
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join("") + path.extname(filename);
}

// Helper to convert to lowercase
function toLowerCase(filename) {
  return filename.toLowerCase();
}

// Directories with special rules
const pascalDirs = ["components", "pages"];
const lowerDirs = ["components/ui", "lib", "hooks", "utils"];

// Recursively walk a directory
function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
    } else {
      const relPath = fullPath.replace(process.cwd() + "/", "");
      const ext = path.extname(entry.name);

      if (![".ts", ".tsx", ".js", ".jsx"].includes(ext)) return;

      let parentDir = path.dirname(relPath);

      if (lowerDirs.some(d => parentDir.includes(d))) {
        const lower = toLowerCase(entry.name);
        if (entry.name !== lower) {
          const newPath = path.join(dir, lower);
          console.log(`Renaming → ${relPath} → ${newPath}`);
          fs.renameSync(fullPath, newPath);
        }
      } else if (pascalDirs.some(d => parentDir.includes(d))) {
        const pascal = toPascalCase(entry.name);
        if (entry.name !== pascal) {
          const newPath = path.join(dir, pascal);
          console.log(`Renaming → ${relPath} → ${newPath}`);
          fs.renameSync(fullPath, newPath);
        }
      }
    }
  });
}

// Run on client/src
walk(path.join(process.cwd(), "client/src"));

console.log("✅ Filename normalization complete!");
