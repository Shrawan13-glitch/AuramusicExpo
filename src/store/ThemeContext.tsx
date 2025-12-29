import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeSettings {
  backgroundImage: string | null;
  blurIntensity: number;
  overlayOpacity: number;
  enableBackground: boolean;
}

interface ThemeContextType {
  theme: ThemeSettings;
  updateTheme: (settings: Partial<ThemeSettings>) => void;
  resetTheme: () => void;
}

const defaultTheme: ThemeSettings = {
  backgroundImage: null,
  blurIntensity: 10,
  overlayOpacity: 0.7,
  enableBackground: false,
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeSettings>(defaultTheme);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem('theme_settings');
      if (saved) {
        setTheme(JSON.parse(saved));
      }
    } catch (error) {
      console.log('Error loading theme:', error);
    }
  };

  const updateTheme = async (settings: Partial<ThemeSettings>) => {
    const newTheme = { ...theme, ...settings };
    setTheme(newTheme);
    try {
      await AsyncStorage.setItem('theme_settings', JSON.stringify(newTheme));
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  };

  const resetTheme = async () => {
    setTheme(defaultTheme);
    try {
      await AsyncStorage.removeItem('theme_settings');
    } catch (error) {
      console.log('Error resetting theme:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};