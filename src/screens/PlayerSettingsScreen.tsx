import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAnimation } from '../store/AnimationContext';
import SettingsModal from '../components/SettingsModal';

export default function PlayerSettingsScreen({ navigation }: any) {
  const { settings } = useAnimation();
  const [backgroundStyle, setBackgroundStyle] = useState('blur');
  const [skipDuration, setSkipDuration] = useState(10);
  const [skipEnabled, setSkipEnabled] = useState(true);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (showContent) {
      loadBackgroundStyle();
      loadSkipDuration();
      loadSkipEnabled();
    }
  }, [showContent]);

  useEffect(() => {
    const loadInitialSettings = async () => {
      await Promise.all([
        loadBackgroundStyle(),
        loadSkipDuration(), 
        loadSkipEnabled()
      ]);
      const speedDelays = { fast: 250, normal: 350, slow: 550 };
      setTimeout(() => setShowContent(true), speedDelays[settings.speed]);
    };
    loadInitialSettings();
  }, [settings.speed]);

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

  const saveSkipEnabled = async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem('skipEnabled', enabled.toString());
      setSkipEnabled(enabled);
    } catch (error) {
      // Error saving skip enabled handled silently
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

  const skipDurationOptions = [
    { key: '5', label: '5 seconds' },
    { key: '10', label: '10 seconds' },
    { key: '15', label: '15 seconds' },
    { key: '30', label: '30 seconds' }
  ];
  
  const backgroundOptions = [
    { key: 'blur', label: 'Gradient', subtitle: 'Blurred album art with gradient' },
    { key: 'image', label: 'Blur', subtitle: 'Album artwork background' }
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {showContent && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>PLAYBACK</Text>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingTitle}>Skip Controls</Text>
                <Switch
                  value={skipEnabled}
                  onValueChange={saveSkipEnabled}
                  trackColor={{ false: '#333', true: '#1db954' }}
                  thumbColor="#fff"
                />
              </View>
              
              {skipEnabled && (
                <TouchableOpacity style={styles.settingItem} onPress={() => setShowSkipModal(true)}>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>Skip Duration</Text>
                    <Text style={styles.settingSubtitle}>{skipDuration} seconds</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionHeader}>APPEARANCE</Text>
              
              <TouchableOpacity style={styles.settingItem} onPress={() => setShowBackgroundModal(true)}>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Background Style</Text>
                  <Text style={styles.settingSubtitle}>{backgroundOptions.find(o => o.key === backgroundStyle)?.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
      
      <SettingsModal
        visible={showSkipModal}
        title="Skip Duration"
        options={skipDurationOptions}
        selectedKey={skipDuration.toString()}
        onSelect={(key) => saveSkipDuration(parseInt(key))}
        onClose={() => setShowSkipModal(false)}
      />
      
      <SettingsModal
        visible={showBackgroundModal}
        title="Background Style"
        options={backgroundOptions}
        selectedKey={backgroundStyle}
        onSelect={saveBackgroundStyle}
        onClose={() => setShowBackgroundModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#fff', flex: 1, textAlign: 'center' },
  section: { marginTop: 32 },
  sectionHeader: { fontSize: 13, fontWeight: '600', color: '#666', paddingHorizontal: 20, marginBottom: 8, letterSpacing: 0.5 },
  settingItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingVertical: 16, 
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a'
  },
  settingContent: { flex: 1 },
  settingTitle: { fontSize: 16, color: '#fff', fontWeight: '500' },
  settingSubtitle: { fontSize: 14, color: '#666', marginTop: 2 },
  scrollContent: { paddingBottom: 100 },
});