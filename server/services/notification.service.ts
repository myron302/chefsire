// server/services/notification.service.ts
// Singleton service for sending notifications throughout the app

type NotificationHelper = {
  notifyUser: (
    userId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      imageUrl?: string;
      linkUrl?: string;
      metadata?: Record<string, any>;
      priority?: string;
    }
  ) => Promise<any>;
  notifyMultipleUsers: (
    userIds: string[],
    notification: {
      type: string;
      title: string;
      message: string;
      imageUrl?: string;
      linkUrl?: string;
      metadata?: Record<string, any>;
      priority?: string;
    }
  ) => Promise<any>;
} | null;

class NotificationService {
  private helper: NotificationHelper = null;

  initialize(helper: NotificationHelper) {
    this.helper = helper;
  }

  async notifyUser(
    userId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      imageUrl?: string;
      linkUrl?: string;
      metadata?: Record<string, any>;
      priority?: string;
    }
  ) {
    if (!this.helper) {
      console.warn("[NotificationService] Not initialized, skipping notification");
      return null;
    }
    return this.helper.notifyUser(userId, notification);
  }

  async notifyMultipleUsers(
    userIds: string[],
    notification: {
      type: string;
      title: string;
      message: string;
      imageUrl?: string;
      linkUrl?: string;
      metadata?: Record<string, any>;
      priority?: string;
    }
  ) {
    if (!this.helper) {
      console.warn("[NotificationService] Not initialized, skipping notifications");
      return null;
    }
    return this.helper.notifyMultipleUsers(userIds, notification);
  }

  async notifyFollowersOfActivity(
    userId: string,
    activityType: "post" | "custom_drink" | "recipe" | "achievement",
    details: {
      title: string;
      message: string;
      imageUrl?: string;
      linkUrl?: string;
      metadata?: Record<string, any>;
    }
  ) {
    if (!this.helper) {
      console.warn("[NotificationService] Not initialized, skipping follower notifications");
      return null;
    }

    try {
      // Import here to avoid circular dependencies
      const { storage } = await import("../storage");

      // Get followers
      const followers = await storage.getFollowers(userId);

      if (followers.length === 0) {
        return null;
      }

      // Get the user who performed the activity
      const user = await storage.getUser(userId);
      const username = user?.username || "Someone";

      // Create notification for all followers
      const followerIds = followers.map(f => f.id);

      return this.notifyMultipleUsers(followerIds, {
        type: "friend_activity",
        title: details.title,
        message: details.message,
        imageUrl: details.imageUrl,
        linkUrl: details.linkUrl,
        metadata: {
          ...details.metadata,
          activityType,
          actorUserId: userId,
          actorUsername: username,
        },
        priority: "normal",
      });
    } catch (error) {
      console.error("[NotificationService] Error notifying followers:", error);
      return null;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
