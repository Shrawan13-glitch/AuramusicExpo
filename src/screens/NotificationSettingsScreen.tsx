import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerForPushNotificationsAsync } from '../services/pushNotifications';

export default function NotificationSettingsScreen({ navigation }: any) {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [newReleases, setNewReleases] = useState(true);
  const [recommendations, setRecommendations] = useState(true);
  const [updates, setUpdates] = useState(true);

  useEffect(() => {
    checkPermissions();
    loadSettings();
  }, []);

  const checkPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setPermissionGranted(status === 'granted');
  };

  const loadSettings = async () => {
    try {
      const token = await AsyncStorage.getItem('pushToken');
      const releases = await AsyncStorage.getItem('notif_newReleases');
      const recs = await AsyncStorage.getItem('notif_recommendations');
      const upd = await AsyncStorage.getItem('notif_updates');
      
      if (token) setPushToken(token);
      if (releases !== null) setNewReleases(JSON.parse(releases));
      if (recs !== null) setRecommendations(JSON.parse(recs));
      if (upd !== null) setUpdates(JSON.parse(upd));
    } catch (error) {
      // Error loading settings handled silently
    }
  };

  const requestPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          setPermissionGranted(true);
          setPushToken(token);
          await AsyncStorage.setItem('pushToken', token);
          Alert.alert('Success', 'Notifications enabled successfully!');
        }
      } else {
        Alert.alert(
          'Permission Denied',
          'To receive notifications, please enable them in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to enable notifications. Please try again.');
    }
  };

  const saveSetting = async (key: string, value: boolean) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Error saving setting handled silently
    }
  };

  const handleNewReleases = (value: boolean) => {
    setNewReleases(value);
    saveSetting('notif_newReleases', value);
  };

  const handleRecommendations = (value: boolean) => {
    setRecommendations(value);
    saveSetting('notif_recommendations', value);
  };

  const handleUpdates = (value: boolean) => {
    setUpdates(value);
    saveSetting('notif_updates', value);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Ionicons 
              name={permissionGranted ? "notifications" : "notifications-off"} 
              size={32} 
              color={permissionGranted ? "#1db954" : "#ff4757"} 
            />
          </View>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>
              {permissionGranted ? 'Notifications Enabled' : 'Notifications Disabled'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {permissionGranted 
                ? 'You will receive notifications for selected categories'
                : 'Enable notifications to stay updated'
              }
            </Text>
          </View>
          {!permissionGranted && (
            <TouchableOpacity style={styles.enableButton} onPress={requestPermission}>
              <Text style={styles.enableButtonText}>Enable</Text>
            </TouchableOpacity>
          )}
        </View>

        {permissionGranted && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Types</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>New Releases</Text>
                <Text style={styles.settingDescription}>Get notified about new music releases</Text>
              </View>
              <Switch
                value={newReleases}
                onValueChange={handleNewReleases}
                trackColor={{ false: '#333', true: '#1db954' }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Recommendations</Text>
                <Text style={styles.settingDescription}>Personalized music recommendations</Text>
              </View>
              <Switch
                value={recommendations}
                onValueChange={handleRecommendations}
                trackColor={{ false: '#333', true: '#1db954' }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>App Updates</Text>
                <Text style={styles.settingDescription}>New features and improvements</Text>
              </View>
              <Switch
                value={updates}
                onValueChange={handleUpdates}
                trackColor={{ false: '#333', true: '#1db954' }}
                thumbColor="#fff"
              />
            </View>
          </View>
        )}

        {pushToken && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Device Token</Text>
            <View style={styles.tokenCard}>
              <Text style={styles.tokenText} numberOfLines={3}>{pushToken}</Text>
            </View>
          </View>
        )}
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
  statusCard: { 
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#121212', 
    margin: 20, 
    padding: 20, 
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#282828'
  },
  statusIcon: { marginRight: 16 },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
  statusSubtitle: { fontSize: 14, color: '#aaa' },
  enableButton: { 
    backgroundColor: '#1db954', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 8 
  },
  enableButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
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
  tokenCard: { 
    backgroundColor: '#121212', 
    padding: 16, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#282828'
  },
  tokenText: { fontSize: 12, color: '#aaa', fontFamily: 'monospace' },
});