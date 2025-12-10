import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';

export default function LyricsScreen({ onClose }: any) {
  const { currentSong } = usePlayer();
  const [lyrics, setLyrics] = useState<{ lines: Array<{ text: string }> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentSong) {
      loadLyrics();
    }
  }, [currentSong?.id]);

  const loadLyrics = async () => {
    if (!currentSong) return;
    setLoading(true);
    const result = await InnerTube.getLyrics(currentSong.id);
    setLyrics(result);
    setLoading(false);
  };

  if (!currentSong) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lyrics</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>{currentSong.title}</Text>
        <Text style={styles.songArtist} numberOfLines={1}>
          {currentSong.artists?.map(a => a.name).join(', ') || 'Unknown Artist'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1db954" />
        </View>
      ) : !lyrics ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="musical-notes-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>No lyrics available</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.lyricsContainer}
          contentContainerStyle={styles.lyricsContent}
          showsVerticalScrollIndicator={false}
        >
          {lyrics.lines.map((line, index) => (
            <Text key={index} style={styles.lyricLine}>
              {line.text || ' '}
            </Text>
          ))}
          <View style={{ height: 300 }} />
        </ScrollView>
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
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  songInfo: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  songTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#aaa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  lyricsContainer: {
    flex: 1,
  },
  lyricsContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },

  lyricLine: {
    fontSize: 20,
    color: '#aaa',
    marginVertical: 16,
    lineHeight: 32,
    textAlign: 'center',
  },
});
