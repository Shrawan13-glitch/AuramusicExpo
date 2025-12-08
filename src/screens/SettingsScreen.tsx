import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import { checkForUpdates, getCurrentVersion } from '../utils/updateChecker';

export default function SettingsScreen({ navigation }: any) {
  const { isAuthenticated, accountInfo, logout } = useAuth();
  const [checking, setChecking] = useState(false);

  const handleCheckUpdates = async () => {
    setChecking(true);
    const { hasUpdate, updateInfo } = await checkForUpdates();
    setChecking(false);
    if (hasUpdate && updateInfo) {
      navigation.navigate('Update', { updateInfo });
    } else {
      alert('You are on the latest version');
    }
  };

  const SettingItem = ({ icon, title, subtitle, onPress, showChevron = true }: any) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <Ionicons name={icon} size={24} color="#666" style={styles.settingIcon} />
      <View style={styles.settingText}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {showChevron && <Ionicons name="chevron-forward" size={20} color="#666" />}
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }: any) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {isAuthenticated && (
          <>
            <SectionHeader title="ACCOUNT" />
            <View style={styles.section}>
              <View style={styles.accountCard}>
                <View style={styles.accountInfo}>
                  {accountInfo?.thumbnail ? (
                    <View style={styles.avatarContainer}>
                      <Text style={styles.avatarText}>{accountInfo.name?.[0]?.toUpperCase()}</Text>
                    </View>
                  ) : (
                    <View style={styles.avatarContainer}>
                      <Ionicons name="person" size={32} color="#fff" />
                    </View>
                  )}
                  <View style={styles.accountDetails}>
                    <Text style={styles.accountName}>{accountInfo?.name}</Text>
                    <Text style={styles.accountEmail}>{accountInfo?.email}</Text>
                  </View>
                </View>
              </View>
              <SettingItem
                icon="log-out-outline"
                title="Sign out"
                onPress={() => {
                  logout();
                  navigation.goBack();
                }}
                showChevron={false}
              />
            </View>
          </>
        )}

        <SectionHeader title="ABOUT" />
        <View style={styles.section}>
          <SettingItem icon="information-circle-outline" title="Version" subtitle={getCurrentVersion()} onPress={() => {}} showChevron={false} />
          <TouchableOpacity style={styles.settingItem} onPress={handleCheckUpdates} disabled={checking}>
            <Ionicons name="cloud-download-outline" size={24} color="#666" style={styles.settingIcon} />
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>Check for updates</Text>
            </View>
            {checking ? <ActivityIndicator size="small" color="#1db954" /> : <Ionicons name="chevron-forward" size={20} color="#666" />}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1 },
  sectionHeader: { fontSize: 14, fontWeight: '600', color: '#1db954', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  section: { backgroundColor: '#121212', marginHorizontal: 16, marginBottom: 8, borderRadius: 8, overflow: 'hidden' },
  accountCard: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#282828' },
  accountInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1db954', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  accountDetails: { marginLeft: 16, flex: 1 },
  accountName: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
  accountEmail: { fontSize: 14, color: '#aaa' },
  settingItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#282828' },
  settingIcon: { marginRight: 16 },
  settingText: { flex: 1 },
  settingTitle: { fontSize: 16, color: '#fff', marginBottom: 2 },
  settingSubtitle: { fontSize: 14, color: '#aaa' },
});
