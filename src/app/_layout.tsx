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
import { useEffect } from "react";
import { AppState, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
  const user = useAuthStore((state) => state.user);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const isAuthRoute = segments[0] === "login" || segments[0] === "onboarding";
    const isTabsRoute = segments[0] === "(tabs)";

    if (!token && !isAuthRoute) {
      // Not logged in → go to onboarding splash
      router.replace("/onboarding");
    } else if (token && isAuthRoute) {
      // Logged in but still on auth/onboarding screens
      if (user?.must_set_password) {
        // Guest or legacy user who hasn't set a password yet
        router.replace("/onboarding/setup-account");
      } else {
        // Fully authenticated → go to home tabs
        router.replace("/(tabs)/home");
      }
    }
    // If token & isTabsRoute → already on the right screen, do nothing
  }, [ready, router, segments, token, user?.must_set_password]);

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
        <Stack.Screen name="onboarding/index" options={{ animation: "fade" }} />
        <Stack.Screen name="onboarding/auth" options={{ animation: "slide_from_left" }} />
        <Stack.Screen name="onboarding/setup-account" options={{ animation: "slide_from_left" }} />
        <Stack.Screen name="onboarding/setup-schedule" options={{ animation: "slide_from_left" }} />
        <Stack.Screen name="onboarding/setup-class" options={{ animation: "slide_from_left" }} />
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

  useEffect(() => {
    void useAuthStore.getState().hydrate();
  }, []);

  const ready = (fontsLoaded || Boolean(fontError)) && hydrated;

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
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
});
