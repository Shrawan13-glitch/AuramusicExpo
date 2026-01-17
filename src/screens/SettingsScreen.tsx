import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, BackHandler, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import { useAnimation } from '../store/AnimationContext';
import { useAssistant } from '../hooks/useAssistant';
import { checkForUpdatesV2, getCurrentVersion } from '../utils/updateCheckerV2';
import { cacheManager } from '../utils/cacheManager';
import Toast from '../components/Toast';
import SettingsModal from '../components/SettingsModal';
import AssistantScreen from './AssistantScreen';

export default function SettingsScreen({ navigation }: any) {
  const { isAuthenticated, accountInfo, logout } = useAuth();
  const { settings, updateSettings } = useAnimation();
  const { showAssistant, openAssistant, closeAssistant } = useAssistant();
  const [checking, setChecking] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [showCacheModal, setShowCacheModal] = useState(false);
  const [showPlayerUIModal, setShowPlayerUIModal] = useState(false);
  const [showTabIconModal, setShowTabIconModal] = useState(false);
  const [cacheSize, setCacheSize] = useState(500);
  const [cacheStats, setCacheStats] = useState({ totalSize: 0, songCount: 0 });

  // Handle back button for cache modal
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showCacheModal) {
        setShowCacheModal(false);
        return true;
      }
      if (showPlayerUIModal) {
        setShowPlayerUIModal(false);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [showCacheModal, showPlayerUIModal]);

  useEffect(() => {
    const speedDelays = { fast: 250, normal: 350, slow: 550 };
    const timer = setTimeout(() => setShowContent(true), speedDelays[settings.speed]);
    loadCacheSettings();
    return () => clearTimeout(timer);
  }, [settings.speed]);

  const loadCacheSettings = async () => {
    try {
      const [maxSize, stats] = await Promise.all([
        cacheManager.getMaxCacheSize(),
        cacheManager.getCacheStats()
      ]);
      setCacheSize(maxSize);
      setCacheStats(stats);
    } catch (error) {
      
    }
  };

  const handleCheckUpdates = useCallback(async () => {
    setChecking(true);
    const { hasUpdate, updateInfo, selectedDownload } = await checkForUpdatesV2();
    setChecking(false);
    if (hasUpdate && updateInfo && selectedDownload) {
      navigation.navigate('Update', { updateInfo, selectedDownload });
    } else {
      setShowToast(true);
    }
  }, [navigation]);

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will remove all cached songs. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await cacheManager.clearAllCache();
            loadCacheSettings();
          }
        }
      ]
    );
  };

  const handleSavePlayerUI = async (selectedKey: string) => {
    const isModern = selectedKey === 'modern';
    await updateSettings({ modernPlayerUI: isModern });
  };

  const handleSaveTabIcons = async (selectedKey: string) => {
    await updateSettings({ tabBarIconStyle: selectedKey });
  };

  const tabIconOptions = [
    { key: 'filled', label: 'Filled Icons', subtitle: 'Solid filled icon style' },
    { key: 'outline', label: 'Outline Icons', subtitle: 'Clean outline style' },
    { key: 'default', label: 'Default Icons', subtitle: 'Standard Ionicons style' }
  ];

  const playerUIOptions = [
    { key: 'modern', label: 'Modern Design', subtitle: 'Card-based layout with floating controls' },
    { key: 'classic', label: 'Classic Design', subtitle: 'Traditional music player layout' }
  ];

  const handleSaveCacheSize = async (selectedSize: string) => {
    const size = parseInt(selectedSize);
    setCacheSize(size);
    await cacheManager.setMaxCacheSize(size);
    loadCacheSettings();
  };

  const cacheOptions = [
    { key: '100', label: '100 MB', subtitle: 'Minimal storage usage' },
    { key: '250', label: '250 MB', subtitle: 'Light usage' },
    { key: '500', label: '500 MB', subtitle: 'Recommended' },
    { key: '1000', label: '1 GB', subtitle: 'Heavy usage' },
    { key: '2000', label: '2 GB', subtitle: 'Maximum storage' }
  ];

  const formatSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const SettingItem = ({ icon, iconFamily = 'Ionicons', title, subtitle, onPress, showArrow = true, iconColor = '#666' }) => {
    const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'Feather' ? Feather : Ionicons;
    
    return (
      <TouchableOpacity style={styles.settingItem} onPress={onPress}>
        <IconComponent name={icon} size={24} color={iconColor} style={styles.settingIcon} />
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
        {showArrow && <Ionicons name="chevron-forward" size={20} color="#666" />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity onPress={openAssistant} style={styles.assistantButton}>
          <Ionicons name="mic" size={24} color="#1db954" />
        </TouchableOpacity>
      </View>

      {showContent && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
              icon="music-note"
              iconFamily="MaterialIcons"
              title="Player"
              subtitle="Playback settings"
              onPress={() => navigation.navigate('PlayerSettings')}
              iconColor="#1db954"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>STORAGE</Text>
            <SettingItem
              icon="folder"
              iconFamily="Feather"
              title="Cached Songs"
              subtitle={`${cacheStats.songCount} songs • ${formatSize(cacheStats.totalSize)}`}
              onPress={() => navigation.navigate('CachedSongs')}
              iconColor="#f39c12"
            />
            <SettingItem
              icon="musical-note-outline"
              title="Cached Lyrics"
              subtitle="Manage stored lyrics"
              onPress={() => navigation.navigate('CachedLyrics')}
              iconColor="#e67e22"
            />
            <SettingItem
              icon="settings-outline"
              title="Cache Settings"
              subtitle={`Max size: ${cacheSize} MB`}
              onPress={() => setShowCacheModal(true)}
              iconColor="#9b59b6"
            />
            <SettingItem
              icon="trash-outline"
              title="Clear Cache"
              subtitle="Remove all cached songs"
              onPress={handleClearCache}
              iconColor="#e74c3c"
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
            <SettingItem
              icon="smartphone"
              iconFamily="Feather"
              title="Player UI Style"
              subtitle={settings.modernPlayerUI ? 'Modern design' : 'Classic design'}
              onPress={() => setShowPlayerUIModal(true)}
              iconColor="#9b59b6"
            />
            <SettingItem
              icon="grid"
              iconFamily="Feather"
              title="Tab Bar Icons"
              subtitle={settings.tabBarIconStyle === 'filled' ? 'Filled style' : settings.tabBarIconStyle === 'outline' ? 'Outline style' : 'Default style'}
              onPress={() => setShowTabIconModal(true)}
              iconColor="#e67e22"
            />
            <SettingItem
              icon="mic-outline"
              title="Voice Assistant"
              subtitle="Voice commands & settings"
              onPress={() => navigation.navigate('VoiceSettings')}
              iconColor="#1db954"
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

      {/* Cache Settings Modal */}
      <SettingsModal
        visible={showCacheModal}
        title="Cache Size"
        options={cacheOptions}
        selectedKey={cacheSize.toString()}
        onSelect={handleSaveCacheSize}
        onClose={() => setShowCacheModal(false)}
      />
      {/* Player UI Settings Modal */}
      <SettingsModal
        visible={showPlayerUIModal}
        title="Player UI Style"
        options={playerUIOptions}
        selectedKey={settings.modernPlayerUI ? 'modern' : 'classic'}
        onSelect={handleSavePlayerUI}
        onClose={() => setShowPlayerUIModal(false)}
      />
      {/* Tab Bar Icon Settings Modal */}
      <SettingsModal
        visible={showTabIconModal}
        title="Tab Bar Icons"
        options={tabIconOptions}
        selectedKey={settings.tabBarIconStyle}
        onSelect={handleSaveTabIcons}
        onClose={() => setShowTabIconModal(false)}
      />
      <Modal visible={showAssistant} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeAssistant}>
        <AssistantScreen onClose={closeAssistant} navigation={navigation} />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { width: 32 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#fff', textAlign: 'center' },
  content: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
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
  assistantButton: { width: 32 },
});