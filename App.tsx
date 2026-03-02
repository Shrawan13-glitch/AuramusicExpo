import React, { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Button, Dialog, PaperProvider, Portal, Text } from 'react-native-paper';
import { InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import AppNavigator from './src/navigation/AppNavigator';
import AuthScreen from './src/screens/AuthScreen';
import LoginScreen from './src/screens/LoginScreen';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { PlayerProvider } from './src/contexts/PlayerContext';
import { SongOptionsProvider } from './src/contexts/SongOptionsContext';
import { darkTheme } from './src/theme/theme';
import { AuthCookie } from './src/utils/cookieManager';
import MusicController from './src/components/MusicController';
import StartupSplash from './src/components/StartupSplash';
import {
  DEFAULT_SPLASH_MIN_DURATION_MS,
  normalizeSplashMinDurationMs,
  SPLASH_MIN_DURATION_KEY,
} from './src/utils/splashSettings';
import { checkForAppUpdate } from './src/utils/updater';
import { applyOtaUpdateNow, checkAndFetchOtaUpdate } from './src/utils/otaUpdater';

const AppContent = React.memo(() => {
  const { isAuthLoading, isAuthenticated, login } = useAuth();
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [isMinSplashDone, setIsMinSplashDone] = useState(false);
  const [isSplashClosing, setIsSplashClosing] = useState(false);
  const [isSplashClosed, setIsSplashClosed] = useState(false);
  const [isSplashConfigLoaded, setIsSplashConfigLoaded] = useState(false);
  const [splashMinDurationMs, setSplashMinDurationMs] = useState(DEFAULT_SPLASH_MIN_DURATION_MS);
  const [didAutoCheckOta, setDidAutoCheckOta] = useState(false);
  const [didAutoCheckStrictApk, setDidAutoCheckStrictApk] = useState(false);
  const [isOtaPromptVisible, setIsOtaPromptVisible] = useState(false);
  const [otaStatusMessage, setOtaStatusMessage] = useState<string | null>(null);
  const [isApplyingOta, setIsApplyingOta] = useState(false);
  const [didRequestNotificationPermission, setDidRequestNotificationPermission] = useState(false);
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

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(SPLASH_MIN_DURATION_KEY)
      .then((stored) => {
        if (!active) return;
        setSplashMinDurationMs(normalizeSplashMinDurationMs(stored));
      })
      .catch(() => {
        if (!active) return;
        setSplashMinDurationMs(DEFAULT_SPLASH_MIN_DURATION_MS);
      })
      .finally(() => {
        if (active) setIsSplashConfigLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isSplashConfigLoaded) return;
    const timer = setTimeout(() => setIsMinSplashDone(true), splashMinDurationMs);
    return () => clearTimeout(timer);
  }, [isSplashConfigLoaded, splashMinDurationMs]);

  useEffect(() => {
    if (!isAuthLoading && isSplashConfigLoaded && isMinSplashDone && !isSplashClosing && !isSplashClosed) {
      setIsSplashClosing(true);
    }
  }, [isAuthLoading, isSplashConfigLoaded, isMinSplashDone, isSplashClosing, isSplashClosed]);

  useEffect(() => {
    if (didRequestNotificationPermission) return;
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

    let active = true;
    const requestNotificationPermission = async () => {
      try {
        const currentPermission = await Notifications.getPermissionsAsync();
        if (!active) return;

        if (currentPermission.status !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
      } catch (error) {
        console.warn('Failed to request notification permission', error);
      } finally {
        if (active) setDidRequestNotificationPermission(true);
      }
    };

    requestNotificationPermission();
    return () => {
      active = false;
    };
  }, [didRequestNotificationPermission]);

  useEffect(() => {
    if (didAutoCheckOta) return;
    if (!isAuthenticated) return;
    if (!navigationRef.isReady()) return;

    setDidAutoCheckOta(true);
    checkAndFetchOtaUpdate()
      .then((result) => {
        if (result.message) {
          setOtaStatusMessage(result.message);
        }
        if (!result.isPending) return;
        setIsOtaPromptVisible(true);
      })
      .catch(() => {});
  }, [didAutoCheckOta, isAuthenticated, navigationRef, routeName]);

  useEffect(() => {
    if (didAutoCheckStrictApk) return;
    if (!isAuthenticated) return;
    if (!navigationRef.isReady()) return;
    if (Platform.OS !== 'android') return;

    const currentVersion =
      Constants.expoConfig?.version ||
      (Constants.manifest2 as { extra?: { expoClient?: { version?: string } } } | null)?.extra?.expoClient?.version ||
      '0.0.0';

    setDidAutoCheckStrictApk(true);
    checkForAppUpdate(currentVersion)
      .then((update) => {
        if (!update) return;
        if (!update.isStrict) return;
        const currentRoute = navigationRef.getCurrentRoute()?.name;
        if (currentRoute === 'Update') return;
        navigationRef.navigate('Update' as never, { prefetchedUpdate: update, autoOpened: true } as never);
      })
      .catch(() => {});
  }, [didAutoCheckStrictApk, isAuthenticated, navigationRef, routeName]);

  const handleApplyOta = useCallback(async () => {
    if (isApplyingOta) return;
    setIsApplyingOta(true);
    try {
      await applyOtaUpdateNow();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply OTA update.';
      setOtaStatusMessage(message);
      setIsOtaPromptVisible(false);
      setIsApplyingOta(false);
    }
  }, [isApplyingOta]);

  if (!isSplashClosed) {
    return (
      <StartupSplash
        isClosing={isSplashClosing}
        onCloseComplete={() => setIsSplashClosed(true)}
      />
    );
  }

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
        <Portal>
          <Dialog visible={isOtaPromptVisible} onDismiss={() => setIsOtaPromptVisible(false)}>
            <Dialog.Title>Update ready</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium">
                A new app update has been downloaded. Restart now to apply it.
              </Text>
              {!!otaStatusMessage && (
                <Text variant="bodySmall" style={{ marginTop: 8 }}>
                  {otaStatusMessage}
                </Text>
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setIsOtaPromptVisible(false)} disabled={isApplyingOta}>
                Later
              </Button>
              <Button onPress={() => void handleApplyOta()} loading={isApplyingOta} disabled={isApplyingOta}>
                Restart now
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
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
