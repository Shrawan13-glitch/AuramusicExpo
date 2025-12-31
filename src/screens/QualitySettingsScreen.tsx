import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const QualityOption = React.memo(({ option, isSelected, onPress }: any) => (
  <TouchableOpacity
    style={[styles.optionCard, isSelected && styles.optionCardActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.optionContent}>
      <View style={styles.optionHeader}>
        <Text style={[styles.optionTitle, isSelected && styles.optionTitleActive]}>
          {option.label}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color="#1db954" />
        )}
      </View>
      <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
      <Text style={styles.optionSize}>{option.size}</Text>
    </View>
  </TouchableOpacity>
));

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

  const qualityOptions = useMemo(() => [
    { key: 'low', label: 'Low Quality', subtitle: '128 kbps • Fastest downloads', size: '~1-2 MB per song' },
    { key: 'medium', label: 'Medium Quality', subtitle: '192 kbps • Good quality', size: '~2-4 MB per song' },
    { key: 'high', label: 'High Quality', subtitle: '320 kbps • Best quality', size: '~4-6 MB per song' }
  ], []);

  const saveQuality = useCallback(async (quality: string) => {
    try {
      await AsyncStorage.setItem('downloadQuality', quality);
      setSelectedQuality(quality);
    } catch (error) {
      // Error saving quality handled silently
    }
  }, []);

  const renderItem = useCallback(({ item }: any) => (
    <QualityOption
      option={item}
      isSelected={selectedQuality === item.key}
      onPress={() => saveQuality(item.key)}
    />
  ), [selectedQuality, saveQuality]);

  const keyExtractor = useCallback((item: any) => item.key, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Download Quality</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          Choose your preferred download quality. Higher quality means larger file sizes and longer download times.
        </Text>

        <FlashList
          data={qualityOptions}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.optionsContainer}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#fff', flex: 1, textAlign: 'center' },
  content: { flex: 1, paddingHorizontal: 20 },
  description: { fontSize: 16, color: '#aaa', lineHeight: 22, marginBottom: 24 },
  optionsContainer: { gap: 12, paddingBottom: 100 },
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