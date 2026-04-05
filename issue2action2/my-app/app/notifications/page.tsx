"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Bell, CheckCircle, Mail, AlertTriangle, ArrowUpRight, Zap, Clock, Inbox, Filter, Loader2, Check } from 'lucide-react';
import Link from 'next/link';
import { getUserNotifications, markNotificationRead, markAllNotificationsRead, AppNotification } from '@/lib/api';
import { getAuth } from '@/lib/auth';
import { insforge } from '@/lib/insforge';

const NOTIF_CONFIG: Record<string, { icon: React.ReactNode; bg: string; label: string; color: string }> = {
  issue_submitted: {
    icon: <Zap className="w-5 h-5 text-emerald-500" />,
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    label: 'Submitted',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  authority_detected: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'Authority',
    color: 'text-amber-600 dark:text-amber-400',
  },
  email_sent: {
    icon: <Mail className="w-5 h-5 text-blue-500" />,
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Email Sent',
    color: 'text-blue-600 dark:text-blue-400',
  },
  issue_escalated: {
    icon: <ArrowUpRight className="w-5 h-5 text-red-500" />,
    bg: 'bg-red-100 dark:bg-red-900/30',
    label: 'Escalated',
    color: 'text-red-600 dark:text-red-400',
  },
  issue_resolved: {
    icon: <CheckCircle className="w-5 h-5 text-green-500" />,
    bg: 'bg-green-100 dark:bg-green-900/30',
    label: 'Resolved',
    color: 'text-green-600 dark:text-green-400',
  },
  status_update: {
    icon: <Bell className="w-5 h-5 text-indigo-500" />,
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    label: 'Update',
    color: 'text-indigo-600 dark:text-indigo-400',
  },
};

function getNotifConfig(type: string) {
  return NOTIF_CONFIG[type] || NOTIF_CONFIG.status_update;
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
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type FilterType = 'all' | 'unread' | 'issue_submitted' | 'authority_detected' | 'email_sent' | 'issue_escalated' | 'issue_resolved';

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'issue_submitted', label: 'Submitted' },
  { value: 'authority_detected', label: 'Authority' },
  { value: 'email_sent', label: 'Email' },
  { value: 'issue_escalated', label: 'Escalated' },
  { value: 'issue_resolved', label: 'Resolved' },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchNotifs = useCallback(async () => {
    try {
      const { userId } = getAuth();
      if (!userId) return;
      const data = await getUserNotifications(userId);
      setNotifications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifs();
  }, [fetchNotifs]);

  // Realtime listener for live updates
  useEffect(() => {
    let isSubscribed = true;
    const setup = async () => {
      try {
        await insforge.realtime.connect();
        await insforge.realtime.subscribe('issues:feed');
        insforge.realtime.on('notification_update', () => {
          if (isSubscribed) fetchNotifs();
        });
      } catch { /* silent */ }
    };
    setup();
    return () => { isSubscribed = false; };
  }, [fetchNotifs]);

  // Polling fallback every 30s
  useEffect(() => {
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  const markAsRead = async (id: string) => {
    const { userId } = getAuth();
    if (!userId) return;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    try { await markNotificationRead(userId, id); } catch { /* silent */ }
  };

  const markAllAsRead = async () => {
    const { userId } = getAuth();
    if (!userId) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    try { await markAllNotificationsRead(userId); } catch { /* silent */ }
  };

  // Filter notifications
  const filtered = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.is_read;
    return n.type === filter;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Bell className="w-5 h-5 text-white" />
              </div>
              Notifications
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
              Stay updated on your reports and community activity.
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </p>
          </div>
          {unreadCount > 0 && (
            <button 
              onClick={markAllAsRead}
              className="flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2.5 rounded-xl border border-indigo-100 dark:border-indigo-800/50 hover:shadow-md hover:shadow-indigo-500/10"
            >
              <Check className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all duration-200 whitespace-nowrap border ${
                filter === opt.value
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                  : 'bg-white dark:bg-[#1e293b]/60 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {opt.label}
              {opt.value === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 bg-white/20 text-white px-1.5 py-px rounded-full text-[10px]">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Notification List */}
        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-sm text-gray-400 font-medium">Loading notifications...</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#1e293b]/70 border border-gray-100 dark:border-gray-700 rounded-2xl backdrop-blur-md">
            <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-5">
              <Inbox className="w-10 h-10 text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {filter === 'all' ? 'All caught up!' : 'No notifications found'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm max-w-sm mx-auto">
              {filter === 'all' 
                ? 'You have no new notifications right now. Report an issue to get started!' 
                : `No ${filter === 'unread' ? 'unread' : filter.replace('_', ' ')} notifications found.`
              }
            </p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="mt-4 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors"
              >
                Show all notifications →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((notification, index) => {
              const config = getNotifConfig(notification.type);
              return (
                <div 
                  key={notification.id}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                  className={`flex gap-4 p-5 rounded-2xl border transition-all duration-200 cursor-pointer group relative overflow-hidden ${
                    notification.is_read 
                      ? 'bg-white/60 dark:bg-[#1e293b]/40 border-gray-100 dark:border-gray-800 opacity-75 hover:opacity-100' 
                      : 'bg-white dark:bg-[#1e293b]/80 border-indigo-100 dark:border-indigo-900/40 shadow-sm hover:shadow-md hover:shadow-indigo-500/5'
                  }`}
                  style={{ 
                    animation: `notifFadeIn 0.3s ease-out ${index * 0.05}s both` 
                  }}
                >
                  {/* Left accent bar for unread */}
                  {!notification.is_read && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-l-2xl" />
                  )}
                  
                  {/* Type Icon */}
                  <div className={`mt-0.5 flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${config.bg}`}>
                    {config.icon}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1 mb-1.5">
                      <div className="flex items-center gap-2">
                        <h4 className={`text-sm font-bold ${notification.is_read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                          {notification.title || 'Notification'}
                        </h4>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-gray-500 shrink-0">
                        <Clock className="w-3 h-3" />
                        {timeAgo(notification.created_at)}
                      </span>
                    </div>
                    
                    <p className={`text-sm leading-relaxed mb-3 ${notification.is_read ? 'text-gray-500 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'}`}>
                      {notification.message}
                    </p>
                    
                    {notification.issue_id && (
                      <Link 
                        href={`/track?id=${notification.issue_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors bg-indigo-50 dark:bg-indigo-900/10 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/20"
                      >
                        View Issue Details
                        <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </Link>
                    )}
                  </div>

                  {/* Unread indicator dot */}
                  {!notification.is_read && (
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0 mt-2 shadow-sm shadow-indigo-500/50 animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inline animation keyframes */}
      <style jsx>{`
        @keyframes notifFadeIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
