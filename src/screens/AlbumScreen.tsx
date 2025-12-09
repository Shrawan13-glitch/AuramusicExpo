import React, { useEffect, useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';

export default function AlbumScreen({ route, navigation }: any) {
  const { albumId } = route.params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { playSong } = usePlayer();

  useEffect(() => {
    loadAlbum();
  }, [albumId]);

  const loadAlbum = async () => {
    setLoading(true);
    const result = await InnerTube.getAlbum(albumId);
    setData(result);
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (!data || !data.album) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.errorText}>Failed to load album</Text>
        {data && <Text style={styles.errorText}>{JSON.stringify(data, null, 2)}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      <FlatList
        data={data.songs}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={{ paddingBottom: 80 }}
        ListHeaderComponent={
          <View style={styles.albumHeader}>
            {data.album.thumbnail ? (
              <Image source={{ uri: data.album.thumbnail }} style={styles.albumArt} />
            ) : (
              <View style={[styles.albumArt, { backgroundColor: '#333' }]} />
            )}
            <Text style={styles.albumType}>{data.album.type || 'Album'}</Text>
            <Text style={styles.albumTitle}>{data.album.title || 'Unknown Album'}</Text>
            <Text style={styles.albumArtist}>{data.album.artist || 'Unknown Artist'}</Text>
            <Text style={styles.albumYear}>{data.album.year || ''} {data.album.year && '•'} {data.songs?.length || 0} songs</Text>
            
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
                <Ionicons name="play" size={24} color="#000" />
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
                <Ionicons name="shuffle" size={24} color="#fff" />
                <Text style={styles.shuffleButtonText}>Shuffle</Text>
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
            <Text style={styles.trackNumber}>{index + 1}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  backButton: { position: 'absolute', top: 50, left: 16, zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  albumHeader: { alignItems: 'center', padding: 16, paddingTop: 60 },
  albumArt: { width: 200, height: 200, borderRadius: 8, marginBottom: 16 },
  albumType: { fontSize: 12, color: '#aaa', textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' },
  albumTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 8 },
  albumArtist: { fontSize: 16, color: '#fff', marginBottom: 4, textAlign: 'center' },
  albumYear: { fontSize: 14, color: '#aaa', marginBottom: 24, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  playButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1db954', paddingVertical: 12, borderRadius: 24, gap: 8 },
  playButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  shuffleButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', paddingVertical: 12, borderRadius: 24, gap: 8 },
  shuffleButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  songItem: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16 },
  trackNumber: { width: 30, fontSize: 16, color: '#666', textAlign: 'center' },
  songInfo: { flex: 1, marginLeft: 12 },
  songTitle: { fontSize: 16, color: '#fff', fontWeight: '500' },
  songArtist: { fontSize: 14, color: '#aaa', marginTop: 2 },
  errorText: { color: '#fff', textAlign: 'center', marginTop: 100, fontSize: 16 },
});
