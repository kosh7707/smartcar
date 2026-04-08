import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { Notification } from "@aegis/shared";
import {
  fetchNotifications,
  fetchNotificationCount,
  markNotificationRead as apiMarkRead,
  markAllNotificationsRead as apiMarkAllRead,
  getNotificationWsUrl,
} from "../api/notifications";
import { logError } from "../api/core";
import { parseWsMessage, createReconnectingWs } from "../utils/wsEnvelope";

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({
  projectId,
  children,
}: {
  projectId: string | undefined;
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const rwsRef = useRef<ReturnType<typeof createReconnectingWs> | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        fetchNotifications(projectId),
        fetchNotificationCount(projectId),
      ]);
      setNotifications(list);
      setUnreadCount(count.unread);
    } catch (e) {
      logError("NotificationContext.refresh", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // WebSocket connection for real-time notifications (with reconnection)
  useEffect(() => {
    if (!projectId) return;
    if (import.meta.env.VITE_MOCK === "true") return;

    const rws = createReconnectingWs(() => getNotificationWsUrl(projectId), {
      maxRetries: 10,
      async onReconnect() {
        // Catch up on missed notifications via REST
        try {
          const [list, count] = await Promise.all([
            fetchNotifications(projectId),
            fetchNotificationCount(projectId),
          ]);
          setNotifications(list);
          setUnreadCount(count.unread);
        } catch (e) {
          logError("NotificationContext.reconnect", e);
        }
        wireHandlers(rws.getWs());
      },
    });
    rwsRef.current = rws;

    function wireHandlers(ws: WebSocket | null) {
      if (!ws) return;
      ws.onmessage = (event) => {
        try {
          const msg = parseWsMessage(event.data);
          const payload = msg;
          if (payload.type === "notification" && payload.payload) {
            const notif = payload.payload as Notification;
            setNotifications((prev) => [notif, ...prev]);
            if (!notif.read) setUnreadCount((c) => c + 1);
          }
        } catch {
          // ignore non-JSON messages
        }
      };
    }
    wireHandlers(rws.getWs());

    return () => {
      rws.close();
      rwsRef.current = null;
    };
  }, [projectId]);

  const markRead = useCallback(async (id: string) => {
    await apiMarkRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!projectId) return;
    await apiMarkAllRead(projectId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [projectId]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loading, markRead, markAllRead, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
