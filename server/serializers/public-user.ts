import type { User } from "@shared/schema";

/** Public social identity only; catering and authentication fields are deliberately excluded. */
export function serializePublicUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    royalTitle: user.royalTitle,
    avatar: user.avatar,
    bio: user.bio,
    specialty: user.specialty,
    isChef: user.isChef,
    isPrivate: user.isPrivate,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    postsCount: user.postsCount,
  };
}

