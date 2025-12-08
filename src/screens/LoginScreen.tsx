import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../store/AuthContext';

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  const extractCookies = async (url: string) => {
    if (url.startsWith('https://music.youtube.com') && !url.includes('accounts.google.com')) {
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(`
          (function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'cookies',
              cookies: document.cookie,
              visitorData: window.yt?.config_?.VISITOR_DATA,
              dataSyncId: window.yt?.config_?.DATASYNC_ID
            }));
          })();
          true;
        `);
      }, 2000);
    }
  };

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'cookies' && data.cookies) {
        // Fetch account info
        setTimeout(async () => {
          try {
            const { InnerTube } = require('../api/innertube');
            const accountInfo = await InnerTube.getAccountInfo();
            await login(
              data.cookies,
              data.visitorData,
              data.dataSyncId ? data.dataSyncId.split('||')[0] : undefined,
              accountInfo
            );
          } catch (error) {
            console.error('Failed to fetch account info:', error);
          }
          
          navigation.navigate('Main', { screen: 'Library' });
        }, 500);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Login to YouTube Music</Text>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1db954" />
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: 'https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fmusic.youtube.com' }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={(navState) => extractCookies(navState.url)}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 50, gap: 16 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  loadingContainer: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -20, zIndex: 10 },
  webview: { flex: 1, backgroundColor: '#000' },
});
