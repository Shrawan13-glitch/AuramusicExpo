import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../store/LibraryContext';
import { usePlayer } from '../store/PlayerContext';
import { useDownload } from '../store/DownloadContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TabHeader from '../components/TabHeader';

export default function LibraryScreen({ navigation }: any) {
  const { likedSongs, recentlyPlayed } = useLibrary();
  const { playSong } = usePlayer();
  const { downloadedSongs } = useDownload();
  const [ytmLibrary, setYtmLibrary] = useState<any[]>([]);
  const [loadingYtm, setLoadingYtm] = useState(false);
  const [subscribedArtists, setSubscribedArtists] = useState<any[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(false);
  const [cachedSongs, setCachedSongs] = useState<any[]>([]);
  const [downloadedCount, setDownloadedCount] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'list' | 'grid'>('list');
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: layoutMode === 'grid' ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [layoutMode]);

  useEffect(() => {
    loadCachedSongs();
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadYtmLibrary();
      loadSubscribedArtists();
    }
  }, [isAuthenticated]);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('ytm_token');
      setIsAuthenticated(!!token);
    } catch (error) {
      // Error checking auth handled silently
    }
  };

  const loadCachedSongs = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem('cached_songs');
      const downloaded = await AsyncStorage.getItem('downloaded_songs');
      if (cached) setCachedSongs(JSON.parse(cached));
      if (downloaded) setDownloadedCount(JSON.parse(downloaded).length || 0);
    } catch (error) {
      // Error loading cached songs handled silently
    }
  }, []);

  const loadYtmLibrary = useCallback(async () => {
    setLoadingYtm(true);
    try {
      const { InnerTube } = require('../api/innertube');
      const result = await InnerTube.getLibrary('FEmusic_liked_videos');
      setYtmLibrary(result.items || []);
    } catch (error) {
      // Error loading YTM library handled silently
    } finally {
      setLoadingYtm(false);
    }
  }, []);

  const loadSubscribedArtists = useCallback(async () => {
    setLoadingArtists(true);
    try {
      const { InnerTube } = require('../api/innertube');
      const result = await InnerTube.getLibrary('FEmusic_library_corpus_artists');
      setSubscribedArtists(result.items || []);
    } catch (error) {
      // Error loading artists handled silently
    } finally {
      setLoadingArtists(false);
    }
  }, []);

  const folders = useMemo(() => [
    {
      title: 'AuraMeter',
      count: 0,
      icon: 'flame' as const,
      color: '#8b5cf6',
      hideCount: true,
      onPress: () => navigation.navigate('AuraMeter'),
    },
    {
      title: 'Downloaded',
      count: downloadedSongs.length,
      icon: 'download' as const,
      color: '#1db954',
      onPress: () => navigation.navigate('DownloadedSongs'),
    },
    {
      title: 'Cached Songs',
      count: cachedSongs.length,
      icon: 'server' as const,
      color: '#ff6b35',
      onPress: () => navigation.navigate('CachedSongs', { songs: cachedSongs }),
    },
    {
      title: 'Recently Played',
      count: recentlyPlayed.length,
      icon: 'time' as const,
      color: '#9b59b6',
      onPress: () => navigation.navigate('RecentlyPlayed'),
    },
    {
      title: isAuthenticated ? 'Liked Songs (YTM)' : 'Liked Songs',
      count: isAuthenticated && ytmLibrary.length > 0 ? ytmLibrary.length : likedSongs.length,
      icon: 'heart' as const,
      color: '#e74c3c',
      loading: loadingYtm,
      onPress: () => navigation.navigate('LikedSongs'),
    },
  ], [downloadedSongs.length, cachedSongs.length, recentlyPlayed.length, isAuthenticated, ytmLibrary.length, likedSongs.length, loadingYtm, navigation]);

  const renderArtist = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.artistItem}
      onPress={() => navigation.navigate('Artist', { artistId: item.id })}
    >
      <Image 
        source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} 
        style={styles.artistImage}
        resizeMode="cover"
        onError={() => {}}
      />
      <Text style={styles.artistName} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  ), [navigation]);

  const renderFolder = useCallback(({ item }) => {
    if (layoutMode === 'grid') {
      return (
        <TouchableOpacity
          style={styles.gridItem}
          onPress={item.onPress}
          disabled={item.loading}
          activeOpacity={0.7}
        >
          <View style={styles.gridIconContainer}>
            <View style={[styles.gridIcon, { backgroundColor: item.color }]}>
              <Ionicons name={item.icon} size={28} color="#fff" />
            </View>
          </View>
          <View style={styles.gridTextContainer}>
            <Text style={styles.gridTitle} numberOfLines={2}>{item.title}</Text>
            {!item.hideCount && (
              <Text style={styles.gridCount}>
                {item.loading ? '...' : item.count}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    }
    
    return (
      <TouchableOpacity
        style={styles.folderItem}
        onPress={item.onPress}
        disabled={item.loading}
      >
        <View style={[styles.folderIcon, { backgroundColor: item.color }]}>
          <Ionicons name={item.icon} size={24} color="#fff" />
        </View>
        <View style={styles.folderInfo}>
          <Text style={styles.folderTitle}>{item.title}</Text>
          {!item.hideCount && (
            <Text style={styles.folderCount}>
              {item.loading ? 'Loading...' : `${item.count} ${item.count === 1 ? 'item' : 'items'}`}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </TouchableOpacity>
    );
  }, [layoutMode]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="Library" navigation={navigation} />
      
      <View style={styles.layoutToggle}>
        <TouchableOpacity 
          style={styles.toggleContainer} 
          onPress={() => setLayoutMode(layoutMode === 'list' ? 'grid' : 'list')}
          activeOpacity={0.8}
        >
          <Animated.View 
            style={[
              styles.toggleSlider,
              {
                transform: [{
                  translateX: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 48]
                  })
                }]
              }
            ]}
          >
            <Ionicons name={layoutMode === 'list' ? 'list' : 'grid'} size={18} color="#000" />
          </Animated.View>
          <View style={styles.toggleOption}>
            <Ionicons name="list" size={18} color={layoutMode === 'list' ? '#000' : '#666'} />
          </View>
          <View style={styles.toggleOption}>
            <Ionicons name="grid" size={18} color={layoutMode === 'grid' ? '#000' : '#666'} />
          </View>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[{ type: 'artists' }, { type: 'folders' }]}
        keyExtractor={(item) => item.type}
        contentContainerStyle={{ paddingBottom: 140, paddingTop: 8 }}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={5}
        renderItem={({ item }) => {
          if (item.type === 'artists') {
            return isAuthenticated && subscribedArtists.length > 0 ? (
              <View style={styles.artistsSection}>
                <Text style={styles.sectionTitle}>Subscribed Artists</Text>
                <FlatList
                  horizontal
                  data={subscribedArtists.slice(0, 10)}
                  keyExtractor={(artist) => artist.id}
                  renderItem={renderArtist}
                  showsHorizontalScrollIndicator={false}
                  removeClippedSubviews={true}
                  maxToRenderPerBatch={5}
                  windowSize={5}
                />
              </View>
            ) : null;
          }
          
          return layoutMode === 'grid' ? (
            <View style={styles.gridContainer}>
              {folders.map((folder) => (
                <View key={folder.title} style={styles.gridItemWrapper}>
                  {renderFolder({ item: folder })}
                </View>
              ))}
            </View>
          ) : (
            <FlatList
              data={folders}
              keyExtractor={(folder) => folder.title}
              renderItem={renderFolder}
              scrollEnabled={false}
            />
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  layoutToggle: { paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center' },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#1a1a1a', borderRadius: 10, padding: 4, width: 100, position: 'relative' },
  toggleSlider: { position: 'absolute', left: 4, top: 4, bottom: 4, width: 44, backgroundColor: '#1db954', borderRadius: 8, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  toggleOption: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, zIndex: 2 },
  folderItem: { flexDirection: 'row', alignItems: 'center', padding: 16, marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1a1a1a', borderRadius: 12 },
  folderIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  folderInfo: { flex: 1, marginLeft: 16 },
  folderTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  folderCount: { fontSize: 14, color: '#aaa', marginTop: 4 },
  artistsSection: { marginBottom: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  artistsScroll: { paddingRight: 16 },
  artistItem: { width: 120, marginRight: 12, alignItems: 'center' },
  artistImage: { width: 120, height: 120, borderRadius: 60, marginBottom: 8 },
  artistName: { fontSize: 14, color: '#fff', textAlign: 'center', width: '100%' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  gridItemWrapper: { width: '50%', padding: 8 },
  gridItem: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, minHeight: 160, justifyContent: 'space-between' },
  gridIconContainer: { marginBottom: 12 },
  gridIcon: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  gridTextContainer: { flex: 1, justifyContent: 'flex-end' },
  gridTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 6, lineHeight: 20 },
  gridCount: { fontSize: 24, fontWeight: '800', color: '#1db954', letterSpacing: -0.5 },
});
