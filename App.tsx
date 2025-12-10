import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet, InteractionManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import { PlayerProvider } from './src/store/PlayerContext';
import { LibraryProvider } from './src/store/LibraryContext';
import { AuthProvider } from './src/store/AuthContext';
import { DownloadProvider } from './src/store/DownloadContext';
import { NotificationProvider } from './src/store/NotificationContext';
import MiniPlayer from './src/components/MiniPlayer';
import { checkForUpdates } from './src/utils/updateChecker';

// Enable StrictMode in development
if (__DEV__) {
  const { enableScreens } = require('react-native-screens');
  enableScreens(true);
}

export default function App() {
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    // Defer non-critical initialization until after interactions
    const checkUpdates = () => {
      InteractionManager.runAfterInteractions(async () => {
        try {
          const { hasUpdate, updateInfo } = await checkForUpdates();
          if (hasUpdate && updateInfo && navigationRef.current) {
            navigationRef.current?.navigate('Update', { updateInfo });
          }
        } catch (error) {
          // Update check failed silently
        }
      });
    };
    
    // Delay update check to not block startup
    setTimeout(checkUpdates, 3000);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NotificationProvider>
          <AuthProvider>
            <LibraryProvider>
              <DownloadProvider>
                <PlayerProvider>
                  <NavigationContainer
                    ref={navigationRef}
                    onReady={() => {
                      // Navigation ready
                    }}
                  >
                    <AppNavigator />
                  </NavigationContainer>
                </PlayerProvider>
              </DownloadProvider>
            </LibraryProvider>
          </AuthProvider>
        </NotificationProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
