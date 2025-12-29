import React from 'react';
import { View, ImageBackground, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../store/ThemeContext';

interface ThemedBackgroundProps {
  children: React.ReactNode;
  style?: any;
}

export default function ThemedBackground({ children, style }: ThemedBackgroundProps) {
  const { theme } = useTheme();

  console.log('Theme state:', theme); // Debug log

  if (!theme.enableBackground || !theme.backgroundImage) {
    return <View style={[styles.container, style]}>{children}</View>;
  }

  return (
    <View style={[styles.container, style]}>
      <ImageBackground 
        source={{ uri: theme.backgroundImage }} 
        style={StyleSheet.absoluteFill} 
        resizeMode="cover"
      >
        <BlurView intensity={theme.blurIntensity} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${theme.overlayOpacity})` }]} />
      </ImageBackground>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});