import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Share, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuraDB } from '../services/auraDB';
import { AuraStats } from '../types';
import { AuraLoadingScreen } from '../components/AuraLoadingScreen';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { usePlayer } from '../store/PlayerContext';

const { width } = Dimensions.get('window');

export default function AuraMeterScreen({ navigation }: any) {
  const [stats, setStats] = useState<AuraStats | null>(null);
  const [loading, setLoading] = useState(true);
  const shareCardRef = useRef<View>(null);
  const { playSong } = usePlayer();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setTimeout(async () => {
      const data = await AuraDB.getAuraStats();
      setStats(data);
      setLoading(false);
    }, 2000);
  };

  const shareAura = async () => {
    const caption = `🔥 My Musical Aura 🔥\n\n${getAuraEmoji(stats?.auraLevel || 'Common')} Rank: ${stats?.auraLevel}\n✨ Aura Points: ${stats?.auraScore.toLocaleString()}\n⏱️ Listening Time: ${formatTime(stats?.totalListeningTime || 0)}\n🎵 Songs: ${stats?.topSongs.length}\n🎤 Artists: ${stats?.topArtists.length}\n\nJoin me on AuraMusic and discover your musical aura! 🎶\n#AuraMusic #${stats?.auraLevel}Aura`;
    
    Share.share({ message: caption });
  };

  if (loading) return <AuraLoadingScreen />;
  if (!stats) return null;

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getAuraColor = (level: string) => {
    const colors: any = {
      'Legendary': ['#ffd700', '#ffed4e', '#ff6b00', '#ff0080'],
      'Mythic': ['#9333ea', '#c026d3', '#ec4899', '#f97316'],
      'Epic': ['#6366f1', '#8b5cf6', '#3b82f6', '#06b6d4'],
      'Rare': ['#3b82f6', '#06b6d4', '#14b8a6', '#10b981'],
      'Uncommon': ['#10b981', '#14b8a6', '#22c55e', '#84cc16'],
      'Common': ['#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb'],
    };
    return colors[level] || colors['Common'];
  };

  const getAuraEmoji = (level: string) => {
    const emojis: any = {
      'Legendary': '👑',
      'Mythic': '🔮',
      'Epic': '⚡',
      'Rare': '💎',
      'Uncommon': '⭐',
      'Common': '🌟',
    };
    return emojis[level] || '🌟';
  };

  const getRankProgress = () => {
    if (!stats.nextRank) return 100;
    const currentThreshold = stats.auraScore;
    const nextThreshold = stats.auraScore + stats.nextRank.pointsNeeded;
    const prevThreshold = nextThreshold - (stats.nextRank.pointsNeeded + stats.auraScore);
    return ((currentThreshold - prevThreshold) / (nextThreshold - prevThreshold)) * 100;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AuraMeter</Text>
        <TouchableOpacity onPress={shareAura} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Shareable Card */}
        <View ref={shareCardRef} collapsable={false} style={styles.shareableWrapper}>
          <LinearGradient colors={getAuraColor(stats.auraLevel)} style={styles.shareableCard}>
            {/* Decorative circles */}
            <View style={[styles.decorCircle, { top: -50, right: -50, opacity: 0.3 }]} />
            <View style={[styles.decorCircle, { bottom: -30, left: -30, opacity: 0.2 }]} />
            
            {/* Logo/Brand */}
            <View style={styles.brandSection}>
              <Text style={styles.brandText}>AURAMUSIC</Text>
            </View>

            {/* Main Aura Display */}
            <View style={styles.mainAuraSection}>
              <View style={styles.glowOrb}>
                <View style={styles.innerGlow}>
                  <Text style={styles.auraEmoji}>{getAuraEmoji(stats.auraLevel)}</Text>
                </View>
              </View>
              
              <Text style={styles.auraLevel}>{stats.auraLevel}</Text>
              <Text style={styles.auraSubtitle}>RANK</Text>
              
              <View style={styles.scoreDisplay}>
                <Text style={styles.auraScore}>{stats.auraScore.toLocaleString()}</Text>
                <Text style={styles.pointsLabel}>AURA POINTS</Text>
              </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Ionicons name="time-outline" size={24} color="#fff" />
                <Text style={styles.statNumber}>{formatTime(stats.totalListeningTime)}</Text>
                <Text style={styles.statText}>Listening</Text>
              </View>
              <View style={styles.statBox}>
                <Ionicons name="musical-notes-outline" size={24} color="#fff" />
                <Text style={styles.statNumber}>{stats.topSongs.length}</Text>
                <Text style={styles.statText}>Songs</Text>
              </View>
              <View style={styles.statBox}>
                <Ionicons name="person-outline" size={24} color="#fff" />
                <Text style={styles.statNumber}>{stats.topArtists.length}</Text>
                <Text style={styles.statText}>Artists</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.cardFooter}>
              <Text style={styles.footerTagline}>Discover Your Musical Aura</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Progress Section */}
        {stats.nextRank && (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Next Rank Progress</Text>
            <View style={styles.progressBar}>
              <LinearGradient 
                colors={getAuraColor(stats.auraLevel)} 
                style={[styles.progressFill, { width: `${getRankProgress()}%` }]} 
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </View>
            <Text style={styles.progressText}>
              {stats.nextRank.pointsNeeded.toLocaleString()} points to {stats.nextRank.emoji} {stats.nextRank.name}
            </Text>
          </View>
        )}

        {/* Top Artists */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <LinearGradient colors={['#8b5cf6', '#ec4899']} style={styles.iconGradient}>
              <Ionicons name="person" size={18} color="#fff" />
            </LinearGradient>
            <Text style={styles.sectionTitle}>Top Artists</Text>
          </View>
          {stats.topArtists.slice(0, 5).map((item, idx) => (
            <TouchableOpacity 
              key={idx} 
              style={styles.listItem}
              onPress={() => navigation.navigate('Artist', { artistId: item.id })}
            >
              <View style={[styles.rank, { backgroundColor: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : '#8b5cf6' }]}>
                <Text style={styles.rankText}>#{idx + 1}</Text>
              </View>
              <View style={styles.artistAvatar}>
                <Text style={styles.artistInitial}>{item.name[0]}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="play" size={12} color="#888" />
                  <Text style={styles.itemMeta}>{item.playCount} plays • {formatTime(item.time)}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Top Songs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <LinearGradient colors={['#ec4899', '#f97316']} style={styles.iconGradient}>
              <Ionicons name="musical-notes" size={18} color="#fff" />
            </LinearGradient>
            <Text style={styles.sectionTitle}>Top Songs</Text>
          </View>
          {stats.topSongs.slice(0, 5).map((item, idx) => (
            <TouchableOpacity 
              key={idx} 
              style={styles.listItem}
              onPress={() => playSong(item.song)}
            >
              <View style={[styles.rank, { backgroundColor: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : '#8b5cf6' }]}>
                <Text style={styles.rankText}>#{idx + 1}</Text>
              </View>
              <Image source={{ uri: item.song.thumbnailUrl }} style={styles.songThumb} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.song.title}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="play" size={12} color="#888" />
                  <Text style={styles.itemMeta}>{item.playCount} plays • {formatTime(item.time)}</Text>
                </View>
              </View>
              <Ionicons name="play-circle" size={24} color="#8b5cf6" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  shareBtn: { padding: 8, backgroundColor: '#8b5cf6', borderRadius: 12 },
  content: { padding: 16, paddingBottom: 100 },
  
  // Shareable Card Styles
  shareableWrapper: { marginBottom: 24, borderRadius: 32, overflow: 'hidden' },
  shareableCard: { padding: 40, alignItems: 'center', position: 'relative', overflow: 'hidden' },
  decorCircle: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#fff' },
  
  brandSection: { marginBottom: 32 },
  brandText: { fontSize: 16, fontWeight: 'bold', color: '#fff', letterSpacing: 4, opacity: 0.9 },
  
  mainAuraSection: { alignItems: 'center', marginBottom: 32 },
  glowOrb: { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 24, shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20 },
  innerGlow: { width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  auraEmoji: { fontSize: 64 },
  auraLevel: { fontSize: 36, fontWeight: 'bold', color: '#fff', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 4, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  auraSubtitle: { fontSize: 12, color: '#fff', opacity: 0.8, letterSpacing: 2, marginBottom: 20 },
  
  scoreDisplay: { alignItems: 'center' },
  auraScore: { fontSize: 64, fontWeight: 'bold', color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 8 },
  pointsLabel: { fontSize: 14, color: '#fff', opacity: 0.9, marginTop: 4, letterSpacing: 2 },
  
  statsGrid: { flexDirection: 'row', width: '100%', justifyContent: 'space-around', marginBottom: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)' },
  statBox: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  statText: { fontSize: 11, color: '#fff', opacity: 0.8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  
  cardFooter: { paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)' },
  footerTagline: { fontSize: 13, color: '#fff', opacity: 0.9, letterSpacing: 1, fontStyle: 'italic' },
  
  // Progress Card
  progressCard: { backgroundColor: '#111', borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#222' },
  progressTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  progressBar: { height: 12, backgroundColor: '#222', borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', borderRadius: 6 },
  progressText: { fontSize: 13, color: '#aaa', textAlign: 'center', fontWeight: '600' },
  
  // Lists
  section: { marginBottom: 24, backgroundColor: '#111', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#222' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  iconGradient: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', letterSpacing: 0.5 },
  listItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12, backgroundColor: '#1a1a1a', padding: 12, borderRadius: 12 },
  rank: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 13, fontWeight: 'bold', color: '#fff' },
  artistAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center' },
  artistInitial: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  songThumb: { width: 48, height: 48, borderRadius: 8 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, color: '#fff', fontWeight: '600', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemMeta: { fontSize: 12, color: '#888' },
});
