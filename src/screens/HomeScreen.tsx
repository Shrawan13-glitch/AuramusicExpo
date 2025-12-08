import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, RefreshControl, ActivityIndicator, Dimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';
import { useAuth } from '../store/AuthContext';
import { Song } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_WIDTH = (SCREEN_WIDTH - 48) / 2;
const ITEM_HEIGHT = 64;

export default function HomeScreen({ navigation }: any) {
  const [quickPicks, setQuickPicks] = useState<Song[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [continuation, setContinuation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const { playSong, currentSong } = usePlayer();
  const { isAuthenticated, accountInfo, logout } = useAuth();

  useEffect(() => {
    loadHome();
  }, []);

  const loadHome = async () => {
    try {
      const data = await InnerTube.getHome();
      setQuickPicks(data.quickPicks);
      setSections(data.sections);
      setContinuation(data.continuation);
      console.log(`Initial load: ${data.sections.length} sections, continuation: ${!!data.continuation}`);
    } catch (error) {
      console.error('Error loading home:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (!continuation || loadingMore) return;
    
    console.log('Loading more sections...');
    setLoadingMore(true);
    try {
      const data = await InnerTube.getHomeContinuation(continuation);
      console.log(`Loaded ${data.sections.length} more sections`);
      setSections(prev => [...prev, ...data.sections]);
      setContinuation(data.continuation);
    } catch (error) {
      console.error('Error loading more:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHome();
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 500;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      loadMore();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Home</Text>
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
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      onScroll={handleScroll}
      scrollEventThrottle={400}
    >
      {quickPicks.length > 0 && (
        <View style={styles.quickPicksSection}>
          <Text style={styles.sectionTitle}>Quick Picks</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.quickPicksGrid}>
              {Array.from({ length: 4 }).map((_, rowIndex) => (
                <View key={rowIndex} style={styles.quickPicksRow}>
                  {quickPicks.slice(rowIndex * 5, (rowIndex + 1) * 5).map((song) => {
                    const isPlaying = currentSong?.id === song.id;
                    return (
                      <TouchableOpacity
                        key={song.id}
                        style={styles.quickPickItem}
                        onPress={() => playSong(song)}
                      >
                        <Image source={{ uri: song.thumbnailUrl }} style={styles.quickPickThumb} />
                        <View style={styles.quickPickInfo}>
                          <Text style={[styles.quickPickTitle, isPlaying && styles.activeText]} numberOfLines={1}>
                            {song.title}
                          </Text>
                          <Text style={styles.quickPickArtist} numberOfLines={1}>
                            {song.artists.map(a => a.name).join(', ')}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {sections.map((section, index) => (
        <View key={index} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionContent}>
            {section.items.map((item: any) => {
              const isPlaying = item.type === 'song' && currentSong?.id === item.id;
              const displayTitle = item.type === 'artist' ? item.name : item.title;
              const displaySubtitle = item.type === 'song' 
                ? item.artists?.map((a: any) => a.name).join(', ') 
                : item.subtitle || '';
              
              return (
                <TouchableOpacity 
                  key={item.id} 
                  style={styles.card} 
                  onPress={() => {
                    if (item.type === 'song') {
                      playSong(item);
                    } else if (item.type === 'artist') {
                      navigation.getParent()?.navigate('Artist', { artistId: item.id });
                    } else if (item.type === 'album') {
                      navigation.getParent()?.navigate('Album', { albumId: item.id });
                    } else if (item.type === 'playlist') {
                      navigation.getParent()?.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
                    }
                  }}
                >
                  <Image source={{ uri: item.thumbnailUrl }} style={[styles.cardImage, item.type === 'artist' && styles.roundImage]} />
                  <Text style={[styles.cardTitle, isPlaying && styles.activeText]} numberOfLines={2}>
                    {displayTitle}
                  </Text>
                  <Text style={styles.cardArtist} numberOfLines={1}>
                    {displaySubtitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ))}

      {loadingMore && (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}
      <View style={{ height: 100 }} />
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
  centerContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  quickPicksSection: { marginBottom: 16 },
  quickPicksGrid: { paddingLeft: 16 },
  quickPicksRow: { flexDirection: 'row' },
  quickPickItem: { flexDirection: 'row', alignItems: 'center', width: ITEM_WIDTH, height: ITEM_HEIGHT, paddingRight: 8, marginBottom: 4 },
  quickPickThumb: { width: 56, height: 56, borderRadius: 4 },
  quickPickInfo: { flex: 1, marginLeft: 12 },
  quickPickTitle: { fontSize: 14, color: '#fff', fontWeight: '500' },
  quickPickArtist: { fontSize: 12, color: '#aaa', marginTop: 2 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginLeft: 16, marginBottom: 12, marginTop: 4 },
  sectionContent: { paddingLeft: 16, paddingRight: 8 },
  card: { width: 160, marginRight: 12 },
  cardImage: { width: 160, height: 160, borderRadius: 8 },
  roundImage: { borderRadius: 80 },
  cardTitle: { fontSize: 14, color: '#fff', fontWeight: '500', marginTop: 8, lineHeight: 18 },
  cardArtist: { fontSize: 12, color: '#aaa', marginTop: 4 },
  activeText: { color: '#1db954' },
  footer: { padding: 20, alignItems: 'center' },
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
