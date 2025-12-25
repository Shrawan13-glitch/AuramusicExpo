import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../store/LibraryContext';
import { usePlayer } from '../store/PlayerContext';
import { PlayHistory } from '../types';

type FilterType = 'all' | 'today' | 'week' | 'month';
type SortType = 'recent' | 'genre';

export default function RecentlyPlayedScreen({ navigation }: any) {
  const { recentlyPlayed, loadMoreHistory } = useLibrary();
  const { playSong } = usePlayer();
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('recent');
  const [data, setData] = useState<PlayHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    applyFilters();
  }, [recentlyPlayed, filter, sort]);

  const applyFilters = () => {
    let filtered = [...recentlyPlayed];
    const now = Date.now();

    if (filter === 'today') {
      const startOfDay = new Date().setHours(0, 0, 0, 0);
      filtered = filtered.filter(h => h.playedAt >= startOfDay);
    } else if (filter === 'week') {
      filtered = filtered.filter(h => h.playedAt >= now - 7 * 24 * 60 * 60 * 1000);
    } else if (filter === 'month') {
      filtered = filtered.filter(h => h.playedAt >= now - 30 * 24 * 60 * 60 * 1000);
    }

    if (sort === 'genre') {
      filtered.sort((a, b) => (a.genre || 'Unknown').localeCompare(b.genre || 'Unknown'));
    }

    setData(filtered);
  };

  const loadMore = async () => {
    if (loading || filter !== 'all') return;
    setLoading(true);
    const more = await loadMoreHistory(data.length);
    setData([...data, ...more]);
    setLoading(false);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date().setHours(0, 0, 0, 0);
    const yesterday = today - 24 * 60 * 60 * 1000;
    
    if (date.getTime() >= today) return 'Today';
    if (date.getTime() >= yesterday) return 'Yesterday';
    return date.toLocaleDateString();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recently Played</Text>
      </View>

      <View style={styles.filters}>
        <View style={styles.filterRow}>
          {(['all', 'today', 'week', 'month'] as FilterType[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={styles.sortBtn}
          onPress={() => setSort(sort === 'recent' ? 'genre' : 'recent')}
        >
          <Ionicons name={sort === 'recent' ? 'time' : 'musical-notes'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={{ paddingBottom: 80 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No recently played songs</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.songItem} onPress={() => playSong(item.song)}>
            <Image source={{ uri: item.song.thumbnailUrl }} style={styles.thumbnail} />
            <View style={styles.songInfo}>
              <Text style={styles.title} numberOfLines={1}>{item.song.title}</Text>
              <Text style={styles.artist} numberOfLines={1}>
                {item.song.artists?.map(a => a.name).join(', ')}
              </Text>
              <View style={styles.meta}>
                <Text style={styles.metaText}>{formatDate(item.playedAt)}</Text>
                {item.genre && <Text style={styles.genre}>{item.genre}</Text>}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1 },
  filters: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  filterRow: { flex: 1, flexDirection: 'row', gap: 8 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#222' },
  filterBtnActive: { backgroundColor: '#8b5cf6' },
  filterText: { fontSize: 12, color: '#aaa', fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  sortBtn: { padding: 8, borderRadius: 8, backgroundColor: '#222' },
  songItem: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16 },
  thumbnail: { width: 56, height: 56, borderRadius: 4 },
  songInfo: { flex: 1, marginLeft: 12 },
  title: { fontSize: 16, color: '#fff', fontWeight: '500' },
  artist: { fontSize: 14, color: '#aaa', marginTop: 4 },
  meta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  metaText: { fontSize: 12, color: '#666' },
  genre: { fontSize: 12, color: '#8b5cf6', fontWeight: '600' },
  empty: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: '#666', fontSize: 16, marginTop: 16 },
});
