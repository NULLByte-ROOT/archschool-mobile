import "react-native-gesture-handler";

import {
  Vazirmatn_400Regular,
  Vazirmatn_500Medium,
  Vazirmatn_600SemiBold,
  Vazirmatn_700Bold,
  Vazirmatn_900Black,
  useFonts,
} from "@expo-google-fonts/vazirmatn";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AppState, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { UpdateModal } from "@/components/UpdateModal";
import { checkForUpdates, downloadOtaBundle, type UpdateCheckResponse } from "@/lib/updater";
import {
  useNotificationObserver,
  usePushRegistration,
} from "@/hooks/useNotifications";
import { usePulseSocket } from "@/hooks/usePulseSocket";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/tokens";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15000,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

function AuthGate({ ready }: { ready: boolean }) {
  const token = useAuthStore((state) => state.token);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const onLogin = segments[0] === "login";
    if (!token && !onLogin) {
      router.replace("/login");
    } else if (token && onLogin) {
      router.replace("/home");
    }
  }, [ready, router, segments, token]);

  return null;
}

function AppShell({ ready }: { ready: boolean }) {
  usePulseSocket();
  usePushRegistration();
  useNotificationObserver();

  const token = useAuthStore((state) => state.token);
  const refreshSession = useAuthStore((state) => state.refreshSession);

  // Roles are edited by an admin on another device. The cached user from
  // SecureStore can therefore be stale (a freshly promoted friend would still
  // see the chat lock). Refresh on cold start and whenever the app comes back
  // to the foreground, exactly like the web AuthProvider does on reload.
  useEffect(() => {
    if (!token) return;
    void refreshSession();
  }, [refreshSession, token]);

  useEffect(() => {
    if (!token) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshSession();
    });
    return () => subscription.remove();
  }, [refreshSession, token]);

  return (
    <>
      <AuthGate ready={ready} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.ink },
          animation: "fade",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" options={{ animation: "fade" }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="chat/[room]"
          options={{ animation: "slide_from_left" }}
        />
        <Stack.Screen
          name="assignment/[id]"
          options={{ animation: "slide_from_left" }}
        />
        <Stack.Screen
          name="overdue"
          options={{ animation: "slide_from_left" }}
        />
        <Stack.Screen
          name="users"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="new-assignment"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="admin-bells"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Vazirmatn_400Regular,
    Vazirmatn_500Medium,
    Vazirmatn_600SemiBold,
    Vazirmatn_700Bold,
    Vazirmatn_900Black,
  });
  const hydrated = useAuthStore((state) => state.hydrated);
  const [updateState, setUpdateState] = useState<UpdateCheckResponse | null>(null);
  const [updateChecked, setUpdateChecked] = useState(false);

  useEffect(() => {
    void useAuthStore.getState().hydrate();
  }, []);

  // Silent update check at startup before main content reveals
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await checkForUpdates(3500);
        if (!active) return;

        if (res.updateType === "apk") {
          setUpdateState(res);
        } else if (res.updateType === "ota") {
          // Download bundle with a bounded timeout
          const downloadPromise = downloadOtaBundle(res);
          const timeoutPromise = new Promise<boolean>((resolve) =>
            setTimeout(() => resolve(false), 7000)
          );
          const success = await Promise.race([downloadPromise, timeoutPromise]);
          if (active && success) {
            setUpdateState({ ...res, otaReady: true });
          }
        }
      } catch {
        // Fallback to offline / existing bundle gracefully
      } finally {
        if (active) {
          setUpdateChecked(true);
        }
      }
    })();

    // Safety fallback: ensure splash always unlocks even on extreme lag
    const safetyTimer = setTimeout(() => {
      if (active) setUpdateChecked(true);
    }, 5000);

    return () => {
      active = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  const ready = (fontsLoaded || Boolean(fontError)) && hydrated && updateChecked;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <AppShell ready={ready} />
          <UpdateModal state={updateState} onDismiss={() => setUpdateState(null)} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
});
