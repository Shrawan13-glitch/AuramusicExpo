import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, ImageBackground } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';
import { useLibrary } from '../store/LibraryContext';
import { useDownload } from '../store/DownloadContext';
import SongOptionsModal from '../components/SongOptionsModal';
import PlaylistSettingsModal from '../components/PlaylistSettingsModal';
import PlaylistDownloadButton from '../components/PlaylistDownloadButton';
import { useSongOptions } from '../hooks/useSongOptions';

// Add hashCode method for color generation
String.prototype.hashCode = function() {
  let hash = 0;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
};

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

const PlaylistHeader = React.memo(({ data, onPlay, onShuffle, onPlaylistOptions, playlistProgress }: any) => {
  // Generate artwork if no thumbnail
  const generateArtwork = () => {
    const colors = [`hsl(${(Math.abs(data.playlist.id?.hashCode() || 0) * 137) % 360}, 80%, 55%)`, `hsl(${(Math.abs(data.playlist.id?.hashCode() || 0) * 137 + 120) % 360}, 80%, 35%)`];
    const patterns = ['▲', '●', '■', '♦', '★', '▼', '◆', '♪'];
    const pattern = patterns[Math.abs(data.playlist.id?.hashCode() || 0) % patterns.length];
    
    return (
      <View style={[styles.generatedArtwork, { backgroundColor: colors[0] }]}>
        <View style={[styles.artworkPattern, { backgroundColor: colors[1] }]}>
          <Text style={styles.patternText}>{pattern}</Text>
        </View>
        <View style={[styles.artworkOverlay, { backgroundColor: colors[1] }]} />
        <View style={styles.artworkTitle}>
          <Text style={styles.artworkTitleText} numberOfLines={2}>{data.playlist.title}</Text>
        </View>
      </View>
    );
  };
  
  const [imageError, setImageError] = useState(false);

  const shouldShowGeneratedArt = !data?.playlist?.thumbnail || 
    data.playlist.thumbnail.includes('placeholder') || 
    data.playlist.thumbnail.includes('via.placeholder') ||
    data.playlist.thumbnail === 'https://via.placeholder.com/200' ||
    imageError;

  return (
    <View style={styles.playlistHeader}>
      {!shouldShowGeneratedArt ? (
        <Image 
          source={{ uri: data.playlist.thumbnail }} 
          style={styles.playlistArt}
          onError={() => setImageError(true)}
        />
      ) : (
        generateArtwork()
      )}
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
      
      <TouchableOpacity style={styles.optionsButton} onPress={onPlaylistOptions}>
        <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
    
    <View style={styles.downloadSection}>
      <PlaylistDownloadButton playlist={data.playlist} songs={data.songs} />
      {playlistProgress && (
        <View style={styles.downloadProgress}>
          <View style={styles.progressContainer}>
            <View style={[styles.progressFill, { width: `${playlistProgress.progress * 100}%` }]} />
          </View>
          <Text style={styles.downloadText}>
            {playlistProgress.currentSong} • {playlistProgress.downloadedSongs}/{playlistProgress.totalSongs}
          </Text>
        </View>
      )}
    </View>
  </View>
  );
});

