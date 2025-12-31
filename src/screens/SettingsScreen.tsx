import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import { useAnimation } from '../store/AnimationContext';
import { checkForUpdates, getCurrentVersion } from '../utils/updateChecker';
import Toast from '../components/Toast';

export default function SettingsScreen({ navigation }: any) {
  const { isAuthenticated, accountInfo, logout } = useAuth();
  const { settings } = useAnimation();
  const [checking, setChecking] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const speedDelays = { fast: 250, normal: 350, slow: 550 };
    const timer = setTimeout(() => setShowContent(true), speedDelays[settings.speed]);
    return () => clearTimeout(timer);
  }, [settings.speed]);

  const handleCheckUpdates = useCallback(async () => {
    setChecking(true);
    const { hasUpdate, updateInfo } = await checkForUpdates();
    setChecking(false);
    if (hasUpdate && updateInfo) {
      navigation.navigate('Update', { updateInfo });
    } else {
      setShowToast(true);
    }
  }, [navigation]);

  const SettingItem = ({ icon, title, subtitle, onPress, showArrow = true, iconColor = '#666' }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <Ionicons name={icon} size={24} color={iconColor} style={styles.settingIcon} />
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {showArrow && <Ionicons name="chevron-forward" size={20} color="#666" />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      {showContent && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {isAuthenticated && (
            <View style={styles.section}>
              <View style={styles.accountCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{accountInfo?.name?.[0]?.toUpperCase() || 'U'}</Text>
                </View>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{accountInfo?.name || 'User'}</Text>
                  <Text style={styles.accountEmail}>{accountInfo?.email}</Text>
                </View>
                <TouchableOpacity onPress={() => { logout(); navigation.goBack(); }} style={styles.logoutButton}>
                  <Ionicons name="log-out-outline" size={20} color="#ff4757" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>AUDIO</Text>
            <SettingItem
              icon="musical-notes"
              title="Player"
              subtitle="Playback settings"
              onPress={() => navigation.navigate('PlayerSettings')}
              iconColor="#1db954"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>INTERFACE</Text>
            <SettingItem
              icon="flash-outline"
              title="Animations"
              subtitle="Animation speed"
              onPress={() => navigation.navigate('AnimationSettings')}
              iconColor="#ff6b6b"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>APP</Text>
            <SettingItem
              icon="cloud-download-outline"
              title="Check for Updates"
              subtitle={checking ? 'Checking...' : 'Get latest version'}
              onPress={handleCheckUpdates}
              iconColor="#3498db"
            />
            <SettingItem
              icon="information-circle-outline"
              title="About"
              subtitle={`Version ${getCurrentVersion()}`}
              onPress={() => navigation.navigate('About')}
              iconColor="#95a5a6"
            />
          </View>
        </ScrollView>
      )}
      
      <Toast
        visible={showToast}
        message="You are on the latest version"
        type="success"
        onHide={() => setShowToast(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { width: 32 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#fff', textAlign: 'center' },
  content: { flex: 1 },
  section: { marginBottom: 32 },
  accountCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#121212', marginHorizontal: 20, padding: 20, borderRadius: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1db954', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  accountInfo: { flex: 1, marginLeft: 16 },
  accountName: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 2 },
  accountEmail: { fontSize: 14, color: '#aaa' },
  logoutButton: { padding: 8 },
  settingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20, backgroundColor: '#000' },
  settingIcon: { marginRight: 16, width: 24 },
  settingContent: { flex: 1, justifyContent: 'center' },
  settingTitle: { fontSize: 17, fontWeight: '400', color: '#fff', lineHeight: 22 },
  settingSubtitle: { fontSize: 15, color: '#8e8e93', marginTop: 2, lineHeight: 20 },
  sectionHeader: { fontSize: 13, fontWeight: '600', color: '#666', paddingHorizontal: 20, marginBottom: 8, letterSpacing: 0.5 },
});
