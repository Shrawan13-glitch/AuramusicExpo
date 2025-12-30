import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAnimation } from '../store/AnimationContext';

export default function AnimationSettingsScreen({ navigation }: any) {
  const { settings, updateSettings } = useAnimation();

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
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Enable Animations</Text>
              <Text style={styles.settingSubtitle}>Turn off to disable all animations</Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={(enabled) => updateSettings({ enabled })}
              trackColor={{ false: '#767577', true: '#1db954' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.infoText}>
            Animation settings affect screen transitions, player animations, and other UI animations throughout the app.
          </Text>
        </View>
      </View>
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