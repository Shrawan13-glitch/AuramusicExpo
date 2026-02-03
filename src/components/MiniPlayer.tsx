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
          backgroundColor: theme.colors.surface,
          borderColor: 'rgba(255,255,255,0.45)',
          marginBottom: bottomOffset,
        },
      ]}
      elevation={8}
    >
      <ProgressBar 
        progress={progress} 
        color={theme.colors.primary}
        style={styles.progressBar}
      />
      
      <TouchableOpacity 
        style={styles.content}
        onPress={handlePlayerPress}
        activeOpacity={0.7}
      >
        <View style={styles.trackInfo}>
          {currentTrack.thumbnail ? (
            <Animated.Image
              source={{ uri: currentTrack.thumbnail }}
              style={[styles.thumbnail, { backgroundColor: theme.colors.surfaceVariant }]}
              resizeMode="cover"
              sharedTransitionTag="albumArt"
            />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
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
              {currentTrack.artist}
            </Text>
          </View>
        </View>

        <View style={styles.controls}>
          <IconButton
            icon={isPlaying ? 'pause' : 'play'}
            size={28}
            iconColor={theme.colors.onSurface}
            onPress={handlePlayPause}
            style={styles.playButton}
          />
        </View>
      </TouchableOpacity>
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
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginHorizontal: 16,
  },
  progressBar: {
    height: 2,
    backgroundColor: 'transparent',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  trackInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
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
    fontSize: 15,
    lineHeight: 18,
  },
  artist: {
    fontSize: 13,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    margin: 0,
  },
});
