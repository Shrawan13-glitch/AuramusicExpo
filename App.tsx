import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { PlayerProvider } from './src/store/PlayerContext';
import { LibraryProvider } from './src/store/LibraryContext';
import MiniPlayer from './src/components/MiniPlayer';

export default function App() {
  return (
    <SafeAreaProvider>
      <LibraryProvider>
        <PlayerProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </PlayerProvider>
      </LibraryProvider>
    </SafeAreaProvider>
  );
}
