import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Appbar, 
  ActivityIndicator, 
  useTheme
} from 'react-native-paper';
import { AuthCookie } from '../utils/cookieManager';

interface AuthScreenProps {
  onAuthComplete: (cookies: AuthCookie[]) => void;
}

const AuthScreen = React.memo(({ onAuthComplete }: AuthScreenProps) => {
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const webViewRef = useRef<WebView>(null);
  const lastExtractAtRef = useRef(0);

  const extractCookies = useCallback(async () => {
    if (!webViewRef.current) return;

    const injectedJavaScript = `
      (function() {
        const cookies = document.cookie.split(';').map(cookie => {
          const [name, value] = cookie.trim().split('=');
          return {
            name: name,
            value: value || '',
            domain: window.location.hostname,
            path: '/'
          };
        }).filter(cookie => cookie.name && cookie.value);
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'cookies',
          cookies: cookies
        }));
      })();
    `;

    webViewRef.current.injectJavaScript(injectedJavaScript);
  }, []);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'cookies' && data.cookies.length > 0) {
        const authCookies = data.cookies.filter((cookie: AuthCookie) =>
          cookie.name.includes('SID') ||
          cookie.name.includes('SAPISID') ||
          cookie.name.includes('APISID') ||
          cookie.name.includes('LOGIN_INFO') ||
          cookie.name.startsWith('__Secure')
        );

        if (authCookies.length > 0) {
          onAuthComplete(data.cookies);
        }
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }, [onAuthComplete]);

  const handleNavigationStateChange = useCallback((navState: any) => {
    const url = navState.url || '';
    const isAuthRelated =
      url.includes('google.com') ||
      url.includes('youtube.com');

    if (!isAuthRelated) return;

    const now = Date.now();
    if (now - lastExtractAtRef.current < 2500) return;
    lastExtractAtRef.current = now;

    setTimeout(extractCookies, 1500);
  }, [extractCookies]);

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.Content title="Login to YouTube Music" />
      </Appbar.Header>

      <View style={styles.webViewContainer}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}
        
        <WebView
          ref={webViewRef}
          source={{ uri: 'https://music.youtube.com' }}
          onLoadEnd={handleLoadEnd}
          onNavigationStateChange={handleNavigationStateChange}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          style={styles.webView}
          userAgent="Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
        />
      </View>
    </SafeAreaView>
  );
});

export default AuthScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    zIndex: 1,
  },
});
