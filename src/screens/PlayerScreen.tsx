import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, useWindowDimensions, ImageBackground, Share, BackHandler, ScrollView } from 'react-native';
import { Text, IconButton, useTheme, Surface } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePlayer } from '../contexts/PlayerContext';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming, withSequence } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { useSongOptions } from '../contexts/SongOptionsContext';
import { AuthenticatedHttpClient } from '../utils/authenticatedHttpClient';
import { parseLibraryData } from '../utils/libraryParser';
import { PlaylistAPI } from '../../api/playlist';
import { SEARCH_FILTERS, YouTubeMusicAPI } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribePlayerBgStyleChanged } from '../utils/settingsEvents';
import QueueScreen from './QueueScreen';
import LyricsScreen from './LyricsScreen';
import type { LyricsPayload, LyricsStatus } from '../types/lyrics';
import { fetchBestLyrics } from '../utils/lyricsService';

type PlayerBgStyle = 'image-gradient' | 'solid-gradient' | 'artwork-blur' | 'artwork-muted';
const PLAYER_BG_KEY = 'player_bg_style';
const PLAYER_BG_STYLES: PlayerBgStyle[] = ['image-gradient', 'solid-gradient', 'artwork-blur', 'artwork-muted'];

const isPlayerBgStyle = (value: string | null): value is PlayerBgStyle =>
  !!value && PLAYER_BG_STYLES.includes(value as PlayerBgStyle);

interface PlayerScreenProps {
  onCollapse?: () => void;
  onQueueVisibilityChange?: (visible: boolean) => void;
  onLyricsVisibilityChange?: (visible: boolean) => void;
}

