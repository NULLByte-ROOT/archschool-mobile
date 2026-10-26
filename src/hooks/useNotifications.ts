import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import { qk, registerPushToken } from "@/api/client";
import { rememberPushToken } from "@/store/auth";
import { useAuthStore } from "@/store/auth";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function projectId(): string {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  const fromConfig = extra?.eas?.projectId ?? "";
  // `easConfig` exists on builds produced by EAS; Expo Go has neither.
  const fromEas = (Constants as unknown as { easConfig?: { projectId?: string } })
    .easConfig?.projectId;
  return (fromConfig || fromEas || "").trim();
}

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  const base = {
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 160, 90, 160],
    lightColor: "#FFFFFF",
    sound: "default",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  };
  const channels: { id: string; name: string; description: string }[] = [
    { id: "default", name: "اعلان‌های عمومی", description: "اطلاع‌رسانی‌های ArchSchool" },
    { id: "chat", name: "گفتگو", description: "پیام‌های کلاس و خصوصی" },
    { id: "assignments", name: "تکالیف", description: "تکلیف تازه" },
    { id: "deadlines", name: "مهلت‌ها", description: "یادآوری ۲۴ و ۲ ساعت مانده" },
  ];
  await Promise.all(
    channels.map((channel) =>
      Notifications.setNotificationChannelAsync(channel.id, {
        ...base,
        name: channel.name,
        description: channel.description,
        showBadge: true,
      }).catch(() => undefined)
    )
  );
}

async function requestPermissionAsync(): Promise<boolean> {
  try {
    let permissions = await Notifications.getPermissionsAsync();
    if (permissions.status !== "granted") {
      // First login on this install: Android 13+ shows the POST_NOTIFICATIONS
      // dialog here, iOS shows its own alert. Both are one-shot per install.
      permissions = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
    }
    return permissions.status === "granted";
  } catch {
    return false;
  }
}

async function registerForPushAsync(): Promise<string | null> {
  // Channels first. Android 13 ties the permission prompt to a channel, and —
  // more importantly — a push addressed to a channel that does not exist is
  // dropped without any error. Creating them before the permission gate means a
  // later grant (or a headless wake-up) still has valid channels.
  await ensureAndroidChannels();

  if (!(await requestPermissionAsync())) {
    console.info("[push] notification permission not granted");
    return null;
  }

  if (!Device.isDevice) {
    // Emulators cannot receive remote push; Expo Go on Android cannot either.
    console.info("[push] emulator detected — remote push unavailable");
    return null;
  }

  try {
    const id = projectId();
    if (!id) {
      // Before `eas init` there is no project id; skip quietly instead of
      // crashing the first launch in Expo Go.
      console.info(
        "[push] no EAS projectId configured yet; remote notifications stay off"
      );
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
    console.info(`[push] Expo push token: ${token.data}`);
    return token.data;
  } catch (error) {
    // The usual cause on Android is a build without Firebase credentials:
    // `getExpoPushTokenAsync` throws before any network call happens.
    console.warn("[push] getExpoPushTokenAsync failed", error);
    return null;
  }
}

/**
 * Store the token on the backend, retrying with a short backoff.
 *
 * The first attempt often races the login/profile bootstrap or a flaky network;
 * a silent single failure used to mean the account had no token until the next
 * cold start.
 */
async function syncTokenWithBackend(expoToken: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await registerPushToken(expoToken, Platform.OS);
      rememberPushToken(expoToken);
      console.info("[push] token stored on the backend");
      return true;
    } catch (error) {
      console.info(`[push] backend registration failed (attempt ${attempt})`, error);
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
      }
    }
  }
  return false;
}

/** Register this install once per authenticated session. */
export function usePushRegistration(): void {
  const sessionToken = useAuthStore((state) => state.token);
  const lastSync = useRef(0);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;

    const push = async () => {
      const expoToken = await registerForPushAsync();
      if (!expoToken || cancelled) return;
      lastSync.current = Date.now();
      await syncTokenWithBackend(expoToken);
    };

    // Let the login response (and the profile query) settle first, so the
    // permission dialog never covers a loading screen.
    const timer = setTimeout(() => void push(), 900);
    // FCM/APNs can roll a device token; re-register so the backend stays fresh.
    const tokenSub = Notifications.addPushTokenListener(() => {
      void push();
    });
    // Tokens are also lost across app updates, reboots and data restores. A
    // foreground re-sync (at most every 10 minutes) heals a missing row without
    // ever bothering the user again — permissions are already granted by then.
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (Date.now() - lastSync.current < 10 * 60_000) return;
      void push();
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      tokenSub.remove();
      appStateSub.remove();
    };
  }, [sessionToken]);
}

function targetFor(
  data: Record<string, unknown>
): { pathname: "/chat/[room]"; params: { room: string } } | { pathname: "/assignment/[id]"; params: { id: string } } | null {
  const type = typeof data.type === "string" ? data.type : "";
  const room = typeof data.room === "string" ? data.room : "";

  if (type === "chat" && room) {
    return { pathname: "/chat/[room]", params: { room } };
  }
  if ((type === "assignment" || type === "deadline") && data.assignment_id != null) {
    return {
      pathname: "/assignment/[id]",
      params: { id: String(data.assignment_id) },
    };
  }
  return null;
}

/**
 * Open the room named by a tapped notification, cold start included.
 *
 * The backend always puts `room` in `data` (`global`, `dm:1:2` or
 * `assignment:4`), so this stays a single mapping with the web app.
 */
export function useNotificationObserver(): void {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sessionToken = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!sessionToken) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response || !active) return;
      const data = (response.notification.request.content.data ?? {}) as Record<
        string,
        unknown
      >;
      const target = targetFor(data);
      if (!target) return;

      // Let the root navigator mount after a cold start before pushing.
      timer = setTimeout(() => {
        if (active) router.push(target);
      }, 300);

      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: qk.unread });
    };

    void Notifications.getLastNotificationResponseAsync()
      .then(handle)
      .catch(() => undefined);

    const responseSub = Notifications.addNotificationResponseReceivedListener(handle);

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: qk.unread });
      void queryClient.invalidateQueries({ queryKey: qk.chatOverview });
      void queryClient.invalidateQueries({ queryKey: qk.assignments });
    });

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      responseSub.remove();
      receivedSub.remove();
    };
  }, [queryClient, router, sessionToken]);
}
