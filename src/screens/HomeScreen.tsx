import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, RefreshControl, ActivityIndicator, Dimensions, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';
import { Song } from '../types';
import SongOptionsModal from '../components/SongOptionsModal';
import TabHeader from '../components/TabHeader';
import { useSongOptions } from '../hooks/useSongOptions';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_WIDTH = (SCREEN_WIDTH - 48) / 2;
const ITEM_HEIGHT = 64;

export default function HomeScreen({ navigation }: any) {
  const [quickPicks, setQuickPicks] = useState<Song[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [continuation, setContinuation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { playSong, currentSong } = usePlayer();
  const { modalVisible, selectedSong, showOptions, hideOptions } = useSongOptions();

  useEffect(() => {
    loadHome();
  }, []);

  const loadHome = useCallback(async () => {
    try {
      const data = await InnerTube.getHome();
      setQuickPicks(data.quickPicks);
      setSections(data.sections);
      setContinuation(data.continuation);
    } catch (error) {
      // Error loading home handled silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!continuation || loadingMore) return;
    
    setLoadingMore(true);
    try {
      const data = await InnerTube.getHomeContinuation(continuation);
      setSections(prev => [...prev, ...data.sections]);
      setContinuation(data.continuation);
    } catch (error) {
      // Error loading more handled silently
    } finally {
      setLoadingMore(false);
    }
  }, [continuation, loadingMore]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadHome();
  }, [loadHome]);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 500;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      loadMore();
    }
  }, [loadMore]);

  const renderSectionItem = useCallback(({ item }) => {
    const isPlaying = item.type === 'song' && currentSong?.id === item.id;
    const displayTitle = item.type === 'artist' ? item.name : item.title;
    const displaySubtitle = item.type === 'song' 
      ? item.artists?.map((a: any) => a.name).join(', ') 
      : item.subtitle || '';
    
    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => {
          if (item.type === 'song') {
            playSong(item);
          } else if (item.type === 'artist') {
            navigation.getParent()?.navigate('Artist', { artistId: item.id });
          } else if (item.type === 'album') {
            navigation.getParent()?.navigate('Album', { albumId: item.id });
          } else if (item.type === 'playlist') {
            navigation.getParent()?.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
          }
        }}
        onLongPress={item.type === 'song' ? () => showOptions(item) : undefined}
      >
        <Image 
          source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} 
          style={[styles.cardImage, item.type === 'artist' && styles.roundImage]}
          resizeMode="cover"
          onError={() => {}}
        />
        <Text style={[styles.cardTitle, isPlaying && styles.activeText]} numberOfLines={2}>
          {displayTitle}
        </Text>
        <Text style={styles.cardArtist} numberOfLines={1}>
          {displaySubtitle}
        </Text>
      </TouchableOpacity>
    );
  }, [currentSong?.id, playSong, navigation, showOptions]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="Home" navigation={navigation} />
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      onScroll={handleScroll}
      scrollEventThrottle={400}
      removeClippedSubviews={true}
      maxToRenderPerBatch={5}
      windowSize={5}
      initialNumToRender={3}
      getItemLayout={(data, index) => ({ length: 200, offset: 200 * index, index })}
    >
      {quickPicks.length > 0 && (
        <View style={styles.quickPicksSection}>
          <Text style={styles.sectionTitle}>Quick Picks</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.quickPicksGrid}>
              {Array.from({ length: Math.ceil(quickPicks.slice(0, 20).length / 5) }).map((_, rowIndex) => (
                <View key={rowIndex} style={styles.quickPicksRow}>
                  {quickPicks.slice(rowIndex * 5, (rowIndex + 1) * 5).map((song) => {
                    const isPlaying = currentSong?.id === song.id;
                    return (
                      <TouchableOpacity
                        key={song.id}
                        style={styles.quickPickItem}
                        onPress={() => playSong(song)}
                        onLongPress={() => showOptions(song)}
                      >
                        <Image 
                          source={song.thumbnailUrl ? { uri: song.thumbnailUrl } : require('../../assets/icon.png')} 
                          style={styles.quickPickThumb}
                          resizeMode="cover"
                          onError={() => {}}
                        />
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
          <FlatList
            horizontal
            data={section.items.slice(0, 15)}
            keyExtractor={(item) => `${item.id}-${item.type}`}
            showsHorizontalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={5}
            windowSize={5}
            renderItem={renderSectionItem}
          />
        </View>
      ))}

      {loadingMore && (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}
      <View style={{ height: 100 }} />
    </ScrollView>

    <SongOptionsModal
      visible={modalVisible}
      onClose={hideOptions}
      song={selectedSong}
      showDeleteOption={false}
      navigation={navigation.getParent()}
    />
    </SafeAreaView>
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
  roundImage: { borderRadius: 80 },
  cardTitle: { fontSize: 14, color: '#fff', fontWeight: '500', marginTop: 8, lineHeight: 18 },
  cardArtist: { fontSize: 12, color: '#aaa', marginTop: 4 },
  activeText: { color: '#1db954' },
  footer: { padding: 20, alignItems: 'center' },
});
