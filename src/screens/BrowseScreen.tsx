import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';

const GridItem = React.memo(({ item, onPress }: any) => (
  <TouchableOpacity style={styles.gridItem} onPress={onPress}>
    <Image source={{ uri: item.thumbnailUrl }} style={styles.gridThumbnail} />
    <Text style={styles.gridTitle} numberOfLines={2}>{item.title}</Text>
  </TouchableOpacity>
));

export default function BrowseScreen({ route, navigation }: any) {
  const { params } = route.params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { playSong } = usePlayer();

  useEffect(() => {
    loadBrowse();
  }, [params]);

  const loadBrowse = async () => {
    const result = await InnerTube.browse('FEmusic_moods_and_genres_category', params);
    setData(result);
    setLoading(false);
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

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 200,
    offset: 200 * index,
    index,
  }), []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{data?.title || 'Browse'}</Text>
      </View>

      <FlatList
        data={data?.items || []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        numColumns={2}
        removeClippedSubviews
        maxToRenderPerBatch={6}
        windowSize={6}
        initialNumToRender={10}
        contentContainerStyle={{ paddingBottom: 80, paddingTop: 16 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 50, gap: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1 },
  gridItem: { flex: 1, margin: 8, maxWidth: '45%' },
  gridThumbnail: { width: '100%', aspectRatio: 1, borderRadius: 4 },
  gridTitle: { fontSize: 14, color: '#fff', marginTop: 8, fontWeight: '500' },
});
