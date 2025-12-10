import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLibrary } from '../store/LibraryContext';
import { useDownload } from '../store/DownloadContext';

export default function PrivacySettingsScreen({ navigation }: any) {
  const [crashReporting, setCrashReporting] = useState(true);
  const [analytics, setAnalytics] = useState(true);
  const { likedSongs } = useLibrary();
  const { downloadedSongs, clearAllDownloads } = useDownload();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const crash = await AsyncStorage.getItem('crashReporting');
      const analyticsData = await AsyncStorage.getItem('analytics');
      if (crash !== null) setCrashReporting(JSON.parse(crash));
      if (analyticsData !== null) setAnalytics(JSON.parse(analyticsData));
    } catch (error) {
      // Error loading settings handled silently
    }
  };

  const saveSetting = async (key: string, value: boolean) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Error saving setting handled silently
    }
  };

  const handleCrashReporting = (value: boolean) => {
    setCrashReporting(value);
    saveSetting('crashReporting', value);
  };

  const handleAnalytics = (value: boolean) => {
    setAnalytics(value);
    saveSetting('analytics', value);
  };

  const clearLikedSongs = () => {
    Alert.alert(
      'Clear Liked Songs',
      'This will remove all your liked songs. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('likedSongs');
              Alert.alert('Success', 'Liked songs cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear liked songs');
            }
          }
        }
      ]
    );
  };

  const clearRecentlyPlayed = () => {
    Alert.alert(
      'Clear Recently Played',
      'This will remove your recently played history. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('recentlyPlayed');
              Alert.alert('Success', 'Recently played cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear recently played');
            }
          }
        }
      ]
    );
  };

  const clearCachedSongs = () => {
    Alert.alert(
      'Clear Cached Songs',
      'This will remove all cached songs. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('cached_songs');
              Alert.alert('Success', 'Cached songs cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cached songs');
            }
          }
        }
      ]
    );
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will remove all your data including liked songs, downloads, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                'likedSongs',
                'recentlyPlayed',
                'cached_songs',
                'downloadQuality',
                'playerBackgroundStyle'
              ]);
              await clearAllDownloads();
              Alert.alert('Success', 'All data cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear all data');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Collection</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Crash Reporting</Text>
              <Text style={styles.settingDescription}>Help improve the app by sending crash reports</Text>
            </View>
            <Switch
              value={crashReporting}
              onValueChange={handleCrashReporting}
              trackColor={{ false: '#333', true: '#1db954' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Analytics</Text>
              <Text style={styles.settingDescription}>Help improve the app by sharing usage data</Text>
            </View>
            <Switch
              value={analytics}
              onValueChange={handleAnalytics}
              trackColor={{ false: '#333', true: '#1db954' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clear Data</Text>
          
          <TouchableOpacity style={styles.clearButton} onPress={clearLikedSongs}>
            <Ionicons name="heart-outline" size={20} color="#ff4757" />
            <View style={styles.clearButtonInfo}>
              <Text style={styles.clearButtonTitle}>Clear Liked Songs</Text>
              <Text style={styles.clearButtonSubtitle}>{likedSongs.length} songs</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearButton} onPress={clearRecentlyPlayed}>
            <Ionicons name="time-outline" size={20} color="#ff4757" />
            <View style={styles.clearButtonInfo}>
              <Text style={styles.clearButtonTitle}>Clear Recently Played</Text>
              <Text style={styles.clearButtonSubtitle}>History data</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearButton} onPress={clearCachedSongs}>
            <Ionicons name="server-outline" size={20} color="#ff4757" />
            <View style={styles.clearButtonInfo}>
              <Text style={styles.clearButtonTitle}>Clear Cached Songs</Text>
              <Text style={styles.clearButtonSubtitle}>Temporary files</Text>
            </View>
          </TouchableOpacity>

          {downloadedSongs.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={clearAllDownloads}>
              <Ionicons name="download-outline" size={20} color="#ff4757" />
              <View style={styles.clearButtonInfo}>
                <Text style={styles.clearButtonTitle}>Clear Downloads</Text>
                <Text style={styles.clearButtonSubtitle}>{downloadedSongs.length} downloaded songs</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.dangerButton} onPress={clearAllData}>
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.dangerButtonText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#fff', flex: 1, textAlign: 'center' },
  scrollContent: { paddingBottom: 100 },
  section: { paddingHorizontal: 20, marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 16 },
  settingItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    backgroundColor: '#121212', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#282828'
  },
  settingInfo: { flex: 1, marginRight: 16 },
  settingTitle: { fontSize: 16, fontWeight: '500', color: '#fff', marginBottom: 4 },
  settingDescription: { fontSize: 14, color: '#aaa' },
  clearButton: { 
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#121212', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#282828'
  },
  clearButtonInfo: { flex: 1, marginLeft: 12 },
  clearButtonTitle: { fontSize: 16, fontWeight: '500', color: '#ff4757', marginBottom: 2 },
  clearButtonSubtitle: { fontSize: 14, color: '#aaa' },
  dangerButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: '#ff4757', 
    padding: 16, 
    borderRadius: 12,
    gap: 8
  },
  dangerButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});