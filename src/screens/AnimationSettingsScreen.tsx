import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAnimation } from '../store/AnimationContext';
import SettingsModal from '../components/SettingsModal';

export default function AnimationSettingsScreen({ navigation }: any) {
  const { settings, updateSettings } = useAnimation();
  const [showContent, setShowContent] = useState(false);
  const [showSpeedModal, setShowSpeedModal] = useState(false);

  useEffect(() => {
    const speedDelays = { fast: 250, normal: 350, slow: 550 };
    const timer = setTimeout(() => setShowContent(true), speedDelays[settings.speed]);
    return () => clearTimeout(timer);
  }, [settings.speed]);

  const speedOptions = [
    { key: 'fast', label: 'Fast', subtitle: '200ms transitions' },
    { key: 'normal', label: 'Normal', subtitle: '300ms transitions' },
    { key: 'slow', label: 'Slow', subtitle: '500ms transitions' }
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Animation Settings</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        {showContent && (
          <>
            <View style={styles.section}>
              <TouchableOpacity style={styles.settingRow} onPress={() => setShowSpeedModal(true)}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Animation Speed</Text>
                  <Text style={styles.settingSubtitle}>{speedOptions.find(o => o.key === settings.speed)?.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.infoText}>
                Animation speed affects screen transitions and other UI animations throughout the app.
              </Text>
            </View>
          </>
        )}
      </View>
      
      <SettingsModal
        visible={showSpeedModal}
        title="Animation Speed"
        options={speedOptions}
        selectedKey={settings.speed}
        onSelect={(speed) => updateSettings({ speed })}
        onClose={() => setShowSpeedModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingVertical: 16 
  },
  backButton: { width: 32 },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: '600', 
    color: '#fff', 
    textAlign: 'center' 
  },
  content: { flex: 1, paddingHorizontal: 20 },
  section: { 
    backgroundColor: '#121212', 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#282828'
  },
  settingRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  settingInfo: { flex: 1, marginRight: 16 },
  settingTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#fff', 
    marginBottom: 4 
  },
  settingSubtitle: { 
    fontSize: 14, 
    color: '#aaa' 
  },
  infoText: { 
    fontSize: 14, 
    color: '#aaa', 
    lineHeight: 20 
  },
});