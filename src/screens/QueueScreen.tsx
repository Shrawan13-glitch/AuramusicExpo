import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../store/PlayerContext';

export default function QueueScreen({ onClose }: { onClose: () => void }) {
  const { queue, currentSong } = usePlayer();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="chevron-down" size={32} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Queue</Text>
        <View style={{ width: 32 }} />
      </View>

      {currentSong && (
        <View style={styles.nowPlayingSection}>
          <Text style={styles.sectionTitle}>Now Playing</Text>
          <View style={styles.queueItem}>
            <Image source={{ uri: currentSong.thumbnailUrl }} style={styles.queueThumbnail} />
            <View style={styles.queueInfo}>
              <Text style={styles.queueTitle} numberOfLines={1}>{currentSong.title}</Text>
              <Text style={styles.queueArtist} numberOfLines={1}>
                {currentSong.artists.map(a => a.name).join(', ')}
              </Text>
            </View>
            <Ionicons name="musical-notes" size={20} color="#1db954" />
          </View>
        </View>
      )}

      <View style={styles.upNextSection}>
        <Text style={styles.sectionTitle}>Up Next ({queue.length})</Text>
        <FlatList
          data={queue}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={styles.queueItem}>
              <Image source={{ uri: item.thumbnailUrl }} style={styles.queueThumbnail} />
              <View style={styles.queueInfo}>
                <Text style={styles.queueTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.queueArtist} numberOfLines={1}>
                  {item.artists.map(a => a.name).join(', ')}
                </Text>
              </View>
            </View>
          )}
        />
      </View>
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
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  nowPlayingSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  upNextSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  queueThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  queueInfo: {
    flex: 1,
    marginLeft: 12,
  },
  queueTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  queueArtist: {
    color: '#aaa',
    fontSize: 12,
  },

});
