import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Modal, PanResponder, ImageBackground, StatusBar, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlayer } from '../store/PlayerContext';
import { useLibrary } from '../store/LibraryContext';
import { useDownload } from '../store/DownloadContext';
import { useAnimation } from '../store/AnimationContext';
import DownloadButton from '../components/DownloadButton';
import SongOptionsModal from '../components/SongOptionsModal';
import { useSongOptions } from '../hooks/useSongOptions';
import LyricsScreen from './LyricsScreen';
import SleepTimerModal from '../components/SleepTimerModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const formatTime = (ms: number) => {
  if (!ms || ms < 0 || !isFinite(ms) || isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 0 || !isFinite(totalSeconds)) return '0:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Memoized components for better performance
const MemoizedArtwork = memo(({ uri }: { uri?: string }) => (
  <Image 
    source={uri ? { uri } : require('../../assets/icon.png')} 
    style={styles.artwork} 
    onError={() => {}}
    fadeDuration={0}
    resizeMode="cover"
  />
));

const MemoizedBackground = memo(({ imageUri, blurRadius, overlayStyle }: any) => (
  <ImageBackground 
    source={imageUri ? { uri: imageUri } : require('../../assets/icon.png')} 
    style={StyleSheet.absoluteFillObject} 
    blurRadius={blurRadius}
    fadeDuration={0}
    resizeMode="cover"
  >
    <View style={[StyleSheet.absoluteFillObject, overlayStyle]} />
  </ImageBackground>
));

