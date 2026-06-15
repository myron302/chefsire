/**
 * Single source of truth for the uploads directory path.
 *
 * Path calculation (stable regardless of process.cwd()):
 *   server/lib/uploads-dir.ts  (this file, or server/dist/index.js in the esbuild bundle)
 *   ../   → server/
 *   ../../ → project root  (= domain root on the Plesk server, sibling of httpdocs)
 *   ../../uploads → project-root/uploads/
 *
 * In the esbuild bundle (server/dist/index.js), import.meta.url resolves to
 * server/dist/index.js, so ../.. from server/dist/ also lands at the project root —
 * the path is consistent between `tsx` (dev) and the compiled bundle (prod).
 */
import { fileURLToPath } from "url";
import path from "path";
import { mkdirSync, existsSync } from "fs";

export const UPLOADS_DIR: string = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../uploads"
);

// Ensure the directory exists at import time so every module can rely on it.
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

/** Returns the URL path for a filename stored in UPLOADS_DIR. */
export function uploadUrlPath(filename: string): string {
  return `/uploads/${filename}`;
}
