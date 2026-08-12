import { z } from "zod";

export type CoverUploadDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 403 | 404; message: string };

/** Pure authorization gate used before a cover file is persisted. */
export function authorizePackageCoverUpload(
  viewerId: string,
  routeProviderId: string,
  packageId: string,
  foundPackage: { providerId: string } | undefined,
): CoverUploadDecision {
  if (viewerId !== routeProviderId) {
    return { allowed: false, status: 403, message: "You can only manage your own packages" };
  }
  if (!z.string().uuid().safeParse(packageId).success) {
    return { allowed: false, status: 400, message: "Invalid package ID" };
  }
  if (!foundPackage) return { allowed: false, status: 404, message: "Package not found" };
  if (foundPackage.providerId !== viewerId) {
    return { allowed: false, status: 403, message: "You do not own this package" };
  }
  return { allowed: true };
}
