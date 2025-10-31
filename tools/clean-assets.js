// tools/clean-assets.js
import { rm } from "fs/promises";
import { resolve } from "path";

async function main() {
  const target = resolve(process.cwd(), "dist", "public", "assets");
  try {
    await rm(target, { recursive: true, force: true });
    console.log(`[clean-assets] removed: ${target}`);
  } catch (err) {
    console.error("[clean-assets] failed:", err);
    process.exit(1);
  }
}

main();
