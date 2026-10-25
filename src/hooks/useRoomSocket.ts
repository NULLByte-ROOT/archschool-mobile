import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { roomSocketUrl } from "@/api/client";
import type { Message } from "@/api/types";
import { useAuthStore } from "@/store/auth";

export type RoomSocketEvent =
  | { type: "clear"; room: string }
  | { type: "delete"; id: number }
  | { type: "edit"; message: Message }
  | { type: "pin"; message: Message };

interface RoomHandlers {
  onMessage: (message: Message) => void;
  onEvent?: (event: RoomSocketEvent) => void;
}

const PING_MS = 20000;

/**
 * One socket per room, owned by the screen showing that room.
 *
 * Messages are written through REST (so the push fan-out and anti-abuse checks
 * run in one place); the socket only receives. Reconnects use bounded
 * exponential backoff, and a `1008 invalid-token` close ends the session
 * instead of retrying a token that can never work.
 */
export function useRoomSocket(room: string | null, handlers: RoomHandlers) {
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const [connected, setConnected] = useState(false);

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!room || !token) return;

    let stopped = false;
    let socket: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const clearPing = () => {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      const wait = Math.min(15000, 900 * 2 ** Math.min(attempt, 4)) + Math.random() * 350;
      attempt += 1;
      retryTimer = setTimeout(connect, wait);
    };

    const connect = () => {
      if (stopped) return;
      retryTimer = null;
      try {
        socket = new WebSocket(roomSocketUrl(room, token));
      } catch {
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        if (stopped) {
          socket?.close();
          return;
        }
        attempt = 0;
        setConnected(true);
        clearPing();
        pingTimer = setInterval(() => {
          try {
            socket?.send("ping");
          } catch {
            // onclose owns the reconnect.
          }
        }, PING_MS);
      };

      socket.onmessage = (event) => {
        let payload: unknown;
        try {
          payload = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (!payload || typeof payload !== "object") return;
        const frame = payload as { type?: string; data?: unknown };

        if (frame.type === "message" && frame.data) {
          handlersRef.current.onMessage(frame.data as Message);
        } else if (frame.type === "delete" && frame.data) {
          const data = frame.data as { id?: number };
          if (typeof data.id === "number") {
            handlersRef.current.onEvent?.({ type: "delete", id: data.id });
          }
        } else if (frame.type === "clear" && frame.data) {
          const data = frame.data as { room?: string };
          handlersRef.current.onEvent?.({
            type: "clear",
            room: typeof data.room === "string" ? data.room : room,
          });
        } else if (frame.type === "edit" && frame.data) {
          handlersRef.current.onEvent?.({
            type: "edit",
            message: frame.data as Message,
          });
        } else if (frame.type === "pin" && frame.data) {
          handlersRef.current.onEvent?.({
            type: "pin",
            message: frame.data as Message,
          });
        }
      };

      socket.onerror = () => {
        // `onclose` always follows and owns retry/backoff.
      };

      socket.onclose = (event) => {
        setConnected(false);
        clearPing();
        socket = null;
        if (stopped) return;
        if (event.code === 1008) {
          if (event.reason === "invalid-token") {
            void logout();
          }
          return;
        }
        scheduleReconnect();
      };
    };

    connect();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || stopped) return;
      if (!socket || socket.readyState === WebSocket.CLOSED) {
        attempt = 0;
        if (retryTimer) clearTimeout(retryTimer);
        connect();
      }
    });

    return () => {
      stopped = true;
      clearPing();
      if (retryTimer) clearTimeout(retryTimer);
      subscription.remove();
      try {
        socket?.close();
      } catch {
        // Already closed.
      }
      socket = null;
      setConnected(false);
    };
  }, [logout, room, token]);

  return { connected };
}
