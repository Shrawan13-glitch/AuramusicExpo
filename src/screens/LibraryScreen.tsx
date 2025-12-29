import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLibrary } from '../store/LibraryContext';
import { useDownload } from '../store/DownloadContext';
import { usePlayer } from '../store/PlayerContext';
import { InnerTube } from '../api/innertube';
import TabHeader from '../components/TabHeader';
import CreatePlaylistModal from '../components/CreatePlaylistModal';
import SongOptionsModal from '../components/SongOptionsModal';
import { useSongOptions } from '../hooks/useSongOptions';
import { Song } from '../types';

const categories = ['Playlists', 'Songs', 'Artists'];

export default function LibraryScreen({ navigation }: any) {
  const { likedSongs, playlists, syncPlaylists, loadPlaylistSongs } = useLibrary();
  const { downloadedSongs } = useDownload();
  const { playSong } = usePlayer();
  const { modalVisible, selectedSong, showOptions, hideOptions } = useSongOptions();
  const [selectedCategory, setSelectedCategory] = useState('Playlists');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [artistFilter, setArtistFilter] = useState('Subscribed');
  const [loading, setLoading] = useState(false);

  // Load all songs from playlists when Songs category is selected
  useEffect(() => {
    if (selectedCategory === 'Songs') {
      loadAllSongs();
    }
  }, [selectedCategory, playlists]);

  // Sync playlists on mount (only for authenticated users)
  useEffect(() => {
    const checkAuthAndSync = async () => {
      const cookies = await AsyncStorage.getItem('ytm_cookies');
      if (cookies) {
        syncPlaylists();
      }
    };
    checkAuthAndSync();
  }, [syncPlaylists]);

  const loadAllSongs = async () => {
    setLoading(true);
    try {
      const songs: Song[] = [...likedSongs];
      
      // Load songs from each playlist
      for (const playlist of playlists) {
        if (playlist.songs && playlist.songs.length > 0) {
          // Add songs from local playlists
          songs.push(...playlist.songs);
        } else if (!playlist.isLocal) {
          // Load songs from remote playlists
          try {
            const playlistSongs = await loadPlaylistSongs(playlist.id);
            songs.push(...playlistSongs);
          } catch (error) {
            // Skip failed playlist loads
          }
        }
      }
      
      // Remove duplicates based on song ID
      const uniqueSongs = songs.filter((song, index, self) => 
        index === self.findIndex(s => s.id === song.id)
      );
      
      setAllSongs(uniqueSongs);
    } catch (error) {
      console.error('Failed to load all songs:', error);
    } finally {
      setLoading(false);
    }
  };

  const libraryItems = useMemo(() => {
    if (selectedCategory === 'Songs') {
      return allSongs.map(song => ({
        id: song.id,
        title: song.title,
        subtitle: song.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
        type: 'song',
        thumbnail: song.thumbnailUrl,
        onPress: () => playSong(song, allSongs)
      }));
    }
    
    if (selectedCategory === 'Artists') {
      const allArtists = new Map();
      
      // Get subscribed artists from library data
      playlists.forEach(item => {
        if (item.type === 'artist') {
          allArtists.set(item.id, {
            id: item.id,
            name: item.name || item.title,
            type: 'artist',
            source: 'subscribed',
            thumbnail: item.thumbnailUrl
          });
        }
      });
      
      // Get artists from liked songs and playlists (only if All filter)
      if (artistFilter === 'All') {
        likedSongs.forEach(song => {
          song.artists?.forEach(artist => {
            if (!allArtists.has(artist.id)) {
              allArtists.set(artist.id, {
                id: artist.id,
                name: artist.name,
                type: 'artist',
                source: 'playlist'
              });
            }
          });
        });
        
        playlists.forEach(playlist => {
          if (playlist.songs) {
            playlist.songs.forEach((song: Song) => {
              song.artists?.forEach(artist => {
                if (!allArtists.has(artist.id)) {
                  allArtists.set(artist.id, {
                    id: artist.id,
                    name: artist.name,
                    type: 'artist',
                    source: 'playlist'
                  });
                }
              });
            });
          }
        });
      }
      
      const artistList = Array.from(allArtists.values());
      
      return artistList.map(artist => ({
        id: artist.id,
        title: artist.name,
        subtitle: artist.source === 'subscribed' ? 'Subscribed' : 'Artist',
        type: 'artist',
        thumbnail: artist.thumbnail,
        isCircular: true,
        onPress: () => navigation.navigate('Artist', { artistId: artist.id })
      }));
    }
    
    const items = [];
    
    // Liked Music (always first for Playlists)
    if (selectedCategory === 'Playlists') {
      items.push({
        id: 'liked',
        title: 'Liked music',
        subtitle: `Auto playlist`,
        type: 'liked',
        isPinned: true,
        onPress: () => navigation.navigate('LikedSongs')
      });
      
      // Downloaded Songs
      items.push({
        id: 'downloaded',
        title: 'Downloaded',
        subtitle: `Playlist`,
        type: 'playlist',
        onPress: () => navigation.navigate('DownloadedSongs')
      });
      
      // User Playlists (filter out episodes)
      playlists
        .filter(item => (item.type === 'playlist' || !item.type) && !item.title?.toLowerCase().includes('episode'))
        .forEach(playlist => {
          items.push({
            id: playlist.id,
            title: playlist.title,
            subtitle: `Playlist`,
            type: 'playlist',
            thumbnail: playlist.thumbnailUrl,
            onPress: () => navigation.navigate('Playlist', { playlistId: playlist.id })
          });
        });
    }
    
    return items;
  }, [selectedCategory, likedSongs, downloadedSongs, playlists, allSongs, artistFilter, navigation, playSong]);

  const renderCategoryChip = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[styles.chip, selectedCategory === item && styles.chipActive]}
      onPress={() => setSelectedCategory(item)}
    >
      <Text style={[styles.chipText, selectedCategory === item && styles.chipTextActive]}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  const renderLibraryItem = ({ item }: { item: any }) => {
    const isLiked = item.type === 'liked';
    const isSong = item.type === 'song';
    
    return (
      <TouchableOpacity 
        style={isSong ? styles.songItem : styles.gridItem} 
        onPress={item.onPress}
        onLongPress={isSong ? () => showOptions(allSongs.find(s => s.id === item.id)) : undefined}
      >
        {isSong ? (
          // Song layout (list item)
          <>
            <View style={styles.songThumbnail}>
              {item.thumbnail ? (
                <Image source={{ uri: item.thumbnail }} style={styles.songThumbnailImage} />
              ) : (
                <View style={styles.placeholderSongThumbnail}>
                  <Ionicons name="musical-note" size={20} color="#666" />
                </View>
              )}
            </View>
            <View style={styles.songInfo}>
              <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.songSubtitle} numberOfLines={1}>{item.subtitle}</Text>
            </View>
            <TouchableOpacity style={styles.songMenu} onPress={() => showOptions(allSongs.find(s => s.id === item.id))}>
              <Ionicons name="ellipsis-vertical" size={20} color="#aaa" />
            </TouchableOpacity>
          </>
        ) : (
          // Playlist layout (grid item)
          <>
            <View style={item.isCircular ? styles.circularThumbnail : styles.thumbnail}>
              {isLiked ? (
                <View style={styles.likedGradient}>
                  <Ionicons name="heart" size={32} color="#fff" />
                </View>
              ) : item.thumbnail ? (
                <Image source={{ uri: item.thumbnail }} style={item.isCircular ? styles.circularThumbnailImage : styles.thumbnailImage} />
              ) : (
                <View style={styles.placeholderThumbnail}>
                  <Ionicons name={item.type === 'artist' ? "person" : "musical-notes"} size={24} color="#666" />
                </View>
              )}
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
              <View style={styles.subtitleRow}>
                {item.isPinned && <Ionicons name="pin" size={12} color="#aaa" style={styles.pinIcon} />}
                <Text style={styles.itemSubtitle} numberOfLines={1}>{item.subtitle}</Text>
              </View>
            </View>
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="Library" navigation={navigation} />
      
      {/* Category Navigation */}
      <View style={styles.categorySection}>
        <FlatList
          horizontal
          data={categories}
          renderItem={renderCategoryChip}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        />
      </View>
      
      {/* Sort Filter */}
      <View style={styles.sortSection}>
        <TouchableOpacity style={styles.sortButton}>
          <Text style={styles.sortText}>Recent activity</Text>
          <Ionicons name="chevron-down" size={16} color="#aaa" />
        </TouchableOpacity>
        
        {selectedCategory === 'Artists' && (
          <View style={styles.artistFilters}>
            <TouchableOpacity 
              style={[styles.filterChip, artistFilter === 'All' && styles.filterChipActive]}
              onPress={() => setArtistFilter('All')}
            >
              <Text style={[styles.filterText, artistFilter === 'All' && styles.filterTextActive]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterChip, artistFilter === 'Subscribed' && styles.filterChipActive]}
              onPress={() => setArtistFilter('Subscribed')}
            >
              <Text style={[styles.filterText, artistFilter === 'Subscribed' && styles.filterTextActive]}>Subscribed</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {selectedCategory === 'Playlists' && (
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading songs...</Text>
        </View>
      ) : (
        <FlatList
          data={libraryItems}
          renderItem={renderLibraryItem}
          keyExtractor={(item) => item.id}
          numColumns={selectedCategory === 'Songs' ? 1 : 2}
          key={selectedCategory} // Force re-render when category changes
          contentContainerStyle={selectedCategory === 'Songs' ? styles.listContainer : styles.gridContainer}
          columnWrapperStyle={selectedCategory === 'Songs' ? undefined : styles.gridRow}
        />
      )}
      
      <CreatePlaylistModal 
        visible={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
      />
      
      <SongOptionsModal
        visible={modalVisible}
        onClose={hideOptions}
        song={selectedSong}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  categorySection: { paddingVertical: 12 },
  categoryList: { paddingHorizontal: 16 },
  chip: { backgroundColor: '#202020', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  chipActive: { backgroundColor: '#fff' },
  chipText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  chipTextActive: { color: '#000' },
  sortSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  sortButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#202020', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  sortText: { color: '#fff', fontSize: 14, marginRight: 4 },
  artistFilters: { flexDirection: 'row', gap: 8 },
  filterChip: { backgroundColor: '#202020', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  filterChipActive: { backgroundColor: '#1db954' },
  filterText: { color: '#fff', fontSize: 14 },
  filterTextActive: { color: '#fff' },
  createButton: { backgroundColor: '#1db954', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#aaa', fontSize: 16 },
  // Grid layout (playlists)
  gridContainer: { paddingHorizontal: 8, paddingBottom: 140 },
  gridRow: { justifyContent: 'space-between', paddingHorizontal: 8 },
  gridItem: { width: '48%', marginBottom: 24 },
  thumbnail: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 8, overflow: 'hidden' },
  circularThumbnail: { width: '100%', aspectRatio: 1, borderRadius: 1000, marginBottom: 8, overflow: 'hidden' },
  likedGradient: { flex: 1, backgroundColor: '#e74c3c', alignItems: 'center', justifyContent: 'center' },
  thumbnailImage: { width: '100%', height: '100%' },
  circularThumbnailImage: { width: '100%', height: '100%' },
  placeholderThumbnail: { flex: 1, backgroundColor: '#202020', alignItems: 'center', justifyContent: 'center' },
  itemInfo: { paddingHorizontal: 4 },
  itemTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center' },
  pinIcon: { marginRight: 4 },
  itemSubtitle: { color: '#aaa', fontSize: 12, flex: 1 },
  // List layout (songs)
  listContainer: { paddingHorizontal: 16, paddingBottom: 140 },
  songItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginBottom: 4 },
  songThumbnail: { width: 48, height: 48, borderRadius: 4, marginRight: 12, overflow: 'hidden' },
  songThumbnailImage: { width: '100%', height: '100%' },
  placeholderSongThumbnail: { flex: 1, backgroundColor: '#202020', alignItems: 'center', justifyContent: 'center' },
  songInfo: { flex: 1, marginRight: 12 },
  songTitle: { color: '#fff', fontSize: 16, fontWeight: '500', marginBottom: 2 },
  songSubtitle: { color: '#aaa', fontSize: 14 },
  songMenu: { padding: 8 },
});