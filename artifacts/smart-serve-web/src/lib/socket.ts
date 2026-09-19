/* Socket.IO client wrapper - auto connects when logged in, auto reconnects. */
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getToken } from "./api";
import { useAuth, useNotifications } from "./store";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

/* Hook-free event subscriptions (safe to call inside useEffect).
   Listeners registered before the socket exists are wired when it connects. */
type SocketListener = (payload: any) => void;
const pending: Record<string, Set<SocketListener>> = {};

export function socketOn(event: string, fn: SocketListener): () => void {
  (pending[event] ??= new Set()).add(fn);
  socket?.on(event, fn);
  return () => {
    pending[event]?.delete(fn);
    socket?.off(event, fn);
  };
}

function wireGlobalListeners(s: Socket): void {
  for (const [event, set] of Object.entries(pending)) {
    for (const fn of set) s.on(event, fn);
  }
}

/** Global socket lifecycle: one connection per token, rejoins the user room. */
export function SocketBootstrapper() {
  const { user, token } = useAuth();
  const { live } = useNotifications();
  const liveRef = useRef(live);
  liveRef.current = live;

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      return;
    }
    const s = io({
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 1500,
    });
    socket = s;
    s.on("notification", (n) => liveRef.current(n));
    wireGlobalListeners(s);
    return () => {
      s.disconnect();
      if (socket === s) socket = null;
    };
  }, [token, user?.id]);

  return null;
}

/** Subscribe to a socket event for the lifetime of the component. */
export function useSocketEvent(event: string, handler: (payload: any) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const fn = (payload: any) => ref.current(payload);
    s.on(event, fn);
    return () => {
      s.off(event, fn);
    };
  }, [event]);
}

export function useSocketConnected(): boolean {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const s = getSocket();
    if (!s) {
      setConnected(false);
      return;
    }
    setConnected(s.connected);
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    s.on("connect", on);
    s.on("disconnect", off);
    return () => {
      s.off("connect", on);
      s.off("disconnect", off);
    };
  }, []);
  return connected;
}
