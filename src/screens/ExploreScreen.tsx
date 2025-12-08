import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import { useAuth } from '../store/AuthContext';

export default function ExploreScreen({ navigation }: any) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const { isAuthenticated, accountInfo, logout } = useAuth();

  useEffect(() => {
    loadExplore();
  }, []);

  const loadExplore = async () => {
    const result = await InnerTube.explore();
    setData(result);
    setLoading(false);
  };

  if (loading) return <SafeAreaView style={styles.container}><Text style={styles.text}>Loading...</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Explore</Text>
        {isAuthenticated && accountInfo ? (
          <TouchableOpacity onPress={() => setShowAccountModal(true)} style={styles.accountButton}>
            {accountInfo.thumbnail ? (
              <Image source={{ uri: accountInfo.thumbnail }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{accountInfo.name?.[0]?.toUpperCase()}</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => navigation.getParent()?.navigate('Login')}>
            <Ionicons name="person-circle-outline" size={32} color="#666" />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>

      {data?.newReleases?.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>New Releases</Text>
            <TouchableOpacity onPress={() => navigation.navigate('NewReleases')}>
              <Text style={styles.viewAll}>View all</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            horizontal
            data={data.newReleases.slice(0, 10)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('Album', { albumId: item.id })}>
                <Image source={{ uri: item.thumbnailUrl }} style={styles.gridThumbnail} />
                <Text style={styles.gridTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.gridSubtitle} numberOfLines={1}>{item.subtitle}</Text>
              </TouchableOpacity>
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      {data?.moodAndGenres?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Moods & Genres</Text>
          <View style={styles.genreGrid}>
            {data.moodAndGenres.map((genre: any, index: number) => (
              <TouchableOpacity
                key={index}
                style={styles.genreItem}
                onPress={() => navigation.navigate('Browse', { params: genre.params })}
              >
                <Text style={styles.genreText}>{genre.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      </ScrollView>

      <Modal visible={showAccountModal} transparent animationType="fade" onRequestClose={() => setShowAccountModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAccountModal(false)}>
          <View style={styles.modalContent}>
            {isAuthenticated && accountInfo && (
              <View style={styles.accountHeader}>
                {accountInfo.thumbnail ? (
                  <Image source={{ uri: accountInfo.thumbnail }} style={styles.modalAvatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, styles.modalAvatar]}>
                    <Text style={styles.modalAvatarText}>{accountInfo.name?.[0]?.toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.accountName}>{accountInfo.name}</Text>
                <Text style={styles.accountEmail}>{accountInfo.email}</Text>
              </View>
            )}

            {!isAuthenticated && (
              <TouchableOpacity style={styles.menuItem} onPress={() => { setShowAccountModal(false); navigation.getParent()?.navigate('Login'); }}>
                <Ionicons name="log-in-outline" size={24} color="#1db954" />
                <Text style={[styles.menuText, { color: '#1db954' }]}>Sign in</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowAccountModal(false); navigation.getParent()?.navigate('Settings'); }}>
              <Ionicons name="settings-outline" size={24} color="#fff" />
              <Text style={styles.menuText}>Settings</Text>
            </TouchableOpacity>

            {isAuthenticated && (
              <TouchableOpacity style={styles.menuItem} onPress={() => { setShowAccountModal(false); logout(); }}>
                <Ionicons name="log-out-outline" size={24} color="#ff4444" />
                <Text style={[styles.menuText, { color: '#ff4444' }]}>Sign out</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  accountButton: { padding: 4 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1db954', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  text: { color: '#fff', textAlign: 'center', marginTop: 100 },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  viewAll: { fontSize: 14, color: '#1db954', fontWeight: '600' },
  gridItem: { width: 140, marginRight: 12 },
  gridThumbnail: { width: 140, height: 140, borderRadius: 4 },
  gridTitle: { fontSize: 14, color: '#fff', marginTop: 8, fontWeight: '500' },
  gridSubtitle: { fontSize: 12, color: '#aaa', marginTop: 2 },
  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  genreItem: { backgroundColor: '#1db954', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
  genreText: { color: '#000', fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 50, paddingRight: 16 },
  modalContent: { backgroundColor: '#1a1a1a', borderRadius: 12, minWidth: 280, overflow: 'hidden' },
  accountHeader: { alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#333' },
  modalAvatar: { width: 64, height: 64, borderRadius: 32, marginBottom: 12 },
  modalAvatarText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  accountName: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
  accountEmail: { fontSize: 14, color: '#aaa' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  menuText: { fontSize: 16, color: '#fff' },
});
