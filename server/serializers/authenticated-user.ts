import type { User } from "../../shared/schema";

/** The one non-sensitive user shape used to hydrate authenticated clients. */
export function serializeAuthenticatedUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    royalTitle: user.royalTitle,
    avatar: user.avatar,
    bio: user.bio,
    isPrivate: user.isPrivate,
    subscriptionTier: user.subscriptionTier,
    nutritionPremium: user.nutritionPremium,
    nutritionTrialEndsAt: user.nutritionTrialEndsAt,
    // Explicit null/false values keep these keys present after JSON serialization
    // for ordinary and legacy users while preserving every persisted value exactly.
    specialty: user.specialty ?? null,
    cateringEnabled: user.cateringEnabled ?? false,
    cateringLocation: user.cateringLocation ?? null,
    cateringLatitude: user.cateringLatitude ?? null,
    cateringLongitude: user.cateringLongitude ?? null,
    cateringRadius: user.cateringRadius ?? null,
    cateringBio: user.cateringBio ?? null,
    cateringAvailable: user.cateringAvailable ?? false,
  };
}
