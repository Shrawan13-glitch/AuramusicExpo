import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AnimationSettings {
  enabled: boolean;
  speed: 'fast' | 'normal' | 'slow';
  modernPlayerUI: boolean;
  tabBarIconStyle: 'default' | 'filled' | 'outline';
}

interface AnimationContextType {
  settings: AnimationSettings;
  updateSettings: (settings: Partial<AnimationSettings>) => void;
}

const AnimationContext = createContext<AnimationContextType | undefined>(undefined);

const STORAGE_KEY = 'animation_settings';
const DEFAULT_SETTINGS: AnimationSettings = {
  enabled: true,
  speed: 'fast',
  modernPlayerUI: true,
  tabBarIconStyle: 'filled',
};

export const AnimationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AnimationSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Failed to load animation settings:', error);
    }
  };

  const updateSettings = async (newSettings: Partial<AnimationSettings>) => {
    try {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save animation settings:', error);
    }
  };

  return (
    <AnimationContext.Provider value={{ settings, updateSettings }}>
      {children}
    </AnimationContext.Provider>
  );
};

export const useAnimation = () => {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error('useAnimation must be used within AnimationProvider');
  }
  return context;
};