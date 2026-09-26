import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken, unregisterPushToken } from "@gymos/api/notifications/push";

const KEY = "gymos.pushToken";

// A push that arrives while the app is open still shows (session reminders, "N sessions left").
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/**
 * Registers this phone for push (docs/05 M8: Expo Push → notifications with channel = push). Native devices only: the web
 * build and simulators skip it. Needs the EAS project id in app config (extra.eas.projectId), set by `eas init`.
 * Never throws: a phone without push still works; it just doesn't get pushes.
 */
export async function enablePush(): Promise<string | null> {
  try {
    if (Platform.OS === "web" || !Device.isDevice) return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return null;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", { name: "GymOS", importance: Notifications.AndroidImportance.HIGH });
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await registerPushToken(token, Platform.OS === "ios" ? "ios" : "android", Device.deviceName);
    await AsyncStorage.setItem(KEY, token);
    return token;
  } catch {
    return null;
  }
}

/** Sign-out: this phone stops getting the person's pushes (a shared phone must not show the last member's reminders). */
export async function disablePush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(KEY);
    if (token) await unregisterPushToken(token);
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* offline: the token is revoked when Expo reports it, or re-registered by the next person */
  }
}
