import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Text, IconButton, useTheme, Surface } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePlayer } from '../contexts/PlayerContext';
import { useNavigation } from '@react-navigation/native';
import Animated from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface PlayerScreenProps {
  onCollapse?: () => void;
}

export default function PlayerScreen({ onCollapse }: PlayerScreenProps) {
  const { 
    currentTrack, 
    isPlaying, 
    pause, 
    resume, 
    position, 
    duration, 
    seekTo,
    skipNext,
    skipPrevious 
  } = usePlayer();
  const theme = useTheme();
  const navigation = useNavigation();

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

  useEffect(() => {
    const { primary, fallback } = getArtworkCandidates(currentTrack?.thumbnail ?? '');
    setArtworkUri(primary);
    setArtworkFallback(fallback);
  }, [currentTrack?.thumbnail, getArtworkCandidates]);

  const displayArtist = useMemo(() => {
    const artist = currentTrack?.artist?.trim();
    if (!artist || artist.toLowerCase() === 'unknown artist') return '';
    return artist;
  }, [currentTrack?.artist]);

  const handleArtistPress = useCallback(() => {
    if (!currentTrack?.artistId || !displayArtist) return;
    navigation.navigate('Artist' as never, { artistId: currentTrack.artistId, artistName: displayArtist } as never);
  }, [currentTrack?.artistId, displayArtist, navigation]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentTrack) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
          No track selected
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={0}>
        <IconButton
          icon="keyboard-backspace"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={() => {
            if (onCollapse) {
              onCollapse();
            } else {
              navigation.goBack();
            }
          }}
        />
        <View style={styles.headerCenter}>
          <Text variant="bodySmall" style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            Playing from Search
          </Text>
        </View>
        <IconButton
          icon="dots-vertical"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={() => {}}
        />
      </Surface>

      {/* Album Art */}
      <View style={styles.artworkContainer}>
        <Surface style={[styles.artworkSurface, { backgroundColor: theme.colors.surfaceVariant }]} elevation={8}>
          {artworkUri ? (
            <Animated.Image
              source={{ uri: artworkUri }}
              style={styles.artwork}
              resizeMode="cover"
              onError={() => {
                if (artworkFallback && artworkUri !== artworkFallback) {
                  setArtworkUri(artworkFallback);
                }
              }}
              sharedTransitionTag="albumArt"
            />
          ) : (
            <View style={[styles.artwork, styles.artworkPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
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
          icon="heart-outline"
          size={24}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={() => {}}
        />
        <IconButton
          icon="share-variant"
          size={24}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={() => {}}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 48,
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
    width: width - 80,
    height: width - 80,
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
});
