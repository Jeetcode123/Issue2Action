"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Bell, CheckCircle, Mail, AlertTriangle, ArrowUpRight, Zap, Clock, X, Inbox } from 'lucide-react';
import { getAuth } from '@/lib/auth';
import { getUserNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead, AppNotification } from '@/lib/api';
import { insforge } from '@/lib/insforge';

const NOTIF_ICONS: Record<string, { icon: React.ReactNode; bg: string }> = {
  issue_submitted: {
    icon: <Zap className="w-4 h-4 text-emerald-500" />,
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  authority_detected: {
    icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    bg: 'bg-amber-100 dark:bg-amber-900/30',
  },
  email_sent: {
    icon: <Mail className="w-4 h-4 text-blue-500" />,
    bg: 'bg-blue-100 dark:bg-blue-900/30',
  },
  issue_escalated: {
    icon: <ArrowUpRight className="w-4 h-4 text-red-500" />,
    bg: 'bg-red-100 dark:bg-red-900/30',
  },
  issue_resolved: {
    icon: <CheckCircle className="w-4 h-4 text-green-500" />,
    bg: 'bg-green-100 dark:bg-green-900/30',
  },
  status_update: {
    icon: <Bell className="w-4 h-4 text-indigo-500" />,
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
};

function getNotifStyle(type: string) {
  return NOTIF_ICONS[type] || NOTIF_ICONS.status_update;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewPulse, setHasNewPulse] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { userId } = getAuth();
      if (!userId) return;
      const count = await getUnreadNotificationCount(userId);
      setUnreadCount(prev => {
        if (count > prev && prev >= 0) {
          setHasNewPulse(true);
          setTimeout(() => setHasNewPulse(false), 2000);
        }
        return count;
      });
    } catch { /* silent */ }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const { userId } = getAuth();
      if (!userId) return;
      setIsLoading(true);
      const data = await getUserNotifications(userId);
      setNotifications(data);
      const unread = data.filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('[NotificationBell]', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll for unread count every 30s + fetch on mount
  useEffect(() => {
    fetchUnreadCount();
    pollInterval.current = setInterval(fetchUnreadCount, 30000);
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [fetchUnreadCount]);

  // Listen for realtime notification events
  useEffect(() => {
    let isSubscribed = true;
    const setupRealtime = async () => {
      try {
        await insforge.realtime.connect();
        await insforge.realtime.subscribe('issues:feed');
        insforge.realtime.on('notification_update', () => {
          if (isSubscribed) {
            fetchUnreadCount();
            if (isOpen) fetchNotifications();
          }
        });
      } catch { /* realtime might already be connected */ }
    };
    setupRealtime();
    return () => {
      isSubscribed = false;
    };
  }, [fetchUnreadCount, fetchNotifications, isOpen]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkRead = async (notifId: string) => {
    const { userId } = getAuth();
    if (!userId) return;
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try { await markNotificationRead(userId, notifId); } catch { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    const { userId } = getAuth();
    if (!userId) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try { await markAllNotificationsRead(userId); } catch { /* silent */ }
  };

  const recent5 = notifications.slice(0, 5);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        id="notification-bell"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl transition-all duration-200 hover:bg-gray-100 dark:hover:bg-white/10 group"
        aria-label="Notifications"
      >
        <Bell className={`w-5 h-5 transition-colors duration-200 ${
          isOpen 
            ? 'text-indigo-600 dark:text-indigo-400' 
            : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'
        }`} />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white bg-red-500 shadow-lg shadow-red-500/30 border-2 border-white dark:border-[#0d1627] transition-transform ${
            hasNewPulse ? 'animate-bounce' : ''
          }`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] bg-white dark:bg-[#1a2235] rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/40 border border-gray-200 dark:border-gray-700/50 z-50 overflow-hidden"
          style={{ animation: 'notifSlideIn 0.2s ease-out' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto max-h-[340px] divide-y divide-gray-50 dark:divide-gray-800/50">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <div className="w-6 h-6 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-400">Loading...</span>
              </div>
            ) : recent5.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-14 h-14 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                  <Inbox className="w-7 h-7 text-gray-300 dark:text-gray-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">All caught up!</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">No notifications yet.</p>
                </div>
              </div>
            ) : (
              recent5.map((notif) => {
                const style = getNotifStyle(notif.type);
                return (
                  <div
                    key={notif.id}
                    onClick={() => !notif.is_read && handleMarkRead(notif.id)}
                    className={`flex gap-3 px-5 py-3.5 transition-all duration-150 cursor-pointer group/item ${
                      notif.is_read
                        ? 'bg-transparent hover:bg-gray-50 dark:hover:bg-white/[0.02] opacity-70'
                        : 'bg-indigo-50/40 dark:bg-indigo-900/10 hover:bg-indigo-50/70 dark:hover:bg-indigo-900/20'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${style.bg}`}>
                      {style.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <h4 className={`text-[13px] font-semibold truncate ${
                          notif.is_read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'
                        }`}>
                          {notif.title || 'Notification'}
                        </h4>
                        <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 shrink-0 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {timeAgo(notif.created_at)}
                        </span>
                      </div>
                      <p className="text-[12px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!notif.is_read && (
                      <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-2 shadow-sm shadow-indigo-500/50" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 dark:border-gray-700/50 px-5 py-3">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/10"
            >
              View All Notifications
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Inline animation keyframes */}
      <style jsx>{`
        @keyframes notifSlideIn {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
