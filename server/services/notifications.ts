// server/services/notifications.ts
// Singleton to hold the notification helper
// This avoids circular dependency issues

let notificationHelperInstance: any = null;

export function setNotificationHelper(helper: any) {
  notificationHelperInstance = helper;
}

export function getNotificationHelper() {
  return notificationHelperInstance;
}

export async function sendNotification(
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
  if (!notificationHelperInstance) {
    console.warn("Notification helper not initialized yet");
    return null;
  }

  try {
    return await notificationHelperInstance.notifyUser(userId, notification);
  } catch (error) {
    console.error("Failed to send notification:", error);
    return null;
  }
}
