import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const LOADING_MESSAGES = [
  'Speaking to AuraGods...',
  'Starting the AuraCalculators...',
  'Measuring your vibe...',
  'Consulting the music spirits...',
  'Analyzing your sonic signature...',
  'Channeling cosmic frequencies...',
  'Decoding your musical DNA...',
  'Summoning the beat masters...',
  'Calculating aura intensity...',
  'Reading your music soul...',
];

export const AuraLoadingScreen: React.FC<{ message?: string }> = ({ message }) => {
  const [displayMessage, setDisplayMessage] = useState(message || LOADING_MESSAGES[0]);
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();

    if (!message) {
      const interval = setInterval(() => {
        setDisplayMessage(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a0033', '#000000', '#001a33']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.orb} />
        <Text style={styles.message}>{displayMessage}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  content: { alignItems: 'center' },
  orb: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#8b5cf6', opacity: 0.6, marginBottom: 32 },
  message: { fontSize: 18, color: '#fff', fontWeight: '600', textAlign: 'center', paddingHorizontal: 32 },
});
