"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { insforge } from '@/lib/insforge';
import { useRouter, usePathname } from 'next/navigation';
import { saveAuth, clearAuth } from '@/lib/auth';

interface AuthContextType {
  user: any;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        if (window.location.search.includes('code=') || window.location.search.includes('insforge_code=')) {
          await new Promise(r => setTimeout(r, 1000));
        }

        const { data, error } = await insforge.auth.getCurrentUser();
        
        if (error || !data?.user) {
          if (mounted) {
            setUser(null);
            clearAuth(); // ensure backend proxy token is cleared
          }
        } else {
          if (mounted) {
            setUser(data.user);
            
            // Sync local custom JWT token for backend proxy
            let foundToken = 'oauth-placeholder-token';
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (key.includes('auth.token') || key.includes('-auth-token'))) {
                try {
                  const session = JSON.parse(localStorage.getItem(key) || '{}');
                  if (session?.accessToken) foundToken = session.accessToken;
                } catch(e) {}
              }
            }
            saveAuth(foundToken, data.user.id);
          }
        }
      } catch (err) {
        if (mounted) {
          setUser(null);
          clearAuth();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkAuth();

    return () => { mounted = false; };
  }, [pathname]);

  const logout = async () => {
    setLoading(true);
    await insforge.auth.signOut();
    setUser(null);
    clearAuth();
    router.replace('/login');
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
