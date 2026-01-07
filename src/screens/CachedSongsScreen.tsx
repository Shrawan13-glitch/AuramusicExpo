import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { cacheManager, CachedSong, CacheStats } from '../utils/cacheManager';

export default function CachedSongsScreen({ navigation }: any) {
  const [cachedSongs, setCachedSongs] = useState<CachedSong[]>([]);
  const [cacheStats, setCacheStats] = useState<CacheStats>({ totalSize: 0, songCount: 0, maxSize: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCachedSongs();
  }, []);

  const loadCachedSongs = async () => {
    try {
      const [songs, stats] = await Promise.all([
        cacheManager.getAllCachedSongs(),
        cacheManager.getCacheStats()
      ]);
      
      // Sort by last played (most recent first)
      songs.sort((a, b) => b.lastPlayed - a.lastPlayed);
      
      setCachedSongs(songs);
      setCacheStats(stats);
    } catch (error) {
      console.log('Error loading cached songs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const handleDeleteSong = (song: CachedSong) => {
    Alert.alert(
      'Remove from Cache',
      `Remove "${song.title}" from cache?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await cacheManager.removeSongFromCache(song.id);
            loadCachedSongs();
          }
        }
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Cache',
      'This will remove all cached songs. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await cacheManager.clearAllCache();
            loadCachedSongs();
          }
        }
      ]
    );
  };

  const renderSongItem = ({ item }: { item: CachedSong }) => (
    <View style={styles.songItem}>
      <View style={styles.songIcon}>
        <Ionicons name="musical-note" size={24} color="#1db954" />
      </View>
      
      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.songArtist} numberOfLines={1}>{item.artist}</Text>
        <View style={styles.songMeta}>
          <Text style={styles.metaText}>{formatSize(item.size)}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>Cached {formatDate(item.cachedAt)}</Text>
        </View>
      </View>
      
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteSong(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={20} color="#ff4757" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cached Songs</Text>
        {cachedSongs.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Cache Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{cacheStats.songCount}</Text>
          <Text style={styles.statLabel}>Songs</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatSize(cacheStats.totalSize)}</Text>
          <Text style={styles.statLabel}>Used</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatSize(cacheStats.maxSize)}</Text>
          <Text style={styles.statLabel}>Limit</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${Math.min((cacheStats.totalSize / cacheStats.maxSize) * 100, 100)}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {((cacheStats.totalSize / cacheStats.maxSize) * 100).toFixed(1)}% used
        </Text>
      </View>

      {/* Songs List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading cached songs...</Text>
        </View>
      ) : cachedSongs.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="musical-notes-outline" size={64} color="#666" />
          <Text style={styles.emptyTitle}>No Cached Songs</Text>
          <Text style={styles.emptySubtitle}>
            Songs will be automatically cached when you play them
          </Text>
        </View>
      ) : (
        <FlatList
          data={cachedSongs}
          renderItem={renderSongItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 16,
    justifyContent: 'space-between'
  },
  backButton: { padding: 4 },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: '600', 
    color: '#fff', 
    flex: 1, 
    textAlign: 'center',
    marginHorizontal: 16
  },
  clearButton: { 
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 71, 87, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.3)'
  },
  clearButtonText: { 
    fontSize: 14, 
    color: '#ff4757', 
    fontWeight: '600' 
  },
  
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#121212',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    justifyContent: 'space-around'
  },
  statItem: { alignItems: 'center' },
  statValue: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#1db954',
    marginBottom: 4
  },
  statLabel: { 
    fontSize: 14, 
    color: '#aaa',
    fontWeight: '500'
  },
  
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 20
  },
  progressBar: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1db954',
    borderRadius: 3
  },
  progressText: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center'
  },
  
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40
  },
  loadingText: {
    fontSize: 16,
    color: '#aaa'
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 22
  },
  
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#121212',
    borderRadius: 12,
    marginBottom: 8
  },
  songIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  songInfo: { flex: 1 },
  songTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4
  },
  songArtist: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 4
  },
  songMeta: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  metaText: {
    fontSize: 12,
    color: '#666'
  },
  metaDot: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 6
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 71, 87, 0.1)'
  }
});