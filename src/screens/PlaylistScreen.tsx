import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';
import { useLibrary } from '../store/LibraryContext';
import SongOptionsModal from '../components/SongOptionsModal';
import { useSongOptions } from '../hooks/useSongOptions';

const ITEM_HEIGHT = 72;

const SongItem = React.memo(({ item, index, onPress, onLongPress, onMenuPress }: any) => (
  <TouchableOpacity style={styles.songItem} onPress={onPress} onLongPress={onLongPress}>
    <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
    <View style={styles.songInfo}>
      <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.songArtist} numberOfLines={1}>
        {item.artists?.map((a: any) => a.name).join(', ')}
      </Text>
    </View>
    <TouchableOpacity style={styles.menuButton} onPress={onMenuPress}>
      <Ionicons name="ellipsis-vertical" size={20} color="#666" />
    </TouchableOpacity>
  </TouchableOpacity>
));

const PlaylistHeader = React.memo(({ data, onPlay, onShuffle }: any) => (
  <View style={styles.playlistHeader}>
    <Image source={{ uri: data.playlist.thumbnail }} style={styles.playlistArt} />
    <Text style={styles.playlistTitle}>{data.playlist.title}</Text>
    <Text style={styles.playlistInfo}>{data.playlist.author} • {data.playlist.songCount}</Text>
    
    <View style={styles.buttonRow}>
      <TouchableOpacity style={styles.playButton} onPress={onPlay}>
        <Ionicons name="play" size={20} color="#000" />
        <Text style={styles.playButtonText}>Play</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.shuffleButton} onPress={onShuffle}>
        <Ionicons name="shuffle" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  </View>
));

export default function PlaylistScreen({ route, navigation }: any) {
  const { playlistId, videoId } = route.params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { playSong } = usePlayer();
  const { playlists } = useLibrary();
  const { modalVisible, selectedSong, showOptions, hideOptions } = useSongOptions();
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadPlaylist();
  }, [playlistId, playlists]);

  const renderItem = useCallback(({ item, index }: any) => (
    <SongItem
      item={item}
      index={index}
      onPress={() => {
        const queue = data.songs.slice(index + 1);
        playSong(item, queue, false);
      }}
      onLongPress={() => showOptions(item)}
      onMenuPress={() => showOptions(item)}
    />
  ), [data?.songs, playSong, showOptions]);

  const keyExtractor = useCallback((item: any, index: number) => `${item.id}-${index}`, []);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  const headerComponent = useMemo(() => data ? (
    <PlaylistHeader
      data={data}
      onPlay={() => {
        if (data.songs.length > 0) {
          const queue = data.songs.slice(1);
          playSong(data.songs[0], queue, false);
        }
      }}
      onShuffle={() => {
        if (data.songs.length > 0) {
          const shuffled = [...data.songs].sort(() => Math.random() - 0.5);
          const queue = shuffled.slice(1);
          playSong(shuffled[0], queue, false);
        }
      }}
    />
  ) : null, [data, playSong]);



  const loadPlaylist = async () => {
    setLoading(true);
    
    // Check if it's a local playlist first
    const localPlaylist = playlists.find(p => p.id === playlistId && p.isLocal);
    
    if (localPlaylist) {
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
      return;
    }
    
    // Check authentication for remote playlists
    const cookies = await AsyncStorage.getItem('ytm_cookies');
    const isAuthenticated = !!cookies;
    
    // Load remote playlist (including empty YTM playlists)
    try {
      const result = await InnerTube.getPlaylist(playlistId, videoId);
      
      if (result) {
        setData(result);
        
        // Auto-load more songs if continuation exists
        if (result?.continuation && result?.isMix) {
          loadAllSongs(result.continuation, result.songs, true);
        } else if (result?.continuation && !result?.isMix) {
          loadAllSongs(result.continuation, result.songs, false);
        }
      } else {
        // Fallback for empty playlists
        const playlistInfo = playlists.find(p => p.id === playlistId);
        
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
      // Handle error case
      const playlistInfo = playlists.find(p => p.id === playlistId);
      
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
  };

  const loadAllSongs = useCallback(async (continuation: string, currentSongs: any[], isMix: boolean) => {
    let nextContinuation = continuation;
    let allSongs = [...currentSongs];

    // Load in background without blocking UI
    setTimeout(async () => {
      while (nextContinuation && allSongs.length < 100) {
        try {
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
        } catch (error) {
          break;
        }
      }
    }, 100);
  }, []);

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
        <Animated.Text 
          style={[
            styles.headerTitle,
            {
              opacity: scrollY.interpolate({
                inputRange: [150, 200],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
            },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {data?.playlist?.title}
        </Animated.Text>
      </View>

      <Animated.FlatList
        data={data.songs}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        ListHeaderComponent={headerComponent}
        contentContainerStyle={{ paddingBottom: 80, paddingTop: 82 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        removeClippedSubviews
        maxToRenderPerBatch={6}
        windowSize={6}
        initialNumToRender={8}
        updateCellsBatchingPeriod={50}
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
  header: { padding: 16, paddingTop: 50, flexDirection: 'row', alignItems: 'center', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, backgroundColor: '#000' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginLeft: 16, flex: 1 },
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
