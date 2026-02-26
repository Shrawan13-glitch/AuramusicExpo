import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, useWindowDimensions, ImageBackground, Share, BackHandler } from 'react-native';
import { Text, IconButton, useTheme, Surface } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePlayer } from '../contexts/PlayerContext';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSongOptions } from '../contexts/SongOptionsContext';
import { AuthenticatedHttpClient } from '../utils/authenticatedHttpClient';
import { parseLibraryData } from '../utils/libraryParser';
import { PlaylistAPI } from '../../api/playlist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribePlayerBgStyleChanged } from '../utils/settingsEvents';
import QueueScreen from './QueueScreen';

type PlayerBgStyle = 'image-gradient' | 'solid-gradient' | 'artwork-blur' | 'artwork-muted';
const PLAYER_BG_KEY = 'player_bg_style';
const PLAYER_BG_STYLES: PlayerBgStyle[] = ['image-gradient', 'solid-gradient', 'artwork-blur', 'artwork-muted'];

const isPlayerBgStyle = (value: string | null): value is PlayerBgStyle =>
  !!value && PLAYER_BG_STYLES.includes(value as PlayerBgStyle);

interface PlayerScreenProps {
  onCollapse?: () => void;
  onQueueVisibilityChange?: (visible: boolean) => void;
}

