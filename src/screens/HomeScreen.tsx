import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, RefreshControl, ActivityIndicator, Dimensions, Modal } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';
import { Song } from '../types';
import SongOptionsModal from '../components/SongOptionsModal';
import TabHeader from '../components/TabHeader';
import { useSongOptions } from '../hooks/useSongOptions';

// Add hashCode method for color generation
String.prototype.hashCode = function() {
  let hash = 0;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_WIDTH = (SCREEN_WIDTH - 48) / 2;
const ITEM_HEIGHT = 64;

export default function HomeScreen({ navigation }: any) {
  const [quickPicks, setQuickPicks] = useState<Song[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [continuation, setContinuation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasStartedScrolling, setHasStartedScrolling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [skeletonSections, setSkeletonSections] = useState(0);
  const { playSong, currentSong } = usePlayer();
  const { modalVisible, selectedSong, showOptions, hideOptions } = useSongOptions();

  useEffect(() => {
    loadHome();
  }, []);

  const loadHome = useCallback(async () => {
    try {
      const data = await InnerTube.getHome();
      setQuickPicks(data.quickPicks);
      setSections(data.sections);
      setContinuation(data.continuation);
      setLoading(false); // Set loading false immediately after initial sections
      
      // Load additional sections in background
      if (data.continuation) {
        const moreData = await InnerTube.getHomeContinuation(data.continuation);
        const newSections = moreData.sections.slice(0, 10);
        setSections(prev => [...prev, ...newSections]);
        setContinuation(moreData.continuation);
      }
    } catch (error) {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await InnerTube.getHome();
      setQuickPicks(data.quickPicks);
      setSections(data.sections);
      setContinuation(data.continuation);
    } catch (error) {
      // Error handled silently
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!continuation || loadingMore) return;
    
    setSkeletonSections(5); // Show 5 skeleton sections
    setLoadingMore(true);
    try {
      const data = await InnerTube.getHomeContinuation(continuation);
      const newSections = data.sections.slice(0, 5);
      setSections(prev => [...prev, ...newSections]);
      setContinuation(data.continuation);
    } catch (error) {
      // Error loading more handled silently
    } finally {
      setSkeletonSections(0); // Remove skeletons
      setLoadingMore(false);
    }
  }, [continuation, loadingMore]);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 300;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      loadMore();
    }
  }, [loadMore]);

  const getSectionType = (section: any) => {
    const title = section.title?.toLowerCase() || '';
    if (title.includes('trending') || title.includes('for you')) return 'trending';
    if (title.includes('cover') || title.includes('remix')) return 'covers';
    if (title.includes('playlist') && (title.includes('my') || title.includes('your'))) return 'myPlaylist';
    if (title.includes('community') || title.includes('from') || title.includes('popular')) return 'communityPlaylist';
    if (title.includes('new') && title.includes('release')) return 'newReleases';
    if (title.includes('chart') || title.includes('top')) return 'charts';
    if (title.includes('album') && title.includes('you')) return 'albumsForYou';
    if (title.includes('long') || title.includes('listen')) return 'longListens';
    if (title.includes('forgotten') || title.includes('favourite')) return 'forgottenFavs';
    if (title.includes('channel') || title.includes('music') && title.includes('like')) return 'musicChannels';
    if (title.includes('mixed') || title.includes('mix') || title.includes('radio') || title.includes('station')) return 'mixes';
    if (title.includes('song') || title.includes('track')) return 'songs';
    return 'default';
  };

  const getSectionItemSize = (section: any) => {
    const sectionType = getSectionType(section);
    if (sectionType === 'newReleases') return 200;
    if (sectionType === 'charts') return 180;
    if (sectionType === 'albumsForYou') return 190;
    if (sectionType === 'longListens') return 220;
    if (sectionType === 'forgottenFavs') return 170;
    if (sectionType === 'musicChannels') return 160;
    if (sectionType === 'trending') return 240;
    if (sectionType === 'myPlaylist') return 170;
    if (sectionType === 'communityPlaylist') return 190;
    if (sectionType === 'personal') return 160;
    if (sectionType === 'community') return 180;
    if (sectionType === 'songs') return 140;
    if (sectionType === 'mixes') return 180;
    return 172;
  };

  const renderSectionItem = useCallback(({ item, sectionType }) => {
    const isPlaying = item.type === 'song' && currentSong?.id === item.id;
    const displayTitle = item.type === 'artist' ? item.name : item.title;
    const displaySubtitle = item.type === 'song' 
      ? item.artists?.map((a: any) => a.name).join(', ') 
      : item.subtitle || '';
    
    if (sectionType === 'trending') {
      const trendingColors = [`hsl(${(Math.abs(item.id?.hashCode() || 0) * 137) % 360}, 85%, 60%)`, `hsl(${(Math.abs(item.id?.hashCode() || 0) * 137 + 120) % 360}, 85%, 40%)`];
      return (
        <TouchableOpacity 
          style={[styles.trendingCard, { transform: [{ scale: 1.02 }, { rotate: `${Math.sin(Math.abs(item.id?.hashCode() || 0)) * 3}deg` }] }]} 
          onPress={() => {
            if (item.type === 'song') {
              playSong(item);
            } else if (item.type === 'playlist') {
              navigation.getParent()?.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
            }
          }}
          onLongPress={item.type === 'song' ? () => showOptions(item) : undefined}
        >
          <View style={[styles.trendingGlowBorder, { borderColor: trendingColors[0], shadowColor: trendingColors[0] }]}>
            <Image 
              source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} 
              style={styles.trendingImage}
              resizeMode="cover"
            />
            <View style={[styles.trendingHologram, { backgroundColor: trendingColors[1] }]} />
            <View style={styles.trendingBadge}>
              <Ionicons name="flame" size={14} color="#fff" />
            </View>
            <View style={styles.trendingPulse}>
              {[...Array(3)].map((_, i) => (
                <View key={i} style={[styles.pulseRing, { borderColor: trendingColors[0], animationDelay: `${i * 0.3}s` }]} />
              ))}
            </View>
          </View>
          <View style={styles.trendingContent}>
            <Text style={[styles.trendingTitle, isPlaying && { color: trendingColors[0] }]} numberOfLines={2}>
              {displayTitle}
            </Text>
            <Text style={[styles.trendingSubtitle, { color: trendingColors[1] }]} numberOfLines={1}>
              {displaySubtitle}
            </Text>
            <View style={styles.trendingStats}>
              <Ionicons name="trending-up" size={10} color={trendingColors[0]} />
              <Text style={[styles.trendingViews, { color: trendingColors[0] }]}>Trending Now</Text>
            </View>
          </View>
          {isPlaying && <View style={[styles.playingIndicator, { backgroundColor: trendingColors[0] }]} />}
        </TouchableOpacity>
      );
    }
    
    if (sectionType === 'myPlaylist') {
      return (
        <TouchableOpacity 
          style={styles.myPlaylistCard} 
          onPress={() => {
            if (item.type === 'playlist') {
              navigation.getParent()?.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
            }
          }}
        >
          <View style={styles.myPlaylistFrame}>
            <Image 
              source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} 
              style={styles.myPlaylistImage}
              resizeMode="cover"
            />
            <View style={styles.myPlaylistGlow} />
            <View style={styles.myPlaylistBadge}>
              <Ionicons name="library" size={12} color="#fff" />
            </View>
          </View>
          <View style={styles.myPlaylistContent}>
            <Text style={styles.myPlaylistTitle} numberOfLines={2}>
              {displayTitle}
            </Text>
            <Text style={styles.myPlaylistSubtitle} numberOfLines={1}>
              My Playlist
            </Text>
          </View>
        </TouchableOpacity>
      );
    }
    
    if (sectionType === 'communityPlaylist') {
      return (
        <TouchableOpacity 
          style={styles.communityPlaylistCard} 
          onPress={() => {
            if (item.type === 'playlist') {
              navigation.getParent()?.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
            }
          }}
        >
          <View style={styles.communityPlaylistFrame}>
            <Image 
              source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} 
              style={styles.communityPlaylistImage}
              resizeMode="cover"
            />
            <View style={styles.communityPlaylistPattern} />
            <View style={styles.communityPlaylistBadge}>
              <Ionicons name="globe" size={12} color="#fff" />
            </View>
            <View style={styles.communityStats}>
              <Ionicons name="people" size={10} color="#fff" />
              <Text style={styles.communityStatsText}>Community</Text>
            </View>
          </View>
          <View style={styles.communityPlaylistContent}>
            <Text style={styles.communityPlaylistTitle} numberOfLines={2}>
              {displayTitle}
            </Text>
            <Text style={styles.communityPlaylistSubtitle} numberOfLines={1}>
              {displaySubtitle}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }
    
    if (sectionType === 'newReleases') {
      return (
        <TouchableOpacity style={styles.newReleaseCard} onPress={() => {
          if (item.type === 'album') navigation.getParent()?.navigate('Album', { albumId: item.id });
          else if (item.type === 'playlist') navigation.getParent()?.navigate('Playlist', { playlistId: item.id });
        }}>
          <View style={styles.newReleaseFrame}>
            <Image source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} style={styles.newReleaseImage} resizeMode="cover" />
            <View style={styles.newReleaseBurst}><Ionicons name="star" size={16} color="#fff" /></View>
            <View style={styles.newReleaseGradient} />
          </View>
          <Text style={styles.newReleaseTitle} numberOfLines={2}>{displayTitle}</Text>
          <Text style={styles.newReleaseSubtitle} numberOfLines={1}>New Release</Text>
        </TouchableOpacity>
      );
    }
    
    if (sectionType === 'charts') {
      return (
        <TouchableOpacity style={styles.chartCard} onPress={() => {
          if (item.type === 'song') playSong(item);
          else if (item.type === 'playlist') navigation.getParent()?.navigate('Playlist', { playlistId: item.id });
        }}>
          <View style={styles.chartFrame}>
            <Image source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} style={styles.chartImage} resizeMode="cover" />
            <View style={styles.chartRank}><Text style={styles.chartRankText}>#1</Text></View>
            <View style={styles.chartFire}><Ionicons name="flame" size={14} color="#ff4757" /></View>
          </View>
          <Text style={styles.chartTitle} numberOfLines={2}>{displayTitle}</Text>
          <Text style={styles.chartSubtitle} numberOfLines={1}>Chart Topper</Text>
        </TouchableOpacity>
      );
    }
    
    if (sectionType === 'albumsForYou') {
      return (
        <TouchableOpacity style={styles.albumForYouCard} onPress={() => {
          if (item.type === 'album') navigation.getParent()?.navigate('Album', { albumId: item.id });
        }}>
          <View style={styles.albumForYouFrame}>
            <Image source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} style={styles.albumForYouImage} resizeMode="cover" />
            <View style={styles.albumForYouHeart}><Ionicons name="heart" size={12} color="#ff6b6b" /></View>
            <View style={styles.albumForYouShine} />
          </View>
          <Text style={styles.albumForYouTitle} numberOfLines={2}>{displayTitle}</Text>
          <Text style={styles.albumForYouSubtitle} numberOfLines={1}>For You</Text>
        </TouchableOpacity>
      );
    }
    
    // Different card styles based on section type
    if (sectionType === 'longListens') {
      return (
        <TouchableOpacity style={styles.longListenCard} onPress={() => {
          if (item.type === 'playlist') navigation.getParent()?.navigate('Playlist', { playlistId: item.id });
        }}>
          <View style={styles.longListenFrame}>
            <Image source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} style={styles.longListenImage} resizeMode="cover" />
            <View style={styles.longListenClock}><Ionicons name="time" size={14} color="#ffa726" /></View>
            <View style={styles.longListenWaves}>
              {[...Array(3)].map((_, i) => <View key={i} style={[styles.waveRing, { opacity: 0.3 - i * 0.1 }]} />)}
            </View>
          </View>
          <Text style={styles.longListenTitle} numberOfLines={2}>{displayTitle}</Text>
          <Text style={styles.longListenSubtitle} numberOfLines={1}>Extended Play</Text>
        </TouchableOpacity>
      );
    }
    
    if (sectionType === 'forgottenFavs') {
      const galaxyColors = [`hsl(${(Math.abs(item.id?.hashCode() || 0) * 89) % 360}, 95%, 70%)`, `hsl(${(Math.abs(item.id?.hashCode() || 0) * 89 + 180) % 360}, 95%, 50%)`];
      const cosmicPatterns = ['✦', '◊', '⟡', '◈', '⬟', '◉', '⬢', '◎'];
      const pattern = cosmicPatterns[Math.abs(item.id?.hashCode() || 0) % cosmicPatterns.length];
      return (
        <TouchableOpacity 
          style={[styles.galaxyCard, { transform: [{ rotate: `${Math.sin(Math.abs(item.id?.hashCode() || 0)) * 5}deg` }] }]} 
          onPress={() => {
            if (item.type === 'song') playSong(item);
          }}
        >
          <View style={[styles.galaxyFrame, { borderColor: galaxyColors[0], shadowColor: galaxyColors[1] }]}>
            <View style={[styles.galaxyArt, { backgroundColor: galaxyColors[0] }]}>
              <Image 
                source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} 
                style={styles.galaxyImage}
                resizeMode="cover"
              />
              <View style={[styles.galaxyOverlay, { backgroundColor: galaxyColors[1] }]} />
              <View style={[styles.galaxyPattern, { backgroundColor: galaxyColors[0] }]}>
                <Text style={styles.galaxyPatternText}>{pattern}</Text>
              </View>
              <View style={styles.galaxyStars}>
                {[...Array(8)].map((_, i) => (
                  <View key={i} style={[styles.galaxyStar, { 
                    backgroundColor: galaxyColors[1], 
                    top: `${5 + i * 11}%`, 
                    left: `${3 + i * 12}%`
                  }]} />
                ))}
              </View>
              <View style={[styles.galaxyNebula, { backgroundColor: galaxyColors[0] }]} />
            </View>
          </View>
          <View style={styles.galaxyContent}>
            <Text style={styles.galaxyTitle} numberOfLines={2}>
              {displayTitle}
            </Text>
            <Text style={[styles.galaxySubtitle, { color: galaxyColors[0] }]} numberOfLines={1}>
              Cosmic Memory
            </Text>
          </View>
        </TouchableOpacity>
      );
    }
    
    if (sectionType === 'covers') {
      return (
        <TouchableOpacity 
          style={styles.coverCard} 
          onPress={() => {
            if (item.type === 'song' || item.type === 'video') {
              playSong(item);
            }
          }}
        >
          <View style={styles.coverFrame}>
            <Image 
              source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} 
              style={styles.coverImage}
              resizeMode="cover"
            />
            <View style={styles.coverBadge}>
              <Ionicons name="musical-notes" size={12} color="#fff" />
            </View>
          </View>
          <View style={styles.coverContent}>
            <Text style={styles.coverTitle} numberOfLines={2}>
              {displayTitle}
            </Text>
            <Text style={styles.coverSubtitle} numberOfLines={1}>
              {displaySubtitle}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }
    
    if (sectionType === 'musicChannels') {
      return (
        <TouchableOpacity style={styles.channelCard} onPress={() => {
          if (item.type === 'playlist') navigation.getParent()?.navigate('Playlist', { playlistId: item.id });
        }}>
          <View style={styles.channelFrame}>
            <Image source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} style={styles.channelImage} resizeMode="cover" />
            <View style={styles.channelSignal}><Ionicons name="radio" size={12} color="#00d4aa" /></View>
            <View style={styles.channelPulse} />
          </View>
          <Text style={styles.channelTitle} numberOfLines={2}>{displayTitle}</Text>
          <Text style={styles.channelSubtitle} numberOfLines={1}>Channel</Text>
        </TouchableOpacity>
      );
    }
    
    if (sectionType === 'songs') {
      return (
        <TouchableOpacity 
          style={[styles.songCard, { backgroundColor: `hsl(${Math.abs(item.id?.hashCode() || 0) % 360}, 70%, 15%)` }]} 
          onPress={() => {
            if (item.type === 'song') {
              playSong(item);
            }
          }}
          onLongPress={item.type === 'song' ? () => showOptions(item) : undefined}
        >
          <View style={styles.songCardImageContainer}>
            <Image 
              source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} 
              style={styles.songCardImage}
              resizeMode="cover"
            />
            <View style={styles.songCardGradient} />
          </View>
          <View style={styles.songCardContent}>
            <Text style={[styles.songCardTitle, isPlaying && styles.activeText]} numberOfLines={2}>
              {displayTitle}
            </Text>
            <Text style={styles.songCardArtist} numberOfLines={1}>
              {displaySubtitle}
            </Text>
          </View>
          {isPlaying && <View style={styles.playingIndicator} />}
        </TouchableOpacity>
      );
    }
    
    if (sectionType === 'mixes') {
      const gradientColors = [`hsl(${Math.abs(item.id?.hashCode() || 0) % 360}, 80%, 25%)`, `hsl(${(Math.abs(item.id?.hashCode() || 0) + 60) % 360}, 80%, 15%)`];
      const mixPatterns = ['▲', '●', '■', '♦', '★', '▼', '◆', '♪'];
      const pattern = mixPatterns[Math.abs(item.id?.hashCode() || 0) % mixPatterns.length];
      
      return (
        <TouchableOpacity 
          style={styles.mixCard} 
          onPress={() => {
            if (item.type === 'playlist') {
              navigation.getParent()?.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
            }
          }}
        >
          <View style={styles.mixCardImageContainer}>
            {item.thumbnailUrl ? (
              <Image 
                source={{ uri: item.thumbnailUrl }} 
                style={styles.mixCardImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.generatedMixArt, { backgroundColor: gradientColors[0] }]}>
                <View style={[styles.mixPattern, { backgroundColor: gradientColors[1] }]}>
                  <Text style={styles.mixPatternText}>{pattern}</Text>
                </View>
                <View style={[styles.mixGradientOverlay, { backgroundColor: gradientColors[1] }]} />
                <View style={styles.mixTitle}>
                  <Text style={styles.mixTitleText} numberOfLines={2}>{displayTitle}</Text>
                </View>
              </View>
            )}
            <View style={[styles.mixGradient, { backgroundColor: gradientColors[0] }]} />
          </View>
          <View style={styles.mixOverlay}>
            <View style={[styles.mixPlayButton, { backgroundColor: gradientColors[1] }]}>
              <Ionicons name="play" size={20} color="#fff" />
            </View>
            <View style={styles.mixBadge}>
              <Ionicons name="shuffle" size={12} color="#fff" />
            </View>
          </View>
          <View style={styles.mixCardContent}>
            <Text style={styles.mixCardTitle} numberOfLines={2}>
              {displayTitle}
            </Text>
            <Text style={styles.mixCardSubtitle} numberOfLines={1}>
              Mixed for You
            </Text>
          </View>
        </TouchableOpacity>
      );
    }
    
    // God-level universe owner default card with quantum morphism
    const quantumColors = [`hsl(${(Math.abs(item.id?.hashCode() || 0) * 137) % 360}, 90%, 65%)`, `hsl(${(Math.abs(item.id?.hashCode() || 0) * 137 + 120) % 360}, 90%, 45%)`, `hsl(${(Math.abs(item.id?.hashCode() || 0) * 137 + 240) % 360}, 90%, 55%)`];
    return (
      <TouchableOpacity 
        style={[styles.quantumCard, item.type === 'artist' && styles.quantumArtistCard, { transform: [{ rotate: `${Math.sin(Math.abs(item.id?.hashCode() || 0)) * 2}deg` }] }]} 
        onPress={() => {
          if (item.type === 'song') {
            playSong(item);
          } else if (item.type === 'artist') {
            navigation.getParent()?.navigate('Artist', { artistId: item.id });
          } else if (item.type === 'album') {
            navigation.getParent()?.navigate('Album', { albumId: item.id });
          } else if (item.type === 'playlist') {
            navigation.getParent()?.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
          } else if (item.type === 'video') {
            playSong(item);
          }
        }}
        onLongPress={item.type === 'song' ? () => showOptions(item) : undefined}
      >
        <View style={[styles.quantumFrame, { borderColor: quantumColors[0], shadowColor: quantumColors[2] }]}>
          <View style={[styles.quantumDimension, { backgroundColor: quantumColors[1] }]} />
          <Image 
            source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} 
            style={[styles.quantumImage, item.type === 'artist' && styles.quantumRoundImage]}
            resizeMode="cover"
          />
          <View style={[styles.quantumAura, { backgroundColor: quantumColors[0] }]} />
          {item.type === 'artist' && (
            <View style={[styles.quantumArtistBadge, { backgroundColor: quantumColors[0] }]}>
              <Ionicons name="person" size={12} color="#fff" />
            </View>
          )}
          <View style={styles.quantumConstellation}>
            {[...Array(6)].map((_, i) => (
              <View key={i} style={[styles.quantumStar, { 
                backgroundColor: quantumColors[i % 3], 
                top: `${10 + i * 13}%`, 
                left: `${5 + i * 15}%`
              }]} />
            ))}
          </View>
          <View style={[styles.quantumVortex, { backgroundColor: quantumColors[1] }]} />
        </View>
        <View style={styles.quantumContent}>
          <Text style={[styles.quantumTitle, isPlaying && { color: quantumColors[0] }]} numberOfLines={2}>
            {displayTitle}
          </Text>
          <Text style={[styles.quantumSubtitle, { color: quantumColors[1] }]} numberOfLines={1}>
            {displaySubtitle || 'Quantum Entity'}
          </Text>
        </View>
        {isPlaying && <View style={[styles.quantumPlayingIndicator, { backgroundColor: quantumColors[0] }]} />}
      </TouchableOpacity>
    );
  }, [currentSong?.id, playSong, navigation, showOptions]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TabHeader title="Home" navigation={navigation} />
        <View style={styles.skeletonContainer}>
          {Array.from({ length: 3 }).map((_, sectionIndex) => (
            <View key={`skeleton-section-${sectionIndex}`} style={styles.skeletonSection}>
              <View style={styles.skeletonSectionTitle} />
              <View style={styles.skeletonRow}>
                {Array.from({ length: 3 }).map((_, itemIndex) => (
                  <View key={`skeleton-item-${itemIndex}`} style={styles.skeletonCard}>
                    <View style={styles.skeletonImage} />
                    <View style={styles.skeletonCardTitle} />
                    <View style={styles.skeletonCardSubtitle} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="Home" navigation={navigation} />
    <FlashList
      style={styles.container}
      data={sections}
      keyExtractor={(item, index) => `section-${index}`}
      estimatedItemSize={300}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      onScroll={handleScroll}
      scrollEventThrottle={100}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#fff"
          colors={['#fff']}
        />
      }
      removeClippedSubviews={false}
      getItemType={() => 'section'}
      ListFooterComponent={
        <>
          {Array.from({ length: skeletonSections }).map((_, index) => (
            <View key={`skeleton-${index}`} style={styles.skeletonSection}>
              <View style={styles.skeletonSectionTitle} />
              <View style={styles.skeletonRow}>
                {Array.from({ length: 3 }).map((_, itemIndex) => (
                  <View key={`skeleton-item-${itemIndex}`} style={styles.skeletonCard}>
                    <View style={styles.skeletonImage} />
                    <View style={styles.skeletonCardTitle} />
                    <View style={styles.skeletonCardSubtitle} />
                  </View>
                ))}
              </View>
            </View>
          ))}
          {loadingMore && skeletonSections === 0 ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          ) : (
            <View style={{ height: 100 }} />
          )}
        </>
      }
      renderItem={({ item: section, index }) => {
        // Special handling for quick picks to use vibrant card layout
        if (section.title?.toLowerCase().includes('quick')) {
          return (
            <View key={`quickpicks-${index}`} style={styles.quickPicksSection}>
              <View style={styles.quickPicksHeader}>
                <View style={styles.quickPicksTitleContainer}>
                  <Ionicons name="flash" size={24} color="#e74c3c" />
                  <Text style={styles.quickPicksSectionTitle}>{section.title}</Text>
                </View>
              </View>
              <FlashList
                horizontal
                data={section.items.slice(0, 15)}
                keyExtractor={(item) => `${item.id}-quick-${index}`}
                estimatedItemSize={150}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item, index: itemIndex }) => {
                  const isPlaying = item.type === 'song' && currentSong?.id === item.id;
                  const vibrantColors = [
                    ['#ff6b35', '#f7931e'], ['#e74c3c', '#c0392b'], ['#9b59b6', '#8e44ad'],
                    ['#3498db', '#2980b9'], ['#1abc9c', '#16a085'], ['#f39c12', '#e67e22'],
                    ['#e91e63', '#ad1457'], ['#00bcd4', '#0097a7'], ['#4caf50', '#388e3c']
                  ];
                  const colorPair = vibrantColors[itemIndex % vibrantColors.length];
                  return (
                    <TouchableOpacity
                      style={[styles.quickPickCard, { transform: [{ rotate: `${(itemIndex % 3 === 0 ? 3 : itemIndex % 3 === 1 ? -2 : 1)}deg` }] }]}
                      onPress={() => {
                        if (item.type === 'song') {
                          playSong(item);
                        }
                      }}
                      onLongPress={item.type === 'song' ? () => showOptions(item) : undefined}
                    >
                      <View style={[styles.quickPickGradientBg, { backgroundColor: colorPair[0] }]} />
                      <Image 
                        source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} 
                        style={styles.quickPickImage}
                        resizeMode="cover"
                      />
                      <View style={styles.quickPickOverlay}>
                        <View style={[styles.quickPickPlayButton, { backgroundColor: colorPair[1] }]}>
                          <Ionicons name={isPlaying ? "pause" : "play"} size={16} color="#fff" />
                        </View>
                      </View>
                      <View style={styles.quickPickContent}>
                        <Text style={[styles.quickPickTitle, isPlaying && { color: colorPair[0] }]} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={styles.quickPickArtist} numberOfLines={1}>
                          {item.artists?.map((a: any) => a.name).join(', ') || 'Unknown'}
                        </Text>
                        <View style={styles.quickPickStats}>
                          <Ionicons name="headset" size={10} color={colorPair[0]} />
                          <Text style={[styles.quickPickLabel, { color: colorPair[0] }]}>Quick Pick</Text>
                        </View>
                      </View>
                      {isPlaying && <View style={[styles.playingIndicator, { backgroundColor: colorPair[0] }]} />}
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.quickPicksContainer}
              />
            </View>
          );
        }
        // Special handling for trending shorts - TikTok-style vertical cards
        if (section.title?.toLowerCase().includes('trending') && section.title?.toLowerCase().includes('shorts')) {
          return (
            <View key={`trending-shorts-${index}`} style={styles.shortsSection}>
              <View style={styles.shortsSectionHeader}>
                <View style={styles.shortsTitleContainer}>
                  <Ionicons name="trending-up" size={24} color="#ff6b35" />
                  <Text style={styles.shortsSectionTitle}>{section.title}</Text>
                </View>
              </View>
              <FlashList
                horizontal
                data={section.items.slice(0, 10)}
                keyExtractor={(item) => `${item.id}-shorts-${index}`}
                estimatedItemSize={180}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item, index: itemIndex }) => {
                  const isPlaying = item.type === 'song' && currentSong?.id === item.id;
                  const colors = [`hsl(${(itemIndex * 60) % 360}, 70%, 50%)`, `hsl(${(itemIndex * 60 + 180) % 360}, 70%, 30%)`];
                  return (
                    <TouchableOpacity
                      style={[styles.shortsCard, { transform: [{ rotate: `${(itemIndex % 2 === 0 ? 2 : -2)}deg` }] }]}
                      onPress={() => {
                        if (item.type === 'song' || item.type === 'video') {
                          playSong(item);
                        }
                      }}
                      onLongPress={item.type === 'song' ? () => showOptions(item) : undefined}
                    >
                      <View style={[styles.shortsGradientBg, { backgroundColor: colors[0] }]} />
                      <Image 
                        source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} 
                        style={styles.shortsImage}
                        resizeMode="cover"
                      />
                      <View style={styles.shortsOverlay}>
                        <View style={[styles.shortsPlayButton, { backgroundColor: colors[1] }]}>
                          <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="#fff" />
                        </View>
                      </View>
                      <View style={styles.shortsContent}>
                        <Text style={[styles.shortsTitle, isPlaying && { color: colors[0] }]} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={styles.shortsArtist} numberOfLines={1}>
                          {item.artists?.map((a: any) => a.name).join(', ') || 'Unknown'}
                        </Text>
                        <View style={styles.shortsStats}>
                          <Ionicons name="musical-note" size={12} color={colors[0]} />
                          <Text style={[styles.shortsViews, { color: colors[0] }]}>Trending</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.shortsContainer}
              />
            </View>
          );
        }
        
        // Special handling for listen again section - Vinyl record style
        if (section.title?.toLowerCase().includes('listen') && section.title?.toLowerCase().includes('again')) {
          return (
            <View key={`listen-again-${index}`} style={styles.listenAgainSection}>
              <View style={styles.listenAgainHeader}>
                <View style={styles.listenAgainTitleContainer}>
                  <Ionicons name="refresh-circle" size={24} color="#9b59b6" />
                  <Text style={styles.listenAgainTitle}>{section.title}</Text>
                </View>
              </View>
              <FlashList
                horizontal
                data={section.items.slice(0, 10)}
                keyExtractor={(item) => `${item.id}-listen-${index}`}
                estimatedItemSize={160}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item, index: itemIndex }) => {
                  const colors = [`hsl(${280 + (itemIndex * 20)}, 60%, 50%)`, `hsl(${280 + (itemIndex * 20)}, 60%, 30%)`];
                  return (
                    <TouchableOpacity
                      style={styles.vinylCard}
                      onPress={() => {
                        if (item.type === 'album') {
                          navigation.getParent()?.navigate('Album', { albumId: item.id });
                        } else if (item.type === 'playlist') {
                          navigation.getParent()?.navigate('Playlist', { playlistId: item.id });
                        }
                      }}
                    >
                      <View style={[styles.vinylRecord, { borderColor: colors[0] }]}>
                        <Image 
                          source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} 
                          style={styles.vinylImage}
                          resizeMode="cover"
                        />
                        <View style={[styles.vinylCenter, { backgroundColor: colors[1] }]}>
                          <View style={styles.vinylHole} />
                        </View>
                        <View style={[styles.vinylGlow, { shadowColor: colors[0] }]} />
                      </View>
                      <View style={styles.vinylContent}>
                        <Text style={styles.vinylTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={[styles.vinylSubtitle, { color: colors[0] }]} numberOfLines={1}>
                          {item.subtitle || 'Recently Played'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.listenAgainContainer}
              />
            </View>
          );
        }
        
        // Special handling for artist sections - Holographic card style
        if (section.title?.toLowerCase().includes('artist') || section.title?.toLowerCase().includes('similar')) {
          return (
            <View key={`artist-section-${index}`} style={styles.artistSection}>
              <View style={styles.artistHeader}>
                <View style={styles.artistTitleContainer}>
                  <Ionicons name="people-circle" size={24} color="#00d4aa" />
                  <Text style={styles.artistTitle}>{section.title}</Text>
                </View>
              </View>
              <FlashList
                horizontal
                data={section.items.slice(0, 10)}
                keyExtractor={(item) => `${item.id}-artist-${index}`}
                estimatedItemSize={140}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item, index: itemIndex }) => {
                  const hueShift = (itemIndex * 45) % 360;
                  const colors = [`hsl(${180 + hueShift}, 70%, 50%)`, `hsl(${180 + hueShift + 60}, 70%, 40%)`];
                  return (
                    <TouchableOpacity
                      style={styles.holoCard}
                      onPress={() => {
                        if (item.type === 'artist') {
                          navigation.getParent()?.navigate('Artist', { artistId: item.id });
                        }
                      }}
                    >
                      <View style={[styles.holoFrame, { borderColor: colors[0], shadowColor: colors[1] }]}>
                        <View style={[styles.holoShimmer, { backgroundColor: colors[0] }]} />
                        <Image 
                          source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} 
                          style={styles.holoImage}
                          resizeMode="cover"
                        />
                        <View style={[styles.holoGradient, { backgroundColor: colors[1] }]} />
                        <View style={styles.holoBadge}>
                          <Ionicons name="star" size={12} color="#fff" />
                        </View>
                      </View>
                      <View style={styles.holoContent}>
                        <Text style={styles.holoName} numberOfLines={2}>
                          {item.name || item.title}
                        </Text>
                        <Text style={[styles.holoLabel, { color: colors[0] }]} numberOfLines={1}>
                          Artist
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.artistContainer}
              />
            </View>
          );
        }
        
        // Special handling for fresh minds old favourites - only liked music
        if (section.title?.toLowerCase().includes('fresh') && section.title?.toLowerCase().includes('mind')) {
          const likedItems = section.items.filter((item: any) => item.liked === true || item.type === 'song');
          return (
            <View key={index} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.subtitle && (
                  <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
                )}
              </View>
              <FlashList
                horizontal
                data={likedItems.slice(0, 15)}
                keyExtractor={(item) => `${item.id}-${item.type}-${index}`}
                estimatedItemSize={getSectionItemSize(section)}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => renderSectionItem({ item, sectionType: getSectionType(section) })}
                contentContainerStyle={styles.horizontalList}
              />
            </View>
          );
        }
        
        // Special handling for mixed for you section - Enhanced mix cards
        if (section.title?.toLowerCase().includes('mixed') && section.title?.toLowerCase().includes('you')) {
          return (
            <View key={`mixed-section-${index}`} style={styles.godMixedSection}>
              <View style={styles.godMixedHeader}>
                <Text style={styles.godMixedTitle}>{section.title}</Text>
              </View>
              <FlashList
                horizontal
                data={section.items.slice(0, 10)}
                keyExtractor={(item) => `${item.id}-mixed-${index}`}
                estimatedItemSize={260}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item, index: itemIndex }) => {
                  const godColors = [`hsl(${(itemIndex * 51 + 320) % 360}, 90%, 65%)`, `hsl(${(itemIndex * 51 + 200) % 360}, 90%, 45%)`];
                  const luxuryPatterns = ['✨', '♥', '★', '◆', '♠', '♣', '♦', '♥'];
                  const pattern = luxuryPatterns[itemIndex % luxuryPatterns.length];
                  
                  return (
                    <TouchableOpacity 
                      style={styles.godMixedCard} 
                      onPress={() => {
                        if (item.type === 'playlist') {
                          navigation.getParent()?.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
                        }
                      }}
                    >
                      <View style={[styles.godMixedFrame, { 
                        borderColor: godColors[0], 
                        shadowColor: godColors[1]
                      }]}>
                        <View style={[styles.godMixedGeneratedArt, { backgroundColor: godColors[0] }]}>
                          <View style={[styles.godMixedPattern, { backgroundColor: godColors[1] }]}>
                            <Text style={styles.godMixedPatternText}>{pattern}</Text>
                          </View>
                          <View style={[styles.godMixedGradientOverlay, { backgroundColor: godColors[1] }]} />
                          <View style={styles.godMixedTitleOverlay}>
                            <Text style={styles.godMixedTitleText} numberOfLines={2}>{item.title}</Text>
                          </View>
                          <View style={styles.godMixedLuxurySparkles}>
                            {[...Array(6)].map((_, i) => (
                              <View key={i} style={[styles.godLuxurySparkle, { 
                                backgroundColor: godColors[1], 
                                top: `${15 + i * 12}%`, 
                                left: `${10 + i * 15}%`
                              }]} />
                            ))}
                          </View>
                        </View>
                      </View>
                      <View style={styles.godMixedControls}>
                        <View style={[styles.godMixedPlayButton, { backgroundColor: godColors[1] }]}>
                          <Ionicons name="play" size={24} color="#fff" />
                        </View>
                      </View>
                      <View style={styles.godMixedContent}>
                        <Text style={styles.godMixedCardTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={[styles.godMixedCardSubtitle, { color: godColors[0] }]} numberOfLines={1}>
                          Personal Mix
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.godMixedContainer}
              />
            </View>
          );
        }
        
        // Special handling for trending sections - Custom styled section
        if (getSectionType(section) === 'trending') {
          return (
            <View key={`trending-section-${index}`} style={styles.trendingSection}>
              <View style={styles.trendingSectionHeader}>
                <View style={styles.trendingTitleContainer}>
                  <Ionicons name="trending-up" size={24} color="#ff6b35" />
                  <Text style={styles.trendingSectionTitle}>{section.title}</Text>
                </View>
              </View>
              <FlashList
                horizontal
                data={section.items.slice(0, 10)}
                keyExtractor={(item) => `${item.id}-trending-${index}`}
                estimatedItemSize={240}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => renderSectionItem({ item, sectionType: 'trending' })}
                contentContainerStyle={styles.trendingContainer}
              />
            </View>
          );
        }
        
        // Special handling for forgotten favs sections - Custom styled section
        if (getSectionType(section) === 'forgottenFavs') {
          return (
            <View key={`forgotten-section-${index}`} style={styles.forgottenSection}>
              <View style={styles.forgottenSectionHeader}>
                <View style={styles.forgottenTitleContainer}>
                  <Ionicons name="library" size={24} color="#8e44ad" />
                  <Text style={styles.forgottenSectionTitle}>{section.title}</Text>
                </View>
              </View>
              <FlashList
                horizontal
                data={section.items.slice(0, 10)}
                keyExtractor={(item) => `${item.id}-forgotten-${index}`}
                estimatedItemSize={200}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => renderSectionItem({ item, sectionType: 'forgottenFavs' })}
                contentContainerStyle={styles.forgottenContainer}
              />
            </View>
          );
        }
        
        // Special handling for covers sections - Custom styled section
        if (getSectionType(section) === 'covers') {
          return (
            <View key={`covers-section-${index}`} style={styles.coversSection}>
              <View style={styles.coversSectionHeader}>
                <View style={styles.coversTitleContainer}>
                  <Ionicons name="musical-notes" size={24} color="#ff9500" />
                  <Text style={styles.coversSectionTitle}>{section.title}</Text>
                </View>
              </View>
              <FlashList
                horizontal
                data={section.items.slice(0, 10)}
                keyExtractor={(item) => `${item.id}-covers-${index}`}
                estimatedItemSize={180}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => renderSectionItem({ item, sectionType: 'covers' })}
                contentContainerStyle={styles.coversContainer}
              />
            </View>
          );
        }
        
        // Special handling for mixes section - God-level mix cards
        if (getSectionType(section) === 'mixes') {
          return (
            <View key={`mixes-section-${index}`} style={styles.mixesSection}>
              <View style={styles.mixesHeader}>
                <View style={styles.mixesTitleContainer}>
                  <Ionicons name="disc" size={24} color="#ff9500" />
                  <Text style={styles.mixesTitle}>{section.title}</Text>
                </View>
              </View>
              <FlashList
                horizontal
                data={section.items.slice(0, 10)}
                keyExtractor={(item) => `${item.id}-mixes-${index}`}
                estimatedItemSize={200}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item, index: itemIndex }) => {
                  const gradientColors = [`hsl(${Math.abs(item.id?.hashCode() || 0) % 360}, 85%, 55%)`, `hsl(${(Math.abs(item.id?.hashCode() || 0) + 120) % 360}, 85%, 35%)`];
                  const mixPatterns = ['▲', '●', '■', '♦', '★', '▼', '◆', '♪'];
                  const pattern = mixPatterns[Math.abs(item.id?.hashCode() || 0) % mixPatterns.length];
                  
                  return (
                    <TouchableOpacity 
                      style={[styles.godMixCard, { transform: [{ rotate: `${Math.sin(itemIndex) * 4}deg` }] }]} 
                      onPress={() => {
                        if (item.type === 'playlist') {
                          navigation.getParent()?.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
                        }
                      }}
                    >
                      <View style={[styles.godMixFrame, { borderColor: gradientColors[0], shadowColor: gradientColors[1] }]}>
                        <View style={[styles.godGeneratedArt, { backgroundColor: gradientColors[0] }]}>
                          <View style={[styles.godMixPattern, { backgroundColor: gradientColors[1] }]}>
                            <Text style={styles.godPatternText}>{pattern}</Text>
                          </View>
                          <View style={[styles.godMixOverlay, { backgroundColor: gradientColors[1] }]} />
                          <View style={styles.godMixTitleOverlay}>
                            <Text style={styles.godMixTitleText} numberOfLines={2}>{item.title}</Text>
                          </View>
                          <View style={styles.godMixSparkles}>
                            {[...Array(6)].map((_, i) => (
                              <View key={i} style={[styles.godSparkle, { 
                                backgroundColor: gradientColors[1], 
                                top: `${10 + i * 12}%`, 
                                left: `${5 + i * 15}%`
                              }]} />
                            ))}
                          </View>
                        </View>
                        <View style={[styles.godMixGlow, { backgroundColor: gradientColors[0] }]} />
                      </View>
                      <View style={styles.godMixOverlayControls}>
                        <View style={[styles.godMixPlayButton, { backgroundColor: gradientColors[1] }]}>
                          <Ionicons name="play" size={24} color="#fff" />
                        </View>
                        <View style={styles.godMixBadge}>
                          <Ionicons name="musical-notes" size={14} color="#fff" />
                        </View>
                      </View>
                      <View style={styles.godMixContent}>
                        <Text style={styles.godMixTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text style={[styles.godMixSubtitle, { color: gradientColors[0] }]} numberOfLines={1}>
                          Premium Mix
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.mixesContainer}
              />
            </View>
          );
        }
        
        // Regular section rendering
        return (
          <View key={index} style={styles.section}>
            <View style={styles.sectionHeader}>
              <TouchableOpacity onPress={() => console.log('Section clicked:', section.title, 'Type:', getSectionType(section))}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.subtitle && (
                  <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
                )}
              </TouchableOpacity>
            </View>
            <FlashList
              horizontal
              data={section.items.slice(0, 15)}
              keyExtractor={(item) => `${item.id}-${item.type}-${index}`}
              estimatedItemSize={getSectionItemSize(section)}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => renderSectionItem({ item, sectionType: getSectionType(section) })}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        );
        return null;
      }}
    />

    <SongOptionsModal
      visible={modalVisible}
      onClose={hideOptions}
      song={selectedSong}
      showDeleteOption={false}
      navigation={navigation.getParent()}
    />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  quickPicksSection: { marginBottom: 16 },
  quickPicksGrid: { paddingLeft: 16 },
  quickPicksRow: { flexDirection: 'row' },
  quickPickItem: { flexDirection: 'row', alignItems: 'center', width: ITEM_WIDTH, height: ITEM_HEIGHT, paddingRight: 8, marginBottom: 4 },
  quickPickThumb: { width: 56, height: 56, borderRadius: 4 },
  quickPickInfo: { flex: 1, marginLeft: 12 },
  quickPickTitle: { fontSize: 14, color: '#fff', fontWeight: '500' },
  quickPickArtist: { fontSize: 12, color: '#aaa', marginTop: 2 },
  section: { marginBottom: 24 },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
  sectionSubtitle: { fontSize: 14, color: '#aaa', marginTop: 2, fontWeight: '500' },
  horizontalList: { paddingLeft: 16 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8 },
  gridItem: { width: '48%' },
  card: { width: 160, marginRight: 12 },
  cardImage: { width: 160, height: 160, borderRadius: 8 },
  roundImage: { borderRadius: 80 },
  cardTitle: { fontSize: 14, color: '#fff', fontWeight: '500', marginTop: 8, lineHeight: 18 },
  cardArtist: { fontSize: 12, color: '#aaa', marginTop: 4 },
  activeText: { color: '#1db954' },
  // Song card styles
  songCard: { width: 130, marginRight: 12, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  songCardImageContainer: { position: 'relative' },
  songCardImage: { width: '100%', height: 80 },
  songCardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 30, backgroundColor: 'rgba(0,0,0,0.6)' },
  songCardContent: { padding: 8, backgroundColor: 'rgba(26,26,26,0.9)' },
  songCardTitle: { fontSize: 13, color: '#fff', fontWeight: '600', lineHeight: 16 },
  songCardArtist: { fontSize: 11, color: '#aaa', marginTop: 2 },
  // Mix card styles
  mixCard: { width: 170, marginRight: 12, position: 'relative', borderRadius: 16, overflow: 'hidden' },
  mixCardImageContainer: { position: 'relative' },
  mixCardImage: { width: '100%', height: 170 },
  generatedMixArt: {
    width: '100%',
    height: 170,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mixPattern: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  mixPatternText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '900',
  },
  mixGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    opacity: 0.4,
  },
  mixTitle: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
  },
  mixTitleText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  mixGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3 },
  mixOverlay: { position: 'absolute', top: 12, right: 12, alignItems: 'flex-end', gap: 8 },
  mixPlayButton: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  mixBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    padding: 6,
  },
  mixCardContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: 'rgba(0,0,0,0.8)' },
  mixCardTitle: { fontSize: 14, color: '#fff', fontWeight: '700' },
  mixCardSubtitle: { fontSize: 11, color: '#ccc', marginTop: 2, fontWeight: '500' },
  // Enhanced default card styles
  cardImageContainer: { position: 'relative' },
  artistCard: { backgroundColor: 'rgba(26,26,26,0.5)', borderRadius: 12, padding: 8 },
  artistBadge: { position: 'absolute', bottom: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#1db954', justifyContent: 'center', alignItems: 'center' },
  playingIndicator: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#1db954' },
  // Trending card styles
  trendingCard: { width: 190, marginRight: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1a1a1a', position: 'relative' },
  trendingImageContainer: { position: 'relative' },
  trendingImage: { width: '100%', height: 120 },
  trendingBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#ff6b35', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  trendingGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, backgroundColor: 'rgba(255,107,53,0.2)' },
  trendingContent: { padding: 12 },
  trendingTitle: { fontSize: 15, color: '#fff', fontWeight: '700', lineHeight: 18 },
  trendingSubtitle: { fontSize: 12, color: '#ff6b35', marginTop: 4, fontWeight: '500' },
  // Personal playlist styles
  personalCard: { width: 150, marginRight: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#2a1a2a' },
  personalImageContainer: { position: 'relative' },
  personalImage: { width: '100%', height: 100 },
  personalOverlay: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, padding: 4 },
  personalContent: { padding: 10 },
  personalTitle: { fontSize: 14, color: '#fff', fontWeight: '600', lineHeight: 16 },
  personalSubtitle: { fontSize: 11, color: '#ff6b6b', marginTop: 3 },
  // Community styles
  communityCard: { width: 170, marginRight: 12, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1a2a1a' },
  communityImageContainer: { position: 'relative' },
  communityImage: { width: '100%', height: 110 },
  communityBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: '#4ecdc4', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3 },
  communityContent: { padding: 10 },
  communityTitle: { fontSize: 14, color: '#fff', fontWeight: '600', lineHeight: 16 },
  communitySubtitle: { fontSize: 11, color: '#4ecdc4', marginTop: 3 },
  // Shorts card styles
  shortsCard: { width: 110, marginRight: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1a1a1a', position: 'relative' },
  shortsImageContainer: { position: 'relative' },
  shortsImage: { width: '100%', height: 140, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  shortsBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 8, padding: 4 },
  shortsGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 30, backgroundColor: 'rgba(0,0,0,0.6)' },
  shortsContent: { padding: 8, height: 50, justifyContent: 'center' },
  shortsTitle: { fontSize: 12, color: '#fff', fontWeight: '600', lineHeight: 14 },
  shortsArtist: { fontSize: 10, color: '#aaa', marginTop: 2 },
  // TikTok-style shorts section
  shortsSection: { 
    marginBottom: 32,
    backgroundColor: 'rgba(255,107,53,0.05)',
    borderRadius: 16,
    marginHorizontal: 16,
    paddingVertical: 20,
  },
  shortsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  shortsTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shortsSectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
  },
  shortsViewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,107,53,0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.3)',
  },
  shortsViewAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff6b35',
  },
  shortsContainer: { paddingLeft: 20, paddingRight: 8 },
  // Listen Again vinyl section
  listenAgainSection: {
    marginBottom: 32,
    backgroundColor: 'rgba(155,89,182,0.08)',
    borderRadius: 16,
    marginHorizontal: 16,
    paddingVertical: 20,
  },
  listenAgainHeader: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  listenAgainTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listenAgainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
  },
  listenAgainContainer: { paddingLeft: 20, paddingRight: 8 },
  vinylCard: { width: 140, marginRight: 16, alignItems: 'center' },
  vinylRecord: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  vinylImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    position: 'absolute',
  },
  vinylCenter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  vinylHole: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#000',
  },
  vinylGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  vinylContent: { marginTop: 12, alignItems: 'center' },
  vinylTitle: { fontSize: 14, color: '#fff', fontWeight: '600', textAlign: 'center', lineHeight: 16 },
  vinylSubtitle: { fontSize: 11, marginTop: 4, fontWeight: '500', textAlign: 'center' },
  // Artist holographic section
  artistSection: {
    marginBottom: 32,
    backgroundColor: 'rgba(0,212,170,0.06)',
    borderRadius: 16,
    marginHorizontal: 16,
    paddingVertical: 20,
  },
  artistHeader: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  artistTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  artistTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
  },
  artistContainer: { paddingLeft: 20, paddingRight: 8 },
  holoCard: { width: 120, marginRight: 16, alignItems: 'center' },
  holoFrame: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  holoShimmer: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 40,
    height: 140,
    opacity: 0.3,
    transform: [{ rotate: '45deg' }],
  },
  holoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  holoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    opacity: 0.4,
  },
  holoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    padding: 3,
  },
  holoContent: { marginTop: 8, alignItems: 'center' },
  holoName: { fontSize: 13, color: '#fff', fontWeight: '700', textAlign: 'center', lineHeight: 15 },
  holoLabel: { fontSize: 10, marginTop: 3, fontWeight: '600', textAlign: 'center' },
  // Quick Picks vibrant section
  quickPicksSection: {
    marginBottom: 32,
    backgroundColor: 'rgba(231,76,60,0.08)',
    borderRadius: 16,
    marginHorizontal: 16,
    paddingVertical: 20,
  },
  quickPicksHeader: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  quickPicksTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickPicksSectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
  },
  quickPicksContainer: { paddingLeft: 20, paddingRight: 8 },
  quickPickCard: {
    width: 140,
    height: 180,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
  },
  quickPickGradientBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.9 },
  quickPickImage: { width: '100%', height: '55%' },
  quickPickOverlay: { position: 'absolute', top: 8, right: 8 },
  quickPickPlayButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  quickPickContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  quickPickTitle: { fontSize: 12, color: '#fff', fontWeight: '700', lineHeight: 14 },
  quickPickArtist: { fontSize: 10, color: '#ccc', marginTop: 2 },
  quickPickStats: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  quickPickLabel: { fontSize: 9, fontWeight: '600' },
  // My Playlist cards - Neon frame style
  myPlaylistCard: { width: 160, marginRight: 12, alignItems: 'center' },
  myPlaylistFrame: {
    width: 140,
    height: 140,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e91e63',
    backgroundColor: '#1a1a1a',
  },
  myPlaylistImage: { width: '100%', height: '100%', borderRadius: 10 },
  myPlaylistGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 22,
    backgroundColor: '#e91e63',
    opacity: 0.2,
    zIndex: -1,
  },
  myPlaylistBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#e91e63',
    borderRadius: 8,
    padding: 4,
  },
  myPlaylistContent: { marginTop: 8, alignItems: 'center' },
  myPlaylistTitle: { fontSize: 14, color: '#fff', fontWeight: '600', textAlign: 'center', lineHeight: 16 },
  myPlaylistSubtitle: { fontSize: 11, color: '#e91e63', marginTop: 3, fontWeight: '500' },
  // Community Playlist cards - Hexagonal pattern style
  communityPlaylistCard: { width: 180, marginRight: 12, alignItems: 'center' },
  communityPlaylistFrame: {
    width: 160,
    height: 160,
    borderRadius: 16,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    transform: [{ rotate: '2deg' }],
  },
  communityPlaylistImage: { width: '100%', height: '100%', borderRadius: 14 },
  communityPlaylistPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(52,152,219,0.15)',
    borderRadius: 14,
  },
  communityPlaylistBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#3498db',
    borderRadius: 10,
    padding: 4,
  },
  communityStats: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  communityStatsText: { fontSize: 9, color: '#fff', fontWeight: '600' },
  communityPlaylistContent: { marginTop: 8, alignItems: 'center' },
  communityPlaylistTitle: { fontSize: 14, color: '#fff', fontWeight: '600', textAlign: 'center', lineHeight: 16 },
  communityPlaylistSubtitle: { fontSize: 11, color: '#3498db', marginTop: 3, fontWeight: '500' },
  // New Releases - Starburst style
  newReleaseCard: { width: 190, marginRight: 12, alignItems: 'center' },
  newReleaseFrame: { width: 170, height: 170, borderRadius: 20, position: 'relative', overflow: 'hidden', backgroundColor: '#1a1a1a' },
  newReleaseImage: { width: '100%', height: '100%', borderRadius: 18 },
  newReleaseBurst: { position: 'absolute', top: 8, right: 8, backgroundColor: '#f39c12', borderRadius: 12, padding: 6, transform: [{ rotate: '15deg' }] },
  newReleaseGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 50, backgroundColor: 'rgba(243,156,18,0.3)' },
  newReleaseTitle: { fontSize: 14, color: '#fff', fontWeight: '700', textAlign: 'center', marginTop: 8, lineHeight: 16 },
  newReleaseSubtitle: { fontSize: 11, color: '#f39c12', marginTop: 3, fontWeight: '600' },
  // Charts - Fire ranking style
  chartCard: { width: 170, marginRight: 12, alignItems: 'center' },
  chartFrame: { width: 150, height: 150, borderRadius: 16, position: 'relative', overflow: 'hidden', backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#ff4757' },
  chartImage: { width: '100%', height: '100%', borderRadius: 14 },
  chartRank: { position: 'absolute', top: 6, left: 6, backgroundColor: '#ff4757', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  chartRankText: { fontSize: 12, color: '#fff', fontWeight: '900' },
  chartFire: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 8, padding: 4 },
  chartTitle: { fontSize: 14, color: '#fff', fontWeight: '700', textAlign: 'center', marginTop: 8, lineHeight: 16 },
  chartSubtitle: { fontSize: 11, color: '#ff4757', marginTop: 3, fontWeight: '600' },
  // Albums For You - Heart pulse style
  albumForYouCard: { width: 180, marginRight: 12, alignItems: 'center' },
  albumForYouFrame: { width: 160, height: 160, borderRadius: 18, position: 'relative', overflow: 'hidden', backgroundColor: '#1a1a1a' },
  albumForYouImage: { width: '100%', height: '100%', borderRadius: 16 },
  albumForYouHeart: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,107,107,0.9)', borderRadius: 8, padding: 4 },
  albumForYouShine: { position: 'absolute', top: -20, right: -20, width: 60, height: 60, backgroundColor: '#ff6b6b', borderRadius: 30, opacity: 0.2 },
  albumForYouTitle: { fontSize: 14, color: '#fff', fontWeight: '700', textAlign: 'center', marginTop: 8, lineHeight: 16 },
  albumForYouSubtitle: { fontSize: 11, color: '#ff6b6b', marginTop: 3, fontWeight: '600' },
  // Long Listens - Wave ripple style
  longListenCard: { width: 210, marginRight: 12, alignItems: 'center' },
  longListenFrame: { width: 190, height: 190, borderRadius: 22, position: 'relative', overflow: 'hidden', backgroundColor: '#1a1a1a' },
  longListenImage: { width: '100%', height: '100%', borderRadius: 20 },
  longListenClock: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255,167,38,0.9)', borderRadius: 10, padding: 6 },
  longListenWaves: { position: 'absolute', bottom: 10, left: 10 },
  waveRing: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#ffa726', position: 'absolute' },
  longListenTitle: { fontSize: 14, color: '#fff', fontWeight: '700', textAlign: 'center', marginTop: 8, lineHeight: 16 },
  longListenSubtitle: { fontSize: 11, color: '#ffa726', marginTop: 3, fontWeight: '600' },
  // Galaxy-level forgotten favs
  galaxyCard: { 
    width: 180, 
    marginRight: 16, 
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 30,
  },
  galaxyFrame: {
    borderRadius: 24,
    borderWidth: 4,
    overflow: 'hidden',
    position: 'relative',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1.0,
    shadowRadius: 40,
  },
  galaxyArt: {
    width: '100%',
    height: 180,
    position: 'relative',
    borderRadius: 20,
  },
  galaxyImage: { width: '100%', height: '100%', borderRadius: 20 },
  galaxyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.3,
    borderRadius: 20,
  },
  galaxyPattern: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.9,
  },
  galaxyPatternText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '900',
  },
  galaxyStars: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  galaxyStar: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.8,
  },
  galaxyNebula: {
    position: 'absolute',
    bottom: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.2,
  },
  galaxyContent: {
    marginTop: 12,
    alignItems: 'center',
  },
  galaxyTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
  },
  galaxySubtitle: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Quantum universe owner default cards
  quantumCard: { 
    width: 190, 
    marginRight: 16, 
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.9,
    shadowRadius: 40,
    elevation: 40,
  },
  quantumArtistCard: { alignItems: 'center' },
  quantumFrame: {
    borderRadius: 28,
    borderWidth: 5,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.08)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1.0,
    shadowRadius: 50,
  },
  quantumDimension: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.15,
    borderRadius: 23,
  },
  quantumImage: { width: 190, height: 190, borderRadius: 23 },
  quantumRoundImage: { width: 140, height: 140, borderRadius: 70 },
  quantumAura: {
    position: 'absolute',
    top: 15,
    left: 15,
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.4,
    transform: [{ rotate: '45deg' }],
  },
  quantumArtistBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  quantumConstellation: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  quantumStar: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.9,
  },
  quantumVortex: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.2,
  },
  quantumContent: { marginTop: 12, alignItems: 'center' },
  quantumTitle: { fontSize: 16, color: '#fff', fontWeight: '800', textAlign: 'center', lineHeight: 18 },
  quantumSubtitle: { fontSize: 13, marginTop: 4, fontWeight: '600', textAlign: 'center' },
  quantumPlayingIndicator: { position: 'absolute', top: 12, left: 12, width: 12, height: 12, borderRadius: 6 },
  // Music Channels - Radio signal style
  channelCard: { width: 150, marginRight: 12, alignItems: 'center' },
  channelFrame: { width: 130, height: 130, borderRadius: 65, position: 'relative', overflow: 'hidden', backgroundColor: '#1a1a1a', borderWidth: 3, borderColor: '#00d4aa' },
  channelImage: { width: '100%', height: '100%', borderRadius: 62 },
  channelSignal: { position: 'absolute', top: 8, right: 8, backgroundColor: '#00d4aa', borderRadius: 8, padding: 4 },
  channelPulse: { position: 'absolute', top: -10, left: -10, right: -10, bottom: -10, borderRadius: 75, borderWidth: 2, borderColor: '#00d4aa', opacity: 0.3 },
  channelTitle: { fontSize: 13, color: '#fff', fontWeight: '600', textAlign: 'center', marginTop: 8, lineHeight: 15 },
  channelSubtitle: { fontSize: 10, color: '#00d4aa', marginTop: 3, fontWeight: '600' },
  // Mixed for You section
  mixedSection: {
    marginBottom: 32,
    backgroundColor: 'rgba(156,39,176,0.08)',
    borderRadius: 16,
    marginHorizontal: 16,
    paddingVertical: 20,
  },
  mixedHeader: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  mixedTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mixedTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
  },
  mixedContainer: { paddingLeft: 20, paddingRight: 8 },
  enhancedMixCard: { width: 170, marginRight: 12, position: 'relative', borderRadius: 16, overflow: 'hidden' },
  enhancedMixImageContainer: { position: 'relative' },
  enhancedMixImage: { width: '100%', height: 170 },
  enhancedMixGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3 },
  enhancedMixOverlay: { position: 'absolute', top: 12, right: 12, alignItems: 'flex-end', gap: 8 },
  enhancedMixPlayButton: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  enhancedMixBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    padding: 6,
  },
  enhancedMixContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: 'rgba(0,0,0,0.8)' },
  enhancedMixTitle: { fontSize: 14, color: '#fff', fontWeight: '700' },
  enhancedMixSubtitle: { fontSize: 11, color: '#9c27b0', marginTop: 2, fontWeight: '500' },
  // God-level trending cards
  trendingCard: { 
    width: 200, 
    height: 240,
    marginRight: 16, 
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },
  trendingGlowBorder: {
    borderRadius: 20,
    borderWidth: 3,
    overflow: 'hidden',
    position: 'relative',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 25,
  },
  trendingImage: { width: '100%', height: 140, borderRadius: 17 },
  trendingHologram: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.15,
    borderRadius: 17,
  },
  trendingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,69,0,0.9)',
    borderRadius: 12,
    padding: 6,
    shadowColor: '#ff4500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  trendingPulse: {
    position: 'absolute',
    top: -15,
    left: -15,
    right: -15,
    bottom: -15,
  },
  pulseRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 35,
    borderWidth: 2,
    opacity: 0.4,
  },
  trendingContent: { padding: 12, alignItems: 'center' },
  trendingTitle: { fontSize: 15, color: '#fff', fontWeight: '800', textAlign: 'center', lineHeight: 18 },
  trendingSubtitle: { fontSize: 12, marginTop: 4, fontWeight: '600', textAlign: 'center' },
  trendingStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  trendingViews: { fontSize: 10, fontWeight: '700' },
  // Crystal morphism default cards
  crystalCard: { 
    width: 170, 
    marginRight: 12, 
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 15,
  },
  crystalArtistCard: { alignItems: 'center' },
  crystalFrame: {
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.05)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  crystalGlass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
    borderRadius: 14,
  },
  crystalImage: { width: 170, height: 170, borderRadius: 14 },
  crystalRoundImage: { width: 120, height: 120, borderRadius: 60 },
  crystalReflection: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.3,
    transform: [{ rotate: '45deg' }],
  },
  crystalArtistBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    borderRadius: 12,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  crystalSparkles: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sparkle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.8,
  },
  crystalContent: { marginTop: 8, alignItems: 'center' },
  crystalTitle: { fontSize: 14, color: '#fff', fontWeight: '700', textAlign: 'center', lineHeight: 16 },
  crystalSubtitle: { fontSize: 12, marginTop: 3, fontWeight: '500', textAlign: 'center' },
  crystalPlayingIndicator: { position: 'absolute', top: 8, left: 8, width: 10, height: 10, borderRadius: 5 },
  // Trending section
  trendingSection: {
    marginBottom: 32,
    backgroundColor: 'rgba(255,107,53,0.08)',
    borderRadius: 20,
    marginHorizontal: 16,
    paddingVertical: 24,
  },
  trendingSectionHeader: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  trendingTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trendingSectionTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  trendingContainer: { paddingLeft: 24, paddingRight: 12, paddingTop: 20 },
  // Forgotten favs section
  forgottenSection: {
    marginBottom: 32,
    backgroundColor: 'rgba(142,68,173,0.08)',
    borderRadius: 20,
    marginHorizontal: 16,
    paddingVertical: 24,
  },
  forgottenSectionHeader: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  forgottenTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  forgottenSectionTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  forgottenContainer: { paddingLeft: 24, paddingRight: 12 },
  // Covers section
  coversSection: {
    marginBottom: 32,
    backgroundColor: 'rgba(255,149,0,0.08)',
    borderRadius: 20,
    marginHorizontal: 16,
    paddingVertical: 24,
  },
  coversSectionHeader: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  coversTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coversSectionTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  coversContainer: { paddingLeft: 24, paddingRight: 12 },
  coverCard: { width: 160, marginRight: 12, alignItems: 'center' },
  coverFrame: { width: 140, height: 140, borderRadius: 12, position: 'relative', overflow: 'hidden', backgroundColor: '#1a1a1a' },
  coverImage: { width: '100%', height: '100%', borderRadius: 10 },
  coverBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#ff9500', borderRadius: 8, padding: 4 },
  coverContent: { marginTop: 8, alignItems: 'center' },
  coverTitle: { fontSize: 14, color: '#fff', fontWeight: '600', textAlign: 'center', lineHeight: 16 },
  coverSubtitle: { fontSize: 11, color: '#ff9500', marginTop: 3, fontWeight: '500' },
  // God-level mixes section
  mixesSection: {
    marginBottom: 32,
    backgroundColor: 'rgba(255,149,0,0.08)',
    borderRadius: 20,
    marginHorizontal: 16,
    paddingVertical: 24,
  },
  mixesHeader: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  mixesTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mixesTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  mixesContainer: { paddingLeft: 24, paddingRight: 12 },
  godMixCard: { 
    width: 190, 
    marginRight: 20, 
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.7,
    shadowRadius: 25,
    elevation: 25,
  },
  godMixFrame: {
    borderRadius: 24,
    borderWidth: 3,
    overflow: 'hidden',
    position: 'relative',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 30,
  },
  godMixImage: { width: '100%', height: 190, borderRadius: 21 },
  godGeneratedArt: {
    width: '100%',
    height: 190,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 21,
  },
  godMixPattern: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  godPatternText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '900',
  },
  godMixOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    opacity: 0.6,
    borderBottomLeftRadius: 21,
    borderBottomRightRadius: 21,
  },
  godMixTitleOverlay: {
    position: 'absolute',
    bottom: 15,
    left: 15,
    right: 15,
  },
  godMixTitleText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  godMixSparkles: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  godSparkle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.7,
  },
  godMixGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.2,
    borderRadius: 21,
  },
  godMixOverlayControls: {
    position: 'absolute',
    top: 15,
    right: 15,
    alignItems: 'flex-end',
    gap: 12,
  },
  godMixPlayButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  godMixBadge: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    padding: 8,
  },
  godMixContent: {
    marginTop: 12,
    alignItems: 'center',
  },
  godMixTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
  },
  godMixSubtitle: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },
  // God-level Mixed for You section
  godMixedSection: {
    marginBottom: 32,
    backgroundColor: 'rgba(233,30,99,0.08)',
    borderRadius: 16,
    marginHorizontal: 16,
    paddingVertical: 20,
  },
  godMixedHeader: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  godMixedTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
  },
  godMixedContainer: { paddingLeft: 20, paddingRight: 8 },
  godMixedCard: {
    width: 180,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 15,
  },
  godMixedFrame: {
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
  },
  godMixedGeneratedArt: {
    width: '100%',
    height: 180,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  godMixedPattern: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.9,
  },
  godMixedPatternText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '900',
  },
  godMixedGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    opacity: 0.6,
  },
  godMixedTitleOverlay: {
    position: 'absolute',
    bottom: 15,
    left: 15,
    right: 15,
  },
  godMixedTitleText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  godMixedLuxurySparkles: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  godLuxurySparkle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.7,
  },
  godMixedControls: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  godMixedPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  godMixedContent: {
    marginTop: 8,
    alignItems: 'center',
  },
  godMixedCardTitle: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
  godMixedCardSubtitle: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: '600',
    textAlign: 'center',
  },
  shortsCard: { 
    width: 160, 
    height: 240, 
    marginRight: 16, 
    borderRadius: 20, 
    overflow: 'hidden', 
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 15,
  },
  shortsGradientBg: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    opacity: 0.8 
  },
  shortsImage: { width: '100%', height: '60%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  shortsOverlay: { position: 'absolute', top: 10, right: 10, alignItems: 'center', gap: 8 },
  shortsPlayButton: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  shortsContent: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: 12, 
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  shortsTitle: { fontSize: 13, color: '#fff', fontWeight: '700', lineHeight: 16 },
  shortsArtist: { fontSize: 11, color: '#ccc', marginTop: 2 },
  shortsStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  shortsViews: { fontSize: 10, fontWeight: '600' },
  footer: { padding: 20, alignItems: 'center' },
  skeletonContainer: {
    flex: 1,
    padding: 16,
  },
  skeletonSection: {
    marginBottom: 32,
  },
  skeletonSectionTitle: {
    height: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginBottom: 16,
    width: '60%',
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonCard: {
    width: 160,
  },
  skeletonImage: {
    width: 160,
    height: 160,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  skeletonCardTitle: {
    height: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginTop: 8,
    width: '80%',
  },
  skeletonCardSubtitle: {
    height: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginTop: 4,
    width: '60%',
  },
});
