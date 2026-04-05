"use client";

import React, { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from './NotificationBell';
import { AuthGuard } from '@/components/auth/AuthGuard';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthGuard>
      <div className="flex h-screen bg-[#eaf0f6] dark:bg-[#0a0f1e] overflow-hidden font-sans transition-colors duration-300">
        <Sidebar />
        <div className="flex-1 ml-64 flex flex-col relative overflow-hidden bg-gradient-to-br from-[#f2f7fb] to-[#e6eef5] dark:from-[#0a0f1e] dark:to-[#1a2235]">
          {/* Top Header */}
          <header className="h-16 flex items-center justify-end px-8 border-b border-gray-200/50 dark:border-white/5 bg-white/30 dark:bg-[#0a0f1e]/30 backdrop-blur-md z-10 sticky top-0 transition-colors duration-300">
            <div className="flex items-center gap-4">
              <NotificationBell />
              <ThemeToggle />
              <div className="flex items-center gap-2 bg-white dark:bg-[#1e293b] px-3 py-1.5 rounded-full shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Live Tracking
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-8 relative">
            {/* Glassmorphic decorative orbs */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-green-400/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
            <div className="max-w-7xl mx-auto h-full relative z-0">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
