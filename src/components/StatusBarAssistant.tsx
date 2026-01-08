import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, Animated, Dimensions, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../store/PlayerContext';
import { useLibrary } from '../store/LibraryContext';

const { height: screenHeight } = Dimensions.get('window');

export default function MiniPlayerAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [response, setResponse] = useState('');
  const lightAnimation = useRef(new Animated.Value(0)).current;
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayer();
  const { likedSongs, playlists } = useLibrary();

  const startAssistant = () => {
    console.log('Starting assistant...');
    setIsListening(true);
    setResponse('Assistant activated');
    
    // Light animation from bottom
    Animated.timing(lightAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();

    // Simulate voice commands for now
    setTimeout(() => {
      setResponse('Say: play, pause, or liked songs');
    }, 1000);

    setTimeout(() => {
      setIsListening(false);
      setResponse('');
      Animated.timing(lightAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }, 3000);
  };

  const lightHeight = lightAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, screenHeight * 0.3],
  });

  const lightOpacity = lightAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.8],
  });

  if (!currentTrack) return null;

  return (
    <>
      <TouchableOpacity
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 49,
          zIndex: 1001,
        }}
        onLongPress={startAssistant}
        delayLongPress={800}
        activeOpacity={1}
      />
      
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: lightHeight,
          backgroundColor: '#1DB954',
          opacity: lightOpacity,
          zIndex: 999,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        pointerEvents="none"
      >
        {isListening && (
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="mic" size={40} color="#fff" />
            <Text style={{ color: '#fff', marginTop: 10, fontSize: 16 }}>
              {response}
            </Text>
          </View>
        )}
      </Animated.View>
    </>
  );
}