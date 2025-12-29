import React, { useEffect, useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';
import { useLibrary } from '../store/LibraryContext';
import SongOptionsModal from '../components/SongOptionsModal';
import { useSongOptions } from '../hooks/useSongOptions';

export default function PlaylistScreen({ route, navigation }: any) {
  const { playlistId, videoId } = route.params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { playSong } = usePlayer();
  const { playlists } = useLibrary();
  const { modalVisible, selectedSong, showOptions, hideOptions } = useSongOptions();

  useEffect(() => {
    loadPlaylist();
  }, [playlistId, playlists]);

  const loadPlaylist = async () => {
    console.log('📋 [PlaylistScreen] Loading playlist:', {
      playlistId,
      videoId,
      timestamp: new Date().toISOString()
    });
    
    setLoading(true);
    
    // Check if it's a local playlist first
    const localPlaylist = playlists.find(p => p.id === playlistId && p.isLocal);
    console.log('🔍 [PlaylistScreen] Local playlist search result:', {
      found: !!localPlaylist,
      playlistId,
      totalPlaylists: playlists.length,
      localPlaylists: playlists.filter(p => p.isLocal).length
    });
    
    if (localPlaylist) {
      console.log('💾 [PlaylistScreen] Loading local playlist:', {
        id: localPlaylist.id,
        title: localPlaylist.title,
        songCount: localPlaylist.songs?.length || 0,
        songs: localPlaylist.songs?.map(s => ({ id: s.id, title: s.title })) || []
      });
      
      setData({
        playlist: {
          id: localPlaylist.id,
          title: localPlaylist.title,
          author: 'You',
          songCount: `${localPlaylist.songs?.length || 0} songs`,
          thumbnail: localPlaylist.songs?.[0]?.thumbnailUrl || localPlaylist.thumbnailUrl || 'https://via.placeholder.com/200'
        },
        songs: localPlaylist.songs || []
      });
      setLoading(false);
      
      console.log('✅ [PlaylistScreen] Local playlist loaded successfully');
      return;
    }
    
    // Check authentication for remote playlists
    const cookies = await AsyncStorage.getItem('ytm_cookies');
    const isAuthenticated = !!cookies;
    
    console.log('🔐 [PlaylistScreen] Authentication status:', {
      isAuthenticated,
      playlistId,
      isRemotePlaylist: true
    });
    
    // Load remote playlist (including empty YTM playlists)
    try {
      console.log('🔄 [PlaylistScreen] Fetching remote playlist from API...');
      const result = await InnerTube.getPlaylist(playlistId, videoId);
      
      console.log('📊 [PlaylistScreen] API response:', {
        hasResult: !!result,
        songCount: result?.songs?.length || 0,
        hasContinuation: !!result?.continuation,
        isMix: !!result?.isMix,
        playlistTitle: result?.playlist?.title
      });
      
      if (result) {
        setData(result);
        
        // Auto-load more songs if continuation exists
        if (result?.continuation && result?.isMix) {
          console.log('🔄 [PlaylistScreen] Loading more songs for mix...');
          loadAllSongs(result.continuation, result.songs, true);
        } else if (result?.continuation && !result?.isMix) {
          console.log('🔄 [PlaylistScreen] Loading more songs for playlist...');
          loadAllSongs(result.continuation, result.songs, false);
        }
      } else {
        console.warn('⚠️ [PlaylistScreen] No result from API - creating fallback playlist');
        // Fallback for empty playlists
        const playlistInfo = playlists.find(p => p.id === playlistId);
        console.log('🔍 [PlaylistScreen] Fallback playlist info:', playlistInfo);
        
        setData({
          playlist: {
            id: playlistId,
            title: playlistInfo?.title || 'Playlist',
            author: playlistInfo?.subtitle || 'Unknown',
            songCount: '0 songs',
            thumbnail: playlistInfo?.thumbnailUrl || 'https://via.placeholder.com/200'
          },
          songs: []
        });
      }
    } catch (error) {
      console.error('❌ [PlaylistScreen] Error loading remote playlist:', error);
      // Handle error case
      const playlistInfo = playlists.find(p => p.id === playlistId);
      console.log('🔍 [PlaylistScreen] Error fallback playlist info:', playlistInfo);
      
      setData({
        playlist: {
          id: playlistId,
          title: playlistInfo?.title || 'Playlist',
          author: playlistInfo?.subtitle || 'Unknown',
          songCount: '0 songs',
          thumbnail: playlistInfo?.thumbnailUrl || 'https://via.placeholder.com/200'
        },
        songs: []
      });
    }
    setLoading(false);
    
    console.log('✅ [PlaylistScreen] Playlist loading completed');
  };

  const loadAllSongs = async (continuation: string, currentSongs: any[], isMix: boolean) => {
    let nextContinuation = continuation;
    let allSongs = [...currentSongs];

    while (nextContinuation && allSongs.length < 100) {
      const result = isMix
        ? await InnerTube.next('', nextContinuation)
        : await InnerTube.getPlaylistContinuation(nextContinuation);
      allSongs = [...allSongs, ...result.songs];
      nextContinuation = result.continuation;
      
      setData((prev: any) => ({
        ...prev,
        songs: allSongs,
        continuation: nextContinuation,
      }));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.errorText}>Failed to load playlist</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={data.songs}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={{ paddingBottom: 80 }}
        ListHeaderComponent={
          <View style={styles.playlistHeader}>
            <Image source={{ uri: data.playlist.thumbnail }} style={styles.playlistArt} />
            <Text style={styles.playlistTitle}>{data.playlist.title}</Text>
            <Text style={styles.playlistInfo}>{data.playlist.author} • {data.playlist.songCount}</Text>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={styles.playButton}
                onPress={() => {
                  if (data.songs.length > 0) {
                    const queue = data.songs.slice(1);
                    playSong(data.songs[0], queue, false);
                  }
                }}
              >
                <Ionicons name="play" size={20} color="#000" />
                <Text style={styles.playButtonText}>Play</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.shuffleButton}
                onPress={() => {
                  if (data.songs.length > 0) {
                    const shuffled = [...data.songs].sort(() => Math.random() - 0.5);
                    const queue = shuffled.slice(1);
                    playSong(shuffled[0], queue, false);
                  }
                }}
              >
                <Ionicons name="shuffle" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.songItem}
            onPress={() => {
              const queue = data.songs.slice(index + 1);
              playSong(item, queue, false);
            }}
            onLongPress={() => showOptions(item)}
          >
            <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
            <View style={styles.songInfo}>
              <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.songArtist} numberOfLines={1}>
                {item.artists?.map((a: any) => a.name).join(', ')}
              </Text>
            </View>
            <TouchableOpacity style={styles.menuButton} onPress={() => showOptions(item)}>
              <Ionicons name="ellipsis-vertical" size={20} color="#666" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
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
  header: { padding: 16, paddingTop: 50 },
  playlistHeader: { alignItems: 'center', padding: 16 },
  playlistArt: { width: 200, height: 200, borderRadius: 8, marginBottom: 16 },
  playlistTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 8 },
  playlistInfo: { fontSize: 14, color: '#fff', marginBottom: 24 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  playButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1db954', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24, gap: 8 },
  playButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  shuffleButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', borderRadius: 24 },
  songItem: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  thumbnail: { width: 48, height: 48, borderRadius: 4 },
  songInfo: { flex: 1, marginLeft: 12 },
  songTitle: { fontSize: 16, color: '#fff', fontWeight: '500' },
  songArtist: { fontSize: 14, color: '#fff', marginTop: 2 },
  menuButton: { padding: 8 },
  errorText: { color: '#fff', textAlign: 'center', marginTop: 100, fontSize: 16 },
});
