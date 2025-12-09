import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../store/PlayerContext';
import { useLibrary } from '../store/LibraryContext';
import LyricsScreen from './LyricsScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const formatTime = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function PlayerScreen({ onClose, onOpenQueue, navigation }: any) {
  const { currentSong, isPlaying, pause, resume, skipNext, skipPrevious, position, duration, seek, shuffle, repeat, toggleShuffle, toggleRepeat } = usePlayer();
  const { isLiked, addLikedSong, removeLikedSong } = useLibrary();
  const [showLyrics, setShowLyrics] = useState(false);

  if (!currentSong) return null;

  const liked = isLiked(currentSong.id);

  return (
    <View style={styles.fullScreen}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-down" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Now Playing</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => setShowLyrics(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginRight: 16 }}>
              <Ionicons name="document-text-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onOpenQueue} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="list" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.artworkContainer}>
          <Image source={{ uri: currentSong.thumbnailUrl }} style={styles.artwork} />
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={2}>{currentSong.title}</Text>
          <View style={styles.artistsRow}>
            {currentSong.artists?.map((artist, index) => (
              <React.Fragment key={artist.id || index}>
                <TouchableOpacity 
                  onPress={() => {
                    if (artist.id && navigation) {
                      onClose();
                      navigation.navigate('Artist', { artistId: artist.id });
                    }
                  }}
                  hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                >
                  <Text style={styles.artist}>{artist.name}</Text>
                </TouchableOpacity>
                {index < currentSong.artists.length - 1 && <Text style={styles.artist}>, </Text>}
              </React.Fragment>
            )) || <Text style={styles.artist}>Unknown Artist</Text>}
          </View>
        </View>

        <View style={styles.progressContainer}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration || 1}
            value={position}
            onSlidingComplete={seek}
            minimumTrackTintColor="#1db954"
            maximumTrackTintColor="#333"
            thumbTintColor="#fff"
          />
          <View style={styles.timeRow}>
            <Text style={styles.time}>{formatTime(position)}</Text>
            <Text style={styles.time}>{formatTime(duration)}</Text>
          </View>
        </View>

        <View style={styles.controlsContainer}>
          <View style={styles.secondaryControls}>
            <TouchableOpacity onPress={toggleShuffle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="shuffle" size={22} color={shuffle ? '#1db954' : '#666'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => liked ? removeLikedSong(currentSong.id) : addLikedSong(currentSong)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? '#1db954' : '#fff'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleRepeat} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name={repeat === 'one' ? 'repeat-outline' : 'repeat'} size={22} color={repeat !== 'off' ? '#1db954' : '#666'} />
            </TouchableOpacity>
          </View>

          <View style={styles.mainControls}>
            <TouchableOpacity onPress={skipPrevious} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
              <Ionicons name="play-skip-back" size={32} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={isPlaying ? pause : resume} style={styles.playButton}>
              <Ionicons name={isPlaying ? "pause" : "play"} size={40} color="#000" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={skipNext} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
              <Ionicons name="play-skip-forward" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <Modal visible={showLyrics} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowLyrics(false)}>
        <LyricsScreen onClose={() => setShowLyrics(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  artworkContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  artwork: {
    width: SCREEN_WIDTH - 80,
    height: SCREEN_WIDTH - 80,
    borderRadius: 8,
  },
  infoContainer: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  artistsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  artist: {
    fontSize: 16,
    color: '#aaa',
  },
  progressContainer: {
    paddingHorizontal: 32,
    paddingBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    fontSize: 12,
    color: '#aaa',
  },
  controlsContainer: {
    paddingBottom: 40,
  },
  secondaryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 64,
    paddingBottom: 20,
  },
  mainControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
