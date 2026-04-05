"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User } from '../lib/types';
import { getPublicIssues, PublicIssue } from '../lib/api';

interface AppState {
  user: User | null;
  issues: PublicIssue[];
  notifications: any[];
}

interface AppContextType {
  state: AppState;
  setUser: (user: User | null) => void;
  setIssues: (issues: PublicIssue[]) => void;
  setNotifications: (notifications: any[]) => void;
  refreshIssues: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>({
    user: null,
    issues: [],
    notifications: [],
  });

  const setUser = (user: User | null) => {
    setState((prev) => ({ ...prev, user }));
  };

  const setIssues = (issues: PublicIssue[]) => {
    setState((prev) => ({ ...prev, issues }));
  };

  const setNotifications = (notifications: any[]) => {
    setState((prev) => ({ ...prev, notifications }));
  };

  const refreshIssues = async () => {
    try {
      const issues = await getPublicIssues();
      setIssues(issues);
    } catch (error: any) {
      console.warn("Failed to refresh issues:", error?.message || error);
    }
  };

  useEffect(() => {
    // Initial fetch
    refreshIssues();
  }, []);

  return (
    <AppContext.Provider value={{ state, setUser, setIssues, setNotifications, refreshIssues }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
