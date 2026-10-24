import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { qk, roomSocketUrl } from "@/api/client";
import { useAuthStore } from "@/store/auth";

const PING_MS = 20000;

/**
 * Notifications-only socket (`room=pulse`).
 *
 * It runs for the whole authenticated session so unread badges stay current
 * outside the chat screens. Any `pulse_ping` invalidates the summaries; the
 * server already decided who is allowed to know about the message.
 */
export function usePulseSocket() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!token) return;

    let stopped = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let attempt = 0;

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: qk.unread });
      void queryClient.invalidateQueries({ queryKey: qk.chatOverview });
      void queryClient.invalidateQueries({ queryKey: qk.recentComments });
    };

    const schedule = () => {
      if (stopped) return;
      const wait = Math.min(20000, 1200 * 2 ** Math.min(attempt, 4)) + Math.random() * 400;
      attempt += 1;
      retryTimer = setTimeout(connect, wait);
    };

    const connect = () => {
      if (stopped) return;
      retryTimer = null;
      try {
        socket = new WebSocket(roomSocketUrl("pulse", token));
      } catch {
        schedule();
        return;
      }

      socket.onopen = () => {
        attempt = 0;
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          try {
            socket?.send("ping");
          } catch {
            // onclose owns the retry.
          }
        }, PING_MS);
      };

      socket.onmessage = (event) => {
        try {
          const frame = JSON.parse(String(event.data)) as { type?: string };
          if (frame.type === "pulse_ping") invalidate();
        } catch {
          // A malformed frame only costs one refresh.
        }
      };

      socket.onclose = () => {
        socket = null;
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = null;
        if (!stopped) schedule();
      };

      socket.onerror = () => undefined;
    };

    connect();

    const subscription = AppState.addEventListener("change", (state) => {
      const wasBackground = Boolean(
        appState.current && appState.current.match(/inactive|background/)
      );
      appState.current = state;
      if (state === "active" && wasBackground) {
        invalidate();
      }
    });

    return () => {
      stopped = true;
      subscription.remove();
      if (retryTimer) clearTimeout(retryTimer);
      if (pingTimer) clearInterval(pingTimer);
      try {
        socket?.close();
      } catch {
        // Already closed.
      }
      socket = null;
    };
  }, [queryClient, token]);
}