export default function PlayerScreen({ onCollapse, onQueueVisibilityChange, onLyricsVisibilityChange }: PlayerScreenProps) {
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
    shuffleEnabled,
    repeatMode,
    toggleShuffle,
    cycleRepeatMode,
  } = usePlayer();
  const theme = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isCompactMode = width < 400 || height < 500;
  const artworkSize = isCompactMode 
    ? Math.min(width - 32, height * 0.3, 200)
    : Math.max(200, Math.min(width - 48, height * 0.42, 380));
  const { openSongOptions } = useSongOptions();
  const [likeLoading, setLikeLoading] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [likedStatus, setLikedStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [bgStyle, setBgStyle] = useState<PlayerBgStyle>('image-gradient');
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [lyricsStatus, setLyricsStatus] = useState<LyricsStatus>('idle');
  const [lyricsPayload, setLyricsPayload] = useState<LyricsPayload | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const [seekIndicator, setSeekIndicator] = useState<{ side: 'left' | 'right'; amount: number } | null>(null);
  const [seekDuration, setSeekDuration] = useState(5);
  const seekOpacity = useSharedValue(0);
  const queueProgress = useSharedValue(0);
  const lyricsProgress = useSharedValue(0);

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
      setLyricsStatus('idle');
      setLyricsPayload(null);
      return;
    }

    let active = true;
    setLyricsStatus('loading');
    setLyricsPayload(null);

    fetchBestLyrics(currentTrack)
      .then((payload) => {
        if (!active) return;
        if (payload?.lines?.length) {
          setLyricsPayload(payload);
          setLyricsStatus('ready');
        } else {
          setLyricsStatus('empty');
        }
      })
      .catch(() => {
        if (!active) return;
        setLyricsStatus('error');
      });

    return () => {
      active = false;
    };
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist, currentTrack?.duration]);


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

  useEffect(() => {
    AsyncStorage.getItem('seek_duration')
      .then((stored) => {
        const parsed = Number(stored);
        if ([5, 10, 15, 30].includes(parsed)) {
          setSeekDuration(parsed);
        }
      })
      .catch(() => {});
  }, []);

  const displayArtists = useMemo(() => {
    const direct = (currentTrack?.artists || [])
      .filter((item) => item?.name?.trim())
      .map((item) => ({ id: item.id, name: item.name.trim() }));
    if (direct.length) return direct;
    const fallback = currentTrack?.artist?.trim();
    if (!fallback || fallback.toLowerCase() === 'unknown artist') return [];
    return [{ id: currentTrack?.artistId, name: fallback }];
  }, [currentTrack?.artist, currentTrack?.artistId, currentTrack?.artists]);

  const handleArtistPress = useCallback(async (artist: { id?: string; name: string }) => {
    if (!artist?.name) return;

    let resolvedArtistId = artist.id;
    if (!resolvedArtistId) {
      try {
        const artistFilter = SEARCH_FILTERS.find((filter) => filter.value === 'artists');
        const results = await YouTubeMusicAPI.search(artist.name, artistFilter);
        const direct = results.find(
          (item) =>
            item.type === 'artist' &&
            item.id?.startsWith('UC') &&
            item.title?.trim().toLowerCase() === artist.name.trim().toLowerCase()
        );
        const fallback = results.find((item) => item.type === 'artist' && item.id?.startsWith('UC'));
        resolvedArtistId = direct?.id || fallback?.id;
      } catch {
        resolvedArtistId = undefined;
      }
    }

    if (!resolvedArtistId) return;
    const artistParams = { artistId: resolvedArtistId, artistName: artist.name } as never;

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
  }, [navigation, onCollapse]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDoubleTapSeek = useCallback((side: 'left' | 'right') => {
    const newPosition = side === 'left' 
      ? Math.max(0, position - seekDuration)
      : Math.min(duration, position + seekDuration);
    
    seekTo(newPosition);
    
    setSeekIndicator(prev => ({
      side,
      amount: prev?.side === side ? (prev.amount + seekDuration) : seekDuration
    }));
    
    seekOpacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(1, { duration: 400 }),
      withTiming(0, { duration: 200 })
    );
    
    setTimeout(() => setSeekIndicator(null), 700);
  }, [position, duration, seekTo, seekOpacity, seekDuration]);

  const leftDoubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => runOnJS(handleDoubleTapSeek)('left'));

  const rightDoubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => runOnJS(handleDoubleTapSeek)('right'));

  const seekIndicatorStyle = useAnimatedStyle(() => ({
    opacity: seekOpacity.value,
  }));

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

  const setLyricsVisible = useCallback((visible: boolean) => {
    setIsLyricsOpen(visible);
    onLyricsVisibilityChange?.(visible);
  }, [onLyricsVisibilityChange]);

  const closeQueueScreen = useCallback(() => {
    queueProgress.value = withTiming(0, { duration: 210 }, (finished) => {
      if (finished) {
        runOnJS(setQueueVisible)(false);
      }
    });
  }, [queueProgress, setQueueVisible]);

  const openQueueScreen = useCallback(() => {
    if (isQueueOpen) return;
    setQueueVisible(true);
    queueProgress.value = withTiming(1, { duration: 240 });
  }, [isQueueOpen, queueProgress, setQueueVisible]);

  const closeLyricsScreen = useCallback(() => {
    lyricsProgress.value = withTiming(0, { duration: 220 }, (finished) => {
      if (finished) {
        runOnJS(setLyricsVisible)(false);
      }
    });
  }, [lyricsProgress, setLyricsVisible]);

  const openLyricsScreen = useCallback(() => {
    if (isLyricsOpen) return;
    setLyricsVisible(true);
    lyricsProgress.value = withTiming(1, { duration: 240 });
  }, [isLyricsOpen, lyricsProgress, setLyricsVisible]);

  useEffect(() => {
    if (!isQueueOpen && !isLyricsOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isLyricsOpen) {
        closeLyricsScreen();
        return true;
      }
      closeQueueScreen();
      return true;
    });
    return () => sub.remove();
  }, [closeQueueScreen, closeLyricsScreen, isLyricsOpen, isQueueOpen]);

  useEffect(() => {
    if (onCollapse) return;
    const nav = navigation as any;
    if (typeof nav?.setOptions !== 'function') return;
    try {
      nav.setOptions({ gestureEnabled: !isLyricsOpen });
    } catch {
      return;
    }
    return () => {
      try {
        nav.setOptions({ gestureEnabled: true });
      } catch {
        // no-op
      }
    };
  }, [isLyricsOpen, navigation, onCollapse]);

  const queueOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(queueProgress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(queueProgress.value, [0, 1], [40, 0], Extrapolation.CLAMP) }],
  }));

  const lyricsOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lyricsProgress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(lyricsProgress.value, [0, 1], [40, 0], Extrapolation.CLAMP) }],
  }));
  const baseContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lyricsProgress.value, [0, 1], [1, 0], Extrapolation.CLAMP),
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
      <Animated.View
        style={[baseContentStyle, { flex: undefined, height: '100%' }]}
        pointerEvents={isLyricsOpen ? 'none' : 'auto'}
      >
        <ScrollView 
          contentContainerStyle={isCompactMode ? styles.scrollContent : styles.normalContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
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
              if (isLyricsOpen) {
                closeLyricsScreen();
              } else if (isQueueOpen) {
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
            <View style={[styles.seekOverlay, { width: artworkSize, height: artworkSize }]}>
              <GestureDetector gesture={leftDoubleTap}>
                <View style={styles.seekZone} />
              </GestureDetector>
              <GestureDetector gesture={rightDoubleTap}>
                <View style={styles.seekZone} />
              </GestureDetector>
            </View>
            {seekIndicator && (
              <Animated.View 
                style={[
                  styles.seekIndicator, 
                  seekIndicatorStyle,
                  { 
                    [seekIndicator.side]: 16,
                    width: artworkSize,
                    height: artworkSize 
                  }
                ]}
              >
                <MaterialCommunityIcons
                  name={seekIndicator.side === 'left' ? 'rewind' : 'fast-forward'}
                  size={32}
                  color="#fff"
                />
                <Text style={styles.seekText}>{seekIndicator.amount}s</Text>
              </Animated.View>
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
          {displayArtists.length > 0 && (
            <View style={styles.artistRow}>
              {displayArtists.map((artist, index) => (
                <View key={`${artist.id || artist.name}-${index}`} style={styles.artistInline}>
                  <TouchableOpacity
                    onPress={() => void handleArtistPress(artist)}
                    activeOpacity={0.7}
                  >
                    <Text
                      variant="titleMedium"
                      numberOfLines={1}
                      style={[styles.artist, styles.artistLink, { color: theme.colors.onSurfaceVariant }]}
                    >
                      {artist.name}
                    </Text>
                  </TouchableOpacity>
                  {index < displayArtists.length - 1 ? (
                    <Text
                      variant="titleMedium"
                      style={[styles.artist, { color: theme.colors.onSurfaceVariant }]}
                    >
                      {', '}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Progress */}
        <View style={styles.progressContainer}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration}
            value={isSeeking ? seekPosition : position}
            onSlidingStart={(value) => {
              setIsSeeking(true);
              setSeekPosition(value);
            }}
            onValueChange={setSeekPosition}
            onSlidingComplete={(value) => {
              setIsSeeking(false);
              seekTo(value);
            }}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.outline}
            thumbStyle={[styles.thumb, { backgroundColor: theme.colors.primary }]}
          />
          <View style={styles.timeContainer}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {formatTime(isSeeking ? seekPosition : position)}
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
            iconColor={shuffleEnabled ? theme.colors.primary : theme.colors.onSurfaceVariant}
            onPress={toggleShuffle}
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
            icon={repeatMode === 'one' ? 'repeat-once' : 'repeat'}
            size={28}
            iconColor={repeatMode === 'off' ? theme.colors.onSurfaceVariant : theme.colors.primary}
            onPress={cycleRepeatMode}
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
          <IconButton
            icon="text-box-multiple-outline"
            size={24}
            iconColor={theme.colors.onSurfaceVariant}
            onPress={openLyricsScreen}
          />
        </View>
        </ScrollView>
      </Animated.View>

      <Animated.View
        style={[styles.lyricsOverlay, lyricsOverlayStyle]}
        pointerEvents={isLyricsOpen ? 'auto' : 'none'}
      >
        <LyricsScreen
          title={currentTrack.title}
          artist={currentTrack.artist}
          lyricsStatus={lyricsStatus}
          lyricsPayload={lyricsPayload}
          position={position}
          duration={duration}
          isPlaying={isPlaying}
          onSeek={seekTo}
          onSkipPrevious={skipPrevious}
          onSkipNext={skipNext}
          onPauseResume={isPlaying ? pause : resume}
          onClose={closeLyricsScreen}
        />
      </Animated.View>

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
    paddingVertical: 24,
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
    marginBottom: 16,
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
  artistRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: 0,
  },
  artistLink: {
    textDecorationLine: 'underline',
  },
  artistInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressContainer: {
    paddingHorizontal: 32,
    marginBottom: 16,
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
    marginBottom: 16,
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
    paddingBottom: 16,
    marginBottom: 16,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  normalContent: {
    flexGrow: 1,
  },
  lyricsOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 18,
  },
  queueOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  seekOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
  },
  seekZone: {
    flex: 1,
    height: '100%',
  },
  seekIndicator: {
    position: 'absolute',
    top: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
  },
  seekText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
});
