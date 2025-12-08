import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { PlayerProvider } from './src/store/PlayerContext';
import { LibraryProvider } from './src/store/LibraryContext';
import { AuthProvider } from './src/store/AuthContext';
import MiniPlayer from './src/components/MiniPlayer';
import { checkForUpdates } from './src/utils/updateChecker';

export default function App() {
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    const checkUpdates = async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const { hasUpdate, updateInfo } = await checkForUpdates();
      if (hasUpdate && updateInfo && navigationRef.current) {
        navigationRef.current?.navigate('Update', { updateInfo });
      }
    };
    checkUpdates();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LibraryProvider>
          <PlayerProvider>
            <NavigationContainer
              ref={navigationRef}
              onReady={() => {
                console.log('Navigation ready');
              }}
            >
              <AppNavigator />
            </NavigationContainer>
          </PlayerProvider>
        </LibraryProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
