// server/services/notification-service.ts
// Notification service to send notifications without circular dependencies

import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  creatorMemberships,
  drinkCollectionWishlists,
  follows,
  notifications,
} from "../../shared/schema";

export const DRINK_ALERT_TYPES = {
  wishlistPromo: "drink_collection_wishlist_promo",
  wishlistPriceDrop: "drink_collection_wishlist_price_drop",
  followedCreatorCollection: "drink_collection_followed_creator_launch",
  followedCreatorPromo: "drink_collection_followed_creator_promo",
  followedCreatorPost: "drink_creator_followed_post",
  creatorMemberPost: "drink_creator_member_post",
  followedCreatorDrop: "drink_creator_followed_drop",
  creatorMemberDrop: "drink_creator_member_drop",
  publicCreatorDrop: "drink_creator_public_drop",
} as const;

export type DrinkAlertType = (typeof DRINK_ALERT_TYPES)[keyof typeof DRINK_ALERT_TYPES];

type DrinkAlertInsertInput = {
  userId: string;
  type: DrinkAlertType;
  title: string;
  message: string;
  linkUrl: string;
  imageUrl?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
  metadata?: Record<string, any>;
};

async function sendBulkDrinkAlerts(items: DrinkAlertInsertInput[]) {
  if (!items.length) return;

  try {
    await db.insert(notifications).values(
      items.map((item) => ({
        userId: item.userId,
        type: item.type,
        title: item.title,
        message: item.message,
        linkUrl: item.linkUrl,
        imageUrl: item.imageUrl ?? null,
        priority: item.priority ?? "normal",
        metadata: item.metadata ?? {},
      })),
    );
  } catch (error) {
    console.error("Failed to send bulk drink alerts:", error);
  }
}

async function loadWishlistRecipientIds(collectionId: string, excludedUserId?: string | null) {
  const rows = await db
    .select({ userId: drinkCollectionWishlists.userId })
    .from(drinkCollectionWishlists)
    .where(eq(drinkCollectionWishlists.collectionId, collectionId));

  return [...new Set(
    rows
      .map((row) => row.userId)
      .filter((userId): userId is string => Boolean(userId) && userId !== excludedUserId),
  )];
}

async function loadFollowerRecipientIds(creatorUserId: string, excludedUserId?: string | null) {
  const rows = await db
    .select({ userId: follows.followerId })
    .from(follows)
    .where(eq(follows.followingId, creatorUserId));

  return [...new Set(
    rows
      .map((row) => row.userId)
      .filter((userId): userId is string => Boolean(userId) && userId !== excludedUserId),
  )];
}

async function loadActiveMemberRecipientIds(creatorUserId: string, excludedUserId?: string | null) {
  const now = new Date();
  const rows = await db
    .select({
      userId: creatorMemberships.userId,
      status: creatorMemberships.status,
      endsAt: creatorMemberships.endsAt,
    })
    .from(creatorMemberships)
    .where(eq(creatorMemberships.creatorUserId, creatorUserId));

  return [...new Set(
    rows
      .filter((row) => (row.status === "active" || row.status === "canceled") && (!row.endsAt || row.endsAt > now))
      .map((row) => row.userId)
      .filter((userId): userId is string => Boolean(userId) && userId !== excludedUserId),
  )];
}

export async function sendWishlistPromoAlerts(params: {
  collectionId: string;
  collectionName: string;
  creatorUserId: string;
  creatorUsername?: string | null;
  creatorAvatar?: string | null;
  promotionId: string;
  promotionCode: string;
}) {
  const recipientIds = await loadWishlistRecipientIds(params.collectionId, params.creatorUserId);
  if (!recipientIds.length) return;

  const creatorHandle = params.creatorUsername ? `@${params.creatorUsername}` : "a creator";

  await sendBulkDrinkAlerts(
    recipientIds.map((userId) => ({
      userId,
      type: DRINK_ALERT_TYPES.wishlistPromo,
      title: "A collection on your wishlist is now on sale",
      message: `"${params.collectionName}" from ${creatorHandle} now has an active promo. Use code ${params.promotionCode} at checkout.`,
      linkUrl: `/drinks/collections/${params.collectionId}`,
      imageUrl: params.creatorAvatar ?? null,
      metadata: {
        collectionId: params.collectionId,
        creatorUserId: params.creatorUserId,
        promotionId: params.promotionId,
        promotionCode: params.promotionCode,
        audience: "wishlist",
      },
    })),
  );
}

