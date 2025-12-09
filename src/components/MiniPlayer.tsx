import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { usePlayer } from '../store/PlayerContext';
import PlayerScreen from '../screens/PlayerScreen';
import QueueScreen from '../screens/QueueScreen';

export default function MiniPlayer() {
  const navigation = useNavigation();
  const { currentSong, isPlaying, pause, resume, position, duration, skipNext, skipPrevious } = usePlayer();
  const [showPlayer, setShowPlayer] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  if (!currentSong) return null;

  const progress = duration > 0 ? position / duration : 0;

  return (
    <>
      <View style={styles.wrapper}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <TouchableOpacity style={styles.container} onPress={() => setShowPlayer(true)} activeOpacity={0.95}>
          {currentSong.thumbnailUrl && (
            <Image source={{ uri: currentSong.thumbnailUrl }} style={styles.thumbnail} />
          )}
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>{currentSong.title}</Text>
            <Text style={styles.artist} numberOfLines={1}>
              {currentSong.artists?.map(a => a.name).join(', ') || 'Unknown Artist'}
            </Text>
          </View>
          <View style={styles.controls}>
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); skipPrevious(); }} style={styles.controlButton}>
              <Ionicons name="play-skip-back" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); isPlaying ? pause() : resume(); }} style={styles.playButton}>
              <Ionicons name={isPlaying ? "pause" : "play"} size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); skipNext(); }} style={styles.controlButton}>
              <Ionicons name="play-skip-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>

      <Modal visible={showPlayer} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowPlayer(false)}>
        <PlayerScreen 
          onClose={() => setShowPlayer(false)} 
          onOpenQueue={() => { setShowPlayer(false); setShowQueue(true); }}
          navigation={navigation}
        />
      </Modal>

      <Modal visible={showQueue} animationType="slide" onRequestClose={() => setShowQueue(false)}>
        <QueueScreen onClose={() => setShowQueue(false)} />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#121212',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#282828',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#1db954',
  },
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  thumbnail: { 
    width: 48, 
    height: 48, 
    borderRadius: 4,
    backgroundColor: '#282828',
  },
  info: { 
    flex: 1, 
    marginLeft: 12,
    marginRight: 8,
  },
  title: { 
    fontSize: 14, 
    color: '#fff', 
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  artist: { 
    fontSize: 12, 
    color: '#b3b3b3', 
    marginTop: 3,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    padding: 8,
  },
  playButton: {
    padding: 8,
    marginHorizontal: 4,
  },
});
