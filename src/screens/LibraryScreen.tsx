import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../store/LibraryContext';
import { usePlayer } from '../store/PlayerContext';
import { useAuth } from '../store/AuthContext';
import { useDownload } from '../store/DownloadContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LibraryScreen({ navigation }: any) {
  const { likedSongs, recentlyPlayed } = useLibrary();
  const { playSong } = usePlayer();
  const { isAuthenticated, accountInfo, logout } = useAuth();
  const { downloadedSongs } = useDownload();
  const [ytmLibrary, setYtmLibrary] = useState<any[]>([]);
  const [loadingYtm, setLoadingYtm] = useState(false);
  const [subscribedArtists, setSubscribedArtists] = useState<any[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [cachedSongs, setCachedSongs] = useState<any[]>([]);
  const [downloadedCount, setDownloadedCount] = useState(0);

  useEffect(() => {
    loadCachedSongs();
    if (isAuthenticated) {
      loadYtmLibrary();
      loadSubscribedArtists();
    }
  }, [isAuthenticated]);

  const loadCachedSongs = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem('cached_songs');
      const downloaded = await AsyncStorage.getItem('downloaded_songs');
      if (cached) setCachedSongs(JSON.parse(cached));
      if (downloaded) setDownloadedCount(JSON.parse(downloaded).length || 0);
    } catch (error) {
      console.error('Error loading cached songs:', error);
    }
  }, []);

  const loadYtmLibrary = useCallback(async () => {
    setLoadingYtm(true);
    try {
      const { InnerTube } = require('../api/innertube');
      const result = await InnerTube.getLibrary('FEmusic_liked_videos');
      setYtmLibrary(result.items || []);
    } catch (error) {
      console.error('Error loading YTM library:', error);
    } finally {
      setLoadingYtm(false);
    }
  }, []);

  const loadSubscribedArtists = useCallback(async () => {
    setLoadingArtists(true);
    try {
      const { InnerTube } = require('../api/innertube');
      const result = await InnerTube.getLibrary('FEmusic_library_corpus_artists');
      setSubscribedArtists(result.items || []);
    } catch (error) {
      console.error('Error loading artists:', error);
    } finally {
      setLoadingArtists(false);
    }
  }, []);

  const folders = useMemo(() => [
    {
      title: 'Downloaded',
      count: downloadedSongs.length,
      icon: 'download' as const,
      color: '#1db954',
      onPress: () => navigation.navigate('DownloadedSongs'),
    },
    {
      title: 'Cached Songs',
      count: cachedSongs.length,
      icon: 'server' as const,
      color: '#ff6b35',
      onPress: () => navigation.navigate('CachedSongs', { songs: cachedSongs }),
    },
    {
      title: 'Recently Played',
      count: recentlyPlayed.length,
      icon: 'time' as const,
      color: '#9b59b6',
      onPress: () => navigation.navigate('RecentlyPlayed'),
    },
    {
      title: isAuthenticated ? 'Liked Songs (YTM)' : 'Liked Songs',
      count: isAuthenticated && ytmLibrary.length > 0 ? ytmLibrary.length : likedSongs.length,
      icon: 'heart' as const,
      color: '#e74c3c',
      loading: loadingYtm,
      onPress: () => navigation.navigate('LikedSongs'),
    },
  ], [downloadedSongs.length, cachedSongs.length, recentlyPlayed.length, isAuthenticated, ytmLibrary.length, likedSongs.length, loadingYtm, navigation]);

  const renderArtist = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.artistItem}
      onPress={() => navigation.navigate('Artist', { artistId: item.id })}
    >
      <Image 
        source={{ uri: item.thumbnailUrl }} 
        style={styles.artistImage}
        defaultSource={require('../../assets/icon.png')}
        resizeMode="cover"
      />
      <Text style={styles.artistName} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  ), [navigation]);

  const renderFolder = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.folderItem}
      onPress={item.onPress}
      disabled={item.loading}
    >
      <View style={[styles.folderIcon, { backgroundColor: item.color }]}>
        <Ionicons name={item.icon} size={24} color="#fff" />
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderTitle}>{item.title}</Text>
        <Text style={styles.folderCount}>
          {item.loading ? 'Loading...' : `${item.count} ${item.count === 1 ? 'item' : 'items'}`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  ), []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Library</Text>
        <TouchableOpacity onPress={() => setShowAccountModal(true)} style={styles.accountButton}>
          {isAuthenticated && accountInfo ? (
            accountInfo.thumbnail ? (
              <Image source={{ uri: accountInfo.thumbnail }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{accountInfo.name?.[0]?.toUpperCase()}</Text>
              </View>
            )
          ) : (
            <Ionicons name="person-circle-outline" size={32} color="#666" />
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={[{ type: 'artists' }, { type: 'folders' }]}
        keyExtractor={(item) => item.type}
        contentContainerStyle={{ paddingBottom: 140, paddingTop: 8 }}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={5}
        renderItem={({ item }) => {
          if (item.type === 'artists') {
            return isAuthenticated && subscribedArtists.length > 0 ? (
              <View style={styles.artistsSection}>
                <Text style={styles.sectionTitle}>Subscribed Artists</Text>
                <FlatList
                  horizontal
                  data={subscribedArtists.slice(0, 10)}
                  keyExtractor={(artist) => artist.id}
                  renderItem={renderArtist}
                  showsHorizontalScrollIndicator={false}
                  removeClippedSubviews={true}
                  maxToRenderPerBatch={5}
                  windowSize={5}
                />
              </View>
            ) : null;
          }
          
          return (
            <FlatList
              data={folders}
              keyExtractor={(folder) => folder.title}
              renderItem={renderFolder}
              scrollEnabled={false}
            />
          );
        }}
      />


      <Modal
        visible={showAccountModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAccountModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowAccountModal(false)}
        >
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
              <TouchableOpacity style={styles.menuItem} onPress={() => { setShowAccountModal(false); navigation.navigate('Login'); }}>
                <Ionicons name="log-in-outline" size={24} color="#1db954" />
                <Text style={[styles.menuText, { color: '#1db954' }]}>Sign in</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.menuItem} onPress={() => {
              setShowAccountModal(false);
              navigation.navigate('Settings');
            }}>
              <Ionicons name="settings-outline" size={24} color="#fff" />
              <Text style={styles.menuText}>Settings</Text>
            </TouchableOpacity>

            {isAuthenticated && (
              <TouchableOpacity style={styles.menuItem} onPress={() => {
                setShowAccountModal(false);
                logout();
              }}>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  accountButton: { padding: 4 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1db954', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  folderItem: { flexDirection: 'row', alignItems: 'center', padding: 16, marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1a1a1a', borderRadius: 12 },
  folderIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  folderInfo: { flex: 1, marginLeft: 16 },
  folderTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  folderCount: { fontSize: 14, color: '#aaa', marginTop: 4 },
  artistsSection: { marginBottom: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  artistsScroll: { paddingRight: 16 },
  artistItem: { width: 120, marginRight: 12, alignItems: 'center' },
  artistImage: { width: 120, height: 120, borderRadius: 60, marginBottom: 8 },
  artistName: { fontSize: 14, color: '#fff', textAlign: 'center', width: '100%' },
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