export async function sendWishlistPriceDropAlerts(params: {
  collectionId: string;
  collectionName: string;
  creatorUserId: string;
  creatorUsername?: string | null;
  creatorAvatar?: string | null;
  previousPriceCents: number;
  nextPriceCents: number;
  currencyCode?: string | null;
}) {
  const recipientIds = await loadWishlistRecipientIds(params.collectionId, params.creatorUserId);
  if (!recipientIds.length) return;

  const creatorHandle = params.creatorUsername ? `@${params.creatorUsername}` : "a creator";

  await sendBulkDrinkAlerts(
    recipientIds.map((userId) => ({
      userId,
      type: DRINK_ALERT_TYPES.wishlistPriceDrop,
      title: "Price dropped on a collection you saved",
      message: `"${params.collectionName}" from ${creatorHandle} dropped from ${(params.previousPriceCents / 100).toFixed(2)} to ${(params.nextPriceCents / 100).toFixed(2)} ${params.currencyCode ?? "USD"}.`,
      linkUrl: `/drinks/collections/${params.collectionId}`,
      imageUrl: params.creatorAvatar ?? null,
      metadata: {
        collectionId: params.collectionId,
        creatorUserId: params.creatorUserId,
        previousPriceCents: params.previousPriceCents,
        nextPriceCents: params.nextPriceCents,
        currencyCode: params.currencyCode ?? "USD",
        audience: "wishlist",
      },
    })),
  );
}

export async function sendFollowedCreatorCollectionLaunchAlerts(params: {
  collectionId: string;
  collectionName: string;
  creatorUserId: string;
  creatorUsername?: string | null;
  creatorAvatar?: string | null;
}) {
  const recipientIds = await loadFollowerRecipientIds(params.creatorUserId, params.creatorUserId);
  if (!recipientIds.length) return;

  const creatorHandle = params.creatorUsername ? `@${params.creatorUsername}` : "A creator";

  await sendBulkDrinkAlerts(
    recipientIds.map((userId) => ({
      userId,
      type: DRINK_ALERT_TYPES.followedCreatorCollection,
      title: "A creator you follow launched a premium collection",
      message: `${creatorHandle} just launched "${params.collectionName}".`,
      linkUrl: `/drinks/collections/${params.collectionId}`,
      imageUrl: params.creatorAvatar ?? null,
      metadata: {
        collectionId: params.collectionId,
        creatorUserId: params.creatorUserId,
        audience: "following",
      },
    })),
  );
}

export async function sendFollowedCreatorPromoAlerts(params: {
  collectionId: string;
  collectionName: string;
  creatorUserId: string;
  creatorUsername?: string | null;
  creatorAvatar?: string | null;
  promotionId: string;
  promotionCode: string;
}) {
  const recipientIds = await loadFollowerRecipientIds(params.creatorUserId, params.creatorUserId);
  if (!recipientIds.length) return;

  const creatorHandle = params.creatorUsername ? `@${params.creatorUsername}` : "A creator";

  await sendBulkDrinkAlerts(
    recipientIds.map((userId) => ({
      userId,
      type: DRINK_ALERT_TYPES.followedCreatorPromo,
      title: "A creator you follow started a promo",
      message: `${creatorHandle} now has a promo on "${params.collectionName}".`,
      linkUrl: `/drinks/collections/${params.collectionId}`,
      imageUrl: params.creatorAvatar ?? null,
      metadata: {
        collectionId: params.collectionId,
        creatorUserId: params.creatorUserId,
        promotionId: params.promotionId,
        promotionCode: params.promotionCode,
        audience: "following",
      },
    })),
  );
}

