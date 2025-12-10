import React, { useEffect, useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';

export default function PlaylistScreen({ route, navigation }: any) {
  const { playlistId, videoId } = route.params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { playSong } = usePlayer();

  useEffect(() => {
    loadPlaylist();
  }, [playlistId]);

  const loadPlaylist = async () => {
    setLoading(true);
    const result = await InnerTube.getPlaylist(playlistId, videoId);
    setData(result);
    setLoading(false);
    
    // Auto-load more songs if continuation exists
    if (result?.continuation && result?.isMix) {
      loadAllSongs(result.continuation, result.songs, true);
    } else if (result?.continuation && !result?.isMix) {
      loadAllSongs(result.continuation, result.songs, false);
    }
  };

  const loadAllSongs = async (continuation: string, currentSongs: any[], isMix: boolean) => {
    let nextContinuation = continuation;
    let allSongs = [...currentSongs];

    while (nextContinuation && allSongs.length < 100) {
      const result = isMix
        ? await InnerTube.next('', nextContinuation)
        : await InnerTube.getPlaylistContinuation(nextContinuation);
      allSongs = [...allSongs, ...result.songs];
      nextContinuation = result.continuation;
      
      setData((prev: any) => ({
        ...prev,
        songs: allSongs,
        continuation: nextContinuation,
      }));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.errorText}>Failed to load playlist</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={data.songs}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={{ paddingBottom: 80 }}
        ListHeaderComponent={
          <View style={styles.playlistHeader}>
            <Image source={{ uri: data.playlist.thumbnail }} style={styles.playlistArt} />
            <Text style={styles.playlistTitle}>{data.playlist.title}</Text>
            <Text style={styles.playlistInfo}>{data.playlist.author} • {data.playlist.songCount}</Text>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={styles.playButton}
                onPress={() => {
                  if (data.songs.length > 0) {
                    const queue = data.songs.slice(1);
                    playSong(data.songs[0], queue, false);
                  }
                }}
              >
                <Ionicons name="play" size={20} color="#000" />
                <Text style={styles.playButtonText}>Play</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.shuffleButton}
                onPress={() => {
                  if (data.songs.length > 0) {
                    const shuffled = [...data.songs].sort(() => Math.random() - 0.5);
                    const queue = shuffled.slice(1);
                    playSong(shuffled[0], queue, false);
                  }
                }}
              >
                <Ionicons name="shuffle" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.songItem}
            onPress={() => {
              const queue = data.songs.slice(index + 1);
              playSong(item, queue, false);
            }}
          >
            <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
            <View style={styles.songInfo}>
              <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.songArtist} numberOfLines={1}>
                {item.artists?.map((a: any) => a.name).join(', ')}
              </Text>
            </View>
            <Ionicons name="ellipsis-vertical" size={20} color="#666" />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 16, paddingTop: 50 },
  playlistHeader: { alignItems: 'center', padding: 16 },
  playlistArt: { width: 200, height: 200, borderRadius: 8, marginBottom: 16 },
  playlistTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 8 },
  playlistInfo: { fontSize: 14, color: '#aaa', marginBottom: 24 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  playButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1db954', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24, gap: 8 },
  playButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  shuffleButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', borderRadius: 24 },
  songItem: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  thumbnail: { width: 48, height: 48, borderRadius: 4 },
  songInfo: { flex: 1, marginLeft: 12 },
  songTitle: { fontSize: 16, color: '#fff', fontWeight: '500' },
  songArtist: { fontSize: 14, color: '#aaa', marginTop: 2 },
  errorText: { color: '#fff', textAlign: 'center', marginTop: 100, fontSize: 16 },
});