export default function PlaylistScreen({ route, navigation }: any) {
  const { playlistId, videoId } = route.params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [showHeaderBg, setShowHeaderBg] = useState(false);
  const [showPlaylistOptions, setShowPlaylistOptions] = useState(false);
  const { playSong } = usePlayer();
  const { playlists } = useLibrary();
  const { getPlaylistProgress, getDownloadedPlaylist, isPlaylistDownloaded } = useDownload();
  const { modalVisible, selectedSong, showOptions, hideOptions } = useSongOptions();
  const scrollY = useRef(new Animated.Value(0)).current;

  const playlistProgress = getPlaylistProgress(playlistId);
  
  // Get current playlist from context for real-time updates
  const currentPlaylist = useMemo(() => {
    return playlists.find(p => p.id === playlistId) || data?.playlist;
  }, [playlists, playlistId, data?.playlist]);

  useEffect(() => {
    loadPlaylist();
    // Delay content loading for smooth animation
    const timer = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(timer);
  }, [playlistId, playlists]);

  // Update data when currentPlaylist changes (for song removal)
  useEffect(() => {
    if (currentPlaylist && currentPlaylist.songs && data) {
      setData(prevData => ({
        ...prevData,
        songs: currentPlaylist.songs,
        playlist: {
          ...prevData.playlist,
          title: currentPlaylist.title,
          description: currentPlaylist.description,
          privacy: currentPlaylist.privacy,
          songCount: `${currentPlaylist.songs.length} songs`
        }
      }));
    }
  }, [currentPlaylist?.songs?.length, currentPlaylist?.title, currentPlaylist?.description, currentPlaylist?.privacy]);

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
      data={{
        ...data,
        playlist: {
          ...data.playlist,
          title: currentPlaylist?.title || data.playlist.title,
          description: currentPlaylist?.description || data.playlist.description,
          privacy: currentPlaylist?.privacy || data.playlist.privacy
        }
      }}
      playlistProgress={playlistProgress}
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
      onPlaylistOptions={() => setShowPlaylistOptions(true)}
    />
  ) : null, [data, playSong, playlistProgress, currentPlaylist]);



  const loadPlaylist = async () => {
    setLoading(true);
    
    // Check if playlist is downloaded first
    const downloadedPlaylist = getDownloadedPlaylist(playlistId);
    if (downloadedPlaylist) {
      setData({
        playlist: {
          id: downloadedPlaylist.id,
          title: downloadedPlaylist.title,
          author: 'Downloaded',
          songCount: `${downloadedPlaylist.songs.length} songs`,
          thumbnail: downloadedPlaylist.thumbnail
        },
        songs: downloadedPlaylist.songs
      });
      setLoading(false);
      return;
    }
    
    // Check if it's a local playlist
    const localPlaylist = playlists.find(p => p.id === playlistId && p.isLocal);
    
    if (localPlaylist) {
      setData({
        playlist: {
          id: localPlaylist.id,
          title: localPlaylist.title,
          description: localPlaylist.description,
          author: 'You',
          songCount: `${localPlaylist.songs?.length || 0} songs`,
          thumbnail: localPlaylist.songs?.[0]?.thumbnailUrl || localPlaylist.thumbnailUrl,
          privacy: localPlaylist.privacy || 'PRIVATE',
          isLocal: true
        },
        songs: localPlaylist.songs || []
      });
      setLoading(false);
      return;
    }
    
    // Load remote playlist
    try {
      const result = await InnerTube.getPlaylist(playlistId, videoId);
      
      if (result) {
        setData(result);
        
        if (result?.continuation && result?.isMix) {
          loadAllSongs(result.continuation, result.songs, true);
        } else if (result?.continuation && !result?.isMix) {
          loadAllSongs(result.continuation, result.songs, false);
        }
      } else {
        const playlistInfo = playlists.find(p => p.id === playlistId);
        
        setData({
          playlist: {
            id: playlistId,
            title: playlistInfo?.title || 'Playlist',
            author: playlistInfo?.subtitle || 'Unknown',
            songCount: '0 songs',
            thumbnail: playlistInfo?.thumbnailUrl
          },
          songs: []
        });
      }
    } catch (error) {
      const playlistInfo = playlists.find(p => p.id === playlistId);
      
      setData({
        playlist: {
          id: playlistId,
          title: playlistInfo?.title || 'Playlist',
          author: playlistInfo?.subtitle || 'Unknown',
          songCount: '0 songs',
          thumbnail: playlistInfo?.thumbnailUrl
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

  // Generate colors for background when no thumbnail
  const getBackgroundColors = () => {
    const colors = [`hsl(${(Math.abs(data?.playlist?.id?.hashCode() || 0) * 137) % 360}, 80%, 55%)`, `hsl(${(Math.abs(data?.playlist?.id?.hashCode() || 0) * 137 + 120) % 360}, 80%, 35%)`];
    return colors;
  };

  const backgroundColors = getBackgroundColors();
  const hasValidThumbnail = data?.playlist?.thumbnail && 
    !data.playlist.thumbnail.includes('placeholder') && 
    !data.playlist.thumbnail.includes('via.placeholder') &&
    data.playlist.thumbnail !== 'https://via.placeholder.com/200';

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={hasValidThumbnail ? { uri: data.playlist.thumbnail } : undefined}
        style={StyleSheet.absoluteFillObject}
        blurRadius={50}
      >
        <LinearGradient
          colors={hasValidThumbnail ? 
            ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', '#000'] : 
            [
              `${backgroundColors[0].replace('hsl', 'hsla').replace(')', ', 0.3)')}`,
              `${backgroundColors[1].replace('hsl', 'hsla').replace(')', ', 0.8)')}`,
              '#000'
            ]
          }
          locations={[0, 0.4, 0.7]}
          style={StyleSheet.absoluteFillObject}
        />
      </ImageBackground>
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={[
          styles.header,
          { backgroundColor: showHeaderBg ? 'rgba(0,0,0,0.9)' : 'transparent' }
        ]}>
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
        </Animated.View>

        <FlashList
          data={showContent ? data.songs : []}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          estimatedItemSize={72}
          ListHeaderComponent={headerComponent}
          contentContainerStyle={{ paddingBottom: 80, paddingTop: 82 }}
        />
        
        <SongOptionsModal
          visible={modalVisible}
          onClose={hideOptions}
          song={selectedSong}
          playlistId={playlistId}
          navigation={navigation}
        />
        
        <PlaylistSettingsModal
          visible={showPlaylistOptions}
          playlist={currentPlaylist}
          onClose={() => {
            setShowPlaylistOptions(false);
            hideOptions();
          }}
          navigation={navigation}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { padding: 16, paddingTop: 50, flexDirection: 'row', alignItems: 'center', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginLeft: 16, flex: 1 },
  playlistHeader: { alignItems: 'center', padding: 16 },
  playlistArt: { width: 200, height: 200, borderRadius: 8, marginBottom: 16 },
  generatedArtwork: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  artworkPattern: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  patternText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '900',
  },
  artworkOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    opacity: 0.4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  artworkTitle: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
  },
  artworkTitleText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  playlistTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 8 },
  playlistInfo: { fontSize: 14, color: '#fff', marginBottom: 24 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  playButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1db954', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24, gap: 8 },
  playButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  shuffleButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', borderRadius: 24 },
  optionsButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', borderRadius: 24 },
  downloadSection: { marginTop: 16, alignItems: 'center' },
  downloadProgress: { marginTop: 12, width: '100%', paddingHorizontal: 20 },
  progressContainer: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginBottom: 6 },
  progressFill: { height: 4, backgroundColor: '#1db954', borderRadius: 2 },
  downloadText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center' },
  songItem: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  thumbnail: { width: 48, height: 48, borderRadius: 4 },
  songInfo: { flex: 1, marginLeft: 12 },
  songTitle: { fontSize: 16, color: '#fff', fontWeight: '500' },
  songArtist: { fontSize: 14, color: '#fff', marginTop: 2 },
  menuButton: { padding: 8 },
  errorText: { color: '#fff', textAlign: 'center', marginTop: 100, fontSize: 16 },
});
