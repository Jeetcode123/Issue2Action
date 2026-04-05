"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, FileText, AlertCircle, Bell, UserPlus, LogOut, Shield, Map } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/components/auth/AuthProvider';
import { getPublicIssues } from '@/lib/api';

const navItems = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'Report Issue', href: '/report', icon: FileText },
  { name: 'My Reports', href: '/my-reports', icon: UserPlus },
  { name: 'Live Map', href: '/map', icon: Map },
  { name: 'Authorities (Admin)', href: '/admin/authorities', icon: Shield },
  { name: 'Notifications', href: '/notifications', icon: Bell },
];

const TYPE_COLORS: Record<string, string> = {
  'Road Damage': 'bg-orange-500',
  'Water Leak': 'bg-blue-500',
  'Garbage Dumping': 'bg-green-500',
  'Broken Streetlights': 'bg-yellow-500',
  'Sewer Issue': 'bg-purple-500',
  'Other': 'bg-gray-500',
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [topIssues, setTopIssues] = useState<{ name: string; color: string; count: number }[]>([]);
  
  // Extract user details defensively
  const displayName = user?.user_metadata?.first_name 
    || user?.email?.split('@')[0] 
    || user?.phone 
    || "Citizen";

  useEffect(() => {
    getPublicIssues().then(issues => {
      const counts: Record<string, number> = {};
      (issues || []).forEach(i => {
        const t = i.type || 'Other';
        counts[t] = (counts[t] || 0) + 1;
      });
      const sorted = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name, count]) => ({
          name,
          count,
          color: TYPE_COLORS[name] || 'bg-gray-500',
        }));
      setTopIssues(sorted);
    }).catch(() => {
      // Silent fallback
    });
  }, []);

  return (
    <aside className="w-64 h-screen bg-white dark:bg-[#0d1627] text-gray-900 dark:text-white flex flex-col border-r border-gray-200 dark:border-white/5 fixed left-0 top-0 transition-colors duration-300">
      <div className="p-6">
        <Logo className="text-gray-900 dark:text-white" />
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
                isActive 
                  ? "bg-purple-100 dark:bg-white text-purple-900 dark:text-[#0d1627] shadow-sm font-bold" 
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-purple-700 dark:text-[#0d1627]" : "")} />
              {item.name}
            </Link>
          )
        })}

        <div className="pt-8">
          <p className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-white/5 pb-2">
            Trending Issues
          </p>
          <div className="space-y-3 px-2">
            {topIssues.length > 0 ? topIssues.map((issue, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors">
                <div className={cn("w-6 h-6 rounded flex items-center justify-center", issue.color)}>
                  <AlertCircle className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{issue.name}</span>
                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{issue.count}</span>
              </div>
            )) : (
              <p className="text-xs text-gray-400 dark:text-gray-600 px-2 italic">Loading trends...</p>
            )}
          </div>
        </div>
      </nav>

      <div className="p-4 mt-auto border-t border-gray-200 dark:border-white/5 space-y-2">
        <div className="flex items-center justify-between px-2 py-2 group">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-xs uppercase shadow-sm">
              {displayName.charAt(0)}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">{displayName}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || "User Account"}</span>
            </div>
          </div>
          <button 
            onClick={logout}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