export async function sendCreatorDropAlerts(params: {
  creatorUserId: string;
  creatorUsername?: string | null;
  creatorAvatar?: string | null;
  dropId: string;
  title: string;
  visibility: "public" | "followers" | "members";
  scheduledFor: string;
}) {
  const creatorHandle = params.creatorUsername ? `@${params.creatorUsername}` : "A creator";
  const linkUrl = `/drinks/drops`;

  if (params.visibility === "members") {
    const recipientIds = await loadActiveMemberRecipientIds(params.creatorUserId, params.creatorUserId);
    if (!recipientIds.length) return;

    await sendBulkDrinkAlerts(
      recipientIds.map((userId) => ({
        userId,
        type: DRINK_ALERT_TYPES.creatorMemberDrop,
        title: "A creator you support scheduled a member drop",
        message: `${creatorHandle} scheduled "${params.title}" for ${new Date(params.scheduledFor).toLocaleString()}.`,
        linkUrl,
        imageUrl: params.creatorAvatar ?? null,
        metadata: {
          creatorUserId: params.creatorUserId,
          dropId: params.dropId,
          visibility: params.visibility,
          scheduledFor: params.scheduledFor,
          audience: "membership",
        },
      })),
    );
    return;
  }

  const recipientIds = params.visibility === "followers"
    ? await loadFollowerRecipientIds(params.creatorUserId, params.creatorUserId)
    : await loadFollowerRecipientIds(params.creatorUserId, params.creatorUserId);

  if (!recipientIds.length) return;

  await sendBulkDrinkAlerts(
    recipientIds.map((userId) => ({
      userId,
      type: params.visibility === "followers" ? DRINK_ALERT_TYPES.followedCreatorDrop : DRINK_ALERT_TYPES.publicCreatorDrop,
      title: params.visibility === "followers" ? "A creator you follow scheduled a drop" : "A creator scheduled a public drop",
      message: `${creatorHandle} scheduled "${params.title}" for ${new Date(params.scheduledFor).toLocaleString()}.`,
      linkUrl,
      imageUrl: params.creatorAvatar ?? null,
      metadata: {
        creatorUserId: params.creatorUserId,
        dropId: params.dropId,
        visibility: params.visibility,
        scheduledFor: params.scheduledFor,
        audience: params.visibility === "followers" ? "following" : "public_followers",
      },
    })),
  );
}

