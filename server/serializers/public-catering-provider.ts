import type { User } from "@shared/schema";
import type { PublicCateringProvider } from "@shared/catering";

type ProviderSource = Pick<User,
  "id" | "username" | "displayName" | "avatar" | "specialty" | "cateringBio" |
  "cateringLocation" | "cateringRadius" | "cateringAvailable" | "cateringEnabled"
> & { distance?: number };

/** The single allowlist for data returned by public catering APIs. */
export function serializePublicCateringProvider(provider: ProviderSource): PublicCateringProvider {
  return {
    id: provider.id,
    displayName: provider.displayName?.trim() || provider.username,
    avatar: provider.avatar ?? null,
    specialty: provider.specialty ?? null,
    cateringBio: provider.cateringBio ?? null,
    cateringLocation: provider.cateringLocation ?? null,
    cateringRadius: provider.cateringRadius ?? null,
    cateringAvailable: provider.cateringAvailable ?? false,
    cateringEnabled: provider.cateringEnabled ?? false,
    ...(provider.distance === undefined ? {} : { distance: provider.distance }),
  };
}

