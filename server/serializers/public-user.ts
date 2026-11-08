import type { User } from "@shared/schema";
import { publicAvatarValue } from "../lib/inline-avatar";

/** Public social identity only; catering and authentication fields are deliberately excluded. */
export function serializePublicUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    royalTitle: user.royalTitle,
    // Inline base64 avatars become a short cached URL instead of being embedded in every response.
    avatar: publicAvatarValue(user.id, user.avatar),
    bio: user.bio,
    specialty: user.specialty,
    isChef: user.isChef,
    isPrivate: user.isPrivate,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    postsCount: user.postsCount,
  };
}

