import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CookieManager, AuthCookie } from '../utils/cookieManager';

interface AuthContextType {
  isAuthenticated: boolean;
  cookies: AuthCookie[];
  userProfile: any;
  login: (cookies: AuthCookie[]) => void;
  logout: () => void;
  refreshCookies: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [cookies, setCookies] = useState<AuthCookie[]>([]);
  const [userProfile, setUserProfile] = useState(null);

  const login = useCallback(async (authCookies: AuthCookie[]) => {
    const importantCookies = CookieManager.extractImportantCookies(authCookies);
    await CookieManager.saveCookies(importantCookies);
    setCookies(importantCookies);
    setIsAuthenticated(true);
    setUserProfile({ name: 'User', avatar: null });
  }, []);

  const logout = useCallback(async () => {
    await CookieManager.clearCookies();
    setCookies([]);
    setIsAuthenticated(false);
    setUserProfile(null);
  }, []);

  const refreshCookies = useCallback(async () => {
    const savedCookies = await CookieManager.getCookies();
    if (savedCookies.length > 0) {
      setCookies(savedCookies);
      setIsAuthenticated(true);
      setUserProfile({ name: 'User', avatar: null });
    }
  }, []);

  const contextValue = useMemo(() => ({
    isAuthenticated,
    cookies,
    userProfile,
    login,
    logout,
    refreshCookies,
  }), [isAuthenticated, cookies, userProfile, login, logout, refreshCookies]);

  React.useEffect(() => {
    refreshCookies();
  }, [refreshCookies]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}