export default function PlayerScreen({ onCollapse, onQueueVisibilityChange }: PlayerScreenProps) {
  const { 
    currentTrack, 
    isPlaying, 
    pause, 
    resume, 
    position, 
    duration, 
    seekTo,
    skipNext,
    skipPrevious,
    playbackSource,
  } = usePlayer();
  const theme = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const artworkSize = Math.max(200, Math.min(width - 48, height * 0.42, 380));
  const { openSongOptions } = useSongOptions();
  const [likeLoading, setLikeLoading] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [likedStatus, setLikedStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [bgStyle, setBgStyle] = useState<PlayerBgStyle>('image-gradient');
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const queueProgress = useSharedValue(0);

  const getArtworkCandidates = useCallback((uri: string) => {
    if (!uri) return { primary: '', fallback: '' };

    if (uri.includes('i.ytimg.com/vi/')) {
      const primary = uri.replace(
        /(default|mqdefault|hqdefault|sddefault|maxresdefault|hq720)\.jpg.*/i,
        'maxresdefault.jpg'
      );
      const fallback = uri.replace(
        /(default|mqdefault|hqdefault|sddefault|maxresdefault|hq720)\.jpg.*/i,
        'hq720.jpg'
      );
      return { primary, fallback };
    }

    if (uri.includes('googleusercontent.com') && uri.includes('=')) {
      const base = uri.split('=')[0];
      return {
        primary: `${base}=w1200-h1200`,
        fallback: `${base}=w600-h600`,
      };
    }

    return { primary: uri, fallback: uri };
  }, []);

  const [artworkUri, setArtworkUri] = useState('');
  const [artworkFallback, setArtworkFallback] = useState('');

  const loadLikedIds = useCallback(async () => {
    if (likedStatus === 'loading' || likedStatus === 'ready') return;
    setLikedStatus('loading');
    try {
      const response = await AuthenticatedHttpClient.getUserLibrary();
      const sections = parseLibraryData(response);
      const allItems = sections.flatMap((section) => section.items);
      const likedPlaylist =
        allItems.find((item) => item.type === 'playlist' && /liked music/i.test(item.title)) ||
        allItems.find((item) => item.type === 'playlist' && /liked/i.test(item.title));
      const likedPlaylistId = likedPlaylist?.id || 'LM';

      const playlist = await PlaylistAPI.getPlaylistDetails(likedPlaylistId);
      if (!playlist) {
        setLikedStatus('error');
        return;
      }

      const nextLikedIds = new Set<string>();
      playlist.tracks.forEach((track) => nextLikedIds.add(track.id));

      let continuation = playlist.continuationToken;
      let guard = 0;
      while (continuation && guard < 8 && nextLikedIds.size < 2000) {
        const more = await PlaylistAPI.loadMoreTracks(continuation);
        if (!more) break;
        more.tracks.forEach((track) => nextLikedIds.add(track.id));
        continuation = more.continuationToken;
        guard += 1;
      }

      setLikedIds(nextLikedIds);
      setLikedStatus('ready');
    } catch (error) {
      console.error('Failed to load liked songs', error);
      setLikedStatus('error');
    }
  }, [likedStatus]);

  useEffect(() => {
    const { primary, fallback } = getArtworkCandidates(currentTrack?.thumbnail ?? '');
    setArtworkUri(primary);
    setArtworkFallback(fallback);
    if (likedStatus === 'idle') {
      loadLikedIds();
    }
  }, [currentTrack?.thumbnail, getArtworkCandidates]);


  useEffect(() => {
    if (!currentTrack?.id) {
      setIsLiked(false);
      return;
    }
    if (likedIds.size > 0) {
      setIsLiked(likedIds.has(currentTrack.id));
    }
  }, [currentTrack?.id, likedIds]);

  const loadBgStyle = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(PLAYER_BG_KEY);
      if (stored === 'artwork-vibrant') {
        setBgStyle('artwork-blur');
        try {
          await AsyncStorage.setItem(PLAYER_BG_KEY, 'artwork-blur');
        } catch {
          // no-op
        }
        return;
      }
      if (isPlayerBgStyle(stored)) {
        setBgStyle(stored);
      }
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    loadBgStyle();
    const unsubscribeNav = navigation.addListener('state', loadBgStyle);
    const unsubscribeEvents = subscribePlayerBgStyleChanged(loadBgStyle);
    return () => {
      unsubscribeNav();
      unsubscribeEvents();
    };
  }, [loadBgStyle, navigation]);

  const displayArtist = useMemo(() => {
    const artist = currentTrack?.artist?.trim();
    if (!artist || artist.toLowerCase() === 'unknown artist') return '';
    return artist;
  }, [currentTrack?.artist]);

  const handleArtistPress = useCallback(() => {
    if (!currentTrack?.artistId || !displayArtist) return;
    const artistParams = { artistId: currentTrack.artistId, artistName: displayArtist } as never;

    // If this is the navigator Player route (no onCollapse provided), replace it with Artist.
    if (!onCollapse && typeof (navigation as any).replace === 'function') {
      (navigation as any).replace('Artist', artistParams);
      return;
    }

    // If player is expanded from mini-player overlay, collapse first then navigate.
    if (onCollapse) {
      onCollapse();
      setTimeout(() => {
        navigation.navigate('Artist' as never, artistParams);
      }, 240);
      return;
    }

    navigation.navigate('Artist' as never, artistParams);
  }, [currentTrack?.artistId, displayArtist, navigation, onCollapse]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleShare = useCallback(async () => {
    if (!currentTrack?.id) return;
    const url = `https://music.youtube.com/watch?v=${currentTrack.id}`;
    const message = `Check out "${currentTrack.title}" on YouTube Music: ${url}`;
    try {
      await Share.share({ message });
    } catch (error) {
      console.error('Share failed', error);
    }
  }, [currentTrack?.id, currentTrack?.title]);

  const handleLikeToggle = useCallback(async () => {
    if (!currentTrack?.id || likeLoading) return;
    setLikeLoading(true);
    try {
      if (isLiked) {
        await AuthenticatedHttpClient.removeLikeSong(currentTrack.id);
        setIsLiked(false);
      } else {
        await AuthenticatedHttpClient.likeSong(currentTrack.id);
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Like toggle failed', error);
    } finally {
      setLikeLoading(false);
    }
  }, [currentTrack?.id, isLiked, likeLoading]);

  const handleOpenOptions = useCallback(() => {
    if (!currentTrack) return;
    openSongOptions({
      videoId: currentTrack.id,
      title: currentTrack.title,
      artist: currentTrack.artist,
      thumbnail: currentTrack.thumbnail,
      isLiked,
    });
  }, [currentTrack, isLiked, openSongOptions]);

  const sourceLabel = playbackSource?.label?.trim() || 'Now playing';

  const setQueueVisible = useCallback((visible: boolean) => {
    setIsQueueOpen(visible);
    onQueueVisibilityChange?.(visible);
  }, [onQueueVisibilityChange]);

  const closeQueueScreen = useCallback(() => {
    queueProgress.value = withTiming(0, { duration: 210 }, (finished) => {
      if (finished) {
        runOnJS(setQueueVisible)(false);
      }
    });
  }, [queueProgress, setQueueVisible]);

  useEffect(() => {
    if (!isQueueOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeQueueScreen();
      return true;
    });
    return () => sub.remove();
  }, [closeQueueScreen, isQueueOpen]);

  const openQueueScreen = useCallback(() => {
    if (isQueueOpen) return;
    setQueueVisible(true);
    queueProgress.value = withTiming(1, { duration: 240 });
  }, [isQueueOpen, queueProgress, setQueueVisible]);

  const queueOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(queueProgress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(queueProgress.value, [0, 1], [40, 0], Extrapolation.CLAMP) }],
  }));

  if (!currentTrack) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          No track selected
        </Text>
      </View>
    );
  }

  const backgroundSource = artworkFallback || artworkUri || currentTrack?.thumbnail || '';

  return (
    <ImageBackground
      source={bgStyle !== 'solid-gradient' && backgroundSource ? { uri: backgroundSource } : undefined}
      blurRadius={bgStyle === 'artwork-blur' ? 12 : 0}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      imageStyle={[
        styles.backgroundImage,
        bgStyle === 'artwork-blur' && { opacity: 0.6 },
        bgStyle === 'artwork-muted' && { opacity: 0.35 },
      ]}
    >
      {bgStyle === 'image-gradient' ? (
        <>
          <LinearGradient
            colors={['rgba(10,8,18,0.35)', 'rgba(12,10,20,0.8)', 'rgba(0,0,0,0.95)']}
            style={styles.backgroundGradient}
          />
          <LinearGradient
            colors={['rgba(210,160,255,0.35)', 'rgba(0,0,0,0)']}
            style={styles.backgroundGlow}
            start={{ x: 0.1, y: 0.1 }}
            end={{ x: 0.9, y: 0.9 }}
          />
        </>
      ) : bgStyle === 'artwork-blur' ? (
        <>
          <LinearGradient
            colors={['rgba(55,48,82,0.28)', 'rgba(10,10,18,0.88)', 'rgba(0,0,0,0.95)']}
            style={styles.backgroundGradient}
          />
          <LinearGradient
            colors={['rgba(205,190,255,0.22)', 'rgba(0,0,0,0)']}
            style={styles.backgroundGlow}
            start={{ x: 0.2, y: 0.05 }}
            end={{ x: 0.85, y: 0.9 }}
          />
        </>
      ) : bgStyle === 'artwork-muted' ? (
        <>
          <LinearGradient
            colors={['rgba(40,32,56,0.2)', 'rgba(8,8,12,0.9)', 'rgba(0,0,0,0.95)']}
            style={styles.backgroundGradient}
          />
          <LinearGradient
            colors={['rgba(120,110,140,0.35)', 'rgba(0,0,0,0)']}
            style={styles.backgroundGlow}
            start={{ x: 0.2, y: 0.1 }}
            end={{ x: 0.85, y: 0.9 }}
          />
        </>
      ) : (
        <>
          <LinearGradient
            colors={['#2a1a4d', '#121018', '#0b0b0d']}
            style={styles.backgroundGradient}
          />
          <LinearGradient
            colors={['rgba(140,80,255,0.28)', 'rgba(0,0,0,0)']}
            style={styles.backgroundGlow}
            start={{ x: 0.15, y: 0.05 }}
            end={{ x: 0.85, y: 0.9 }}
          />
        </>
      )}
      {/* Header */}
      <Surface
        style={[
          styles.header,
          { backgroundColor: 'transparent', paddingTop: insets.top + 8 },
        ]}
        elevation={0}
      >
        <IconButton
          icon="keyboard-backspace"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={() => {
            if (isQueueOpen) {
              closeQueueScreen();
            } else if (onCollapse) {
              onCollapse();
            } else {
              navigation.goBack();
            }
          }}
        />
        <View style={styles.headerCenter}>
          <Text variant="bodySmall" style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            {`Playing from ${sourceLabel}`}
          </Text>
        </View>
        <IconButton
          icon="dots-vertical"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={handleOpenOptions}
        />
      </Surface>

      {/* Album Art */}
      <View style={styles.artworkContainer}>
        <Surface style={[styles.artworkSurface, { backgroundColor: theme.colors.surfaceVariant }]} elevation={8}>
          {artworkUri ? (
            <Animated.Image
              source={{ uri: artworkUri }}
              style={[styles.artwork, { width: artworkSize, height: artworkSize }]}
              resizeMode="cover"
              onError={() => {
                if (artworkFallback && artworkUri !== artworkFallback) {
                  setArtworkUri(artworkFallback);
                }
              }}
              sharedTransitionTag="albumArt"
            />
          ) : (
            <View
              style={[
                styles.artwork,
                styles.artworkPlaceholder,
                { backgroundColor: theme.colors.surfaceVariant, width: artworkSize, height: artworkSize },
              ]}
            >
              <MaterialCommunityIcons
                name="music-note"
                size={36}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          )}
        </Surface>
      </View>

      {/* Track Info */}
      <View style={styles.trackInfo}>
        <Animated.Text 
          numberOfLines={2}
          style={[styles.title, { color: theme.colors.onBackground }]}
          sharedTransitionTag="songTitle"
        >
          {currentTrack.title}
        </Animated.Text>
        {!!displayArtist && (
          currentTrack.artistId ? (
            <TouchableOpacity onPress={handleArtistPress} activeOpacity={0.7}>
              <Text 
                variant="titleMedium" 
                numberOfLines={1}
                style={[styles.artist, { color: theme.colors.onSurfaceVariant }]}
              >
                {displayArtist}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text 
              variant="titleMedium" 
              numberOfLines={1}
              style={[styles.artist, { color: theme.colors.onSurfaceVariant }]}
            >
              {displayArtist}
            </Text>
          )
        )}
      </View>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration}
          value={position}
          onValueChange={seekTo}
          minimumTrackTintColor={theme.colors.primary}
          maximumTrackTintColor={theme.colors.outline}
          thumbStyle={[styles.thumb, { backgroundColor: theme.colors.primary }]}
        />
        <View style={styles.timeContainer}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {formatTime(position)}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {formatTime(duration)}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <IconButton
          icon="shuffle"
          size={28}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={() => {}}
        />
        
        <IconButton
          icon="skip-previous"
          size={36}
          iconColor={theme.colors.onBackground}
          onPress={skipPrevious}
        />
        
        <Surface style={[styles.playButton, { backgroundColor: theme.colors.primary }]} elevation={4}>
          <IconButton
            icon={isPlaying ? 'pause' : 'play'}
            size={32}
            iconColor={theme.colors.onPrimary}
            onPress={isPlaying ? pause : resume}
            style={styles.playButtonInner}
          />
        </Surface>
        
        <IconButton
          icon="skip-next"
          size={36}
          iconColor={theme.colors.onBackground}
          onPress={skipNext}
        />
        
        <IconButton
          icon="repeat"
          size={28}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={() => {}}
        />
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <IconButton
          icon={isLiked ? 'heart' : 'heart-outline'}
          size={24}
          iconColor={isLiked ? theme.colors.primary : theme.colors.onSurfaceVariant}
          onPress={handleLikeToggle}
          disabled={likeLoading}
        />
        <IconButton
          icon="share-variant"
          size={24}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={handleShare}
        />
        <IconButton
          icon="playlist-music"
          size={24}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={openQueueScreen}
        />
      </View>

      <Animated.View
        style={[styles.queueOverlay, queueOverlayStyle]}
        pointerEvents={isQueueOpen ? 'auto' : 'none'}
      >
        <QueueScreen embedded onClose={closeQueueScreen} />
      </Animated.View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundImage: {
    resizeMode: 'cover',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  artworkContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  artworkSurface: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  artwork: {
    borderRadius: 12,
  },
  artworkPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 8,
    fontSize: 24,
    lineHeight: 30,
  },
  artist: {
    textAlign: 'center',
    fontWeight: '400',
  },
  progressContainer: {
    paddingHorizontal: 32,
    marginBottom: 32,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  thumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    marginBottom: 32,
  },
  playButton: {
    borderRadius: 32,
    marginHorizontal: 16,
  },
  playButtonInner: {
    margin: 0,
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingBottom: 32,
  },
  queueOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
});
