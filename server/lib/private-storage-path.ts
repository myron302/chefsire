import path from "path";

/**
 * Path safety for private booking storage, kept free of every other import so it can be reasoned about and tested
 * deterministically -- no environment, no filesystem, no module-level side effects.
 *
 * The invariant it protects is narrow and concrete. `server/app.ts` mounts `express.static(UPLOADS_DIR)` at
 * `/uploads`, which serves any file at or beneath the canonical public uploads root to anyone, with no
 * authentication at all. A booking document is private only if its path can never resolve inside that tree.
 */

/**
 * Whether `candidate` is `base` itself or lives beneath it.
 *
 * The comparison is a path-relative containment test, never a string prefix: `path.resolve` first collapses `..`,
 * repeated separators, trailing separators and relative segments into a canonical absolute path, and
 * `path.relative` then answers in terms of path segments. That is what makes `/var/uploads-private` correctly NOT
 * contained in `/var/uploads`, which a naive `startsWith` would get wrong, while `/var/uploads/a/../b` is correctly
 * recognised as contained. Platform separator differences are handled by `path` itself rather than by us.
 */
export function isSameOrInside(candidate: string, base: string): boolean {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedBase = path.resolve(base);
  const relative = path.relative(resolvedBase, resolvedCandidate);
  if (relative === "") return true;
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

/**
 * Why a private root may not be used, or null when it is safe.
 *
 * - `same` and `inside_public`: every booking document written under this root resolves beneath the public static
 *   mount, so all of them would be downloadable by anyone who can guess a key. Directly exposed.
 * - `contains_public`: the public uploads tree sits inside the private tree. Today's storage keys all begin
 *   `catering-bookings/`, so nothing is exposed *yet* -- but whether a private file is public then depends on
 *   arithmetic between a key prefix and an unrelated environment variable, and a later key change or a moved
 *   UPLOADS_DIR would silently start serving booking documents. This is rejected as well, so the guarantee is the
 *   simple one an operator can actually verify: the two trees do not overlap.
 */
export type PrivateRootConflict = "same" | "inside_public" | "contains_public";

export function privateRootConflict(privateRoot: string, publicUploadsRoot: string): PrivateRootConflict | null {
  const resolvedPrivate = path.resolve(privateRoot);
  const resolvedPublic = path.resolve(publicUploadsRoot);
  if (resolvedPrivate === resolvedPublic) return "same";
  if (isSameOrInside(resolvedPrivate, resolvedPublic)) return "inside_public";
  if (isSameOrInside(resolvedPublic, resolvedPrivate)) return "contains_public";
  return null;
}

const CONFLICT_REASONS: Record<PrivateRootConflict, string> = {
  same: "it is the public uploads directory itself",
  inside_public: "it resolves inside the public uploads directory",
  contains_public: "it contains the public uploads directory",
};

/**
 * Fails closed on an unsafe private root.
 *
 * An explicitly configured PRIVATE_STORAGE_DIR that overlaps the public uploads tree is a configuration error, not
 * something to work around: silently relocating the storage would leave the operator believing their chosen
 * directory is in use, and continuing would serve booking documents from an unauthenticated static mount. The
 * message names both resolved paths so the misconfiguration is fixable without reading the code.
 */
export function assertPrivateRootIsolated(privateRoot: string, publicUploadsRoot: string): void {
  const conflict = privateRootConflict(privateRoot, publicUploadsRoot);
  if (!conflict) return;
  throw new Error(
    `Private booking storage cannot be used because ${CONFLICT_REASONS[conflict]}. ` +
    `Booking documents must never resolve inside the publicly served uploads tree. ` +
    `Private root: ${path.resolve(privateRoot)}; public uploads root: ${path.resolve(publicUploadsRoot)}. ` +
    `Set PRIVATE_STORAGE_DIR to a directory that neither contains nor is contained by the uploads directory.`,
  );
}
