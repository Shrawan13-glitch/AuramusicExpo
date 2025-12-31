import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../store/LibraryContext';
import { usePlayer } from '../store/PlayerContext';
import { useAuth } from '../store/AuthContext';
import SongOptionsModal from '../components/SongOptionsModal';
import { useSongOptions } from '../hooks/useSongOptions';

const SongItem = React.memo(({ item, index, onPress, onLongPress, onMenuPress }: any) => (
  <TouchableOpacity style={styles.songItem} onPress={onPress} onLongPress={onLongPress}>
    <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
    <View style={styles.songInfo}>
      <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.artist} numberOfLines={1}>
        {item.artists?.map((a: any) => a.name).join(', ') || (item.type === 'playlist' ? 'Playlist' : '')}
      </Text>
    </View>
    <TouchableOpacity style={styles.menuButton} onPress={onMenuPress}>
      <Ionicons name="ellipsis-vertical" size={20} color="#666" />
    </TouchableOpacity>
  </TouchableOpacity>
));

export default function LikedSongsScreen({ navigation }: any) {
  const { likedSongs, syncLikedSongs } = useLibrary();
  const { playSong } = usePlayer();
  const { isAuthenticated } = useAuth();
  const { modalVisible, selectedSong, showOptions, hideOptions } = useSongOptions();
  const [syncing, setSyncing] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleSync = async () => {
    if (!isAuthenticated) return;
    setSyncing(true);
    await syncLikedSongs();
    setSyncing(false);
  };

  const renderItem = useCallback(({ item, index }: any) => (
    <SongItem
      item={item}
      index={index}
      onPress={() => {
        if (item.type === 'playlist') {
          navigation.navigate('Playlist', { playlistId: item.id });
        } else {
          const queue = likedSongs.slice(index + 1).filter((s: any) => s.type !== 'playlist');
          playSong(item, queue, false);
        }
      }}
      onLongPress={() => showOptions(item)}
      onMenuPress={() => showOptions(item)}
    />
  ), [likedSongs, navigation, playSong, showOptions]);

  const keyExtractor = useCallback((item: any, index: number) => `${item.id}-${index}`, []);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 80,
    offset: 80 * index,
    index,
  }), []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Liked Songs</Text>
        {isAuthenticated && (
          <TouchableOpacity onPress={handleSync} disabled={syncing}>
            <Ionicons 
              name={syncing ? "sync" : "refresh"} 
              size={24} 
              color={syncing ? "#666" : "#1db954"} 
            />
          </TouchableOpacity>
        )}
      </View>

      <FlashList
        data={showContent ? likedSongs : []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        estimatedItemSize={80}
        contentContainerStyle={{ paddingBottom: 80 }}
        ListEmptyComponent={
          showContent ? (
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={64} color="#666" />
              <Text style={styles.emptyText}>No liked songs yet</Text>
              {isAuthenticated && (
                <TouchableOpacity style={styles.syncButton} onPress={handleSync}>
                  <Text style={styles.syncButtonText}>Sync with YouTube Music</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
      />
      
      <SongOptionsModal
        visible={modalVisible}
        onClose={hideOptions}
        song={selectedSong}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  songItem: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16 },
  thumbnail: { width: 56, height: 56, borderRadius: 4 },
  songInfo: { flex: 1, marginLeft: 12 },
  title: { fontSize: 16, color: '#fff', fontWeight: '500' },
  artist: { fontSize: 14, color: '#aaa', marginTop: 4 },
  menuButton: { padding: 8 },
  empty: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: '#666', fontSize: 16, marginTop: 16 },
  syncButton: { backgroundColor: '#1db954', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 16 },
  syncButtonText: { color: '#fff', fontWeight: '600' },
});
