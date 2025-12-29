import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Modal, PanResponder, ImageBackground, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayer } from '../store/PlayerContext';
import { useLibrary } from '../store/LibraryContext';
import { useDownload } from '../store/DownloadContext';
import DownloadButton from '../components/DownloadButton';
import SongOptionsModal from '../components/SongOptionsModal';
import { useSongOptions } from '../hooks/useSongOptions';
import LyricsScreen from './LyricsScreen';
import SleepTimerModal from '../components/SleepTimerModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const formatTime = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function PlayerScreen({ onClose, onOpenQueue, navigation }: any) {
  const { currentSong, isPlaying, pause, resume, skipNext, skipPrevious, position, duration, seek, shuffle, repeat, toggleShuffle, toggleRepeat, setSleepTimer, cancelSleepTimer, sleepTimerRemaining } = usePlayer();
  const { isLiked, addLikedSong, removeLikedSong } = useLibrary();
  const { isDownloaded } = useDownload();
  const { modalVisible, selectedSong, showOptions, hideOptions } = useSongOptions();
  const [showLyrics, setShowLyrics] = useState(false);
  const [backgroundStyle, setBackgroundStyle] = useState('blur');
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [skipDuration, setSkipDuration] = useState(10);

  useEffect(() => {
    loadBackgroundStyle();
    loadSkipDuration();
  }, []);

  const loadBackgroundStyle = async () => {
    try {
      const style = await AsyncStorage.getItem('playerBackgroundStyle');
      if (style) setBackgroundStyle(style);
    } catch (error) {
      // Error loading background style handled silently
    }
  };

  const loadSkipDuration = async () => {
    try {
      const duration = await AsyncStorage.getItem('skipDuration');
      if (duration) setSkipDuration(parseInt(duration));
    } catch (error) {
      // Error loading skip duration handled silently
    }
  };

  const skipBackward = () => {
    const newPosition = Math.max(0, position - skipDuration * 1000);
    seek(newPosition);
  };

  const skipForward = () => {
    const newPosition = Math.min(duration, position + skipDuration * 1000);
    seek(newPosition);
  };

  if (!currentSong) return null;

  const liked = isLiked(currentSong.id);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return gestureState.dy > 10;
    },
    onPanResponderGrant: () => {},
    onPanResponderMove: () => {},
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > 100) {
        onClose();
      }
    },
    onShouldBlockNativeResponder: () => false,
  });

  const renderBackground = () => {
    const backgroundProps = { style: StyleSheet.absoluteFillObject };
    switch (backgroundStyle) {
      case 'blur':
        return (
          <ImageBackground source={currentSong.thumbnailUrl ? { uri: currentSong.thumbnailUrl } : require('../../assets/icon.png')} {...backgroundProps} blurRadius={50}>
            <View style={[StyleSheet.absoluteFillObject, styles.darkOverlay]} />
          </ImageBackground>
        );
      case 'image':
        return (
          <ImageBackground source={currentSong.thumbnailUrl ? { uri: currentSong.thumbnailUrl } : require('../../assets/icon.png')} {...backgroundProps} blurRadius={20}>
            <View style={[StyleSheet.absoluteFillObject, styles.mediumOverlay]} />
          </ImageBackground>
        );
      default:
        return <View style={[StyleSheet.absoluteFillObject, styles.gradientBackground]} />;
    }
  };

  const getStatusBarStyle = () => {
    return 'light-content';
  };

  return (
    <View style={styles.fullScreen}>
      <StatusBar barStyle={getStatusBarStyle()} backgroundColor="transparent" translucent />
      {renderBackground()}
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container} {...panResponder.panHandlers}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-down" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Now Playing</Text>
            <TouchableOpacity onPress={() => setShowSleepTimer(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="moon" size={24} color={sleepTimerRemaining ? '#1db954' : '#fff'} />
            </TouchableOpacity>
          </View>

        <View style={styles.artworkContainer}>
          <View style={styles.artworkShadow}>
            <Image source={currentSong.thumbnailUrl ? { uri: currentSong.thumbnailUrl } : require('../../assets/icon.png')} style={styles.artwork} onError={() => {}} />
          </View>
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
            <DownloadButton song={currentSong} size={24} />
            <TouchableOpacity onPress={toggleRepeat} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name={repeat === 'one' ? 'repeat-outline' : 'repeat'} size={22} color={repeat !== 'off' ? '#1db954' : '#666'} />
            </TouchableOpacity>
          </View>

          <View style={styles.mainControls}>
            <TouchableOpacity onPress={skipPrevious} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
              <Ionicons name="play-skip-back" size={32} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={skipBackward} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="play-back" size={28} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={isPlaying ? pause : resume} style={styles.playButton}>
              <Ionicons name={isPlaying ? "pause" : "play"} size={40} color="#000" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={skipForward} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="play-forward" size={28} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={skipNext} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
              <Ionicons name="play-skip-forward" size={32} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomControls}>
            <TouchableOpacity onPress={() => setShowLyrics(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="document-text-outline" size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => showOptions(currentSong)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="ellipsis-horizontal" size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onOpenQueue} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="list" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </SafeAreaView>
        
      <Modal visible={showLyrics} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowLyrics(false)}>
        <LyricsScreen onClose={() => setShowLyrics(false)} />
      </Modal>

      <SongOptionsModal
        visible={modalVisible}
        onClose={hideOptions}
        song={selectedSong}
        showDeleteOption={false}
        navigation={navigation}
      />

      <SleepTimerModal
        visible={showSleepTimer}
        onClose={() => setShowSleepTimer(false)}
        onSetTimer={setSleepTimer}
        activeTimer={sleepTimerRemaining}
        onCancelTimer={cancelSleepTimer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fullScreenWithBars: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
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
  artworkShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  artwork: {
    width: SCREEN_WIDTH - 80,
    height: SCREEN_WIDTH - 80,
    borderRadius: 16,
  },
  infoContainer: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
    textAlign: 'center',
  },
  artistsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  artist: {
    fontSize: 16,
    color: '#ccc',
  },
  gradientBackground: {
    backgroundColor: '#1a1a2e',
  },
  darkOverlay: {
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  mediumOverlay: {
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    paddingBottom: 20,
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
    backgroundColor: '#1db954',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1db954',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 80,
    paddingTop: 24,
    paddingBottom: 20,
  },
});
