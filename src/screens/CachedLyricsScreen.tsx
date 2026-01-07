import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { lyricsCache } from '../utils/lyricsCache';

interface CachedLyrics {
  videoId: string;
  title: string;
  artist: string;
  lyrics: any;
  timestamp: number;
  size: number;
}

export default function CachedLyricsScreen({ navigation }: any) {
  const [cachedLyrics, setCachedLyrics] = useState<CachedLyrics[]>([]);
  const [cacheInfo, setCacheInfo] = useState({ count: 0, size: 0, maxSize: 0 });

  useEffect(() => {
    loadCachedLyrics();
  }, []);

  const loadCachedLyrics = async () => {
    const lyrics = await lyricsCache.getCachedLyrics();
    const info = lyricsCache.getCacheInfo();
    setCachedLyrics(lyrics);
    setCacheInfo(info);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const deleteLyrics = async (videoId: string, title: string) => {
    Alert.alert(
      'Delete Lyrics',
      `Delete cached lyrics for "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await lyricsCache.deleteLyrics(videoId);
            loadCachedLyrics();
          },
        },
      ]
    );
  };

  const clearAllLyrics = () => {
    Alert.alert(
      'Clear All Lyrics',
      'This will delete all cached lyrics. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await lyricsCache.clearAll();
            loadCachedLyrics();
          },
        },
      ]
    );
  };

  const renderLyricsItem = ({ item }: { item: CachedLyrics }) => (
    <View style={styles.lyricsItem}>
      <View style={styles.lyricsInfo}>
        <Text style={styles.lyricsTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.lyricsArtist} numberOfLines={1}>{item.artist}</Text>
        <View style={styles.lyricsDetails}>
          <Text style={styles.lyricsSize}>{formatSize(item.size)}</Text>
          <Text style={styles.lyricsDate}>{formatDate(item.timestamp)}</Text>
          <Text style={styles.lyricsType}>
            {item.lyrics ? (item.lyrics.lines?.some((l: any) => l.startTime) ? 'Synced' : 'Plain') : 'Not Found'}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteLyrics(item.videoId, item.title)}
      >
        <Ionicons name="trash-outline" size={20} color="#ff4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cached Lyrics</Text>
        <TouchableOpacity onPress={clearAllLyrics}>
          <Ionicons name="trash-outline" size={24} color="#ff4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.cacheInfo}>
        <Text style={styles.cacheInfoText}>
          {cacheInfo.count} lyrics • {formatSize(cacheInfo.size)} / {formatSize(cacheInfo.maxSize)}
        </Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${(cacheInfo.size / cacheInfo.maxSize) * 100}%` }
            ]} 
          />
        </View>
      </View>

      {cachedLyrics.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="musical-notes-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>No cached lyrics</Text>
          <Text style={styles.emptySubtext}>Lyrics will appear here as you view them</Text>
        </View>
      ) : (
        <FlatList
          data={cachedLyrics}
          renderItem={renderLyricsItem}
          keyExtractor={(item) => item.videoId}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  cacheInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  cacheInfoText: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1db954',
  },
  list: {
    flex: 1,
  },
  lyricsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  lyricsInfo: {
    flex: 1,
  },
  lyricsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  lyricsArtist: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 6,
  },
  lyricsDetails: {
    flexDirection: 'row',
    gap: 12,
  },
  lyricsSize: {
    fontSize: 12,
    color: '#666',
  },
  lyricsDate: {
    fontSize: 12,
    color: '#666',
  },
  lyricsType: {
    fontSize: 12,
    color: '#1db954',
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
});