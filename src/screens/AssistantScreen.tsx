import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Image, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayer } from '../store/PlayerContext';
import { InnerTube } from '../api/innertube';

const { width, height } = Dimensions.get('window');

export default function AssistantScreen({ onClose, navigation }: { onClose: () => void; navigation?: any }) {
  const { playSong, pause, resume, skipNext, skipPrevious, isPlaying, toggleShuffle, currentSong } = usePlayer();
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [responseText, setResponseText] = useState('Hi! Tap the mic and tell me what to play.');
  const [settings, setSettings] = useState({
    language: 'en-US',
    interimResults: true,
    continuous: false,
    autoPlay: true,
  });
  const [customCommands, setCustomCommands] = useState([]);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startWaveAnimation();
    loadSettings();
  }, []);

  useEffect(() => {
    // Reload settings when screen is focused
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadSettings();
    });
    return unsubscribe;
  }, [navigation]);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('voiceAssistantSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
      const savedCommands = await AsyncStorage.getItem('voiceCustomCommands');
      if (savedCommands) {
        const commands = JSON.parse(savedCommands);
        console.log('Loaded custom commands:', commands);
        setCustomCommands(commands);
      }
    } catch (error) {
      console.log('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: typeof settings) => {
    try {
      await AsyncStorage.setItem('voiceAssistantSettings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      // Error saving settings handled silently
    }
  };

  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
    startPulseAnimation();
  });
  
  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    stopPulseAnimation();
  });
  
  useSpeechRecognitionEvent('result', (event) => {
    if (event.results[0]?.transcript) {
      setTranscribedText(event.results[0].transcript);
      if (event.isFinal) {
        processCommand(event.results[0].transcript);
      }
    }
  });
  
  useSpeechRecognitionEvent('error', () => {
    setIsListening(false);
    setResponseText('Speech recognition failed. Please try again.');
    stopPulseAnimation();
  });

  const startWaveAnimation = () => {
    const createWave = (animValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
    };

    Animated.parallel([
      createWave(waveAnim1, 0),
      createWave(waveAnim2, 1000),
    ]).start();
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const startListening = async () => {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        setResponseText('Microphone permission required to use voice commands.');
        return;
      }
      
      setTranscribedText('');
      setResponseText('Listening...');
      
      ExpoSpeechRecognitionModule.start({
        lang: settings.language,
        interimResults: settings.interimResults,
        continuous: settings.continuous,
      });
    } catch (error) {
      setResponseText('Speech recognition not available on this device.');
    }
  };

  const stopListening = () => {
    ExpoSpeechRecognitionModule.stop();
  };

  const processCommand = async (command: string) => {
    const lowerCommand = command.toLowerCase();
    
    console.log('Processing command:', lowerCommand);
    
    // Reload custom commands to ensure we have the latest
    let currentCustomCommands = customCommands;
    try {
      const savedCommands = await AsyncStorage.getItem('voiceCustomCommands');
      if (savedCommands) {
        currentCustomCommands = JSON.parse(savedCommands);
        console.log('Reloaded custom commands:', currentCustomCommands);
      }
    } catch (error) {
      console.log('Error reloading custom commands:', error);
    }
    
    console.log('Available custom commands:', currentCustomCommands);
    
    // Check custom commands first
    const customCommand = currentCustomCommands.find(cmd => 
      cmd.keyword && lowerCommand.includes(cmd.keyword.toLowerCase())
    );
    
    console.log('Found custom command:', customCommand);
    
    if (customCommand) {
      setResponseText(`Playing ${customCommand.targetName}...`);
      try {
        if (customCommand.type === 'song') {
          const searchResult = await InnerTube.search(customCommand.targetName);
          if (searchResult?.items?.length > 0) {
            const song = searchResult.items.find(item => item.id === customCommand.targetId) || searchResult.items[0];
            if (settings.autoPlay) {
              await playSong(song);
            }
            setResponseText(`${settings.autoPlay ? 'Playing' : 'Found'} "${song.title}"`);
          }
        } else if (customCommand.type === 'playlist') {
          if (settings.autoPlay) {
            const playlistData = await InnerTube.getPlaylist(customCommand.targetId);
            if (playlistData?.songs?.length > 0) {
              await playSong(playlistData.songs[0], playlistData.songs);
              setResponseText(`Playing playlist "${customCommand.targetName}"`);
            } else {
              setResponseText('Playlist is empty or unavailable');
            }
          } else {
            setResponseText(`Found playlist "${customCommand.targetName}"`);
          }
        } else if (customCommand.type === 'album') {
          if (settings.autoPlay) {
            const albumData = await InnerTube.getAlbum(customCommand.targetId);
            if (albumData?.songs?.length > 0) {
              await playSong(albumData.songs[0], albumData.songs);
              setResponseText(`Playing album "${customCommand.targetName}"`);
            } else {
              setResponseText('Album is empty or unavailable');
            }
          } else {
            setResponseText(`Found album "${customCommand.targetName}"`);
          }
        } else if (customCommand.type === 'artist') {
          if (settings.autoPlay) {
            navigation?.navigate('Artist', { artistId: customCommand.targetId });
            onClose();
          }
          setResponseText(`${settings.autoPlay ? 'Opening' : 'Found'} artist "${customCommand.targetName}"`);
        }
      } catch (error) {
        setResponseText(`Sorry, could not play ${customCommand.targetName}`);
      }
      return;
    }
    
    if (lowerCommand.includes('play ')) {
      const songQuery = command.substring(command.toLowerCase().indexOf('play ') + 5).trim();
      if (!songQuery) {
        setResponseText('Please specify a song to play');
        return;
      }
      
      setResponseText(`Searching for "${songQuery}"...`);
      
      try {
        const searchResult = await InnerTube.search(songQuery);
        
        if (searchResult && searchResult.items && searchResult.items.length > 0) {
          const firstResult = searchResult.items[0];
          if (settings.autoPlay) {
            await playSong(firstResult);
          }
          setResponseText(`${settings.autoPlay ? 'Playing' : 'Found'} "${firstResult.title}" by ${firstResult.artists?.map(a => a.name).join(', ') || 'Unknown Artist'}`);
        } else {
          setResponseText(`Sorry, I couldn't find "${songQuery}"`);
        }
      } catch (error) {
        console.error('Search error:', error);
        setResponseText('Sorry, there was an error searching for that song');
      }
    } else if (lowerCommand.includes('pause')) {
      pause();
      setResponseText('Music paused');
    } else if (lowerCommand.includes('resume') || lowerCommand.includes('continue')) {
      resume();
      setResponseText('Music resumed');
    } else if (lowerCommand.includes('next') || lowerCommand.includes('skip')) {
      try {
        await skipNext();
        setResponseText('Skipped to next song');
      } catch (error) {
        setResponseText('Could not skip to next song');
      }
    } else if (lowerCommand.includes('previous') || lowerCommand.includes('back')) {
      try {
        await skipPrevious();
        setResponseText('Playing previous song');
      } catch (error) {
        setResponseText('Could not skip to previous song');
      }
    } else if (lowerCommand.includes('shuffle')) {
      toggleShuffle();
      setResponseText('Shuffle toggled');
    } else {
      setResponseText('Sorry, I didn\'t understand that command');
    }
  };

  const handleMicPress = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const languageOptions = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'es-ES', name: 'Spanish' },
    { code: 'fr-FR', name: 'French' },
    { code: 'de-DE', name: 'German' },
    { code: 'it-IT', name: 'Italian' },
    { code: 'pt-BR', name: 'Portuguese' },
    { code: 'ja-JP', name: 'Japanese' },
    { code: 'ko-KR', name: 'Korean' },
    { code: 'zh-CN', name: 'Chinese' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerButton} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
          <Ionicons name="chevron-down" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Assistant</Text>
        <TouchableOpacity onPress={() => {
          navigation?.navigate('VoiceSettings');
        }} style={styles.headerButton} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
          <Ionicons name="settings" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
          {/* Animated Background Waves */}
          <Animated.View 
            style={[
              styles.wave,
              {
                opacity: waveAnim1,
                transform: [{ scale: waveAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2] }) }]
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.wave,
              styles.wave2,
              {
                opacity: waveAnim2,
                transform: [{ scale: waveAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.8] }) }]
              }
            ]} 
          />

          {/* Current Song Display */}
          {currentSong && (
            <TouchableOpacity 
              style={styles.currentSongContainer} 
              onPress={onClose}
            >
              <View style={styles.currentSongCard}>
                <Image 
                  source={{ uri: currentSong.thumbnailUrl || 'https://via.placeholder.com/60' }} 
                  style={styles.currentSongImage} 
                />
                <View style={styles.currentSongInfo}>
                  <Text style={styles.currentSongTitle} numberOfLines={1}>
                    {currentSong.title}
                  </Text>
                  <Text style={styles.currentSongArtist} numberOfLines={1}>
                    {currentSong.artists?.map(a => a.name).join(', ') || 'Unknown Artist'}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.playingIndicator} 
                  onPress={isPlaying ? pause : resume}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="#1db954" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}

          {/* Microphone Button */}
          <View style={styles.micContainer}>
            <Animated.View style={[styles.micButton, { transform: [{ scale: pulseAnim }] }]}>
              <TouchableOpacity onPress={handleMicPress} style={styles.micTouchable}>
                <Ionicons 
                  name={isListening ? "stop" : "mic"} 
                  size={60} 
                  color={isListening ? "#ff4444" : "#fff"} 
                />
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Text Display */}
          <View style={styles.textContainer}>
            {transcribedText ? (
              <View style={styles.transcriptionBox}>
                <Text style={styles.transcriptionLabel}>You said:</Text>
                <Text style={styles.transcriptionText}>{transcribedText}</Text>
              </View>
            ) : null}
            
            <Text style={styles.responseText}>{responseText}</Text>
          </View>

          {/* Instructions */}
          {!isListening && (
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsTitle}>Try saying:</Text>
              <Text style={styles.instruction}>• "Play [song name]"</Text>
              <Text style={styles.instruction}>• "Pause" or "Resume"</Text>
              <Text style={styles.instruction}>• "Next song" or "Previous"</Text>
              <Text style={styles.instruction}>• "Shuffle"</Text>
            </View>
          )}
        </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 1000,
    elevation: 1000,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  wave: {
    position: 'absolute',
    width: width * 2,
    height: width * 2,
    borderRadius: width,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(29, 185, 84, 0.2)',
  },
  wave2: {
    backgroundColor: 'rgba(29, 185, 84, 0.05)',
    borderColor: 'rgba(29, 185, 84, 0.1)',
  },
  micContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  micButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#1db954',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1db954',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  micTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 70,
  },
  textContainer: {
    alignItems: 'center',
    minHeight: 120,
    marginBottom: 40,
  },
  transcriptionBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    minWidth: width - 80,
  },
  transcriptionLabel: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 4,
  },
  transcriptionText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  responseText: {
    fontSize: 18,
    color: '#1db954',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 24,
  },
  instructionsContainer: {
    alignItems: 'center',
  },
  instructionsTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 12,
  },
  instruction: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 4,
  },
  currentSongContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  currentSongCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 12,
    minWidth: width - 80,
    maxWidth: width - 40,
  },
  currentSongImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  currentSongInfo: {
    flex: 1,
  },
  currentSongTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  currentSongArtist: {
    fontSize: 14,
    color: '#aaa',
  },
  playingIndicator: {
    marginLeft: 12,
  },
});