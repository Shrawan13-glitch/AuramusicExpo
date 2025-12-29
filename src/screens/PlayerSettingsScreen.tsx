import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PlayerSettingsScreen({ navigation }: any) {
  const [backgroundStyle, setBackgroundStyle] = useState('blur');
  const [skipDuration, setSkipDuration] = useState(10);

  useEffect(() => {
    loadBackgroundStyle();
    loadSkipDuration();
  }, []);

  const loadSkipDuration = async () => {
    try {
      const duration = await AsyncStorage.getItem('skipDuration');
      if (duration) setSkipDuration(parseInt(duration));
    } catch (error) {
      // Error loading skip duration handled silently
    }
  };

  const loadBackgroundStyle = async () => {
    try {
      const style = await AsyncStorage.getItem('playerBackgroundStyle');
      if (style) setBackgroundStyle(style);
    } catch (error) {
      // Error loading background style handled silently
    }
  };

  const saveSkipDuration = async (duration: number) => {
    try {
      await AsyncStorage.setItem('skipDuration', duration.toString());
      setSkipDuration(duration);
    } catch (error) {
      // Error saving skip duration handled silently
    }
  };

  const saveBackgroundStyle = async (style: string) => {
    try {
      await AsyncStorage.setItem('playerBackgroundStyle', style);
      setBackgroundStyle(style);
    } catch (error) {
      // Error saving background style handled silently
    }
  };

  const skipDurationOptions = [5, 10, 15, 30];

  const backgroundOptions = [
    { key: 'blur', label: 'Gradient', description: 'Blurred album art with gradient overlay', icon: 'color-palette' },
    { key: 'image', label: 'Blur', description: 'Album artwork background', icon: 'image' }
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Player Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Background Style</Text>
          <Text style={styles.sectionDescription}>Choose how the player background appears</Text>
          
          <View style={styles.optionsContainer}>
            {backgroundOptions.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[styles.optionCard, backgroundStyle === option.key && styles.optionCardActive]}
                onPress={() => saveBackgroundStyle(option.key)}
                activeOpacity={0.7}
              >
                <View style={styles.optionHeader}>
                  <View style={[styles.optionIcon, backgroundStyle === option.key && styles.optionIconActive]}>
                    <Ionicons 
                      name={option.icon as any} 
                      size={24} 
                      color={backgroundStyle === option.key ? '#1db954' : '#666'} 
                    />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionTitle, backgroundStyle === option.key && styles.optionTitleActive]}>
                      {option.label}
                    </Text>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  </View>
                  {backgroundStyle === option.key && (
                    <Ionicons name="checkmark-circle" size={24} color="#1db954" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skip Duration</Text>
          <Text style={styles.sectionDescription}>Choose how many seconds to skip forward/backward</Text>
          
          <View style={styles.optionsContainer}>
            {skipDurationOptions.map((duration) => (
              <TouchableOpacity
                key={duration}
                style={[styles.optionCard, skipDuration === duration && styles.optionCardActive]}
                onPress={() => saveSkipDuration(duration)}
                activeOpacity={0.7}
              >
                <View style={styles.optionHeader}>
                  <View style={[styles.optionIcon, skipDuration === duration && styles.optionIconActive]}>
                    <Ionicons 
                      name="time" 
                      size={24} 
                      color={skipDuration === duration ? '#1db954' : '#666'} 
                    />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionTitle, skipDuration === duration && styles.optionTitleActive]}>
                      {duration} seconds
                    </Text>
                  </View>
                  {skipDuration === duration && (
                    <Ionicons name="checkmark-circle" size={24} color="#1db954" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#fff', flex: 1, textAlign: 'center' },
  scrollContent: { paddingBottom: 100 },
  section: { paddingHorizontal: 20, paddingTop: 8 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  sectionDescription: { fontSize: 16, color: '#aaa', marginBottom: 24, lineHeight: 22 },
  optionsContainer: { gap: 12 },
  optionCard: { 
    backgroundColor: '#121212', 
    borderRadius: 16, 
    borderWidth: 2, 
    borderColor: '#282828',
    overflow: 'hidden'
  },
  optionCardActive: { borderColor: '#1db954' },
  optionHeader: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  optionIcon: { 
    width: 48, 
    height: 48, 
    borderRadius: 12, 
    backgroundColor: '#1a1a1a', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginRight: 16
  },
  optionIconActive: { backgroundColor: '#1db954' + '20' },
  optionContent: { flex: 1 },
  optionTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
  optionTitleActive: { color: '#fff' },
  optionDescription: { fontSize: 14, color: '#aaa', lineHeight: 20 },
});