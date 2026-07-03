"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, Check, ExternalLink } from "lucide-react";
import { usePathname } from "next/navigation";
import { notificationService, Notification } from "@/services/notification.service";

interface NotificationDropdownProps {
  className?: string;
}

const formatTimeIndonesia = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) {
    const menit = diffMins === 1 ? "1 menit" : `${diffMins} menit`;
    return `${menit} yang lalu`;
  }
  if (diffHours < 24) {
    const jam = diffHours === 1 ? "1 jam" : `${diffHours} jam`;
    return `${jam} yang lalu`;
  }
  const diffDays = Math.floor(diffMs / 86400000);
  const hari = diffDays === 1 ? "1 hari" : `${diffDays} hari`;
  return `${hari} yang lalu`;
};

export default function NotificationDropdown({ className = "" }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [macroNotifications, setMacroNotifications] = useState<Notification[]>([]);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const handleScroll = () => setIsOpen(false);
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [isOpen]);

  // FIX #1: Use useRef for systemReadIds to prevent infinite re-render loop.
  // Previously, calling getSystemReadIds() in render body created a new Set every render,
  // which caused useEffect with [systemReadIds] dependency to re-trigger infinitely.
  const systemReadIdsRef = useRef<Set<string>>(notificationService.getSystemReadIds());

  const refreshSystemReadIds = useCallback(() => {
    systemReadIdsRef.current = notificationService.getSystemReadIds();
  }, []);

  const allNotifications = useMemo(() => {
    const merged = [...notifications];
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return merged.slice(0, 10);
  }, [notifications]);

  // FIX #2: Compute total unread count from both macro + server notifications
  // This ensures the badge is always consistent regardless of dropdown open/close state
  const allUnreadCount = useMemo(() => {
    return allNotifications.filter(n => !n.read).length;
  }, [allNotifications]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const result = await notificationService.getRecent(10, false);
      if (result.success && result.data) {
        setNotifications(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Fetch full notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Periodic refresh every 30 seconds when dropdown is closed
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isOpen) {
        fetchNotifications();
        refreshSystemReadIds();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isOpen, fetchNotifications, refreshSystemReadIds]);

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    const notif = allNotifications.find(n => n.id === notificationId);
    if (notif?.userId === "system") {
      notificationService.setSystemReadId(notificationId);
      refreshSystemReadIds();
    } else {
      try {
        await notificationService.markAsRead(notificationId);
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
      } catch (error) {
        console.error("Failed to mark as read:", error);
      }
    }
  }, [allNotifications, refreshSystemReadIds]);

  // FIX #3: markAllAsRead now covers ALL macro notifications, not just the sliced allNotifications
  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));

      // Also mark any server notifications that are system-type
      notifications.forEach(n => {
        if (n.userId === "system") {
          notificationService.setSystemReadId(n.id);
        }
      });

      // Refresh ref
      systemReadIdsRef.current = notificationService.getSystemReadIds();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }, [macroNotifications, notifications]);

  // FIX #4: Close dropdown and mark as read when clicking a notification link
  const handleLinkClick = useCallback((notificationId: string) => {
    handleMarkAsRead(notificationId);
    setIsOpen(false);
  }, [handleMarkAsRead]);

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "AI_REVIEW_READY":
        return <span className="text-accent-gold">🤖</span>;
      case "TRADE_LOGGED":
        return <span className="text-data-profit">📊</span>;
      case "RISK_WARNING":
        return <span className="text-amber-400">💰</span>;
      case "SYSTEM":
        return <span className="text-blue-400">⚙️</span>;
      case "COT_UPDATE":
        return <span className="text-purple-400">📈</span>;
      case "REGIME_SHIFT":
        return <span className="text-data-loss">⚠️</span>;
      case "YIELD_CURVE_REGIME":
        return <span className="text-emerald-400">📉</span>;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-text-secondary hover:text-accent-gold hover:bg-white/5 transition-all"
        data-notification-trigger
      >
        <Bell className="w-5 h-5" />
        {allUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-data-loss rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-lg">
            {allUnreadCount > 9 ? "9+" : allUnreadCount}
          </span>
        )}
      </button>

      {isOpen && mounted && createPortal(
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed top-20 right-4 md:right-8 w-80 max-h-[calc(100vh-96px)] flex flex-col overflow-hidden bg-bg-surface/95 border border-white/10 rounded-xl shadow-2xl z-[201]">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                Notifikasi
              </h3>
              {allUnreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-accent-gold hover:underline"
                >
                  Tandai Sudah Dibaca
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-6 h-6 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin mx-auto" />
                </div>
              ) : allNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-text-secondary">Belum ada notifikasi</p>
                </div>
              ) : (
                <>
                  {allNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-white/[0.02] transition-colors ${
                        !notification.read ? "bg-accent-gold/5" : ""
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-text-primary truncate">
                              {notification.title}
                            </p>
                            <span className="text-[10px] text-text-muted whitespace-nowrap">
                              {formatTimeIndonesia(notification.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center space-x-2">
                            {notification.link && (
                              <a
                                href={notification.link}
                                className="inline-flex items-center text-[10px] text-accent-gold hover:underline"
                                onClick={() => handleLinkClick(notification.id)}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Buka
                              </a>
                            )}
                            {!notification.read && (
                              <button
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="inline-flex items-center text-[10px] text-text-secondary hover:text-accent-gold"
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Tandai Dibaca
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}