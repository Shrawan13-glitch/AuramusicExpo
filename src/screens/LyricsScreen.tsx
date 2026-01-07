import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, TextInput, Alert, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';
import { lyricsCache } from '../utils/lyricsCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { height: screenHeight } = Dimensions.get('window');

export default function LyricsScreen({ onClose }: any) {
  const { currentSong, position, duration, isPlaying, pause, resume, skipNext, skipPrevious, seek } = usePlayer();
  const [lyrics, setLyrics] = useState<{ lines: Array<{ text: string; startTime?: number }> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showResyncButton, setShowResyncButton] = useState(false);
  const [showAddLyrics, setShowAddLyrics] = useState(false);
  const [customLyrics, setCustomLyrics] = useState('');
  const [backgroundStyle, setBackgroundStyle] = useState('blur');
  const scrollViewRef = useRef<ScrollView>(null);
  const [lyricsViewHeight, setLyricsViewHeight] = useState(0);

  // Memoize timed lyrics for performance
  const timedLines = useMemo(() => {
    if (!lyrics?.lines) return [];
    return lyrics.lines.filter(line => line.startTime !== undefined);
  }, [lyrics]);

  const hasTimedLyrics = timedLines.length > 0;

  useEffect(() => {
    if (currentSong) {
      checkCacheAndLoad();
      loadBackgroundStyle();
    }
  }, [currentSong?.id]);

  const loadBackgroundStyle = async () => {
    try {
      const style = await AsyncStorage.getItem('playerBackgroundStyle');
      if (style) setBackgroundStyle(style);
    } catch (error) {
      // Error loading background style handled silently
    }
  };

  const checkCacheAndLoad = async () => {
    if (!currentSong) return;
    
    try {
      const cached = await lyricsCache.get(currentSong.id);
      if (cached !== undefined) {
        setLyrics(cached);
        setLoading(false);
        setCurrentLineIndex(-1);
        return;
      }
    } catch (error) {
      console.log('Cache check error:', error);
    }
    
    loadLyrics();
  };

  // Efficient lyrics sync with position
  useEffect(() => {
    if (!hasTimedLyrics || position === undefined) return;

    const positionMs = position;
    const lastLineTime = timedLines[timedLines.length - 1]?.startTime || 0;
    
    if (positionMs > lastLineTime + 10000) {
      if (currentLineIndex !== -1) {
        setCurrentLineIndex(-1);
        if (autoScroll) {
          scrollToLine(timedLines.length - 1); // Scroll to end
        }
      }
      return;
    }

    let newIndex = -1;
    for (let i = 0; i < timedLines.length; i++) {
      if (timedLines[i].startTime! <= positionMs) {
        newIndex = i;
      } else {
        break;
      }
    }

    if (newIndex !== currentLineIndex) {
      setCurrentLineIndex(newIndex);
      
      // Auto-scroll only if enabled
      if (autoScroll) {
        if (newIndex >= 0) {
          scrollToLine(newIndex);
        } else {
          scrollToLine(0); // Scroll to top when lyrics haven't started
        }
      }
    }
  }, [position, timedLines, currentLineIndex, hasTimedLyrics, autoScroll]);

  // Initial center scroll when lyrics load
  useEffect(() => {
    if (lyrics && !loading && lyricsViewHeight > 0) {
      syncToCurrentPosition();
    }
  }, [lyrics, loading, lyricsViewHeight]);

  const scrollToLine = (lineIndex: number) => {
    if (lyricsViewHeight === 0) return;
    const lineHeight = 64;
    const scrollY = lineIndex * lineHeight;
    scrollViewRef.current?.scrollTo({
      y: scrollY,
      animated: true,
    });
  };

  const handleManualScroll = () => {
    if (autoScroll) {
      setAutoScroll(false);
      setShowResyncButton(true);
    }
  };

  const handleResync = () => {
    setAutoScroll(true);
    setShowResyncButton(false);
    syncToCurrentPosition();
  };

  const syncToCurrentPosition = () => {
    if (currentLineIndex >= 0) {
      scrollToLine(currentLineIndex);
    } else if (hasTimedLyrics) {
      const positionMs = position;
      const lastLineTime = timedLines[timedLines.length - 1]?.startTime || 0;
      if (positionMs > lastLineTime + 10000) {
        scrollToLine(timedLines.length - 1); // Scroll to end
      } else {
        scrollToLine(0); // Scroll to top
      }
    } else {
      scrollToLine(0);
    }
  };

  const handleLinePress = (lineIndex: number) => {
    if (hasTimedLyrics && timedLines[lineIndex]?.startTime !== undefined) {
      seek(timedLines[lineIndex].startTime!);
    }
  };

  const handleAddCustomLyrics = async () => {
    if (!currentSong || !customLyrics.trim()) return;
    
    const lines = customLyrics.split('\n').map(line => {
      const trimmed = line.trim();
      // Check for LRC format: [mm:ss.xx] or [mm:ss]
      const lrcMatch = trimmed.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{2}))?\](.*)$/);
      if (lrcMatch) {
        const minutes = parseInt(lrcMatch[1]);
        const seconds = parseInt(lrcMatch[2]);
        const centiseconds = parseInt(lrcMatch[3] || '0');
        const startTime = (minutes * 60 + seconds) * 1000 + centiseconds * 10;
        return { text: lrcMatch[4].trim(), startTime };
      }
      // Plain text line
      return { text: trimmed };
    }).filter(line => line.text); // Remove empty lines
    
    const lyricsData = { lines };
    
    try {
      await lyricsCache.set(
        currentSong.id, 
        currentSong.title, 
        currentSong.artists?.map(a => a.name).join(', ') || 'Unknown Artist', 
        lyricsData
      );
      setLyrics(lyricsData);
      setShowAddLyrics(false);
      setCustomLyrics('');
      setLoading(false);
      Alert.alert('Success', 'Custom lyrics saved!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save lyrics');
    }
  };

  const loadLyrics = async () => {
    if (!currentSong) return;
    setLoading(true);
    setCurrentLineIndex(-1);
    
    // Auto retry up to 3 times
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`🎵 Loading lyrics for: ${currentSong.title} (attempt ${attempt + 1})`);
        const result = await InnerTube.getLyrics(currentSong.id);
        
        if (result) {
          console.log('📝 Lyrics result: Found');
          await lyricsCache.set(currentSong.id, currentSong.title, 
            currentSong.artists?.map(a => a.name).join(', ') || 'Unknown Artist', result);
          setLyrics(result);
          setLoading(false);
          return; // Success, exit retry loop
        } else {
          console.log(`📝 Lyrics result: Not found (attempt ${attempt + 1})`);
          if (attempt === 2) {
            // Final attempt failed - cache null result
            await lyricsCache.set(currentSong.id, currentSong.title, 
              currentSong.artists?.map(a => a.name).join(', ') || 'Unknown Artist', null);
            setLyrics(null);
            setLoading(false);
          } else {
            // Wait 1 second before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (error) {
        console.log(`💥 Lyrics error (attempt ${attempt + 1}):`, error);
        if (attempt === 2) {
          // Final attempt failed
          setLyrics(null);
          setLoading(false);
        } else {
          // Wait 1 second before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

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

  if (!currentSong) return null;

  return (
    <View style={styles.fullScreen}>
      {renderBackground()}
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lyrics</Text>
        <TouchableOpacity onPress={() => setShowAddLyrics(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>{currentSong.title}</Text>
        <Text style={styles.songArtist} numberOfLines={1}>
          {currentSong.artists?.map(a => a.name).join(', ') || 'Unknown Artist'}
        </Text>
        {showResyncButton && (
          <TouchableOpacity style={styles.resyncButton} onPress={handleResync}>
            <Ionicons name="sync" size={16} color="#1db954" />
            <Text style={styles.resyncText}>Resync</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1db954" />
        </View>
      ) : !lyrics ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="musical-notes-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>No lyrics available</Text>
          <Text style={styles.emptySubtext}>Lyrics not found for this song</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadLyrics}>
            <Ionicons name="refresh-outline" size={20} color="#1db954" />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          ref={scrollViewRef}
          style={styles.lyricsContainer}
          contentContainerStyle={styles.lyricsContent}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={handleManualScroll}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            setLyricsViewHeight(height);
          }}
        >
          <View style={{ height: lyricsViewHeight / 2 }} />
          {(hasTimedLyrics ? timedLines : lyrics.lines).map((line, index) => {
            const isActive = hasTimedLyrics && index === currentLineIndex;
            const isPast = hasTimedLyrics && index < currentLineIndex;
            
            return (
              <View key={index} style={{ height: 64, justifyContent: 'center' }}>
                <TouchableOpacity 
                  onPress={() => handleLinePress(index)}
                  disabled={!hasTimedLyrics}
                >
                  <Text 
                    style={[
                      styles.lyricLine,
                      isActive && styles.activeLine,
                      isPast && styles.pastLine,
                      hasTimedLyrics && styles.clickableLine,
                    ]}
                  >
                    {line.text || ' '}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
          <View style={{ height: lyricsViewHeight / 2 }} />
        </ScrollView>
      )}
      
      <View style={styles.controls}>
        <View style={styles.progressContainer}>
          <Text style={styles.timeText}>{formatTime(position)}</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration}
            value={position}
            onSlidingComplete={seek}
            minimumTrackTintColor="#1db954"
            maximumTrackTintColor="#333"
            thumbStyle={styles.thumb}
          />
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
        
        <View style={styles.playbackControls}>
          <TouchableOpacity onPress={skipPrevious} style={styles.controlButton}>
            <Ionicons name="play-skip-back" size={32} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={isPlaying ? pause : resume} 
            style={[styles.controlButton, styles.playButton]}
          >
            <Ionicons 
              name={isPlaying ? "pause" : "play"} 
              size={36} 
              color="#000" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={skipNext} style={styles.controlButton}>
            <Ionicons name="play-skip-forward" size={32} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      
      {showAddLyrics && (
        <View style={styles.addLyricsModal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Custom Lyrics</Text>
            <TextInput
              style={styles.lyricsInput}
              multiline
              placeholder="Enter lyrics (one line per line)...\n\nFor timed lyrics use LRC format:\n[0:15]First line\n[0:30]Second line"
              placeholderTextColor="#666"
              value={customLyrics}
              onChangeText={setCustomLyrics}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => { setShowAddLyrics(false); setCustomLyrics(''); }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={handleAddCustomLyrics}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
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
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  songInfo: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  songTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#aaa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.3)',
    marginTop: 16,
    gap: 6,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1db954',
  },
  lyricsContainer: {
    flex: 1,
  },
  lyricsContent: {
    paddingHorizontal: 24,
  },
  lyricLine: {
    fontSize: 20,
    color: '#666',
    lineHeight: 32,
    textAlign: 'center',
    transition: 'color 0.3s ease',
  },
  lineContainer: {
    paddingVertical: 4,
  },
  activeLine: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 22,
    textShadowColor: 'rgba(29, 185, 84, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  pastLine: {
    color: '#888',
  },
  clickableLine: {
    opacity: 0.8,
  },
  resyncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.3)',
    marginTop: 8,
    gap: 4,
  },
  resyncText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1db954',
  },
  controls: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'transparent',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    width: 40,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: 8,
  },
  thumb: {
    width: 12,
    height: 12,
    backgroundColor: '#1db954',
  },
  playbackControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
  },
  controlButton: {
    padding: 8,
  },
  playButton: {
    backgroundColor: '#1db954',
    borderRadius: 32,
    padding: 12,
  },
  addLyricsModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  lyricsInput: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    minHeight: 200,
    maxHeight: 300,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#333',
  },
  saveButton: {
    backgroundColor: '#1db954',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#000',
    fontWeight: '600',
  },
  gradientBackground: {
    backgroundColor: '#1a1a2e',
  },
  darkOverlay: {
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  mediumOverlay: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
});