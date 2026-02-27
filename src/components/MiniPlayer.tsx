import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, IconButton, useTheme, Surface, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePlayer } from '../contexts/PlayerContext';
import { useNavigation } from '@react-navigation/native';
import Animated from 'react-native-reanimated';

interface MiniPlayerProps {
  onExpand?: () => void;
  bottomOffset?: number;
}

const MiniPlayer = React.memo(({ onExpand, bottomOffset = 0 }: MiniPlayerProps) => {
  const { currentTrack, isPlaying, pause, resume, position, duration } = usePlayer();
  const theme = useTheme();
  const navigation = useNavigation();

  const progress = useMemo(() => {
    return duration > 0 ? position / duration : 0;
  }, [position, duration]);

  const artistLabel = useMemo(() => {
    const artists = (currentTrack?.artists || [])
      .map((item) => item?.name?.trim())
      .filter(Boolean);
    if (artists.length) return artists.join(', ');
    return currentTrack?.artist || '';
  }, [currentTrack?.artist, currentTrack?.artists]);

  const handlePlayerPress = useCallback(() => {
    if (onExpand) {
      onExpand();
      return;
    }
    navigation.navigate('Player' as never);
  }, [navigation, onExpand]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [isPlaying, pause, resume]);

  if (!currentTrack) return null;

  return (
    <Surface
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.outline,
          marginBottom: bottomOffset,
        },
      ]}
      elevation={4}
    >
      <View style={[styles.handle, { backgroundColor: theme.colors.outline }]} />

      <TouchableOpacity
        style={styles.content}
        onPress={handlePlayerPress}
        activeOpacity={0.7}
      >
        <View style={styles.trackInfo}>
          {currentTrack.thumbnail ? (
            <Animated.Image
              source={{ uri: currentTrack.thumbnail }}
              style={[styles.thumbnail, { backgroundColor: theme.colors.surface }]}
              resizeMode="cover"
              sharedTransitionTag="albumArt"
            />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder, { backgroundColor: theme.colors.surface }]}>
              <MaterialCommunityIcons
                name="music-note"
                size={18}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          )}

          <View style={styles.textContainer}>
            <Animated.Text
              numberOfLines={1}
              style={[styles.title, { color: theme.colors.onSurface }]}
              sharedTransitionTag="songTitle"
            >
              {currentTrack.title}
            </Animated.Text>
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={[styles.artist, { color: theme.colors.onSurfaceVariant }]}
            >
              {artistLabel}
            </Text>
          </View>
        </View>

        <View style={styles.controls}>
          <Surface style={[styles.playSurface, { backgroundColor: theme.colors.primary }]} elevation={2}>
            <IconButton
              icon={isPlaying ? 'pause' : 'play'}
              size={22}
              iconColor={theme.colors.onPrimary}
              onPress={handlePlayPause}
              style={styles.playButton}
            />
          </Surface>
        </View>
      </TouchableOpacity>

      <ProgressBar
        progress={progress}
        color={theme.colors.primary}
        style={[styles.progressBar, { backgroundColor: theme.colors.outline }]}
      />
    </Surface>
  );
});

export default MiniPlayer;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginHorizontal: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 3,
    borderRadius: 999,
    marginTop: 6,
    marginBottom: 4,
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trackInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontWeight: '500',
    marginBottom: 2,
    fontSize: 14,
    lineHeight: 18,
  },
  artist: {
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playSurface: {
    borderRadius: 16,
  },
  playButton: {
    margin: 0,
  },
  progressBar: {
    height: 2,
  },
});
