import Constants from "expo-constants";

type NotificationContent = {
  title?: string;
  body?: string;
  data?: unknown;
  sound?: boolean;
};

type NotificationRequest = {
  content: NotificationContent;
  trigger: null;
};

let notificationsModule: any | null | undefined;
let handlerConfigured = false;

const isExpoGo =
  Constants.executionEnvironment === "storeClient" ||
  Constants.appOwnership === "expo";

function getNotificationsModule(): any | null {
  if (isExpoGo) return null;
  if (notificationsModule !== undefined) return notificationsModule;
  try {
    notificationsModule = require("expo-notifications");
  } catch (error) {
    console.warn("[Notifications] Could not load expo-notifications:", error);
    notificationsModule = null;
  }
  return notificationsModule;
}

export function configureNotificationHandler(): void {
  const Notifications = getNotificationsModule();
  if (!Notifications || handlerConfigured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: "max",
    }),
  });

  handlerConfigured = true;
}

export async function getNotificationPermissionStatus(): Promise<
  "granted" | "denied" | "undetermined"
> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return "denied";
  const current = await Notifications.getPermissionsAsync();
  return current.status;
}

export async function requestNotificationPermissionStatus(): Promise<
  "granted" | "denied" | "undetermined"
> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return "denied";
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status;
}

export async function scheduleNotification(request: NotificationRequest): Promise<boolean> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return false;
  await Notifications.scheduleNotificationAsync(request);
  return true;
}
