import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * The single source of truth for the directories ChefSire serves to unauthenticated clients.
 *
 * `server/app.ts` mounts two `express.static` roots and neither is behind any authentication: UPLOADS_DIR at
 * `/uploads`, and the built client bundle at `/`. Both are enumerated here, and app.ts consumes this module rather
 * than keeping its own copy of the list, so the security validator in `private-storage-path.ts` cannot drift away
 * from the real production static configuration. A new static mount belongs in this module, which is what makes it
 * automatically part of the private-storage isolation check instead of silently outside it.
 *
 * This module deliberately imports nothing but `fs`, `path` and `url`: it must be usable from the storage layer at
 * module-initialization time without dragging in the app, the router, or the database.
 */

/** The location of this module, which esbuild collapses to the bundled server entrypoint in production. */
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Every place the built client bundle might live, in the order app.ts probes them.
 *
 * The client bundle is served with `express.static`, so a private storage root resolving into ANY of these is
 * exposed the moment that candidate becomes the one in use -- and which candidate wins depends on the process's
 * working directory, which is not a property of the storage configuration at all. So the isolation check considers
 * all of them rather than only the one that happens to exist right now: a private root is safe only if it is safe
 * whichever candidate the server ends up serving.
 *
 * The module-relative candidate is anchored here rather than in app.ts. Production bundles the whole server into
 * `server/dist/index.js`, so `import.meta.url` is that one file for every module and the resolution is identical;
 * under tsx it resolves to the repository's own `dist/public`, which is the directory it was always meant to name.
 */
export const CLIENT_STATIC_DIR_CANDIDATES: readonly string[] = Array.from(new Set([
  path.resolve(process.cwd(), "dist/public"),      // If running from project root
  path.resolve(process.cwd(), "../dist/public"),   // If running from server/ directory
  path.resolve(moduleDir, "../../dist/public"),    // Relative to the bundled server location
]));

/** The client directory Express will actually serve: the first candidate that exists, or null when none does. */
export function resolveClientStaticDir(): string | null {
  for (const dir of CLIENT_STATIC_DIR_CANDIDATES) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}
