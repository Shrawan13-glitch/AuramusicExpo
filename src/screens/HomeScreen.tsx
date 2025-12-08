import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, RefreshControl, ActivityIndicator, Dimensions } from 'react-native';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';
import { Song } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_WIDTH = (SCREEN_WIDTH - 48) / 2;
const ITEM_HEIGHT = 64;

export default function HomeScreen() {
  const [quickPicks, setQuickPicks] = useState<Song[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [continuation, setContinuation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { playSong, currentSong } = usePlayer();

  useEffect(() => {
    loadHome();
  }, []);

  const loadHome = async () => {
    try {
      const data = await InnerTube.getHome();
      setQuickPicks(data.quickPicks);
      setSections(data.sections);
      setContinuation(data.continuation);
      console.log(`Initial load: ${data.sections.length} sections, continuation: ${!!data.continuation}`);
    } catch (error) {
      console.error('Error loading home:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (!continuation || loadingMore) return;
    
    console.log('Loading more sections...');
    setLoadingMore(true);
    try {
      const data = await InnerTube.getHomeContinuation(continuation);
      console.log(`Loaded ${data.sections.length} more sections`);
      setSections(prev => [...prev, ...data.sections]);
      setContinuation(data.continuation);
    } catch (error) {
      console.error('Error loading more:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHome();
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 500;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      loadMore();
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      onScroll={handleScroll}
      scrollEventThrottle={400}
    >
      {quickPicks.length > 0 && (
        <View style={styles.quickPicksSection}>
          <Text style={styles.sectionTitle}>Quick Picks</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.quickPicksGrid}>
              {Array.from({ length: 4 }).map((_, rowIndex) => (
                <View key={rowIndex} style={styles.quickPicksRow}>
                  {quickPicks.slice(rowIndex * 5, (rowIndex + 1) * 5).map((song) => {
                    const isPlaying = currentSong?.id === song.id;
                    return (
                      <TouchableOpacity
                        key={song.id}
                        style={styles.quickPickItem}
                        onPress={() => playSong(song)}
                      >
                        <Image source={{ uri: song.thumbnailUrl }} style={styles.quickPickThumb} />
                        <View style={styles.quickPickInfo}>
                          <Text style={[styles.quickPickTitle, isPlaying && styles.activeText]} numberOfLines={1}>
                            {song.title}
                          </Text>
                          <Text style={styles.quickPickArtist} numberOfLines={1}>
                            {song.artists.map(a => a.name).join(', ')}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {sections.map((section, index) => (
        <View key={index} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionContent}>
            {section.items.map((song: Song) => {
              const isPlaying = currentSong?.id === song.id;
              return (
                <TouchableOpacity key={song.id} style={styles.card} onPress={() => playSong(song)}>
                  <Image source={{ uri: song.thumbnailUrl }} style={styles.cardImage} />
                  <Text style={[styles.cardTitle, isPlaying && styles.activeText]} numberOfLines={2}>
                    {song.title}
                  </Text>
                  <Text style={styles.cardArtist} numberOfLines={1}>
                    {song.artists.map(a => a.name).join(', ')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ))}

      {continuation && !loadingMore && (
        <TouchableOpacity style={styles.loadMoreButton} onPress={loadMore}>
          <Text style={styles.loadMoreText}>Load More</Text>
        </TouchableOpacity>
      )}
      {loadingMore && (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  quickPicksSection: { marginBottom: 16 },
  quickPicksGrid: { paddingLeft: 16 },
  quickPicksRow: { flexDirection: 'row' },
  quickPickItem: { flexDirection: 'row', alignItems: 'center', width: ITEM_WIDTH, height: ITEM_HEIGHT, paddingRight: 8, marginBottom: 4 },
  quickPickThumb: { width: 56, height: 56, borderRadius: 4 },
  quickPickInfo: { flex: 1, marginLeft: 12 },
  quickPickTitle: { fontSize: 14, color: '#fff', fontWeight: '500' },
  quickPickArtist: { fontSize: 12, color: '#aaa', marginTop: 2 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginLeft: 16, marginBottom: 12, marginTop: 4 },
  sectionContent: { paddingLeft: 16, paddingRight: 8 },
  card: { width: 160, marginRight: 12 },
  cardImage: { width: 160, height: 160, borderRadius: 8 },
  cardTitle: { fontSize: 14, color: '#fff', fontWeight: '500', marginTop: 8, lineHeight: 18 },
  cardArtist: { fontSize: 12, color: '#aaa', marginTop: 4 },
  activeText: { color: '#1db954' },
  footer: { padding: 20, alignItems: 'center' },
  loadMoreButton: { padding: 16, margin: 16, backgroundColor: '#1db954', borderRadius: 8, alignItems: 'center' },
  loadMoreText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