export async function sendLikeNotification(
  postAuthorId: string,
  likerId: string,
  likerName: string,
  likerAvatar: string | null,
  postId: string
) {
  try {
    // Don't notify if user likes their own post
    if (postAuthorId === likerId) return;

    await db.insert(notifications).values({
      userId: postAuthorId,
      type: "like",
      title: "New Like",
      message: `${likerName} liked your post`,
      imageUrl: likerAvatar,
      linkUrl: `/post/${postId}`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send like notification:", error);
  }
}

export async function sendCommentNotification(
  postAuthorId: string,
  commenterId: string,
  commenterName: string,
  commenterAvatar: string | null,
  postId: string,
  commentText: string
) {
  try {
    // Don't notify if user comments on their own post
    if (postAuthorId === commenterId) return;

    await db.insert(notifications).values({
      userId: postAuthorId,
      type: "comment",
      title: "New Comment",
      message: `${commenterName} commented: "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
      imageUrl: commenterAvatar,
      linkUrl: `/post/${postId}`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send comment notification:", error);
  }
}

export async function sendReplyNotification(
  parentCommentAuthorId: string,
  replierId: string,
  replierName: string,
  replierAvatar: string | null,
  postId: string,
  replyText: string
) {
  try {
    // Don't notify if user replies to their own comment
    if (parentCommentAuthorId === replierId) return;

    await db.insert(notifications).values({
      userId: parentCommentAuthorId,
      type: "comment",
      title: "New Reply",
      message: `${replierName} replied: "${replyText.substring(0, 50)}${replyText.length > 50 ? '...' : ''}"`,
      imageUrl: replierAvatar,
      linkUrl: `/post/${postId}`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send reply notification:", error);
  }
}


export async function sendDmNotification(
  recipientUserId: string,
  senderId: string,
  senderName: string,
  senderAvatar: string | null,
  threadId: string,
  messageText: string
) {
  try {
    // Don't notify yourself
    if (recipientUserId === senderId) return;

    const snippet =
      messageText.length > 120 ? messageText.substring(0, 120) + "..." : messageText;

    await db.insert(notifications).values({
      userId: recipientUserId,
      type: "dm",
      title: `New message from ${senderName}`,
      message: snippet,
      imageUrl: senderAvatar,
      linkUrl: `/messages/${threadId}`,
      metadata: { threadId, senderId },
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send DM notification:", error);
  }
}


export async function sendFollowRequestNotification(
  targetUserId: string,
  requesterId: string,
  requesterName: string,
  requesterAvatar: string | null
) {
  try {
    // Don't notify yourself
    if (targetUserId === requesterId) return;

    await db.insert(notifications).values({
      userId: targetUserId,
      type: "follow",
      title: "New Follow Request",
      message: `${requesterName} wants to follow you`,
      imageUrl: requesterAvatar,
      linkUrl: `/profile/${requesterId}`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send follow request notification:", error);
  }
}

export async function sendFollowAcceptedNotification(
  requesterId: string,
  accepterId: string,
  accepterName: string,
  accepterAvatar: string | null
) {
  try {
    // Don't notify yourself
    if (requesterId === accepterId) return;

    await db.insert(notifications).values({
      userId: requesterId,
      type: "follow",
      title: "Follow Request Accepted",
      message: `${accepterName} accepted your follow request`,
      imageUrl: accepterAvatar,
      linkUrl: `/profile/${accepterId}`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send follow accepted notification:", error);
  }
}

export async function sendNewFollowerNotification(
  targetUserId: string,
  followerId: string,
  followerName: string,
  followerAvatar: string | null
) {
  try {
    // Don't notify yourself
    if (targetUserId === followerId) return;

    await db.insert(notifications).values({
      userId: targetUserId,
      type: "follow",
      title: "New Follower",
      message: `${followerName} started following you`,
      imageUrl: followerAvatar,
      linkUrl: `/profile/${followerId}`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send new follower notification:", error);
  }
}

export async function sendHouseholdInviteNotification(
  invitedUserId: string,
  inviterUserId: string,
  inviterName: string,
  inviterAvatar: string | null,
  householdName: string
) {
  try {
    // Don't notify yourself
    if (invitedUserId === inviterUserId) return;

    await db.insert(notifications).values({
      userId: invitedUserId,
      type: "household",
      title: "Household Invite",
      message: `${inviterName} invited you to join "${householdName}"`,
      imageUrl: inviterAvatar,
      linkUrl: `/pantry/household`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send household invite notification:", error);
  }
}

export async function sendHouseholdInviteAcceptedNotification(
  inviterUserId: string,
  accepterUserId: string,
  accepterName: string,
  accepterAvatar: string | null,
  householdName: string
) {
  try {
    // Don't notify yourself
    if (inviterUserId === accepterUserId) return;

    await db.insert(notifications).values({
      userId: inviterUserId,
      type: "household",
      title: "Household Invite Accepted",
      message: `${accepterName} accepted your invite to "${householdName}"`,
      imageUrl: accepterAvatar,
      linkUrl: `/pantry/household`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send household invite accepted notification:", error);
  }
}

// Recipe & Content Notifications
export async function sendRecipeReviewNotification(
  recipeAuthorId: string,
  reviewerId: string,
  reviewerName: string,
  reviewerAvatar: string | null,
  recipeId: string,
  recipeName: string,
  rating: number
) {
  try {
    if (recipeAuthorId === reviewerId) return;

    await db.insert(notifications).values({
      userId: recipeAuthorId,
      type: "review",
      title: "New Recipe Review",
      message: `${reviewerName} gave "${recipeName}" ${rating} stars`,
      imageUrl: reviewerAvatar,
      linkUrl: `/recipes/${recipeId}`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send recipe review notification:", error);
  }
}

export async function sendRecipeSavedNotification(
  recipeAuthorId: string,
  saverId: string,
  saverName: string,
  saverAvatar: string | null,
  recipeId: string,
  recipeName: string
) {
  try {
    if (recipeAuthorId === saverId) return;

    await db.insert(notifications).values({
      userId: recipeAuthorId,
      type: "save",
      title: "Recipe Saved",
      message: `${saverName} saved your recipe "${recipeName}"`,
      imageUrl: saverAvatar,
      linkUrl: `/recipes/${recipeId}`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send recipe saved notification:", error);
  }
}

export async function sendRemixNotification(
  originalAuthorId: string,
  remixerId: string,
  remixerName: string,
  remixerAvatar: string | null,
  remixId: string,
  originalRecipeName: string
) {
  try {
    if (originalAuthorId === remixerId) return;

    await db.insert(notifications).values({
      userId: originalAuthorId,
      type: "remix",
      title: "Recipe Remixed",
      message: `${remixerName} remixed your recipe "${originalRecipeName}"`,
      imageUrl: remixerAvatar,
      linkUrl: `/recipes/${remixId}`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send remix notification:", error);
  }
}

export async function sendDuetNotification(
  originalAuthorId: string,
  dueterId: string,
  dueterName: string,
  dueterAvatar: string | null,
  duetId: string
) {
  try {
    if (originalAuthorId === dueterId) return;

    await db.insert(notifications).values({
      userId: originalAuthorId,
      type: "duet",
      title: "New Duet",
      message: `${dueterName} created a duet with your content`,
      imageUrl: dueterAvatar,
      linkUrl: `/post/${duetId}`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send duet notification:", error);
  }
}

// Pantry Notifications
export async function sendPantryExpiringNotification(
  userId: string,
  itemName: string,
  daysUntilExpiry: number
) {
  try {
    const message = daysUntilExpiry === 0
      ? `${itemName} expires today!`
      : `${itemName} expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}`;

    await db.insert(notifications).values({
      userId,
      type: "pantry",
      title: "Item Expiring Soon",
      message,
      linkUrl: `/pantry`,
      priority: daysUntilExpiry === 0 ? "high" : "normal",
    });
  } catch (error) {
    console.error("Failed to send pantry expiring notification:", error);
  }
}

export async function sendPantryLowStockNotification(
  userId: string,
  itemName: string,
  currentQuantity: number
) {
  try {
    await db.insert(notifications).values({
      userId,
      type: "pantry",
      title: "Low Stock Alert",
      message: `${itemName} is running low (${currentQuantity} left)`,
      linkUrl: `/pantry`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send pantry low stock notification:", error);
  }
}

// Gamification Notifications
export async function sendAchievementUnlockedNotification(
  userId: string,
  achievementName: string,
  achievementDescription: string,
  achievementIcon: string | null
) {
  try {
    await db.insert(notifications).values({
      userId,
      type: "achievement",
      title: "Achievement Unlocked!",
      message: `${achievementName}: ${achievementDescription}`,
      imageUrl: achievementIcon,
      linkUrl: `/achievements`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send achievement notification:", error);
  }
}

export async function sendStreakMilestoneNotification(
  userId: string,
  days: number
) {
  try {
    await db.insert(notifications).values({
      userId,
      type: "streak",
      title: "Streak Milestone!",
      message: `🔥 ${days} day streak! Keep it going!`,
      linkUrl: `/streaks`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send streak milestone notification:", error);
  }
}

export async function sendQuestCompletedNotification(
  userId: string,
  questName: string,
  reward: string
) {
  try {
    await db.insert(notifications).values({
      userId,
      type: "quest",
      title: "Quest Completed!",
      message: `You completed "${questName}" and earned ${reward}`,
      linkUrl: `/quests`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send quest completed notification:", error);
  }
}

// Community Notifications
export async function sendClubInviteNotification(
  invitedUserId: string,
  inviterName: string,
  inviterAvatar: string | null,
  clubName: string,
  clubId: string
) {
  try {
    await db.insert(notifications).values({
      userId: invitedUserId,
      type: "club",
      title: "Club Invitation",
      message: `${inviterName} invited you to join "${clubName}"`,
      imageUrl: inviterAvatar,
      linkUrl: `/clubs/${clubId}`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send club invite notification:", error);
  }
}

export async function sendEventInviteNotification(
  invitedUserId: string,
  inviterName: string,
  inviterAvatar: string | null,
  eventName: string,
  eventId: string,
  eventDate: Date
) {
  try {
    await db.insert(notifications).values({
      userId: invitedUserId,
      type: "event",
      title: "Event Invitation",
      message: `${inviterName} invited you to "${eventName}" on ${eventDate.toLocaleDateString()}`,
      imageUrl: inviterAvatar,
      linkUrl: `/events/${eventId}`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send event invite notification:", error);
  }
}

export async function sendEventReminderNotification(
  userId: string,
  eventName: string,
  eventId: string,
  hoursUntil: number
) {
  try {
    const message = hoursUntil < 1
      ? `"${eventName}" is starting soon!`
      : `"${eventName}" starts in ${hoursUntil} hours`;

    await db.insert(notifications).values({
      userId,
      type: "event",
      title: "Event Reminder",
      message,
      linkUrl: `/events/${eventId}`,
      priority: "high",
    });
  } catch (error) {
    console.error("Failed to send event reminder notification:", error);
  }
}

// Wedding Planner Notifications
export async function sendWeddingRSVPNotification(
  coupleUserId: string,
  guestName: string,
  rsvpStatus: string,
  guestCount: number
) {
  try {
    const acceptedStatuses = ["accepted", "accept-both", "ceremony-only", "reception-only"];
    const statusLabel = rsvpStatus.replace('-', ' ');
    const message = acceptedStatuses.includes(rsvpStatus)
      ? `${guestName} RSVP'd ${statusLabel} (${guestCount} guest${guestCount > 1 ? 's' : ''})`
      : `${guestName} declined the invitation`;

    await db.insert(notifications).values({
      userId: coupleUserId,
      type: "wedding",
      title: "New RSVP",
      message,
      linkUrl: `/wedding/rsvp`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send wedding RSVP notification:", error);
  }
}

// Marketplace Notifications
export async function sendOrderPlacedNotification(
  sellerId: string,
  buyerName: string,
  buyerAvatar: string | null,
  orderId: string,
  itemName: string,
  amount: number
) {
  try {
    await db.insert(notifications).values({
      userId: sellerId,
      type: "order",
      title: "New Order Received",
      message: `${buyerName} ordered ${itemName} ($${amount})`,
      imageUrl: buyerAvatar,
      linkUrl: `/orders/${orderId}`,
      priority: "high",
    });
  } catch (error) {
    console.error("Failed to send order placed notification:", error);
  }
}

export async function sendOrderStatusNotification(
  buyerId: string,
  status: string,
  orderId: string,
  itemName: string
) {
  try {
    const statusMessages: Record<string, string> = {
      confirmed: "confirmed",
      shipped: "has been shipped",
      delivered: "has been delivered",
      cancelled: "was cancelled",
    };

    await db.insert(notifications).values({
      userId: buyerId,
      type: "order",
      title: "Order Update",
      message: `Your order for ${itemName} ${statusMessages[status] || status}`,
      linkUrl: `/orders/${orderId}`,
      priority: status === "delivered" ? "high" : "normal",
    });
  } catch (error) {
    console.error("Failed to send order status notification:", error);
  }
}

export async function sendCateringRequestNotification(
  chefId: string,
  customerName: string,
  customerAvatar: string | null,
  eventDate: Date,
  guestCount: number
) {
  try {
    await db.insert(notifications).values({
      userId: chefId,
      type: "catering",
      title: "New Catering Request",
      message: `${customerName} requested catering for ${guestCount} guests on ${eventDate.toLocaleDateString()}`,
      imageUrl: customerAvatar,
      linkUrl: `/catering/requests`,
      priority: "high",
    });
  } catch (error) {
    console.error("Failed to send catering request notification:", error);
  }
}


// ============================================================
// CLUB NOTIFICATIONS
// ============================================================

export async function sendClubJoinRequestNotification(
  ownerId: string,
  requesterName: string,
  requesterAvatar: string | null,
  clubId: string,
  clubName: string
) {
  try {
    await db.insert(notifications).values({
      userId: ownerId,
      type: "club_join_request",
      title: "New Join Request",
      message: `${requesterName} requested to join "${clubName}"`,
      imageUrl: requesterAvatar,
      linkUrl: `/clubs/${clubId}`,
      priority: "high",
      metadata: { clubId },
    });
  } catch (error) {
    console.error("Failed to send club join request notification:", error);
  }
}

export async function sendClubJoinApprovedNotification(
  requesterId: string,
  clubId: string,
  clubName: string
) {
  try {
    await db.insert(notifications).values({
      userId: requesterId,
      type: "club_join_approved",
      title: "Request Approved",
      message: `You were approved to join "${clubName}"`,
      linkUrl: `/clubs/${clubId}`,
      priority: "normal",
      metadata: { clubId },
    });
  } catch (error) {
    console.error("Failed to send club join approved notification:", error);
  }
}

export async function sendClubNewMemberNotification(
  ownerId: string,
  memberName: string,
  memberAvatar: string | null,
  clubId: string,
  clubName: string
) {
  try {
    await db.insert(notifications).values({
      userId: ownerId,
      type: "club_new_member",
      title: "New Member",
      message: `${memberName} joined "${clubName}"`,
      imageUrl: memberAvatar,
      linkUrl: `/clubs/${clubId}`,
      priority: "normal",
      metadata: { clubId },
    });
  } catch (error) {
    console.error("Failed to send club new member notification:", error);
  }
}

export async function sendClubPostLikeNotification(
  postAuthorId: string,
  likerId: string,
  likerName: string,
  likerAvatar: string | null,
  clubId: string,
  clubPostId: string
) {
  try {
    if (postAuthorId === likerId) return;

    await db.insert(notifications).values({
      userId: postAuthorId,
      type: "club_post_like",
      title: "New Like",
      message: `${likerName} liked your club post`,
      imageUrl: likerAvatar,
      linkUrl: `/clubs/${clubId}`,
      priority: "normal",
      metadata: { clubId, clubPostId },
    });
  } catch (error) {
    console.error("Failed to send club post like notification:", error);
  }
}
