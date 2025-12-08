import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../store/LibraryContext';
import { usePlayer } from '../store/PlayerContext';

export default function RecentlyPlayedScreen({ navigation }: any) {
  const { recentlyPlayed } = useLibrary();
  const { playSong } = usePlayer();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recently Played</Text>
      </View>

      <FlatList
        data={recentlyPlayed}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={{ paddingBottom: 80 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No recently played songs</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.songItem} onPress={() => playSong(item)}>
            <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
            <View style={styles.songInfo}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.artist} numberOfLines={1}>
                {item.artists?.map(a => a.name).join(', ')}
              </Text>
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
  songItem: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16 },
  thumbnail: { width: 56, height: 56, borderRadius: 4 },
  songInfo: { flex: 1, marginLeft: 12 },
  title: { fontSize: 16, color: '#fff', fontWeight: '500' },
  artist: { fontSize: 14, color: '#aaa', marginTop: 4 },
  empty: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: '#666', fontSize: 16, marginTop: 16 },
});
