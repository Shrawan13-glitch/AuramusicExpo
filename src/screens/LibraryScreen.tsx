import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../store/LibraryContext';
import { usePlayer } from '../store/PlayerContext';

export default function LibraryScreen({ navigation }: any) {
  const { likedSongs, recentlyPlayed } = useLibrary();
  const { playSong } = usePlayer();
  const [activeTab, setActiveTab] = useState<'recent' | 'liked'>('recent');

  const data = activeTab === 'recent' ? recentlyPlayed : likedSongs;

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'recent' && styles.activeTab]} onPress={() => setActiveTab('recent')}>
          <Text style={[styles.tabText, activeTab === 'recent' && styles.activeTabText]}>Recently Played</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'liked' && styles.activeTab]} onPress={() => setActiveTab('liked')}>
          <Text style={[styles.tabText, activeTab === 'liked' && styles.activeTabText]}>Liked Songs</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={{ paddingBottom: 140 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={activeTab === 'recent' ? 'time-outline' : 'heart-outline'} size={64} color="#666" />
            <Text style={styles.emptyText}>{activeTab === 'recent' ? 'No recently played songs' : 'No liked songs yet'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.songItem} onPress={() => playSong(item)}>
            <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
            <View style={styles.songInfo}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.artist} numberOfLines={1}>{item.artists?.map(a => a.name).join(', ')}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  tabs: { flexDirection: 'row', paddingTop: 50, paddingHorizontal: 16, gap: 16 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#1db954' },
  tabText: { color: '#666', fontSize: 14, fontWeight: '600' },
  activeTabText: { color: '#fff' },
  songItem: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16 },
  thumbnail: { width: 56, height: 56, borderRadius: 4 },
  songInfo: { flex: 1, marginLeft: 12 },
  title: { fontSize: 16, color: '#fff', fontWeight: '500' },
  artist: { fontSize: 14, color: '#aaa', marginTop: 4 },
  empty: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: '#666', fontSize: 16, marginTop: 16 },
});
