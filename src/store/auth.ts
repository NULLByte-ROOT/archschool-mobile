import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import {
  setAuthToken,
  setUnauthorizedHandler,
  unregisterPushToken,
} from "@/api/client";
import type { User } from "@/api/types";

const TOKEN_KEY = "archschool.token";
const USER_KEY = "archschool.user";
const PUSH_KEY = "archschool.pushToken";

let loggingOut = false;

async function readSecure(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeSecure(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // A device without a usable keystore still gets an in-memory session.
  }
}

export function rememberPushToken(token: string | null): void {
  void writeSecure(PUSH_KEY, token);
}

export async function readRememberedPushToken(): Promise<string | null> {
  return readSecure(PUSH_KEY);
}

interface AuthState {
  token: string | null;
  user: User | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (token: string, user: User) => Promise<void>;
  setUser: (user: User) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const [token, rawUser] = await Promise.all([
      readSecure(TOKEN_KEY),
      readSecure(USER_KEY),
    ]);
    let user: User | null = null;
    if (rawUser) {
      try {
        user = JSON.parse(rawUser) as User;
      } catch {
        user = null;
      }
    }
    setAuthToken(token);
    set({ token, user: token ? user : null, hydrated: true });
  },

  setSession: async (token, user) => {
    setAuthToken(token);
    set({ token, user, hydrated: true });
    await Promise.all([
      writeSecure(TOKEN_KEY, token),
      writeSecure(USER_KEY, JSON.stringify(user)),
    ]);
  },

  setUser: async (user) => {
    set({ user });
    await writeSecure(USER_KEY, JSON.stringify(user));
  },

  logout: async () => {
    if (loggingOut) return;
    loggingOut = true;
    try {
      const pushToken = await readRememberedPushToken();
      if (pushToken && get().token) {
        // If the token already expired this 401s; swallow it, the local session
        // is being destroyed anyway.
        await unregisterPushToken(pushToken).catch(() => undefined);
      }
    } finally {
      setAuthToken(null);
      set({ token: null, user: null, hydrated: true });
      await Promise.all([
        writeSecure(TOKEN_KEY, null),
        writeSecure(USER_KEY, null),
        writeSecure(PUSH_KEY, null),
      ]);
      loggingOut = false;
    }
  },
}));

// A 401 from any request destroys the local session. The auth gate in the root
// layout then routes to /login; no screen needs to handle expiry itself.
setUnauthorizedHandler(() => {
  void useAuthStore.getState().logout();
});
