import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  ScrollView,
  Pressable,
  ImageBackground,
  Share,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  Text,
  useTheme,
  IconButton,
  Button,
  Surface,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { YouTubeMusicAPI, ArtistData, ArtistSection, ArtistItem } from '../../api';
import ArtistCard from '../components/ArtistCard';
import { useSongOptions } from '../contexts/SongOptionsContext';
import { AuthenticatedHttpClient } from '../utils/authenticatedHttpClient';
import { usePlayer } from '../contexts/PlayerContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEADER_MAX_HEIGHT = 420;
const HEADER_MIN_HEIGHT = 100;
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

interface ArtistScreenProps {
  route: {
    params: {
      artistId: string;
      artistName?: string;
    };
  };
  navigation: any;
}

type TabType = 'overview' | 'songs' | 'albums' | 'videos' | 'about';

export default function ArtistScreen({ route, navigation }: ArtistScreenProps) {
  const theme = useTheme();
  const { artistId, artistName } = route.params;
  const { openSongOptions } = useSongOptions();
  const { playTrack } = usePlayer();
  const [artistData, setArtistData] = useState<ArtistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadArtistData();
  }, [artistId]);

  const loadArtistData = async () => {
    try {
      setLoading(true);
      setIsFollowing(false);
      setFollowLoading(false);
      const data = await YouTubeMusicAPI.getArtist(artistId);
      if (data) {
        setArtistData(data);
        setIsFollowing(!!data.isSubscribed);
      } else {
        // Fallback to mock data if API fails
        const mockData: ArtistData = {
          id: artistId,
          name: artistName || 'Unknown Artist',
          thumbnail: 'https://i.ytimg.com/vi/k0Ka-deab1s/hq720.jpg',
          subscribers: '2.5M subscribers',
          description: 'Artist description not available.',
          sections: [
            {
              title: 'Songs',
              type: 'songs',
              items: Array.from({ length: 15 }, (_, i) => ({
                id: `song-${i}`,
                title: `Song ${i + 1}`,
                subtitle: `Artist • ${Math.floor(Math.random() * 100)}M views`,
                thumbnail: 'https://i.ytimg.com/vi/k0Ka-deab1s/sddefault.jpg',
                duration: `${Math.floor(Math.random() * 4) + 2}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
                type: 'song'
              }))
            },
            {
              title: 'Albums',
              type: 'albums',
              items: Array.from({ length: 8 }, (_, i) => ({
                id: `album-${i}`,
                title: `Album ${i + 1}`,
                subtitle: `${2020 + i} • Album`,
                thumbnail: 'https://i.ytimg.com/vi/k0Ka-deab1s/hq720.jpg',
                type: 'album'
              }))
            },
            {
              title: 'Live performances',
              type: 'videos',
              items: Array.from({ length: 12 }, (_, i) => ({
                id: `video-${i}`,
                title: `Live Performance ${i + 1}`,
                subtitle: `Artist • ${Math.floor(Math.random() * 50)}M views`,
                thumbnail: 'https://i.ytimg.com/vi/k0Ka-deab1s/hq720.jpg',
                type: 'video'
              }))
            },
            {
              title: 'Fans might also like',
              type: 'artists',
              items: Array.from({ length: 10 }, (_, i) => ({
                id: `artist-${i}`,
                title: `Similar Artist ${i + 1}`,
                subtitle: `Artist • ${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 9)}M subscribers`,
                thumbnail: 'https://i.ytimg.com/vi/k0Ka-deab1s/hq720.jpg',
                type: 'artist'
              }))
            }
          ]
        };
        setArtistData(mockData);
        setIsFollowing(false);
      }
    } catch (error) {
      console.error('Error loading artist data:', error);
      // Set fallback data on error
      const fallbackData: ArtistData = {
        id: artistId,
        name: artistName || 'Unknown Artist',
        thumbnail: '',
        sections: []
      };
      setArtistData(fallbackData);
      setIsFollowing(false);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = useCallback(async () => {
    if (!artistData || followLoading) return;

    const channelIds = artistData.subscriptionChannelIds?.length
      ? artistData.subscriptionChannelIds
      : artistData.id?.startsWith('UC')
        ? [artistData.id]
        : [];
    const params = artistData.subscriptionParams;
    if (!channelIds.length) {
      console.warn('No channelIds available for follow/unfollow on this artist');
      return;
    }

    const previous = isFollowing;
    setFollowLoading(true);
    setIsFollowing(!previous);

    try {
      if (previous) {
        await AuthenticatedHttpClient.unfollowArtist(channelIds, params);
      } else {
        await AuthenticatedHttpClient.followArtist(channelIds, params);
      }
    } catch (error) {
      console.error('Failed to toggle follow state', error);
      setIsFollowing(previous);
    } finally {
      setFollowLoading(false);
    }
  }, [artistData, followLoading, isFollowing]);

  const handleItemPress = useCallback((item: ArtistItem, sectionItems?: ArtistItem[]) => {
    switch (item.type) {
      case 'song':
      case 'video':
        {
          const candidateItems =
            (sectionItems?.length ? sectionItems : sections).flatMap((entry) =>
              'items' in entry ? entry.items : [entry]
            );
          const playableQueue = candidateItems
            .filter((entry) => entry.type === 'song' || entry.type === 'video')
            .map((entry) => ({
              id: entry.videoId || entry.id,
              title: entry.title,
              artist: entry.subtitle || artistData?.name || artistName || 'Unknown Artist',
              thumbnail: entry.thumbnail || artistData?.thumbnail || '',
            }));
          const targetId = item.videoId || item.id;
          const queueIndex = playableQueue.findIndex((track) => track.id === targetId);

          if (!playableQueue.length || queueIndex === -1) return;
          playTrack(playableQueue[queueIndex], playableQueue, {
            source: {
              type: 'queue',
              label: artistData?.name ? `Artist: ${artistData.name}` : 'Artist Songs',
              id: artistId,
            },
          });
        }
        break;
      case 'album':
        navigation.navigate('Album', { albumId: item.id });
        break;
      case 'artist':
        navigation.navigate('Artist', { artistId: item.id, artistName: item.title });
        break;
      case 'playlist':
        navigation.navigate('Playlist', { playlistId: item.id });
        break;
    }
  }, [artistData?.name, artistData?.thumbnail, artistId, artistName, navigation, playTrack, sections]);

  const renderSectionItem = useCallback(({ item, sectionItems }: { item: ArtistItem; sectionItems?: ArtistItem[] }) => (
    <ArtistCard
      id={item.id}
      title={item.title}
      subtitle={item.subtitle}
      thumbnail={item.thumbnail}
      type={item.type}
      onPress={() => handleItemPress(item, sectionItems)}
      onMenuPress={() => {
        if (item.type === 'song' || item.type === 'video') {
          openSongOptions({
            videoId: item.videoId || item.id,
            title: item.title,
            artist: item.subtitle,
            thumbnail: item.thumbnail,
          });
        }
      }}
      onLongPress={() => {
        if (item.type === 'song' || item.type === 'video') {
          openSongOptions({
            videoId: item.videoId || item.id,
            title: item.title,
            artist: item.subtitle,
            thumbnail: item.thumbnail,
          });
        }
      }}
      variant="list"
    />
  ), [handleItemPress, openSongOptions]);

  const renderGridItem = useCallback(({ item }: { item: ArtistItem }) => (
    <TouchableOpacity 
      style={styles.gridItem}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item.thumbnail }} style={styles.gridImage} />
      <View style={styles.gridInfo}>
        <Text variant="titleSmall" numberOfLines={2} style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
          {item.title}
        </Text>
        <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
          {item.subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  ), [handleItemPress, theme]);

  const renderArtistItem = useCallback(({ item }: { item: ArtistItem }) => (
    <TouchableOpacity 
      style={{ width: 120, alignItems: 'center', paddingHorizontal: 8 }}
      onPress={() => handleItemPress(item)}
    >
      <Image 
        source={{ uri: item.thumbnail }} 
        style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 8 }} 
      />
      <Text 
        variant="titleSmall" 
        numberOfLines={2} 
        style={{ textAlign: 'center', marginBottom: 4, fontWeight: '500', color: theme.colors.onSurface }}
      >
        {item.title}
      </Text>
      <Text 
        variant="bodySmall" 
        numberOfLines={1} 
        style={{ textAlign: 'center', fontSize: 12, color: theme.colors.onSurfaceVariant }}
      >
        {item.subtitle}
      </Text>
    </TouchableOpacity>
  ), [handleItemPress, theme.colors.onSurface, theme.colors.onSurfaceVariant]);

  const sections = useMemo(
    () => artistData?.sections.filter((section) => section.items.length > 0) ?? [],
    [artistData?.sections]
  );

  const tabSections = useMemo(() => {
    const tabs: Record<TabType, ArtistSection[]> = {
      overview: sections.slice(0, 3),
      songs: sections.filter(s => s.type === 'songs'),
      albums: sections.filter(s => s.type === 'albums'),
      videos: sections.filter(s => s.type === 'videos'),
      about: [],
    };
    return tabs;
  }, [sections]);

  const handleShareArtist = useCallback(async () => {
    const shareArtistName = artistData?.name || artistName || 'this artist';
    const shareId = artistData?.id || artistId;
    const shareUrl = shareId ? `https://music.youtube.com/browse/${shareId}` : '';
    const message = shareUrl
      ? `Check out ${shareArtistName} on YouTube Music: ${shareUrl}`
      : `Check out ${shareArtistName} on Mediyo`;

    try {
      await Share.share({
        title: shareArtistName,
        message,
        url: shareUrl || undefined,
      });
    } catch (error) {
      console.error('Failed to share artist', error);
    }
  }, [artistData?.id, artistData?.name, artistId, artistName]);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const renderSection = useCallback((section: ArtistSection, index: number) => {
    const isGrid = section.type === 'albums' || section.type === 'videos';
    const displayItems = section.items.slice(0, isGrid ? 6 : 8);

    return (
      <View key={`${section.title}-${index}`} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            {section.title}
          </Text>
          {section.items.length > displayItems.length && (
            <Pressable
              onPress={() => navigation.navigate('ShowAll', {
                sectionTitle: section.title,
                sectionType: section.type,
                items: section.items,
                artistName: artistData?.name,
                browseId: section.browseId,
                continuationToken: section.continuationToken
              })}
            >
              <Text style={[styles.showAllText, { color: theme.colors.primary }]}>
                Show all
              </Text>
            </Pressable>
          )}
        </View>

        {isGrid ? (
          <View style={styles.gridContainer}>
            {displayItems.map((item) => (
              <View key={item.id} style={{ width: '50%' }}>
                {renderGridItem({ item })}
              </View>
            ))}
          </View>
        ) : section.type === 'artists' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.artistsRow}>
            {displayItems.map((item) => renderArtistItem({ item }))}
          </ScrollView>
        ) : (
          <View>
            {displayItems.map((item) => (
              <View key={item.id}>{renderSectionItem({ item, sectionItems: section.items })}</View>
            ))}
          </View>
        )}
      </View>
    );
  }, [artistData?.name, navigation, renderArtistItem, renderGridItem, renderSectionItem, theme]);

  const renderTabContent = () => {
    const currentSections = tabSections[activeTab];
    
    if (activeTab === 'about') {
      return (
        <View style={styles.aboutContainer}>
          <Surface style={[styles.aboutCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, marginBottom: 16, fontWeight: '700' }}>
              About {artistData?.name}
            </Text>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 24 }}>
              {artistData?.description || 'No description available.'}
            </Text>
            {artistData?.subscribers && (
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <MaterialCommunityIcons name="account-group" size={24} color={theme.colors.primary} />
                  <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: 8, fontWeight: '600' }}>
                    {artistData.subscribers}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Subscribers
                  </Text>
                </View>
              </View>
            )}
          </Surface>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {currentSections.map((section, index) => renderSection(section, index))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 16, color: theme.colors.onSurface }}>Loading artist...</Text>
      </View>
    );
  }

  if (!artistData) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <MaterialCommunityIcons 
          name="account-music-outline" 
          size={64} 
          color={theme.colors.onSurfaceVariant} 
        />
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: 16 }}>
          Artist not found
        </Text>
        <Button mode="outlined" onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          Go Back
        </Button>
      </View>
    );
  }

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: 'view-dashboard' },
    { key: 'songs', label: 'Songs', icon: 'music-note' },
    { key: 'albums', label: 'Albums', icon: 'album' },
    { key: 'videos', label: 'Videos', icon: 'video' },
    { key: 'about', label: 'About', icon: 'information' },
  ];

  return (
    <ImageBackground
      source={{ uri: artistData.thumbnail }}
      blurRadius={12}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      imageStyle={styles.backgroundImage}
    >
      <LinearGradient
        colors={['rgba(40,32,56,0.2)', 'rgba(8,8,12,0.9)', 'rgba(0,0,0,0.95)']}
        style={styles.backgroundGradient}
      />
      <LinearGradient
        colors={['rgba(180,150,220,0.15)', 'rgba(0,0,0,0)']}
        style={styles.backgroundGlow}
        start={{ x: 0.15, y: 0.08 }}
        end={{ x: 0.88, y: 0.92 }}
      />
      
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Animated Top Bar */}
      <Animated.View style={[styles.topBar, { opacity: headerOpacity }]}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.topBarContent}>
          <IconButton icon="arrow-left" iconColor="white" size={24} onPress={() => navigation.goBack()} />
          <Text variant="titleMedium" style={{ color: 'white', fontWeight: '600', flex: 1 }} numberOfLines={1}>
            {artistData.name}
          </Text>
          <IconButton icon="dots-vertical" iconColor="white" size={24} onPress={() => {}} />
        </View>
      </Animated.View>

      {/* Floating Back Button */}
      <Animated.View style={[styles.floatingBack, { opacity: scrollY.interpolate({
        inputRange: [0, 50],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }) }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.floatingBackButton}>
          <BlurView intensity={60} tint="dark" style={styles.floatingBackBlur}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </BlurView>
        </Pressable>
      </Animated.View>

      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Content */}
        <View style={styles.heroContent}>
          <Image source={{ uri: artistData.thumbnail }} style={styles.heroImage} />
          
          <View style={styles.heroTextContainer}>
            <Text variant="displaySmall" style={styles.artistName}>
              {artistData.name}
            </Text>
            {artistData.subscribers && (
              <View style={styles.subscriberBadge}>
                <MaterialCommunityIcons name="check-decagram" size={16} color={theme.colors.primary} />
                <Text variant="bodyMedium" style={styles.subscriberText}>
                  {artistData.subscribers}
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Pressable 
              style={[styles.actionButton, styles.followButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleFollowToggle}
              disabled={followLoading}
            >
              <MaterialCommunityIcons
                name={isFollowing ? 'account-check' : 'account-plus'}
                size={20}
                color="white"
              />
              <Text variant="titleMedium" style={styles.followButtonText}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </Pressable>

            <Pressable 
              style={[
                styles.actionButton,
                styles.shareButton,
                { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline },
              ]}
              onPress={handleShareArtist}
            >
              <MaterialCommunityIcons name="share-variant" size={20} color={theme.colors.onSurface} />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                Share
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScroll}
          >
            {tabs.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tab,
                  activeTab === tab.key && { backgroundColor: theme.colors.primaryContainer }
                ]}
              >
                <MaterialCommunityIcons 
                  name={tab.icon as any} 
                  size={18} 
                  color={activeTab === tab.key ? theme.colors.primary : theme.colors.onSurfaceVariant} 
                />
                <Text 
                  variant="labelLarge" 
                  style={[
                    styles.tabLabel,
                    { color: activeTab === tab.key ? theme.colors.primary : theme.colors.onSurfaceVariant }
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Tab Content */}
        {renderTabContent()}
      </Animated.ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImage: {
    resizeMode: 'cover',
    opacity: 0.35,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_MAX_HEIGHT,
    overflow: 'hidden',
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: HEADER_MAX_HEIGHT,
    resizeMode: 'cover',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HEADER_MAX_HEIGHT,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: 'hidden',
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: StatusBar.currentHeight || 40,
    paddingHorizontal: 8,
    height: HEADER_MIN_HEIGHT,
  },
  floatingBack: {
    position: 'absolute',
    top: (StatusBar.currentHeight || 40) + 8,
    left: 16,
    zIndex: 99,
  },
  floatingBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  floatingBackBlur: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingTop: (StatusBar.currentHeight || 40) + 60,
    paddingBottom: 24,
    alignItems: 'center',
  },
  heroImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: 24,
  },
  heroTextContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  artistName: {
    color: 'white',
    fontWeight: '800',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subscriberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  subscriberText: {
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    width: '100%',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 28,
    gap: 8,
  },
  followButton: {
    flex: 1.15,
  },
  followButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  shareButton: {
    flex: 0.85,
    borderWidth: 1.5,
  },
  tabsContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  tabsScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  tabLabel: {
    fontWeight: '600',
  },
  tabContent: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  showAllText: {
    fontWeight: '600',
    fontSize: 14,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  gridItem: {
    padding: 8,
  },
  gridImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 8,
  },
  gridInfo: {
    paddingHorizontal: 4,
  },
  artistsRow: {
    paddingRight: 20,
    gap: 16,
  },
  aboutContainer: {
    paddingHorizontal: 20,
  },
  aboutCard: {
    padding: 24,
    borderRadius: 20,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
});
