import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AccountInfo {
  name: string;
  email: string;
  channelHandle?: string;
  thumbnail?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  cookies: string | null;
  visitorData: string | null;
  accountInfo: AccountInfo | null;
  login: (cookies: string, visitorData?: string, dataSyncId?: string, accountInfo?: AccountInfo) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [cookies, setCookies] = useState<string | null>(null);
  const [visitorData, setVisitorData] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);

  useEffect(() => {
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      const savedCookies = await AsyncStorage.getItem('ytm_cookies');
      const savedVisitorData = await AsyncStorage.getItem('ytm_visitor_data');
      const savedAccount = await AsyncStorage.getItem('ytm_account');
      if (savedCookies && savedCookies.trim() !== '') {
        setCookies(savedCookies);
        setVisitorData(savedVisitorData);
        setAccountInfo(savedAccount ? JSON.parse(savedAccount) : null);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      setIsAuthenticated(false);
    }
  };

  const login = async (cookies: string, visitorData?: string, dataSyncId?: string, accountInfo?: AccountInfo) => {
    await AsyncStorage.setItem('ytm_cookies', cookies);
    if (visitorData) await AsyncStorage.setItem('ytm_visitor_data', visitorData);
    if (dataSyncId) await AsyncStorage.setItem('ytm_datasync_id', dataSyncId);
    if (accountInfo) await AsyncStorage.setItem('ytm_account', JSON.stringify(accountInfo));
    setCookies(cookies);
    setVisitorData(visitorData || null);
    setAccountInfo(accountInfo || null);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['ytm_cookies', 'ytm_visitor_data', 'ytm_datasync_id', 'ytm_account']);
    setCookies(null);
    setVisitorData(null);
    setAccountInfo(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, cookies, visitorData, accountInfo, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
