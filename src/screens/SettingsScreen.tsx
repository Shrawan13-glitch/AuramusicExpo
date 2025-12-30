import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import { checkForUpdates, getCurrentVersion } from '../utils/updateChecker';
import Toast from '../components/Toast';

const SettingCard = React.memo(({ icon, title, subtitle, onPress, iconColor = '#1db954', disabled }: any) => (
  <TouchableOpacity style={[styles.settingCard, disabled && styles.disabledCard]} onPress={onPress} activeOpacity={0.7} disabled={disabled}>
    <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
      <Ionicons name={icon} size={24} color={iconColor} />
    </View>
    <View style={styles.cardContent}>
      <Text style={styles.cardTitle}>{title}</Text>
      {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={20} color="#666" />
  </TouchableOpacity>
));

export default function SettingsScreen({ navigation }: any) {
  const { isAuthenticated, accountInfo, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [showToast, setShowToast] = useState(false);

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

  const settingsData = useMemo(() => [
    {
      id: 'player',
      icon: 'musical-notes',
      title: 'Player',
      subtitle: 'Playback & appearance',
      onPress: () => navigation.navigate('PlayerSettings'),
      iconColor: '#1db954'
    },
    {
      id: 'animations',
      icon: 'flash-outline',
      title: 'Animations',
      subtitle: 'Control app animations',
      onPress: () => navigation.navigate('AnimationSettings'),
      iconColor: '#ff6b6b'
    },
    {
      id: 'about',
      icon: 'information-circle-outline',
      title: 'About',
      subtitle: `Version ${getCurrentVersion()}`,
      onPress: () => navigation.navigate('About'),
      iconColor: '#747d8c'
    }
  ], [navigation]);

  const renderSettingCard = useCallback(({ item }: any) => (
    <SettingCard {...item} />
  ), []);

  const keyExtractor = useCallback((item: any) => item.id, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        {isAuthenticated && (
          <View style={styles.accountSection}>
            <View style={styles.accountCard}>
              <View style={styles.avatarContainer}>
                {accountInfo?.thumbnail ? (
                  <Text style={styles.avatarText}>{accountInfo.name?.[0]?.toUpperCase()}</Text>
                ) : (
                  <Ionicons name="person" size={28} color="#fff" />
                )}
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

        <FlatList
          data={[
            ...settingsData,
            {
              id: 'updates',
              icon: 'cloud-download-outline',
              title: 'Check for Updates',
              subtitle: checking ? 'Checking...' : 'Stay up to date',
              onPress: handleCheckUpdates,
              iconColor: '#1db954',
              disabled: checking
            }
          ]}
          keyExtractor={keyExtractor}
          renderItem={renderSettingCard}
          contentContainerStyle={styles.settingsGrid}
          showsVerticalScrollIndicator={false}
        />
      </View>
      
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
  accountSection: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  accountCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#121212', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#282828' },
  avatarContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1db954', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  accountInfo: { flex: 1, marginLeft: 16 },
  accountName: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 2 },
  accountEmail: { fontSize: 14, color: '#aaa' },
  logoutButton: { padding: 8 },
  settingsGrid: { paddingHorizontal: 20, gap: 12, paddingBottom: 100 },
  settingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#121212', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#282828' },
  disabledCard: { opacity: 0.6 },
  iconContainer: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 2 },
  cardSubtitle: { fontSize: 14, color: '#aaa' },
});
