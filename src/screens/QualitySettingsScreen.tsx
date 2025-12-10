import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function QualitySettingsScreen({ navigation }: any) {
  const [selectedQuality, setSelectedQuality] = useState('low');

  useEffect(() => {
    loadQuality();
  }, []);

  const loadQuality = async () => {
    try {
      const quality = await AsyncStorage.getItem('downloadQuality');
      if (quality) setSelectedQuality(quality);
    } catch (error) {
      // Error loading quality handled silently
    }
  };

  const saveQuality = async (quality: string) => {
    try {
      await AsyncStorage.setItem('downloadQuality', quality);
      setSelectedQuality(quality);
    } catch (error) {
      // Error saving quality handled silently
    }
  };

  const qualityOptions = [
    { key: 'low', label: 'Low Quality', subtitle: '128 kbps • Fastest downloads', size: '~1-2 MB per song' },
    { key: 'medium', label: 'Medium Quality', subtitle: '192 kbps • Good quality', size: '~2-4 MB per song' },
    { key: 'high', label: 'High Quality', subtitle: '320 kbps • Best quality', size: '~4-6 MB per song' }
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Download Quality</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          Choose your preferred download quality. Higher quality means larger file sizes and longer download times.
        </Text>

        <View style={styles.optionsContainer}>
          {qualityOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[styles.optionCard, selectedQuality === option.key && styles.optionCardActive]}
              onPress={() => saveQuality(option.key)}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <View style={styles.optionHeader}>
                  <Text style={[styles.optionTitle, selectedQuality === option.key && styles.optionTitleActive]}>
                    {option.label}
                  </Text>
                  {selectedQuality === option.key && (
                    <Ionicons name="checkmark-circle" size={24} color="#1db954" />
                  )}
                </View>
                <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                <Text style={styles.optionSize}>{option.size}</Text>
              </View>
            </TouchableOpacity>
          ))}
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
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  description: { fontSize: 16, color: '#aaa', lineHeight: 22, marginBottom: 24 },
  optionsContainer: { gap: 12 },
  optionCard: { 
    backgroundColor: '#121212', 
    borderRadius: 16, 
    borderWidth: 2, 
    borderColor: '#282828',
    overflow: 'hidden'
  },
  optionCardActive: { borderColor: '#1db954' },
  optionContent: { padding: 20 },
  optionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  optionTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  optionTitleActive: { color: '#fff' },
  optionSubtitle: { fontSize: 14, color: '#aaa', marginBottom: 4 },
  optionSize: { fontSize: 12, color: '#666' },
});