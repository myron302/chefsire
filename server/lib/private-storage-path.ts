import fs from "fs";
import path from "path";

/**
 * Path safety for private booking storage, kept free of every other import so it can be reasoned about and tested
 * deterministically -- no environment, no module-level side effects.
 *
 * The invariant it protects is narrow and concrete. `server/app.ts` mounts TWO unauthenticated `express.static`
 * roots: the uploads directory at `/uploads`, and the built client bundle at `/`. Either one serves any file at or
 * beneath it to anyone. A booking document is private only if its bytes can never land inside EITHER tree, so the
 * check below takes the whole set of public static roots rather than the uploads directory alone -- a private root
 * under the client build directory is exactly as exposed as one under uploads.
 *
 * "Inside" has to mean physically inside, not lexically inside. `PRIVATE_STORAGE_DIR=/safe-looking/private` passes
 * any purely lexical test even when `/safe-looking/private` is a symlink to the public uploads directory -- and the
 * files then land in the publicly served tree regardless of how the path was spelled. So both roots are resolved
 * through the filesystem before they are compared.
 */

/**
 * Whether `candidate` is `base` itself or lives beneath it, comparing already-canonical absolute paths.
 *
 * The comparison is a path-relative containment test, never a string prefix: `path.relative` answers in terms of
 * path segments, which is what makes `/var/uploads-private` correctly NOT contained in `/var/uploads` where a naive
 * `startsWith` would say it is. Platform separator differences are handled by `path` itself.
 */
export function isSameOrInside(candidate: string, base: string): boolean {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedBase = path.resolve(base);
  const relative = path.relative(resolvedBase, resolvedCandidate);
  if (relative === "") return true;
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

/**
 * The physical location a path refers to, for a path that is allowed not to exist yet.
 *
 * `fs.realpathSync` requires the whole path to exist, but a private storage root is legitimately created on first
 * write. So the nearest existing ancestor is canonicalized -- which is what resolves any symlink in the path,
 * including one several segments up -- and the not-yet-created suffix is rebuilt beneath that canonical ancestor.
 * The result is where the directory WILL physically live once created, which is exactly what must be compared.
 *
 * Throws if canonicalization fails for any reason other than a missing path (a permission error, a symlink loop).
 * Callers must fail closed on that: a root whose real location cannot be established is not known to be private.
 */
export function canonicalizePath(target: string): string {
  const resolved = path.resolve(target);
  const suffix: string[] = [];
  let current = resolved;
  for (;;) {
    try {
      const real = fs.realpathSync(current);
      return suffix.length === 0 ? real : path.join(real, ...suffix);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // Only a genuinely absent path may be walked past. Anything else -- EACCES, ELOOP, ENOTDIR -- means the real
      // location cannot be established, and guessing it would be exactly the assumption this module exists to avoid.
      if (code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      // A filesystem root that does not resolve cannot be walked further; the lexical path is all there is.
      if (parent === current) return resolved;
      suffix.unshift(path.basename(current));
      current = parent;
    }
  }
}

/**
 * Why a private root may not be used, or null when it is safe. Every comparison is against canonicalized targets,
 * so a symlinked alias is judged by where it actually points rather than by how it is spelled.
 *
 * - `same` and `inside_public`: every booking document written under this root lands beneath the public static
 *   mount, so all of them would be downloadable by anyone who can guess a key. Directly exposed.
 * - `contains_public`: the public uploads tree sits inside the private tree. Today's storage keys all begin
 *   `catering-bookings/`, so nothing is exposed *yet* -- but whether a private file is public then depends on
 *   arithmetic between a key prefix and an unrelated environment variable, and a later key change or a moved
 *   UPLOADS_DIR would silently start serving booking documents. This is rejected as well, so the guarantee is the
 *   simple one an operator can actually verify: the two trees do not overlap.
 * - `unresolvable`: canonicalization itself failed, so the real relationship could not be established. Treated as
 *   unsafe rather than assumed private.
 */
export type PrivateRootConflict = "same" | "inside_public" | "contains_public" | "unresolvable";

export function privateRootConflict(privateRoot: string, publicUploadsRoot: string): PrivateRootConflict | null {
  let realPrivate: string;
  let realPublic: string;
  try {
    realPrivate = canonicalizePath(privateRoot);
    realPublic = canonicalizePath(publicUploadsRoot);
  } catch {
    return "unresolvable";
  }
  if (realPrivate === realPublic) return "same";
  if (isSameOrInside(realPrivate, realPublic)) return "inside_public";
  if (isSameOrInside(realPublic, realPrivate)) return "contains_public";
  return null;
}

const CONFLICT_REASONS: Record<PrivateRootConflict, (label: string) => string> = {
  same: (label) => `it resolves to the ${label} itself`,
  inside_public: (label) => `it resolves inside the ${label}`,
  contains_public: (label) => `it contains the ${label}`,
  unresolvable: () => "its real filesystem location could not be established, so it cannot be shown to be private",
};

/**
 * One unauthenticated static root, named so an operator reading a startup failure knows which mount is at issue.
 * The set is enumerated in `public-static-dirs.ts`, which `server/app.ts` itself consumes.
 */
export type PublicStaticRoot = { label: string; path: string };

/**
 * The first public static root the private root conflicts with, or null when it is isolated from all of them.
 *
 * Every root is checked, not merely the one currently being served: which client build directory Express picks
 * depends on the process working directory, so a private root that is safe today only because a candidate does not
 * exist yet is not safe. An `unresolvable` answer counts as a conflict for the same fail-closed reason a single
 * root does -- an unverifiable relationship is not evidence of separation.
 */
export function firstPrivateRootConflict(privateRoot: string, publicRoots: readonly PublicStaticRoot[]): { root: PublicStaticRoot; conflict: PrivateRootConflict } | null {
  for (const root of publicRoots) {
    const conflict = privateRootConflict(privateRoot, root.path);
    if (conflict) return { root, conflict };
  }
  return null;
}

/**
 * Fails closed on an unsafe private root.
 *
 * An explicitly configured PRIVATE_STORAGE_DIR that overlaps any publicly served tree is a configuration error, not
 * something to work around: silently relocating the storage would leave the operator believing their chosen
 * directory is in use, and continuing would serve booking documents from an unauthenticated static mount. The
 * message names the offending mount and both canonical paths, so an alias is diagnosable even when the configured
 * spelling looked fine.
 */
export function assertPrivateRootIsolatedFrom(privateRoot: string, publicRoots: readonly PublicStaticRoot[]): void {
  const found = firstPrivateRootConflict(privateRoot, publicRoots);
  if (!found) return;
  const describe = (target: string) => {
    try {
      const real = canonicalizePath(target);
      return real === path.resolve(target) ? real : `${path.resolve(target)} -> ${real}`;
    } catch {
      return path.resolve(target);
    }
  };
  throw new Error(
    `Private booking storage cannot be used because ${CONFLICT_REASONS[found.conflict](found.root.label)}. ` +
    `Booking documents must never resolve inside a publicly served static tree. ` +
    `Private root: ${describe(privateRoot)}; ${found.root.label}: ${describe(found.root.path)}. ` +
    `Set PRIVATE_STORAGE_DIR to a directory that neither contains nor is contained by any publicly served directory.`,
  );
}

/** The single-root form, kept for the uploads tree the private root was first checked against. */
export function assertPrivateRootIsolated(privateRoot: string, publicUploadsRoot: string): void {
  assertPrivateRootIsolatedFrom(privateRoot, [{ label: "public uploads directory", path: publicUploadsRoot }]);
}
