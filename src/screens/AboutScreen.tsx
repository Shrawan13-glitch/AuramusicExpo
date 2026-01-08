import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAnimation } from '../store/AnimationContext';
import { checkForUpdatesV2, getCurrentVersion } from '../utils/updateCheckerV2';

export default function AboutScreen({ navigation }: any) {
  const { settings } = useAnimation();
  const [checking, setChecking] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const speedDelays = { fast: 250, normal: 350, slow: 550 };
    const timer = setTimeout(() => setShowContent(true), speedDelays[settings.speed]);
    return () => clearTimeout(timer);
  }, [settings.speed]);

  const handleCheckUpdates = async () => {
    setChecking(true);
    const { hasUpdate, updateInfo, selectedDownload } = await checkForUpdatesV2();
    setChecking(false);
    if (hasUpdate && updateInfo && selectedDownload) {
      navigation.navigate('Update', { updateInfo, selectedDownload });
    } else {
      alert('You are on the latest version');
    }
  };

  const InfoCard = ({ icon, title, subtitle, onPress, iconColor = '#1db954' }: any) => (
    <TouchableOpacity style={styles.infoCard} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={20} color="#666" />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AssistantScreen')} style={styles.assistantButton}>
          <Ionicons name="mic" size={24} color="#1db954" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {showContent && (
          <>
            <View style={styles.appSection}>
              <View style={styles.appIcon}>
                <Ionicons name="musical-notes" size={40} color="#1db954" />
              </View>
              <Text style={styles.appName}>AuraMusic</Text>
              <Text style={styles.appDescription}>Your ultimate music streaming companion</Text>
            </View>

            <View style={styles.section}>
              <InfoCard
                icon="information-circle-outline"
                title="Version"
                subtitle={getCurrentVersion()}
                iconColor="#3742fa"
              />
              
              <TouchableOpacity style={styles.updateCard} onPress={handleCheckUpdates} disabled={checking}>
                <View style={[styles.iconContainer, { backgroundColor: '#1db954' + '20' }]}>
                  {checking ? (
                    <ActivityIndicator size="small" color="#1db954" />
                  ) : (
                    <Ionicons name="cloud-download-outline" size={24} color="#1db954" />
                  )}
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Check for Updates</Text>
                  <Text style={styles.cardSubtitle}>Get the latest features and fixes</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>

              <InfoCard
                icon="code-slash-outline"
                title="Developer"
                subtitle="ShryneX - Built with React Native & Expo"
                iconColor="#ff6b6b"
              />

              <InfoCard
                icon="shield-checkmark-outline"
                title="Privacy Policy"
                subtitle="How we protect your data"
                onPress={() => Linking.openURL('https://shrynex.pages.dev/auramusic/privacy-policy')}
                iconColor="#ffa502"
              />

              <InfoCard
                icon="document-text-outline"
                title="Terms of Service"
                subtitle="Usage terms and conditions"
                onPress={() => Linking.openURL('https://shrynex.pages.dev/auramusic/terms')}
                iconColor="#747d8c"
              />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Made with ❤️ for music lovers</Text>
              <Text style={styles.copyright}>© 2024 AuraMusic by ShryneX. All rights reserved.</Text>
            </View>
          </>
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
  appSection: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  appIcon: { 
    width: 80, 
    height: 80, 
    borderRadius: 20, 
    backgroundColor: '#1db954' + '20', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: 16
  },
  appName: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 8 },
  appDescription: { fontSize: 16, color: '#aaa', textAlign: 'center', lineHeight: 22 },
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
  updateCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#121212', 
    padding: 20, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#1db954' 
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
  footer: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 40 },
  footerText: { fontSize: 16, color: '#aaa', marginBottom: 8 },
  copyright: { fontSize: 14, color: '#666' },
  assistantButton: { padding: 4 },
});