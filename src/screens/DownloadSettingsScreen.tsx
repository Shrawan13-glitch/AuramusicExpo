import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDownload } from '../store/DownloadContext';

export default function DownloadSettingsScreen({ navigation }: any) {
  const { downloadedSongs, getTotalDownloadSize, clearAllDownloads } = useDownload();
  const [downloadQuality, setDownloadQuality] = useState('high');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const quality = await AsyncStorage.getItem('downloadQuality');
      if (quality) setDownloadQuality(quality);
    } catch (error) {
      console.log('Error loading settings:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Downloads',
      'Are you sure you want to delete all downloaded songs? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete All', 
          style: 'destructive',
          onPress: clearAllDownloads
        }
      ]
    );
  };

  const InfoCard = ({ icon, title, subtitle, onPress, iconColor = '#1db954', showChevron = false }: any) => (
    <TouchableOpacity style={styles.infoCard} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      {showChevron && <Ionicons name="chevron-forward" size={20} color="#666" />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Downloads</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Ionicons name="musical-notes" size={32} color="#1db954" />
            <Text style={styles.statNumber}>{downloadedSongs.length}</Text>
            <Text style={styles.statLabel}>Downloaded Songs</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="folder" size={32} color="#3742fa" />
            <Text style={styles.statNumber}>{formatFileSize(getTotalDownloadSize())}</Text>
            <Text style={styles.statLabel}>Storage Used</Text>
          </View>
        </View>

        <View style={styles.section}>
          <InfoCard
            icon="list-outline"
            title="Downloaded Songs"
            subtitle={`View and manage your ${downloadedSongs.length} downloaded songs`}
            onPress={() => navigation.navigate('DownloadedSongs')}
            iconColor="#1db954"
            showChevron={true}
          />

          <TouchableOpacity style={styles.settingCard} onPress={() => navigation.navigate('QualitySettings')}>
            <View style={[styles.iconContainer, { backgroundColor: '#3742fa20' }]}>
              <Ionicons name="settings-outline" size={24} color="#3742fa" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Download Quality</Text>
              <Text style={styles.cardSubtitle}>{downloadQuality === 'high' ? 'High (320 kbps)' : downloadQuality === 'medium' ? 'Medium (192 kbps)' : 'Low (128 kbps)'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {downloadedSongs.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
            <Ionicons name="trash-outline" size={20} color="#ff4757" />
            <Text style={styles.clearButtonText}>Clear All Downloads</Text>
          </TouchableOpacity>
        )}
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
  statsSection: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 12 },
  statCard: { 
    flex: 1, 
    backgroundColor: '#121212', 
    padding: 20, 
    borderRadius: 16, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#282828'
  },
  statNumber: { fontSize: 24, fontWeight: '700', color: '#fff', marginTop: 8, marginBottom: 4 },
  statLabel: { fontSize: 14, color: '#aaa', textAlign: 'center' },
  section: { paddingHorizontal: 20, gap: 12 },
  infoCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#121212', 
    padding: 20, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#282828' 
  },
  iconContainer: { 
    width: 44, 
    height: 44, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 16 
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 2 },
  cardSubtitle: { fontSize: 14, color: '#aaa' },
  settingCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#121212', 
    padding: 20, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#282828' 
  },
  clearButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#121212', 
    marginHorizontal: 20, 
    marginTop: 24, 
    padding: 16, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#ff4757' 
  },
  clearButtonText: { fontSize: 16, fontWeight: '600', color: '#ff4757', marginLeft: 8 },
});