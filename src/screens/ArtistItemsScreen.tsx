import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';

export default function ArtistItemsScreen({ route, navigation }: any) {
  const { browseId, params } = route.params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { playSong } = usePlayer();

  useEffect(() => {
    loadItems();
  }, [browseId]);

  const loadItems = async () => {
    setLoading(true);
    const result = await InnerTube.getArtistItems(browseId, params);
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

  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load items</Text>
      </View>
    );
  }

  const isSongList = data.items[0]?.type === 'song';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{data.title}</Text>
      </View>

      <FlatList
        data={data.items}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        numColumns={isSongList ? 1 : 2}
        key={isSongList ? 'list' : 'grid'}
        contentContainerStyle={{ paddingBottom: 80, paddingTop: 16 }}
        renderItem={({ item }) => {
          if (isSongList) {
            return (
              <TouchableOpacity style={styles.songItem} onPress={() => playSong(item)}>
                <Image source={{ uri: item.thumbnailUrl }} style={styles.songThumbnail} />
                <View style={styles.songInfo}>
                  <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.songArtist} numberOfLines={1}>
                    {item.artists?.map((a: any) => a.name).join(', ')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => {
                if (item.type === 'album') {
                  navigation.navigate('Album', { albumId: item.id });
                } else if (item.type === 'playlist') {
                  navigation.navigate('Playlist', { playlistId: item.id });
                } else if (item.type === 'artist') {
                  navigation.navigate('Artist', { artistId: item.id });
                } else if (item.type === 'video') {
                  playSong(item);
                }
              }}
            >
              <Image source={{ uri: item.thumbnailUrl }} style={[styles.gridThumbnail, item.type === 'artist' && { borderRadius: 70 }]} />
              <Text style={styles.gridTitle} numberOfLines={2}>{item.title || item.name}</Text>
              {item.subtitle && <Text style={styles.gridSubtitle} numberOfLines={1}>{item.subtitle}</Text>}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 50, gap: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1 },
  songItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  songThumbnail: { width: 48, height: 48, borderRadius: 4 },
  songInfo: { flex: 1, marginLeft: 12 },
  songTitle: { fontSize: 16, color: '#fff', fontWeight: '500' },
  songArtist: { fontSize: 14, color: '#aaa', marginTop: 2 },
  gridItem: { flex: 1, margin: 8, maxWidth: '45%' },
  gridThumbnail: { width: '100%', aspectRatio: 1, borderRadius: 4 },
  gridTitle: { fontSize: 14, color: '#fff', marginTop: 8, fontWeight: '500' },
  gridSubtitle: { fontSize: 12, color: '#aaa', marginTop: 2 },
  errorText: { color: '#fff', textAlign: 'center', marginTop: 100, fontSize: 16 },
});
