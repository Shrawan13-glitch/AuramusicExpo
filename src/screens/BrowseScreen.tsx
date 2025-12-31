import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = (SCREEN_WIDTH - 48) / 2;

const GridItem = React.memo(({ item, onPress }: any) => (
  <TouchableOpacity style={[styles.gridItem, { width: ITEM_WIDTH }]} onPress={onPress}>
    <Image source={{ uri: item.thumbnailUrl }} style={styles.gridThumbnail} />
    <View style={styles.cardContent}>
      <Text style={styles.gridTitle} numberOfLines={2}>{item.title}</Text>
    </View>
  </TouchableOpacity>
));

export default function BrowseScreen({ route, navigation }: any) {
  const { params } = route.params || {};
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { playSong } = usePlayer();

  useEffect(() => {
    loadBrowse();
  }, [params]);

  const loadBrowse = async () => {
    try {
      const result = await InnerTube.browse('FEmusic_moods_and_genres_category', params);
      setData(result);
    } catch (error) {
      console.error('Error loading browse data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = useCallback(({ item }: any) => (
    <GridItem
      item={item}
      onPress={() => {
        if (item.type === 'playlist') {
          navigation.navigate('Playlist', { playlistId: item.id });
        } else if (item.type === 'song') {
          playSong(item);
        }
      }}
    />
  ), [navigation, playSong]);

  const keyExtractor = useCallback((item: any, index: number) => `${item.id}-${index}`, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Browse</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1db954" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{data?.title || 'Browse'}</Text>
      </View>

      <FlashList
        data={data?.items || []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={2}
        estimatedItemSize={ITEM_WIDTH + 80}
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
});
