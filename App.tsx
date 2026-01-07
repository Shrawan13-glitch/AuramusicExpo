import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet, InteractionManager, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import AppNavigator from './src/navigation/AppNavigator';
import { PlayerProvider } from './src/store/PlayerContext';
import { LibraryProvider } from './src/store/LibraryContext';
import { AuthProvider } from './src/store/AuthContext';
import { DownloadProvider } from './src/store/DownloadContext';
import { NotificationProvider } from './src/store/NotificationContext';
import { AnimationProvider } from './src/store/AnimationContext';
import { NetworkProvider } from './src/store/NetworkContext';
import MiniPlayer from './src/components/MiniPlayer';
import { checkForUpdatesV2 } from './src/utils/updateCheckerV2';

// Enable StrictMode in development
if (__DEV__) {
  const { enableScreens } = require('react-native-screens');
  enableScreens(true);
}

export default function App() {
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    // Keep app awake during music playback
    activateKeepAwakeAsync();
    
    return () => {
      deactivateKeepAwake();
    };
  }, []);

  useEffect(() => {
    // Defer non-critical initialization until after interactions
    const checkUpdates = () => {
      InteractionManager.runAfterInteractions(async () => {
        try {
          const { hasUpdate, updateInfo, selectedDownload } = await checkForUpdatesV2();
          if (hasUpdate && updateInfo && selectedDownload && navigationRef.current) {
            navigationRef.current?.navigate('Update', { updateInfo, selectedDownload });
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
        <NetworkProvider>
          <AnimationProvider>
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
          </AnimationProvider>
        </NetworkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
