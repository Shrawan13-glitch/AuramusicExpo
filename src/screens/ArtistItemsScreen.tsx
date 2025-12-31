import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = (SCREEN_WIDTH - 48) / 2;

const SongItem = React.memo(({ item, onPress }: any) => (
  <TouchableOpacity style={styles.songItem} onPress={onPress}>
    <Image source={{ uri: item.thumbnailUrl }} style={styles.songThumbnail} />
    <View style={styles.songInfo}>
      <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.songArtist} numberOfLines={1}>
        {item.artists?.map((a: any) => a.name).join(', ')}
      </Text>
    </View>
  </TouchableOpacity>
));

const GridItem = React.memo(({ item, onPress }: any) => (
  <TouchableOpacity style={[styles.gridItem, { width: ITEM_WIDTH }]} onPress={onPress}>
    <Image source={{ uri: item.thumbnailUrl }} style={[styles.gridThumbnail, item.type === 'artist' && { borderRadius: ITEM_WIDTH / 2 }]} />
    <View style={styles.cardContent}>
      <Text style={styles.gridTitle} numberOfLines={2}>{item.title || item.name}</Text>
      {item.subtitle && <Text style={styles.gridSubtitle} numberOfLines={1}>{item.subtitle}</Text>}
    </View>
  </TouchableOpacity>
));

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

  const renderItem = useCallback(({ item }: any) => {
    if (isSongList) {
      return <SongItem item={item} onPress={() => playSong(item)} />;
    }

    return (
      <GridItem
        item={item}
        onPress={() => {
          if (item.type === 'album') {
            navigation.navigate('Album', { albumId: item.id });
          } else if (item.type === 'playlist') {
            navigation.navigate('Playlist', { playlistId: item.id });
          } else if (item.type === 'artist') {
            navigation.navigate('Artist', { artistId: item.id });
          } else if (item.type === 'video' || item.type === 'song') {
            playSong(item);
          }
        }}
      />
    );
  }, [isSongList, playSong, navigation]);

  const keyExtractor = useCallback((item: any, index: number) => `${item.id}-${index}`, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1db954" />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load items</Text>
      </View>
    );
  }

  const isSongList = data.items[0]?.type === 'song' && data.title?.toLowerCase().includes('song') && data.items.length > 10;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{data.title}</Text>
      </View>

      <FlashList
        data={data.items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        estimatedItemSize={isSongList ? 64 : ITEM_WIDTH + 80}
        numColumns={isSongList ? 1 : 2}
        removeClippedSubviews
        maxToRenderPerBatch={6}
        windowSize={5}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    paddingBottom: 12,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a'
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#fff', 
    flex: 1,
    letterSpacing: 0.3
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  listContent: { 
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100
  },
  songItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  songThumbnail: { width: 48, height: 48, borderRadius: 4 },
  songInfo: { flex: 1, marginLeft: 12 },
  songTitle: { fontSize: 16, color: '#fff', fontWeight: '500' },
  songArtist: { fontSize: 14, color: '#aaa', marginTop: 2 },
  gridItem: { 
    marginBottom: 20,
    marginHorizontal: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  gridThumbnail: { 
    width: '100%', 
    height: ITEM_WIDTH,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cardContent: {
    padding: 12,
    height: 60,
    justifyContent: 'center',
  },
  gridTitle: { 
    fontSize: 16, 
    color: '#fff', 
    fontWeight: '600',
    lineHeight: 20,
  },
  gridSubtitle: { fontSize: 12, color: '#aaa', marginTop: 2 },
  errorText: { color: '#fff', textAlign: 'center', marginTop: 100, fontSize: 16 },
});
