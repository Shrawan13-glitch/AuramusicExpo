import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { InteractionManager } from 'react-native';

import AppNavigator from './src/navigation/AppNavigator';
import AuthScreen from './src/screens/AuthScreen';
import LoginScreen from './src/screens/LoginScreen';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { PlayerProvider } from './src/contexts/PlayerContext';
import { SongOptionsProvider } from './src/contexts/SongOptionsContext';
import { darkTheme } from './src/theme/theme';
import { AuthCookie } from './src/utils/cookieManager';
import MusicController from './src/components/MusicController';

const AppContent = React.memo(() => {
  const { isAuthenticated, login } = useAuth();
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const navigationRef = useNavigationContainerRef();
  const [routeName, setRouteName] = useState<string | undefined>(undefined);
  const insets = useSafeAreaInsets();

  const handleAuthComplete = useCallback((cookies: AuthCookie[]) => {
    // Run auth completion after interactions to avoid blocking UI
    InteractionManager.runAfterInteractions(() => {
      login(cookies);
    });
  }, [login]);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowAuthScreen(false);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    if (!showAuthScreen) {
      return <LoginScreen onLoginPress={() => setShowAuthScreen(true)} />;
    }

    return <AuthScreen onAuthComplete={handleAuthComplete} />;
  }

  return (
    <PlayerProvider>
      <SongOptionsProvider>
        <NavigationContainer
          ref={navigationRef}
          onReady={() => setRouteName(navigationRef.getCurrentRoute()?.name)}
          onStateChange={() => setRouteName(navigationRef.getCurrentRoute()?.name)}
        >
          <View style={{ flex: 1 }}>
            <AppNavigator />
            <MusicController
              bottomOffset={insets.bottom + (routeName === 'Main' ? 88 : 8)}
              activeRouteName={routeName}
            />
          </View>
        </NavigationContainer>
      </SongOptionsProvider>
    </PlayerProvider>
  );
});

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={darkTheme}>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
