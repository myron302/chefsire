/**
 * Single source of truth for the uploads directory path.
 *
 * Prefer an explicit UPLOADS_DIR in production so Plesk deployments can pin the
 * canonical home-level uploads folder even when the Node app is launched from
 * httpdocs or from a bundled server/dist entrypoint. Without an override, infer
 * the repository/domain root from this module location:
 *
 *   server/lib/uploads-dir.ts  (dev, tsx)          → ../../uploads
 *   server/dist/index.js       (prod, esbuild)     → ../../uploads
 *
 * If the compiled server is deployed under httpdocs/server/dist but the real
 * upload files live beside httpdocs, set UPLOADS_DIR=/path/to/account/uploads.
 */
import { fileURLToPath } from "url";
import path from "path";
import { mkdirSync, existsSync } from "fs";

function resolveUploadsDir(): string {
  const configuredDir = process.env.UPLOADS_DIR?.trim();

  if (configuredDir) {
    return path.resolve(configuredDir);
  }

  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../uploads");
}

export const UPLOADS_DIR: string = resolveUploadsDir();

// Ensure the directory exists at import time so every module can rely on it.
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

/** Returns the URL path for a filename stored in UPLOADS_DIR. */
export function uploadUrlPath(filename: string): string {
  return `/uploads/${filename}`;
}
