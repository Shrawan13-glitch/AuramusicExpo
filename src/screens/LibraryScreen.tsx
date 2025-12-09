import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../store/LibraryContext';
import { usePlayer } from '../store/PlayerContext';
import { useAuth } from '../store/AuthContext';

export default function LibraryScreen({ navigation }: any) {
  const { likedSongs, recentlyPlayed } = useLibrary();
  const { playSong } = usePlayer();
  const { isAuthenticated, accountInfo, logout } = useAuth();
  const [ytmLibrary, setYtmLibrary] = useState<any[]>([]);
  const [loadingYtm, setLoadingYtm] = useState(false);
  const [subscribedArtists, setSubscribedArtists] = useState<any[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadYtmLibrary();
      loadSubscribedArtists();
    }
  }, [isAuthenticated]);

  const loadYtmLibrary = async () => {
    setLoadingYtm(true);
    try {
      const { InnerTube } = require('../api/innertube');
      const result = await InnerTube.getLibrary('FEmusic_liked_videos');
      setYtmLibrary(result.items || []);
    } catch (error) {
    }
    setLoadingYtm(false);
  };

  const loadSubscribedArtists = async () => {
    setLoadingArtists(true);
    try {
      const { InnerTube } = require('../api/innertube');
      const result = await InnerTube.getLibrary('FEmusic_library_corpus_artists');
      setSubscribedArtists(result.items || []);
    } catch (error) {
    }
    setLoadingArtists(false);
  };

  const folders = [
    {
      title: 'Recently Played',
      count: recentlyPlayed.length,
      icon: 'time-outline' as const,
      onPress: () => navigation.navigate('RecentlyPlayed'),
    },
    {
      title: isAuthenticated ? 'Liked Songs (YouTube Music)' : 'Liked Songs',
      count: isAuthenticated && ytmLibrary.length > 0 ? ytmLibrary.length : likedSongs.length,
      icon: 'heart' as const,
      loading: loadingYtm,
      onPress: () => navigation.navigate('LikedSongs'),
    },
  ];

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

      <ScrollView contentContainerStyle={{ paddingBottom: 140, paddingTop: 8 }}>
        {isAuthenticated && subscribedArtists.length > 0 && (
          <View style={styles.artistsSection}>
            <Text style={styles.sectionTitle}>Subscribed Artists</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.artistsScroll}>
              {subscribedArtists.map((artist, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.artistItem}
                  onPress={() => navigation.navigate('Artist', { artistId: artist.id })}
                >
                  <Image source={{ uri: artist.thumbnailUrl }} style={styles.artistImage} />
                  <Text style={styles.artistName} numberOfLines={1}>{artist.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {folders.map((folder, index) => (
          <TouchableOpacity
            key={index}
            style={styles.folderItem}
            onPress={folder.onPress}
            disabled={folder.loading}
          >
            <View style={styles.folderIcon}>
              <Ionicons name={folder.icon} size={28} color="#1db954" />
            </View>
            <View style={styles.folderInfo}>
              <Text style={styles.folderTitle}>{folder.title}</Text>
              <Text style={styles.folderCount}>
                {folder.loading ? 'Loading...' : `${folder.count} ${folder.count === 1 ? 'song' : 'songs'}`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>
        ))}
      </ScrollView>

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
  folderItem: { flexDirection: 'row', alignItems: 'center', padding: 16, marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1a1a1a', borderRadius: 8 },
  folderIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#282828', alignItems: 'center', justifyContent: 'center' },
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
