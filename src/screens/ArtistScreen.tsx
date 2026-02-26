import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  Text,
  useTheme,
  IconButton,
  Button,
  Surface,
  ActivityIndicator,
  Appbar,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { YouTubeMusicAPI, ArtistData, ArtistSection, ArtistItem } from '../../api';
import ArtistCard from '../components/ArtistCard';
import { useSongOptions } from '../contexts/SongOptionsContext';

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList) as typeof FlashList;

interface ArtistScreenProps {
  route: {
    params: {
      artistId: string;
      artistName?: string;
    };
  };
  navigation: any;
}

export default function ArtistScreen({ route, navigation }: ArtistScreenProps) {
  const theme = useTheme();
  const { artistId, artistName } = route.params;
  const { openSongOptions } = useSongOptions();
  const [artistData, setArtistData] = useState<ArtistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [scrollY] = useState(new Animated.Value(0));

  useEffect(() => {
    loadArtistData();
  }, [artistId]);

  const loadArtistData = async () => {
    try {
      setLoading(true);
      const data = await YouTubeMusicAPI.getArtist(artistId);
      if (data) {
        setArtistData(data);
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
    } finally {
      setLoading(false);
    }
  };

  const handleItemPress = useCallback((item: ArtistItem) => {
    switch (item.type) {
      case 'song':
      case 'video':
        // Navigate to player
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
  }, [navigation]);

  const renderSectionItem = useCallback(({ item }: { item: ArtistItem }) => (
    <ArtistCard
      id={item.id}
      title={item.title}
      subtitle={item.subtitle}
      thumbnail={item.thumbnail}
      type={item.type}
      onPress={() => handleItemPress(item)}
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

  const renderSection = useCallback(({ item, index }: { item: ArtistSection; index: number }) => {
    const isLastSection = index === sections.length - 1;
    const totalCount = item.items.length;
    const showMore = totalCount > 3;

    return (
      <View key={item.title} style={[styles.section, isLastSection && { marginTop: 0 }]}>
        <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={[styles.sectionHeader, isLastSection && { marginBottom: 0 }]}>
            <View style={styles.sectionTitleContainer}>
              <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                {item.title}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}>
                ({totalCount})
              </Text>
            </View>
            {showMore && (
              <Button
                mode="text"
                compact
                onPress={() => navigation.navigate('ShowAll', {
                  sectionTitle: item.title,
                  sectionType: item.type,
                  items: item.items,
                  artistName: artistData?.name,
                  browseId: item.browseId,
                  continuationToken: item.continuationToken
                })}
                style={styles.showAllButton}
                labelStyle={[styles.showAllLabel, { color: theme.colors.primary }]}
              >
                Show all
              </Button>
            )}
          </View>
          
          {item.type === 'artists' ? (
            <View style={styles.sectionBody}>
              <FlashList
                data={item.items.slice(0, 6)}
                renderItem={renderArtistItem}
                keyExtractor={(artistItem) => artistItem.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.artistsList}
                style={{ marginBottom: 0 }}
                estimatedItemSize={140}
              />
            </View>
          ) : (
            <View style={styles.sectionBody}>
              <View style={styles.sectionContent}>
            {item.items.slice(0, 5).map((sectionItem) => (
              <View key={sectionItem.id}>
                {renderSectionItem({ item: sectionItem })}
              </View>
            ))}
              </View>
            </View>
          )}
        </Surface>
      </View>
    );
  }, [artistData?.name, navigation, renderArtistItem, renderSectionItem, sections.length, theme.colors.onSurface, theme.colors.onSurfaceVariant, theme.colors.primary]);


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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Animated Header */}
      <Animated.View 
        style={[
          styles.animatedHeader,
          {
            backgroundColor: theme.colors.surface,
            opacity: scrollY.interpolate({
              inputRange: [200, 250],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
          }
        ]}
      >
        <Appbar.Header style={{ backgroundColor: 'transparent' }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={artistData?.name || ''} />
          <Appbar.Action icon="dots-vertical" onPress={() => {}} />
        </Appbar.Header>
      </Animated.View>

      <AnimatedFlashList
        data={sections}
        renderItem={renderSection}
        keyExtractor={(item) => item.title}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        estimatedItemSize={300}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Image source={{ uri: artistData.thumbnail }} style={styles.heroImage} />
              <LinearGradient
                colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.9)']}
                style={styles.heroGradient}
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.7)', 'transparent']}
                style={styles.heroTopFade}
              />

              <View style={styles.heroNav}>
                <IconButton
                  icon="arrow-left"
                  size={24}
                  iconColor="white"
                  onPress={() => navigation.goBack()}
                />
                <IconButton
                  icon="dots-vertical"
                  size={24}
                  iconColor="white"
                  onPress={() => {}}
                />
              </View>

              <View style={styles.heroContent}>
                <Text variant="headlineLarge" style={styles.heroTitle}>
                  {artistData.name}
                </Text>
                {artistData.subscribers && (
                  <Text variant="bodyMedium" style={styles.heroSubtitle}>
                    {artistData.subscribers}
                  </Text>
                )}
                {artistData.description && (
                  <Text variant="bodySmall" numberOfLines={2} style={styles.heroDescription}>
                    {artistData.description}
                  </Text>
                )}
              </View>
            </View>

            <Surface style={[styles.actionsCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
              <View style={styles.primaryActions}>
                <Button
                  mode="contained"
                  icon="play"
                  onPress={() => {}}
                  style={styles.primaryButton}
                >
                  Play
                </Button>
                <Button
                  mode="outlined"
                  icon={isFollowing ? "account-check" : "account-plus"}
                  onPress={() => setIsFollowing(!isFollowing)}
                  style={styles.primaryButton}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
              </View>
              <View style={styles.secondaryActions}>
                <TouchableOpacity style={styles.iconAction} onPress={() => {}}>
                  <MaterialCommunityIcons name="shuffle" size={20} color={theme.colors.onSurface} />
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Shuffle</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconAction} onPress={() => {}}>
                  <MaterialCommunityIcons name="heart-outline" size={20} color={theme.colors.onSurface} />
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Like</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconAction} onPress={() => {}}>
                  <MaterialCommunityIcons name="share-variant" size={20} color={theme.colors.onSurface} />
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Share</Text>
                </TouchableOpacity>
              </View>
            </Surface>

          </View>
        }
        ListFooterComponent={
          artistData.description ? (
            <Surface style={[styles.aboutSection, { backgroundColor: theme.colors.surface }]}>
              <Text variant="titleMedium" style={[styles.aboutTitle, { color: theme.colors.onSurface }]}>
                About
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {artistData.description}
              </Text>
            </Surface>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
      />
    </View>
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
  hero: {
    height: 320,
    position: 'relative',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  heroTopFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  heroNav: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroContent: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  heroTitle: {
    color: 'white',
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    letterSpacing: 0.4,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroDescription: {
    color: 'rgba(255,255,255,0.82)',
    marginTop: 8,
    lineHeight: 18,
  },
  actionsCard: {
    marginHorizontal: 16,
    marginTop: -22,
    borderRadius: 18,
    padding: 12,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 22,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 6,
  },
  iconAction: {
    alignItems: 'center',
    gap: 6,
    minWidth: 72,
  },
  aboutSection: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    elevation: 1,
  },
  aboutTitle: {
    marginBottom: 8,
    fontWeight: '600',
  },
  content: {
    paddingBottom: 0,
  },
  listContent: {
    paddingBottom: 150,
    paddingTop: 10,
  },
  section: {
    marginTop: 8,
    marginBottom: 0,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 12,
  },
  sectionCard: {
    borderRadius: 16,
    paddingBottom: 8,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  showAllButton: {
    borderRadius: 999,
  },
  showAllLabel: {
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionBody: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  sectionContent: {
    backgroundColor: 'transparent',
  },
  artistsList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    marginBottom: 0,
    paddingTop: 0
  },
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 4,
  },
});
