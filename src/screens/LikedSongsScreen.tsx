import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../store/LibraryContext';
import { usePlayer } from '../store/PlayerContext';
import { useAuth } from '../store/AuthContext';
import { InnerTube } from '../api/innertube';

export default function LikedSongsScreen({ navigation }: any) {
  const { likedSongs } = useLibrary();
  const { playSong } = usePlayer();
  const { isAuthenticated } = useAuth();
  const [ytmLibrary, setYtmLibrary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadYtmLibrary();
    }
  }, [isAuthenticated]);

  const loadYtmLibrary = async () => {
    setLoading(true);
    try {
      const result = await InnerTube.getLibrary('FEmusic_liked_videos');
      setYtmLibrary(result.items || []);
    } catch (error) {
      console.error('Failed to load YTM library:', error);
    }
    setLoading(false);
  };

  const data = isAuthenticated && ytmLibrary.length > 0 ? ytmLibrary : likedSongs;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isAuthenticated ? 'Liked Songs (YouTube Music)' : 'Liked Songs'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#1db954" />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={{ paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={64} color="#666" />
              <Text style={styles.emptyText}>
                {isAuthenticated ? 'No liked songs in YouTube Music' : 'No liked songs yet'}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.songItem}
              onPress={() => {
                if (item.type === 'playlist') {
                  navigation.navigate('Playlist', { playlistId: item.id });
                } else {
                  const queue = data.slice(index + 1).filter((s: any) => s.type !== 'playlist');
                  playSong(item, queue, false);
                }
              }}
            >
              <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
              <View style={styles.songInfo}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {item.artists?.map((a: any) => a.name).join(', ') || (item.type === 'playlist' ? 'Playlist' : '')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
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
  empty: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: '#666', fontSize: 16, marginTop: 16 },
});
