import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { auth, profiles, credits } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import type { Profile } from '../types';

interface User {
  id: string;
  email?: string;
}

export interface AppContextValue {
  user: User | null;
  profile: Profile | null;
  creditBalance: number;
  toasts: ReturnType<typeof useToast>['toasts'];
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  refreshProfile: () => Promise<void>;
  refreshCredits: () => Promise<void>;
  setUser: (u: User | null) => void;
  setProfile: (p: Profile | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [creditBalance, setCreditBalance] = useState(0);
  const { toasts, toast, dismiss } = useToast();

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await profiles.get(user.id);
    if (data) {
      setProfile(data);
      setCreditBalance(data.credits ?? 0);
    }
  }, [user]);

  const refreshCredits = useCallback(async () => {
    if (!user) return;
    const bal = await credits.getBalance(user.id);
    setCreditBalance(bal);
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshProfile();
    }
  }, [user]);

  const value: AppContextValue = {
    user,
    profile,
    creditBalance,
    toasts,
    toast,
    dismissToast: dismiss,
    refreshProfile,
    refreshCredits,
    setUser,
    setProfile,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}
