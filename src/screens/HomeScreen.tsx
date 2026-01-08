import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';
import { Song } from '../types';
import SongOptionsModal from '../components/SongOptionsModal';
import TabHeader from '../components/TabHeader';
import { useSongOptions } from '../hooks/useSongOptions';
import OfflineBanner from '../components/OfflineBanner';
import ErrorState from '../components/ErrorState';

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

export default function HomeScreen({ navigation }: any) {
  const [sections, setSections] = useState<any[]>([]);
  const [continuation, setContinuation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [skeletonSections, setSkeletonSections] = useState(0);
  const { playSong, currentSong } = usePlayer();
  const { modalVisible, selectedSong, showOptions, hideOptions } = useSongOptions();

  useEffect(() => {
    loadHome();
  }, []);

  const loadHome = useCallback(async () => {
    try {
      setError(false);
      const data = await InnerTube.getHome();
      setSections(data.sections);
      setContinuation(data.continuation);
      setLoading(false);
      
      // Load additional sections in background
      if (data.continuation) {
        const moreData = await InnerTube.getHomeContinuation(data.continuation);
        const newSections = moreData.sections.slice(0, 10);
        setSections(prev => [...prev, ...newSections]);
        setContinuation(moreData.continuation);
      }
    } catch (error) {
      setLoading(false);
      setError(true);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(false);
    try {
      const data = await InnerTube.getHome();
      setSections(data.sections);
      setContinuation(data.continuation);
    } catch (error) {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!continuation || loadingMore) return;
    
    setSkeletonSections(5);
    setLoadingMore(true);
    try {
      const data = await InnerTube.getHomeContinuation(continuation);
      const newSections = data.sections.slice(0, 5);
      setSections(prev => [...prev, ...newSections]);
      setContinuation(data.continuation);
    } catch (error) {
      // Error loading more handled silently
    } finally {
      setSkeletonSections(0);
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

  const handleSectionPress = (section: any) => {
    const sectionType = getSectionType(section);
    
    navigation.navigate('SectionView', { 
      sectionTitle: section.title,
      sectionType: sectionType,
      items: section.items 
    });
  };

  const getSectionType = (section: any) => {
    const title = section.title?.toLowerCase() || '';
    if (title.includes('trending') || title.includes('for you')) return 'trending';
    if (title.includes('artist')) return 'artists';
    if (title.includes('daily') && title.includes('discover')) return 'dailyDiscover';
    if (title.includes('long') && title.includes('listen')) return 'longListens';
    if (title.includes('album') && title.includes('you')) return 'albumsForYou';
    if (title.includes('playlist')) return 'playlists';
    if (title.includes('mix')) return 'mixes';
    return 'default';
  };

  const getSectionStyle = (sectionType: string) => {
    switch (sectionType) {
      case 'trending':
        return { color: '#ff6b6b', bg: 'rgba(255, 107, 107, 0.2)' };
      case 'playlists':
        return { color: '#4ecdc4', bg: 'rgba(78, 205, 196, 0.2)' };
      case 'mixes':
        return { color: '#45b7d1', bg: 'rgba(69, 183, 209, 0.2)' };
      case 'dailyDiscover':
        return { color: '#f39c12', bg: 'rgba(243, 156, 18, 0.2)' };
      case 'longListens':
        return { color: '#9b59b6', bg: 'rgba(155, 89, 182, 0.2)' };
      case 'artists':
        return { color: '#e74c3c', bg: 'rgba(231, 76, 60, 0.2)' };
      default:
        return { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.2)' };
    }
  };

  const generateAutoThumbnail = (item: any, sectionType: string) => {
    const gradients = [
      ['#ff6b6b', '#ee5a24'],
      ['#4ecdc4', '#00d2d3'],
      ['#45b7d1', '#3742fa'],
      ['#f39c12', '#e55039'],
      ['#9b59b6', '#8c7ae6'],
      ['#e74c3c', '#c44569']
    ];
    
    const icons = {
      trending: 'trending-up',
      playlists: 'musical-notes',
      mixes: 'disc',
      dailyDiscover: 'sparkles',
      default: 'play-circle'
    };
    
    const gradient = gradients[Math.abs(item.id?.hashCode() || 0) % gradients.length];
    const icon = icons[sectionType] || icons.default;
    
    return (
      <View style={[styles.autoThumbnail, { backgroundColor: gradient[0] }]}>
        <View style={[styles.autoThumbnailGradient, { backgroundColor: gradient[1] }]} />
        <Ionicons name={icon} size={32} color="rgba(255,255,255,0.9)" />
        <Text style={styles.autoThumbnailText} numberOfLines={2}>
          {item.type === 'artist' ? item.name : item.title}
        </Text>
      </View>
    );
  };

  const renderTrendingSection = (section: any, style: any) => (
    <View style={styles.trendingSection}>
      <TouchableOpacity 
        style={[styles.trendingHeader, { backgroundColor: `${style.color}15` }]}
        onPress={() => handleSectionPress(section)}
        activeOpacity={0.7}
      >
        <Text style={styles.trendingTitle}>{section.title}</Text>
        <Text style={[styles.trendingNumber, { color: style.color }]}>#TRENDING</Text>
      </TouchableOpacity>
      {section.items.slice(0, 5).map((item: any, index: number) => (
        <TouchableOpacity 
          key={item.id} 
          style={styles.trendingItem} 
          onPress={() => {
            if (item.type === 'song') {
              playSong(item);
            } else if (item.type === 'album') {
              navigation.navigate('Album', { albumId: item.id });
            } else if (item.type === 'playlist') {
              navigation.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
            }
          }}
        >
          <View style={styles.trendingRank}>
            <Text style={[styles.rankNumber, { color: style.color }]}>{index + 1}</Text>
          </View>
          <View style={styles.trendingImageContainer}>
            <View style={[styles.trendingAutoThumb, { 
              backgroundColor: ['#ff9a9e', '#a8e6cf', '#ffd3a5', '#c2e9fb', '#fbc2eb'][index % 5] 
            }]}>
              <Ionicons name="trending-up" size={20} color="rgba(255,255,255,0.9)" />
            </View>
            {item.thumbnailUrl && item.thumbnailUrl !== '' && (
              <Image source={{ uri: item.thumbnailUrl }} style={styles.trendingImage} />
            )}
          </View>
          <View style={styles.trendingInfo}>
            <Text style={styles.trendingItemTitle} numberOfLines={1}>
              {item.type === 'artist' ? item.name : item.title}
            </Text>
            <Text style={styles.trendingArtist} numberOfLines={1}>
              {item.type === 'song' ? item.artists?.map((a: any) => a.name).join(', ') : item.subtitle}
            </Text>
          </View>
          {item.type === 'song' && (
            <TouchableOpacity style={styles.heartButton} onPress={() => showOptions(item)}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPlaylistSection = (section: any, style: any) => (
    <View style={styles.playlistSection}>
      <View style={styles.playlistHeader}>
        <View style={styles.playlistTitleWrap}>
          <Text style={styles.playlistTitle}>{section.title}</Text>
          <View style={[styles.playlistAccent, { backgroundColor: style.color }]} />
        </View>
        <TouchableOpacity 
          style={[styles.playlistViewAll, { borderColor: `${style.color}40` }]}
          onPress={() => handleSectionPress(section)}
        >
          <Text style={[styles.playlistViewText, { color: style.color }]}>View all</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.playlistGrid}>
        {section.items.slice(0, 2).map((item: any, index: number) => (
          <TouchableOpacity 
            key={item.id}
            style={[styles.playlistCard, index === 0 ? styles.playlistMain : styles.playlistSecondary]}
            onPress={() => navigation.navigate('Playlist', { playlistId: item.id })}
          >
            <View style={[styles.playlistImageContainer, { backgroundColor: `${style.color}15` }]}>
              <Image source={{ uri: item.thumbnailUrl }} style={styles.playlistImage} />
              <View style={[styles.playlistOverlay, { backgroundColor: `${style.color}40` }]} />
              <View style={styles.playlistContent}>
                <View style={[styles.playlistBadge, { backgroundColor: style.color }]}>
                  <Text style={styles.playlistBadgeText}>PLAYLIST</Text>
                </View>
                <Text style={styles.playlistCardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.playlistSubtitle} numberOfLines={1}>
                  {item.subtitle || 'Curated selection'}
                </Text>
              </View>
              <View style={[styles.playlistGlow, { backgroundColor: style.color }]} />
            </View>
          </TouchableOpacity>
        ))}
        
        <View style={styles.playlistMini}>
          {section.items.slice(2, 4).map((item: any) => (
            <TouchableOpacity 
              key={item.id}
              style={styles.playlistMiniCard}
              onPress={() => navigation.navigate('Playlist', { playlistId: item.id })}
            >
              <Image source={{ uri: item.thumbnailUrl }} style={styles.playlistMiniImage} />
              <View style={[styles.playlistMiniOverlay, { backgroundColor: `${style.color}60` }]} />
              <Text style={styles.playlistMiniTitle} numberOfLines={1}>
                {item.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderItem = (item: any, index: number) => {
    const isPlaying = item.type === 'song' && currentSong?.id === item.id;
    const displayTitle = item.type === 'artist' ? item.name : item.title;
    const displaySubtitle = item.type === 'song' 
      ? item.artists?.map((a: any) => a.name).join(', ') 
      : item.subtitle || '';

    // Generate auto artwork if no thumbnail
    const generateArtwork = () => {
      const colors = [
        '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444'
      ];
      const color = colors[Math.abs(item.id?.hashCode() || 0) % colors.length];
      const patterns = ['◆', '◇', '●', '○', '▲', '△', '■', '□'];
      const pattern = patterns[Math.abs(item.id?.hashCode() || 0) % patterns.length];
      
      return (
        <View style={[styles.autoArtwork, { backgroundColor: color }]}>
          <Text style={styles.artworkPattern}>{pattern}</Text>
        </View>
      );
    };

    return (
      <TouchableOpacity
        key={`${item.id}-${index}`}
        style={styles.card}
        onPress={() => {
          if (item.type === 'song') {
            playSong(item);
          } else if (item.type === 'artist') {
            navigation.navigate('Artist', { artistId: item.id });
          } else if (item.type === 'album') {
            navigation.navigate('Album', { albumId: item.id });
          } else if (item.type === 'playlist') {
            navigation.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
          }
        }}
        onLongPress={item.type === 'song' ? () => showOptions(item) : undefined}
      >
        <View style={styles.imageContainer}>
          <View style={styles.cardGlow} />
          {item.thumbnailUrl ? (
            <Image 
              source={{ uri: item.thumbnailUrl }} 
              style={[styles.cardImage, item.type === 'artist' && styles.roundImage]}
              resizeMode="cover"
            />
          ) : (
            generateArtwork()
          )}
          <View style={styles.cardOverlay} />
          {isPlaying && (
            <View style={styles.playingPulse}>
              <View style={styles.playingDot} />
            </View>
          )}
          {item.type === 'artist' && (
            <View style={styles.artistBadge}>
              <Ionicons name="person" size={10} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, isPlaying && styles.activeText]} numberOfLines={2}>
            {displayTitle}
          </Text>
          {displaySubtitle && (
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {displaySubtitle}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = (section: any, index: number) => {
    const sectionType = getSectionType(section);
    const style = getSectionStyle(sectionType);
    
    if (sectionType === 'trending') {
      return (
        <View key={`section-${index}`} style={styles.section}>
          {renderTrendingSection(section, style)}
        </View>
      );
    }
    
    if (sectionType === 'playlists') {
      return (
        <View key={`section-${index}`} style={styles.section}>
          {renderPlaylistSection(section, style)}
        </View>
      );
    }
    
    if (sectionType === 'mixes') {
      return (
        <View key={`section-${index}`} style={styles.section}>
          <View style={[styles.mixesSection, { backgroundColor: `${style.color}03` }]}>
            <TouchableOpacity 
              style={styles.mixesHeader}
              onPress={() => handleSectionPress(section)}
            >
              <View style={styles.mixesTitleContainer}>
                <View style={[styles.mixesOrb, { backgroundColor: style.color }]} />
                <Text style={styles.mixesTitle}>{section.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={style.color} />
            </TouchableOpacity>
            
            <View style={styles.mixesGrid}>
              {section.items.slice(0, 8).map((item: any, idx: number) => {
                const positions = [
                  { size: 'xl', x: 0, y: 0 },
                  { size: 'md', x: 2.2, y: 0 },
                  { size: 'sm', x: 3.5, y: 0 },
                  { size: 'md', x: 0, y: 2.2 },
                  { size: 'sm', x: 2.2, y: 1.3 },
                  { size: 'lg', x: 1.5, y: 2.5 },
                  { size: 'sm', x: 3.8, y: 1.8 },
                  { size: 'md', x: 2.8, y: 3.2 }
                ];
                const pos = positions[idx];
                
                return (
                  <TouchableOpacity 
                    key={item.id}
                    style={[
                      styles.mixesCard,
                      styles[`mixes${pos.size.toUpperCase()}`],
                      {
                        position: 'absolute',
                        left: pos.x * 90,
                        top: pos.y * 90,
                        transform: [{ rotate: `${(idx - 3) * 3}deg` }]
                      }
                    ]}
                    onPress={() => {
                      if (item.type === 'song') playSong(item);
                      else if (item.type === 'artist') navigation.navigate('Artist', { artistId: item.id });
                      else if (item.type === 'album') navigation.navigate('Album', { albumId: item.id });
                      else if (item.type === 'playlist') navigation.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
                    }}
                  >
                    <View style={[styles.mixesImageWrap, { backgroundColor: `${style.color}20` }]}>
                      <View style={styles.mixesAutoThumb}>
                        <View style={[styles.mixesAutoGradient, { 
                          backgroundColor: ['#ff9a9e', '#a8e6cf', '#ffd3a5', '#c2e9fb', '#fbc2eb', '#a18cd1'][idx % 6] 
                        }]} />
                        <Ionicons name="disc" size={pos.size === 'xl' ? 40 : pos.size === 'lg' ? 32 : 24} color="rgba(255,255,255,0.9)" />
                        {pos.size === 'xl' && (
                          <Text style={styles.mixesAutoText} numberOfLines={2}>
                            {item.type === 'artist' ? item.name : item.title}
                          </Text>
                        )}
                      </View>
                      {item.thumbnailUrl && item.thumbnailUrl !== '' && (
                        <Image source={{ uri: item.thumbnailUrl }} style={styles.mixesImage} />
                      )}
                      <View style={[styles.mixesHolo, { backgroundColor: `${style.color}60` }]} />
                      <View style={[styles.mixesGlow, { backgroundColor: style.color }]} />
                      {pos.size === 'xl' && (
                        <View style={styles.mixesContent}>
                          <Text style={styles.mixesItemTitle} numberOfLines={1}>
                            {item.type === 'artist' ? item.name : item.title}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.mixesParticle, { backgroundColor: style.color }]} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      );
    }
    
    if (sectionType === 'dailyDiscover') {
      return (
        <View key={`section-${index}`} style={styles.section}>
          <View style={[styles.discoverSection, { backgroundColor: `${style.color}08`, borderColor: `${style.color}20` }]}>
            <TouchableOpacity 
              style={styles.discoverHeader}
              onPress={() => handleSectionPress(section)}
              activeOpacity={0.9}
            >
              <View style={[styles.discoverGlow, { backgroundColor: style.color }]} />
              <View style={styles.discoverTitleContainer}>
                <Text style={styles.discoverTitle}>{section.title}</Text>
                <Text style={styles.discoverSubtitle}>Fresh picks • Updated daily</Text>
              </View>
              <View style={[styles.discoverBadge, { backgroundColor: style.color }]}>
                <Text style={styles.discoverBadgeText}>NEW</Text>
              </View>
            </TouchableOpacity>
            
            <View style={styles.discoverGrid}>
              {section.items.slice(0, 6).map((item: any, index: number) => {
                const sizes = ['large', 'medium', 'small', 'medium', 'small', 'large'];
                const size = sizes[index];
                return (
                  <TouchableOpacity 
                    key={item.id} 
                    style={[styles.discoverCard, styles[`discover${size.charAt(0).toUpperCase() + size.slice(1)}`]]}
                    onPress={() => {
                      if (item.type === 'song') {
                        playSong(item);
                      } else if (item.type === 'artist') {
                        navigation.navigate('Artist', { artistId: item.id });
                      } else if (item.type === 'album') {
                        navigation.navigate('Album', { albumId: item.id });
                      } else if (item.type === 'playlist') {
                        navigation.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: item.thumbnailUrl }} style={styles.discoverImage} />
                    <View style={[styles.discoverImageOverlay, { backgroundColor: `${style.color}40` }]} />
                    <View style={styles.discoverContent}>
                      <Text style={styles.discoverItemTitle} numberOfLines={size === 'large' ? 2 : 1}>
                        {item.type === 'artist' ? item.name : item.title}
                      </Text>
                      {size === 'large' && (
                        <Text style={styles.discoverArtist} numberOfLines={1}>
                          {item.type === 'song' ? item.artists?.map((a: any) => a.name).join(', ') : item.subtitle}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.discoverPulse, { backgroundColor: style.color }]} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      );
    }
    
    if (sectionType === 'longListens') {
      return (
        <View key={`section-${index}`} style={styles.section}>
          <View style={[styles.longListensSection, { backgroundColor: `${style.color}05` }]}>
            <TouchableOpacity 
              style={styles.longListensHeader}
              onPress={() => handleSectionPress(section)}
            >
              <View style={styles.longListensTitleWrap}>
                <Ionicons name="time" size={24} color={style.color} />
                <Text style={styles.longListensTitle}>{section.title}</Text>
              </View>
              <View style={[styles.longListensBadge, { backgroundColor: style.color }]}>
                <Text style={styles.longListensBadgeText}>EXTENDED</Text>
              </View>
            </TouchableOpacity>
            
            <View style={styles.longListensCards}>
              {section.items.slice(0, 3).map((item: any, idx: number) => (
                <TouchableOpacity 
                  key={item.id}
                  style={[styles.longListensCard, { backgroundColor: `${style.color}10` }]}
                  onPress={() => {
                    if (item.type === 'song') playSong(item);
                    else if (item.type === 'artist') navigation.navigate('Artist', { artistId: item.id });
                    else if (item.type === 'album') navigation.navigate('Album', { albumId: item.id });
                    else if (item.type === 'playlist') navigation.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
                  }}
                >
                  <View style={styles.longListensImageWrap}>
                    <View style={[styles.longListensAutoThumb, { 
                      backgroundColor: ['#9b59b6', '#8c7ae6', '#a29bfe'][idx % 3] 
                    }]}>
                      <Ionicons name="hourglass" size={20} color="#fff" />
                    </View>
                    {item.thumbnailUrl && item.thumbnailUrl !== '' && (
                      <Image source={{ uri: item.thumbnailUrl }} style={styles.longListensImage} />
                    )}
                  </View>
                  <View style={styles.longListensContent}>
                    <Text style={styles.longListensItemTitle} numberOfLines={1}>
                      {item.type === 'artist' ? item.name : item.title}
                    </Text>
                    <View style={styles.longListensDuration}>
                      <Ionicons name="play" size={12} color={style.color} />
                      <Text style={[styles.longListensDurationText, { color: style.color }]}>Extended Mix</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );
    }
    
    if (sectionType === 'default') {
      const designs = ['grid', 'carousel', 'compact'];
      const design = designs[index % 3];
      
      if (design === 'carousel') {
        return (
          <View key={`section-${index}`} style={styles.section}>
            <View style={styles.pureHeader}>
              <Text style={styles.pureTitle}>{section.title}</Text>
              <TouchableOpacity 
                style={[styles.pureButton, { borderColor: style.color }]}
                onPress={() => handleSectionPress(section)}
              >
                <View style={[styles.pureDot, { backgroundColor: style.color }]} />
              </TouchableOpacity>
            </View>
            
            <FlashList
              horizontal
              data={section.items.slice(0, 5)}
              renderItem={({ item, index: idx }) => (
                <TouchableOpacity 
                  style={[styles.pureCard, { marginLeft: idx === 0 ? 20 : 24 }]}
                  onPress={() => {
                    if (item.type === 'song') playSong(item);
                    else if (item.type === 'artist') navigation.navigate('Artist', { artistId: item.id });
                    else if (item.type === 'album') navigation.navigate('Album', { albumId: item.id });
                    else if (item.type === 'playlist') navigation.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
                  }}
                >
                  <View style={styles.pureImageWrap}>
                    <View style={[styles.pureAutoThumb, { 
                      backgroundColor: ['#ff9a9e', '#a8e6cf', '#ffd3a5', '#c2e9fb', '#fbc2eb'][idx % 5] 
                    }]}>
                      <Ionicons name="disc" size={32} color="rgba(255,255,255,0.9)" />
                    </View>
                    {item.thumbnailUrl && item.thumbnailUrl !== '' && (
                      <Image source={{ uri: item.thumbnailUrl }} style={styles.pureImage} />
                    )}
                    <View style={[styles.pureGradient, { backgroundColor: style.color }]} />
                  </View>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id}
              estimatedItemSize={120}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        );
      }
      
      if (design === 'compact') {
        return (
          <View key={`section-${index}`} style={styles.section}>
            <TouchableOpacity 
              style={[styles.etherealCard, { backgroundColor: `${style.color}05` }]}
              onPress={() => handleSectionPress(section)}
            >
              <View style={styles.etherealTop}>
                <Text style={styles.etherealTitle}>{section.title}</Text>
                <View style={[styles.etherealPulse, { backgroundColor: style.color }]} />
              </View>
              
              <View style={styles.etherealGrid}>
                {section.items.slice(0, 4).map((item: any, idx: number) => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={styles.etherealItem}
                    onPress={() => {
                      if (item.type === 'song') playSong(item);
                      else if (item.type === 'artist') navigation.navigate('Artist', { artistId: item.id });
                      else if (item.type === 'album') navigation.navigate('Album', { albumId: item.id });
                      else if (item.type === 'playlist') navigation.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
                    }}
                  >
                    <Image source={{ uri: item.thumbnailUrl }} style={styles.etherealImage} />
                    <View style={[styles.etherealOverlay, { backgroundColor: `${style.color}30` }]} />
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </View>
        );
      }
      // Default grid design (original)
      return (
        <View key={`section-${index}`} style={styles.section}>
          <View style={[styles.defaultSection, { borderColor: `${style.color}20` }]}>
            <TouchableOpacity 
              style={styles.defaultHeader}
              onPress={() => handleSectionPress(section)}
              activeOpacity={0.7}
            >
              <View style={[styles.defaultAccent, { backgroundColor: style.color }]} />
              <Text style={styles.defaultTitle}>{section.title}</Text>
              <View style={styles.defaultArrow}>
                <Ionicons name="chevron-forward" size={16} color={style.color} />
              </View>
            </TouchableOpacity>
            
            <View style={styles.defaultGrid}>
              {section.items.slice(0, 4).map((item: any, index: number) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={styles.defaultGridItem}
                  onPress={() => {
                    if (item.type === 'song') {
                      playSong(item);
                    } else if (item.type === 'artist') {
                      navigation.navigate('Artist', { artistId: item.id });
                    } else if (item.type === 'album') {
                      navigation.navigate('Album', { albumId: item.id });
                    } else if (item.type === 'playlist') {
                      navigation.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.defaultImageContainer, { backgroundColor: `${style.color}15` }]}>
                    <View style={[styles.defaultAutoThumb, { 
                      backgroundColor: ['#ff9a9e', '#a8e6cf', '#ffd3a5', '#c2e9fb', '#fbc2eb', '#a18cd1'][index % 6] 
                    }]}>
                      <Ionicons name="play-circle" size={24} color="rgba(255,255,255,0.9)" />
                    </View>
                    {item.thumbnailUrl && item.thumbnailUrl !== '' && (
                      <Image source={{ uri: item.thumbnailUrl }} style={styles.defaultGridImage} />
                    )}
                    <View style={[styles.defaultOverlay, { backgroundColor: `${style.color}20` }]} />
                    {item.type === 'song' && currentSong?.id === item.id && (
                      <View style={[styles.defaultPlayingDot, { backgroundColor: style.color }]} />
                    )}
                    <View style={[styles.defaultGradient, { backgroundColor: `${style.color}30` }]} />
                  </View>
                  <Text style={styles.defaultItemTitle} numberOfLines={1}>
                    {item.type === 'artist' ? item.name : item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );
    }
    
    return (
      <View key={`section-${index}`} style={styles.section}>
        <TouchableOpacity 
          style={styles.sectionHeader}
          onPress={() => handleSectionPress(section)}
          activeOpacity={0.7}
        >
          <View style={[styles.sectionHeaderGlow, { backgroundColor: style.color }]} />
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={[styles.sectionChevron, { backgroundColor: style.bg }]}>
              <Ionicons name="chevron-forward" size={18} color={style.color} />
            </View>
          </View>
          {section.subtitle && (
            <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
          )}
          <View style={[styles.sectionUnderline, { backgroundColor: style.color }]} />
        </TouchableOpacity>
        
        <FlashList
          horizontal
          data={section.items.slice(0, 10)}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              key={`${item.id}-${index}`}
              style={styles.card}
              onPress={() => {
                if (item.type === 'song') {
                  playSong(item);
                } else if (item.type === 'artist') {
                  navigation.navigate('Artist', { artistId: item.id });
                } else if (item.type === 'album') {
                  navigation.navigate('Album', { albumId: item.id });
                } else if (item.type === 'playlist') {
                  navigation.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
                }
              }}
              onLongPress={item.type === 'song' ? () => showOptions(item) : undefined}
            >
              <View style={styles.imageContainer}>
                <View style={[styles.cardGlow, { backgroundColor: style.color }]} />
                {item.thumbnailUrl ? (
                  <Image 
                    source={{ uri: item.thumbnailUrl }} 
                    style={[styles.cardImage, item.type === 'artist' && styles.roundImage]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.autoArtwork, { backgroundColor: style.color }]}>
                    <Text style={styles.artworkPattern}>♪</Text>
                  </View>
                )}
                <View style={styles.cardOverlay} />
                {item.type === 'song' && currentSong?.id === item.id && (
                  <View style={[styles.playingPulse, { backgroundColor: `${style.color}40` }]}>
                    <View style={[styles.playingDot, { backgroundColor: style.color }]} />
                  </View>
                )}
                {item.type === 'artist' && (
                  <View style={styles.artistBadge}>
                    <Ionicons name="person" size={10} color="#fff" />
                  </View>
                )}
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, item.type === 'song' && currentSong?.id === item.id && { color: style.color }]} numberOfLines={2}>
                  {item.type === 'artist' ? item.name : item.title}
                </Text>
                {(item.artists || item.subtitle) && (
                  <Text style={styles.cardSubtitle} numberOfLines={1}>
                    {item.type === 'song' ? item.artists?.map((a: any) => a.name).join(', ') : item.subtitle}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          estimatedItemSize={170}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        />
      </View>
    );
  };

  const renderSkeletonSection = (index: number) => (
    <View key={`skeleton-${index}`} style={styles.section}>
      <View style={styles.skeletonSectionTitle} />
      <FlashList
        horizontal
        data={Array.from({ length: 5 })}
        renderItem={({ index: itemIndex }) => (
          <View key={`skeleton-item-${itemIndex}`} style={styles.card}>
            <View style={styles.skeletonImage} />
            <View style={styles.skeletonCardTitle} />
            <View style={styles.skeletonCardSubtitle} />
          </View>
        )}
        keyExtractor={(_, itemIndex) => `skeleton-item-${itemIndex}`}
        estimatedItemSize={160}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TabHeader title="Home" navigation={navigation} />
        <FlashList
          data={Array.from({ length: 6 })}
          renderItem={({ index }) => renderSkeletonSection(index)}
          keyExtractor={(_, index) => `skeleton-${index}`}
          estimatedItemSize={200}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    );
  }

  if (error || (!loading && sections.length === 0)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TabHeader title="Home" navigation={navigation} />
        <ErrorState 
          title={sections.length === 0 ? "No content available" : "Failed to load home"}
          message={sections.length === 0 ? "Unable to load your music feed. Check your connection and try again." : "Unable to load your music feed. Check your connection and try again."}
          onRetry={loadHome}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="Home" navigation={navigation} />
      
      <OfflineBanner 
        onDownloadsPress={() => navigation.navigate('DownloadedSongs')}
        onTryAgain={onRefresh}
      />
      
      <FlashList
        data={sections}
        renderItem={({ item: section, index }) => renderSection(section, index)}
        keyExtractor={(_, index) => `section-${index}`}
        estimatedItemSize={200}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={['#fff']}
          />
        }
        ListFooterComponent={
          <>
            {Array.from({ length: skeletonSections }).map((_, index) => 
              renderSkeletonSection(index)
            )}
            {loadingMore && skeletonSections === 0 && (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
            <View style={styles.bottomPadding} />
          </>
        }
        showsVerticalScrollIndicator={false}
      />

      <SongOptionsModal
        visible={modalVisible}
        onClose={hideOptions}
        song={selectedSong}
        showDeleteOption={false}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 40,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 20,
    position: 'relative',
  },
  sectionHeaderGlow: {
    position: 'absolute',
    top: -10,
    left: 10,
    right: 10,
    height: 60,
    borderRadius: 30,
    opacity: 0.08,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  sectionChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
    fontWeight: '500',
  },
  sectionUnderline: {
    width: 40,
    height: 2,
    borderRadius: 1,
    opacity: 0.8,
  },
  horizontalList: {
    paddingLeft: 20,
    paddingRight: 12,
  },
  card: {
    width: 170,
    marginRight: 16,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  cardGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 20,
    opacity: 0.15,
    transform: [{ scale: 0.95 }],
  },
  cardImage: {
    width: 170,
    height: 170,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  roundImage: {
    borderRadius: 85,
  },
  autoArtwork: {
    width: 170,
    height: 170,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artworkPattern: {
    fontSize: 48,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '300',
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  playingPulse: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  artistBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    padding: 6,
  },
  cardContent: {
    paddingHorizontal: 4,
  },
  cardTitle: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  activeText: {
    color: '#6366f1',
  },
  
  // Skeleton styles
  skeletonSectionTitle: {
    height: 22,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginHorizontal: 16,
    marginBottom: 16,
    width: '60%',
  },
  skeletonImage: {
    width: 160,
    height: 160,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 8,
  },
  skeletonCardTitle: {
    height: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginBottom: 4,
    width: '80%',
  },
  skeletonCardSubtitle: {
    height: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    width: '60%',
  },
  
  // Trending section styles
  trendingSection: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  trendingHeader: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  trendingNumber: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  trendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  trendingRank: {
    width: 30,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: '900',
  },
  trendingImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginLeft: 15,
  },
  trendingInfo: {
    flex: 1,
    marginLeft: 15,
  },
  trendingItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  trendingArtist: {
    fontSize: 14,
    color: '#888',
  },
  heartButton: {
    padding: 8,
  },
  
  // Playlist section styles
  playlistSection: {
    paddingHorizontal: 20,
  },
  playlistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  playlistTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playlistTitle: {
    fontSize: 26,
    fontWeight: '200',
    color: '#fff',
    letterSpacing: 1,
    marginRight: 12,
  },
  playlistAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  playlistViewAll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  playlistViewText: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  playlistGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  playlistCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  playlistMain: {
    flex: 2,
    height: 280,
  },
  playlistSecondary: {
    flex: 1,
    height: 280,
  },
  playlistImageContainer: {
    flex: 1,
    position: 'relative',
    padding: 4,
    borderRadius: 24,
  },
  playlistImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  playlistOverlay: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: 20,
  },
  playlistContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  playlistBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  playlistBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  playlistCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  playlistSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '400',
  },
  playlistGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 34,
    opacity: 0.2,
    zIndex: -1,
  },
  playlistMini: {
    flex: 1,
    gap: 16,
  },
  playlistMiniCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  playlistMiniImage: {
    width: '100%',
    height: '100%',
  },
  playlistMiniOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  playlistMiniTitle: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  
  // Auto thumbnail styles
  mixesAutoThumb: {
    width: '100%',
    height: '100%',
    backgroundColor: '#ffeaa7',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    position: 'relative',
  },
  mixesAutoGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#3742fa',
    opacity: 0.7,
    borderRadius: 18,
  },
  mixesAutoText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  
  // Long Listens section styles
  longListensSection: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
  },
  longListensHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  longListensTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  longListensTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
  },
  longListensBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  longListensBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  longListensCards: {
    gap: 12,
  },
  longListensCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  longListensImageWrap: {
    width: 60,
    height: 60,
    borderRadius: 12,
    position: 'relative',
    marginRight: 16,
  },
  longListensAutoThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  longListensImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 12,
    zIndex: 1,
  },
  longListensContent: {
    flex: 1,
  },
  longListensItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 6,
  },
  longListensDuration: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  longListensDurationText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  
  // Trending auto thumbnail
  trendingImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginLeft: 15,
    position: 'relative',
  },
  trendingAutoThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendingImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 8,
    zIndex: 1,
  },
  
  // Default auto thumbnail
  defaultAutoThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  defaultGridImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 13,
    zIndex: 1,
  },
  
  // Auto thumbnail styles
  autoThumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 18,
  },
  autoThumbnailGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.7,
    borderRadius: 18,
  },
  autoThumbnailText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  
  // Mixes section styles
  mixesSection: {
    marginHorizontal: 20,
    borderRadius: 32,
    padding: 24,
    overflow: 'hidden',
  },
  mixesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  mixesTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mixesOrb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 16,
  },
  mixesTitle: {
    fontSize: 24,
    fontWeight: '100',
    color: '#fff',
    letterSpacing: 2,
    marginRight: 16,
  },
  mixesPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  mixesViewAll: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mixesGrid: {
    height: 350,
    position: 'relative',
  },
  mixesCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  mixesXL: {
    width: 140,
    height: 140,
  },
  mixesLG: {
    width: 100,
    height: 100,
  },
  mixesMD: {
    width: 80,
    height: 80,
  },
  mixesSM: {
    width: 60,
    height: 60,
  },
  mixesImageWrap: {
    width: '100%',
    height: '100%',
    position: 'relative',
    borderRadius: 20,
    padding: 2,
  },
  mixesImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 18,
    zIndex: 1,
  },
  mixesHolo: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 18,
    opacity: 0.4,
  },
  mixesGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 28,
    opacity: 0.3,
    zIndex: -1,
  },
  mixesContent: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
  },
  mixesItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  mixesParticle: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  
  // Daily Discover section styles
  discoverSection: {
    marginHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
  },
  discoverHeader: {
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  discoverGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
  },
  discoverTitleContainer: {
    flex: 1,
  },
  discoverTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  discoverSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  discoverBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discoverBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  discoverGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  discoverCard: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  discoverLarge: {
    width: '65%',
    height: 120,
  },
  discoverMedium: {
    width: '32%',
    height: 80,
  },
  discoverSmall: {
    width: '32%',
    height: 60,
  },
  discoverImage: {
    width: '100%',
    height: '100%',
  },
  discoverImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  discoverContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  discoverItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  discoverArtist: {
    fontSize: 11,
    color: '#ccc',
    marginTop: 2,
  },
  discoverPulse: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  
  // Zen Flow Design
  zenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  zenTitle: {
    fontSize: 28,
    fontWeight: '200',
    color: '#fff',
    letterSpacing: 2,
  },
  zenOrb: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  zenFlow: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  zenCard: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    position: 'relative',
  },
  zenImage: {
    width: '100%',
    height: '100%',
  },
  zenAura: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 120,
    opacity: 0.3,
  },
  
  // Pure Minimalism Design
  pureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  pureTitle: {
    fontSize: 22,
    fontWeight: '100',
    color: '#fff',
    letterSpacing: 1,
  },
  pureButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pureCard: {
    width: 100,
    height: 100,
  },
  pureImageWrap: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    overflow: 'hidden',
    position: 'relative',
  },
  pureAutoThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pureImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 50,
    zIndex: 1,
  },
  pureGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    opacity: 0.6,
  },
  
  // Ethereal Compact Design
  etherealCard: {
    marginHorizontal: 20,
    borderRadius: 32,
    padding: 32,
  },
  etherealTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  etherealTitle: {
    fontSize: 20,
    fontWeight: '100',
    color: '#fff',
    letterSpacing: 1.5,
  },
  etherealPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  etherealGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  etherealItem: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  etherealImage: {
    width: '100%',
    height: '100%',
  },
  etherealOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  
  // List section styles
  listSection: {
    marginHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    overflow: 'hidden',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  listAccent: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: 12,
  },
  listTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
  },
  listImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  listContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  listSubtitle: {
    fontSize: 12,
    color: '#888',
  },
  listDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  
  // Carousel section styles
  carouselHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  carouselTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  carouselBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  carouselList: {
    paddingLeft: 20,
  },
  carouselCard: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  carouselOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  
  // Compact section styles
  compactSection: {
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  compactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  compactCount: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  compactRow: {
    flexDirection: 'row',
    gap: 8,
  },
  compactDot: {
    width: 32,
    height: 8,
    borderRadius: 4,
  },
  
  // Default section styles
  defaultSection: {
    marginHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    overflow: 'hidden',
  },
  defaultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
  },
  defaultAccent: {
    width: 3,
    height: 20,
    borderRadius: 2,
    marginRight: 16,
  },
  defaultTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
  defaultArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 16,
  },
  defaultGridItem: {
    width: '47%',
  },
  defaultImageContainer: {
    borderRadius: 16,
    padding: 3,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  defaultOverlay: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: 13,
    opacity: 0.3,
  },
  defaultPlayingDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  defaultGradient: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    right: 3,
    height: 30,
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
  },
  defaultItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  
  // Footer
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  bottomPadding: {
    height: 100,
  },
});