export default function PlayerScreen({ onClose, onOpenQueue, navigation }: any) {
  const { currentSong, isPlaying, pause, resume, skipNext, skipPrevious, position, duration, seek, shuffle, repeat, toggleShuffle, toggleRepeat, setSleepTimer, cancelSleepTimer, sleepTimerRemaining } = usePlayer();
  const { isLiked, addLikedSong, removeLikedSong } = useLibrary();
  const { isDownloaded } = useDownload();
  const { settings } = useAnimation();
  const { modalVisible, selectedSong, showOptions, hideOptions } = useSongOptions();
  const [showLyrics, setShowLyrics] = useState(false);
  const [backgroundStyle, setBackgroundStyle] = useState('blur');
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [skipDuration, setSkipDuration] = useState(10);
  const [sliderValue, setSliderValue] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [skipEnabled, setSkipEnabled] = useState(true);
  const [isLikedOptimistic, setIsLikedOptimistic] = useState(false);

  useEffect(() => {
    loadBackgroundStyle();
    loadSkipDuration();
    loadSkipEnabled();
  }, []);

  // Handle StatusBar when screen is focused/unfocused
  useFocusEffect(
    React.useCallback(() => {
      // Set StatusBar for player screen
      StatusBar.setBarStyle('light-content', true);
      StatusBar.setBackgroundColor('transparent', true);
      StatusBar.setTranslucent(true);
      
      return () => {
        // Reset StatusBar when leaving player screen
        StatusBar.setBarStyle('light-content', true);
        StatusBar.setBackgroundColor('#000', true);
        StatusBar.setTranslucent(false);
      };
    }, [])
  );

  // Memoized values for better performance
  const liked = useMemo(() => isLiked(currentSong?.id), [isLiked, currentSong?.id]);
  const formattedPosition = useMemo(() => formatTime(isDragging ? sliderValue : (position || 0)), [isDragging, sliderValue, position]);
  const formattedDuration = useMemo(() => formatTime(duration || 0), [duration]);
  const maxSliderValue = useMemo(() => Math.max(duration || 1, 1), [duration]);
  const currentArtwork = useMemo(() => currentSong?.thumbnailUrl, [currentSong?.thumbnailUrl]);
  const currentTitle = useMemo(() => currentSong?.title, [currentSong?.title]);
  const currentArtists = useMemo(() => currentSong?.artists, [currentSong?.artists]);

  // Update optimistic like state when actual state changes
  useEffect(() => {
    setIsLikedOptimistic(liked);
  }, [liked]);

  useEffect(() => {
    if (!isDragging) {
      setSliderValue(position || 0);
    }
  }, [position, isDragging]);

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

  const loadSkipEnabled = async () => {
    try {
      const enabled = await AsyncStorage.getItem('skipEnabled');
      if (enabled !== null) setSkipEnabled(enabled === 'true');
    } catch (error) {
      // Error loading skip enabled handled silently
    }
  };

  // Memoized callbacks for better performance
  const skipBackward = useCallback(() => {
    const newPosition = Math.max(0, position - skipDuration * 1000);
    seek(newPosition);
  }, [position, skipDuration, seek]);

  const skipForward = useCallback(() => {
    const newPosition = Math.min(duration, position + skipDuration * 1000);
    seek(newPosition);
  }, [duration, position, skipDuration, seek]);

  const handlePlayPause = useCallback(() => {
    isPlaying ? pause() : resume();
  }, [isPlaying, pause, resume]);

  const handleLikeToggle = useCallback(() => {
    if (!currentSong) return;
    // Optimistic update for instant UI feedback
    setIsLikedOptimistic(!isLikedOptimistic);
    // Actual update
    isLikedOptimistic ? removeLikedSong(currentSong.id) : addLikedSong(currentSong);
  }, [currentSong, isLikedOptimistic, addLikedSong, removeLikedSong]);

  const handleSliderStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleSliderChange = useCallback((value: number) => {
    setSliderValue(value);
  }, []);

  const handleSliderComplete = useCallback((value: number) => {
    seek(value);
    setIsDragging(false);
  }, [seek]);

  const handleArtistPress = useCallback((artist: any) => {
    if (artist.id && navigation) {
      onClose();
      navigation.navigate('Artist', { artistId: artist.id });
    }
  }, [navigation, onClose]);

  if (!currentSong) return null;

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

  const renderBackground = useMemo(() => {
    switch (backgroundStyle) {
      case 'blur':
        return (
          <MemoizedBackground 
            imageUri={currentArtwork} 
            blurRadius={50} 
            overlayStyle={styles.darkOverlay}
          />
        );
      case 'image':
        return (
          <MemoizedBackground 
            imageUri={currentArtwork} 
            blurRadius={20} 
            overlayStyle={styles.mediumOverlay}
          />
        );
      default:
        return (
          <LinearGradient
            colors={['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57']}
            locations={[0, 0.25, 0.5, 0.75, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        );
    }
  }, [backgroundStyle, currentArtwork]);

  return (
    <View style={styles.fullScreen}>
      {renderBackground}
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={settings.modernPlayerUI ? styles.modernContainer : styles.container} {...panResponder.panHandlers}>
          {settings.modernPlayerUI ? (
            <View style={styles.modernLayout}>
              <View style={styles.modernHeader}>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="chevron-down" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Now Playing</Text>
                <TouchableOpacity onPress={() => setShowSleepTimer(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="moon" size={24} color={sleepTimerRemaining ? '#1db954' : '#fff'} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.cardContainer}>
                <View style={styles.artworkCard}>
                  <MemoizedArtwork uri={currentArtwork} />
                  <View style={styles.floatingControls}>
                    <TouchableOpacity onPress={toggleShuffle} style={styles.floatingButton}>
                      <Ionicons name="shuffle" size={16} color={shuffle ? '#1db954' : '#fff'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={toggleRepeat} style={styles.floatingButton}>
                      <Ionicons name={repeat === 'one' ? 'repeat-outline' : 'repeat'} size={16} color={repeat !== 'off' ? '#1db954' : '#fff'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleLikeToggle} style={styles.floatingButton}>
                      <Ionicons name={isLikedOptimistic ? 'heart' : 'heart-outline'} size={16} color={isLikedOptimistic ? '#ff4757' : '#fff'} />
                    </TouchableOpacity>
                    <View style={styles.floatingButton}>
                      <DownloadButton song={currentSong} size={16} modern={true} />
                    </View>
                  </View>
                </View>
                
                <View style={styles.infoCard}>
                  <Text style={styles.modernTitle} numberOfLines={2}>{currentTitle}</Text>
                  <View style={styles.artistsRow}>
                    {currentArtists?.map((artist, index) => (
                      <React.Fragment key={artist.id || index}>
                        <TouchableOpacity onPress={() => handleArtistPress(artist)}>
                          <Text style={styles.modernArtist}>{artist.name}</Text>
                        </TouchableOpacity>
                        {index < currentArtists.length - 1 && <Text style={styles.modernArtist}>, </Text>}
                      </React.Fragment>
                    )) || <Text style={styles.modernArtist}>Unknown Artist</Text>}
                  </View>
                </View>
              </View>
              
              <View style={styles.progressCard}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={maxSliderValue}
                  value={sliderValue}
                  onSlidingStart={handleSliderStart}
                  onValueChange={handleSliderChange}
                  onSlidingComplete={handleSliderComplete}
                  minimumTrackTintColor="#1db954"
                  maximumTrackTintColor="rgba(255,255,255,0.2)"
                  thumbTintColor="#fff"
                />
                <View style={styles.timeRow}>
                  <Text style={styles.time}>{formattedPosition}</Text>
                  <Text style={styles.time}>{formattedDuration}</Text>
                </View>
              </View>
              
              <View style={styles.controlsCard}>
                <View style={styles.mainControlsRow}>
                  <TouchableOpacity onPress={skipPrevious} style={styles.navButton}>
                    <Ionicons name="play-skip-back" size={24} color="#fff" />
                  </TouchableOpacity>
                  
                  {skipEnabled && (
                    <TouchableOpacity onPress={skipBackward} style={styles.skipButton}>
                      <Ionicons name="play-back" size={20} color="#fff" />
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity onPress={handlePlayPause} style={styles.playButtonCard}>
                    <Ionicons name={isPlaying ? "pause" : "play"} size={32} color="#000" />
                  </TouchableOpacity>
                  
                  {skipEnabled && (
                    <TouchableOpacity onPress={skipForward} style={styles.skipButton}>
                      <Ionicons name="play-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity onPress={skipNext} style={styles.navButton}>
                    <Ionicons name="play-skip-forward" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.bottomActionsRow}>
                  <TouchableOpacity onPress={() => setShowLyrics(true)} style={styles.horizontalActionButton}>
                    <Ionicons name="document-text-outline" size={16} color="#fff" />
                    <Text style={styles.horizontalActionText}>Lyrics</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onOpenQueue} style={styles.horizontalActionButton}>
                    <Ionicons name="list" size={16} color="#fff" />
                    <Text style={styles.horizontalActionText}>Queue</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => showOptions(currentSong)} style={styles.horizontalActionButton}>
                    <Ionicons name="ellipsis-horizontal" size={16} color="#fff" />
                    <Text style={styles.horizontalActionText}>More</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <>
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
                  <MemoizedArtwork uri={currentArtwork} />
                </View>
              </View>

              <View style={styles.infoContainer}>
                <Text style={styles.title} numberOfLines={2}>{currentTitle}</Text>
                <View style={styles.artistsRow}>
                  {currentArtists?.map((artist, index) => (
                    <React.Fragment key={artist.id || index}>
                      <TouchableOpacity 
                        onPress={() => handleArtistPress(artist)}
                        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                      >
                        <Text style={styles.artist}>{artist.name}</Text>
                      </TouchableOpacity>
                      {index < currentArtists.length - 1 && <Text style={styles.artist}>, </Text>}
                    </React.Fragment>
                  )) || <Text style={styles.artist}>Unknown Artist</Text>}
                </View>
              </View>

              <View style={styles.progressContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={maxSliderValue}
                  value={sliderValue}
                  onSlidingStart={handleSliderStart}
                  onValueChange={handleSliderChange}
                  onSlidingComplete={handleSliderComplete}
                  minimumTrackTintColor="#1db954"
                  maximumTrackTintColor="#333"
                  thumbTintColor="#fff"
                />
                <View style={styles.timeRow}>
                  <Text style={styles.time}>{formattedPosition}</Text>
                  <Text style={styles.time}>{formattedDuration}</Text>
                </View>
              </View>

              <View style={styles.controlsContainer}>
                <View style={styles.secondaryControls}>
                  <TouchableOpacity onPress={toggleShuffle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="shuffle" size={22} color={shuffle ? '#1db954' : '#666'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleLikeToggle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={isLikedOptimistic ? 'heart' : 'heart-outline'} size={26} color={isLikedOptimistic ? '#1db954' : '#fff'} />
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
                  
                  {skipEnabled && (
                    <TouchableOpacity onPress={skipBackward} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="play-back" size={28} color="#fff" />
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
                    <Ionicons name={isPlaying ? "pause" : "play"} size={40} color="#000" />
                  </TouchableOpacity>
                  
                  {skipEnabled && (
                    <TouchableOpacity onPress={skipForward} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="play-forward" size={28} color="#fff" />
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity onPress={skipNext} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                    <Ionicons name="play-skip-forward" size={32} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.bottomControls}>
                  <TouchableOpacity onPress={() => setShowLyrics(true)} style={styles.lyricsButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="document-text-outline" size={20} color="#fff" />
                    <Text style={styles.lyricsText}>Lyrics</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => showOptions(currentSong)} style={styles.lyricsButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
                    <Text style={styles.lyricsText}>More</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onOpenQueue} style={styles.lyricsButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="list" size={20} color="#fff" />
                    <Text style={styles.lyricsText}>Queue</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
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
  darkOverlay: {
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  mediumOverlay: {
    backgroundColor: 'rgba(0,0,0,0.7)',
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
  lyricsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  lyricsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  // Modern UI Styles
  modernContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
  },
  modernHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingVertical: 16,
    marginBottom: 10,
  },
  modernLayout: {
    flex: 1,
    gap: 15,
  },
  cardContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 24,
    padding: 20,
    marginTop: 5,
  },
  artworkCard: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 20,
  },
  floatingControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'column',
    gap: 8,
  },
  floatingButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    alignItems: 'center',
  },
  progressCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 20,
  },
  controlsCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 20,
    gap: 20,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mainControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  navButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonCard: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#1db954',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1db954',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  horizontalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  skipButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontalActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  modernTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  modernArtist: {
    fontSize: 16,
    color: '#ddd',
    fontWeight: '400',
  },
  modernControlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});