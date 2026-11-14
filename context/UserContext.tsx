'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { AppUser } from '@/types/database';

interface UserContextValue {
  user: AppUser | null;
  loading: boolean;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch user from API
    fetch('/api/auth/user')
      .then(r => r.json())
      .then(data => {
        setUser(data.user || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext).user;
}

export function useUserContext() {
  return useContext(UserContext);
}