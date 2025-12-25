import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Modal, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { usePlayer } from '../store/PlayerContext';
import PlayerScreen from '../screens/PlayerScreen';
import QueueScreen from '../screens/QueueScreen';

const MiniPlayer = React.memo(() => {
  const navigation = useNavigation();
  const { currentSong, isPlaying, pause, resume, position, duration, skipNext, skipPrevious } = usePlayer();
  const [showPlayer, setShowPlayer] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showQueue) {
        setShowQueue(false);
        setShowPlayer(true);
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [showQueue]);

  if (!currentSong) return null;

  const progress = duration > 0 ? position / duration : 0;

  const onGestureEvent = (event: any) => {
    if (event.nativeEvent.translationY < -50 && event.nativeEvent.state === State.END) {
      setShowPlayer(true);
    }
  };

  return (
    <>
      <View style={styles.wrapper}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <PanGestureHandler onHandlerStateChange={onGestureEvent}>
          <TouchableOpacity style={styles.container} onPress={() => setShowPlayer(true)} activeOpacity={0.95}>
          <Image 
            source={currentSong.thumbnailUrl ? { uri: currentSong.thumbnailUrl } : require('../../assets/icon.png')} 
            style={styles.thumbnail}
            resizeMode="cover"
            onError={() => {}}
          />
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
        </PanGestureHandler>
      </View>

      <Modal visible={showPlayer} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent={true} onRequestClose={() => setShowPlayer(false)}>
        <PlayerScreen 
          onClose={() => setShowPlayer(false)} 
          onOpenQueue={() => { setShowPlayer(false); setShowQueue(true); }}
          navigation={navigation}
        />
      </Modal>

      <Modal visible={showQueue} animationType="slide" statusBarTranslucent={true} onRequestClose={() => { setShowQueue(false); setShowPlayer(true); }}>
        <QueueScreen onClose={() => { setShowQueue(false); setShowPlayer(true); }} />
      </Modal>
    </>
  );
});

export default MiniPlayer;

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
