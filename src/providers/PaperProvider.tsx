import React from 'react';
import { PaperProvider as RNPaperProvider, MD3DarkTheme } from 'react-native-paper';

const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#1db954',
    secondary: '#1ed760',
    surface: '#121212',
    background: '#000000',
  },
};

interface PaperProviderProps {
  children: React.ReactNode;
}

export const PaperProvider: React.FC<PaperProviderProps> = ({ children }) => {
  return (
    <RNPaperProvider theme={theme}>
      {children}
    </RNPaperProvider>
  );
};