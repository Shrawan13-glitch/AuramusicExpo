import React, { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../store/PlayerContext';

export default function CachedSongsScreen({ route, navigation }: any) {
  const { songs = [] } = route.params || {};
  const { playSong } = usePlayer();

  const renderSong = useCallback(({ item, index }) => (
    <TouchableOpacity
      style={styles.songItem}
      onPress={() => playSong(item)}
    >
      <Image 
        source={{ uri: item.thumbnailUrl }} 
        style={styles.thumbnail}
        defaultSource={require('../../assets/icon.png')}
        resizeMode="cover"
      />
      <View style={styles.songInfo}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>
          {item.artists?.map(a => a.name).join(', ') || 'Unknown Artist'}
        </Text>
      </View>
      <View style={styles.cacheIndicator}>
        <Ionicons name="server" size={16} color="#ff6b35" />
      </View>
    </TouchableOpacity>
  ), [playSong]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cached Songs</Text>
      </View>

      <FlatList
        data={songs}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={renderSong}
        contentContainerStyle={{ paddingBottom: 100 }}
        removeClippedSubviews={true}
        maxToRenderPerBatch={15}
        windowSize={10}
        initialNumToRender={20}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="server-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No cached songs</Text>
            <Text style={styles.emptySubtext}>Songs will appear here as you play them</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  songItem: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16 },
  thumbnail: { width: 48, height: 48, borderRadius: 4 },
  songInfo: { flex: 1, marginLeft: 12 },
  title: { fontSize: 16, color: '#fff', fontWeight: '500' },
  artist: { fontSize: 14, color: '#aaa', marginTop: 2 },
  cacheIndicator: { padding: 8 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { fontSize: 18, color: '#666', marginTop: 16, fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' },
});