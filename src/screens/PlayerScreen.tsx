import React, { useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../store/PlayerContext';
import { useLibrary } from '../store/LibraryContext';
import { Song } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;

const formatTime = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function PlayerScreen({ onClose, onOpenQueue, navigation }: { onClose: () => void; onOpenQueue: () => void; navigation?: any }) {
  const { currentSong, isPlaying, pause, resume, skipNext, skipPrevious, position, duration, seek, shuffle, repeat, toggleShuffle, toggleRepeat } = usePlayer();
  const { isLiked, addLikedSong, removeLikedSong } = useLibrary();

  if (!currentSong) return null;

  return (
    <View style={styles.fullScreen}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="chevron-down" size={32} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Now Playing</Text>
        <TouchableOpacity onPress={onOpenQueue}>
          <Ionicons name="list" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.artworkContainer}>
        <Image source={{ uri: currentSong.thumbnailUrl }} style={styles.artwork} />
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={2}>{currentSong.title}</Text>
        <View style={styles.artistsContainer}>
          {currentSong.artists.map((artist, index) => (
            <React.Fragment key={artist.id || index}>
              <TouchableOpacity 
                onPress={() => {
                  if (artist.id && navigation) {
                    onClose();
                    navigation.navigate('Artist', { artistId: artist.id });
                  }
                }}
              >
                <Text style={styles.artist}>{artist.name}</Text>
              </TouchableOpacity>
              {index < currentSong.artists.length - 1 && (
                <Text style={styles.artist}>, </Text>
              )}
            </React.Fragment>
          ))}
        </View>
      </View>

      <View style={styles.progressContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration}
          value={position}
          onSlidingComplete={seek}
          minimumTrackTintColor="#1db954"
          maximumTrackTintColor="#333"
          thumbTintColor="#fff"
        />
        <View style={styles.timeContainer}>
          <Text style={styles.time}>{formatTime(position)}</Text>
          <Text style={styles.time}>{formatTime(duration)}</Text>
        </View>
      </View>

      <View style={styles.secondaryControls}>
        <TouchableOpacity onPress={toggleShuffle}>
          <Ionicons name="shuffle" size={24} color={shuffle ? '#1db954' : '#666'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => currentSong && (isLiked(currentSong.id) ? removeLikedSong(currentSong.id) : addLikedSong(currentSong))}>
          <Ionicons name={currentSong && isLiked(currentSong.id) ? 'heart' : 'heart-outline'} size={28} color={currentSong && isLiked(currentSong.id) ? '#1db954' : '#fff'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleRepeat}>
          <Ionicons name={repeat === 'one' ? 'repeat-outline' : 'repeat'} size={24} color={repeat !== 'off' ? '#1db954' : '#666'} />
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity onPress={skipPrevious} style={styles.controlButton}>
          <Ionicons name="play-skip-back" size={36} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={isPlaying ? pause : resume} style={styles.playButton}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={48} color="#000" />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={skipNext} style={styles.controlButton}>
          <Ionicons name="play-skip-forward" size={36} color="#fff" />
        </TouchableOpacity>
      </View>
      </SafeAreaView>
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
    paddingTop: 10,
    paddingBottom: 10,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  artistsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  artist: {
    fontSize: 18,
    color: '#aaa',
  },
  progressContainer: {
    paddingHorizontal: 32,
    paddingBottom: 12,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    fontSize: 12,
    color: '#aaa',
  },
  secondaryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 64,
    paddingBottom: 24,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 50,
  },
  controlButton: {
    padding: 16,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 32,
  },
});
