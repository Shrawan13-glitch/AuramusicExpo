import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { usePlayer } from '../store/PlayerContext';
import { InnerTube } from '../api/innertube';

const { width, height } = Dimensions.get('window');

export default function AssistantScreen({ onClose, navigation }: { onClose: () => void; navigation?: any }) {
  const { playSong, pause, resume, skipNext, skipPrevious, isPlaying, toggleShuffle, currentSong } = usePlayer();
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [responseText, setResponseText] = useState('Hi! Tap the mic and tell me what to play.');
  const [showInput, setShowInput] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startWaveAnimation();
  }, []);

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
    setResponseText('Speech failed. Use text input.');
    setShowInput(true);
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
        setShowInput(true);
        setResponseText('Microphone permission required. Use text input.');
        return;
      }
      
      setTranscribedText('');
      setResponseText('Listening...');
      
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
      });
    } catch (error) {
      setShowInput(true);
      setResponseText('Speech not available. Use text input.');
    }
  };

  const stopListening = () => {
    ExpoSpeechRecognitionModule.stop();
  };

  const processCommand = async (command: string) => {
    const lowerCommand = command.toLowerCase();
    
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
          await playSong(firstResult);
          setResponseText(`Playing "${firstResult.title}" by ${firstResult.artists?.map(a => a.name).join(', ') || 'Unknown Artist'}`);
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
      skipNext();
      setResponseText('Skipped to next song');
    } else if (lowerCommand.includes('previous') || lowerCommand.includes('back')) {
      skipPrevious();
      setResponseText('Playing previous song');
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Assistant</Text>
        <View style={{ width: 28 }} />
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

        {/* Text Input Fallback */}
        {showInput && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Type your command here..."
              placeholderTextColor="#666"
              value={transcribedText}
              onChangeText={setTranscribedText}
              onSubmitEditing={() => {
                processCommand(transcribedText);
                setShowInput(false);
              }}
              autoFocus
            />
          </View>
        )}

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
  fallbackButton: {
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  fallbackText: {
    color: '#aaa',
    fontSize: 14,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
});