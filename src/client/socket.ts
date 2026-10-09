"use client";
import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

/** One shared connection per tab. Identity rides on the httpOnly cookies. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: "/socket.io", withCredentials: true, transports: ["websocket", "polling"], reconnectionDelayMax: 4000, autoConnect: false });
    // First visit: make sure the guest cookie exists, then connect.
    socket.on("connect_error", async (err) => {
      if (err.message === "no-identity") {
        await fetch("/api/me", { credentials: "same-origin" }).catch(() => undefined);
        setTimeout(() => socket?.connect(), 300);
      }
    });
    void fetch("/api/me", { credentials: "same-origin" })
      .catch(() => undefined)
      .finally(() => socket?.connect());
  }
  return socket;
}

export function emit<T = Record<string, unknown>>(event: string, data: unknown = {}): Promise<T & { error?: string }> {
  return new Promise((resolve) => {
    const s = getSocket();
    const timer = setTimeout(() => resolve({ error: "Connection timed out — retrying…" } as T & { error?: string }), 10_000);
    s.emit(event, data, (res: T & { error?: string }) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}
