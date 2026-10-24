import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import { qk, registerPushToken } from "@/api/client";
import { rememberPushToken } from "@/store/auth";
import { useAuthStore } from "@/store/auth";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
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
    lightColor: "#F2B455",
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

async function registerForPushAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    // Emulators cannot receive remote push; Expo Go on Android cannot either.
    return null;
  }
  try {
    await ensureAndroidChannels();
    let permissions = await Notifications.getPermissionsAsync();
    if (permissions.status !== "granted") {
      permissions = await Notifications.requestPermissionsAsync();
    }
    if (permissions.status !== "granted") return null;

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
    return token.data;
  } catch (error) {
    console.info("[push] registration skipped", error);
    return null;
  }
}

/** Register this install once per authenticated session. */
export function usePushRegistration(): void {
  const sessionToken = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;

    const run = async () => {
      const expoToken = await registerForPushAsync();
      if (!expoToken || cancelled) return;
      try {
        await registerPushToken(expoToken, Platform.OS);
        rememberPushToken(expoToken);
      } catch (error) {
        console.info("[push] backend registration failed", error);
      }
    };

    void run();
    return () => {
      cancelled = true;
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
