import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Animated,
} from 'react-native';
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

const { width } = Dimensions.get('window');

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

  const renderSectionItem = ({ item }: { item: ArtistItem }) => (
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
  );

  const renderArtistItem = ({ item }: { item: ArtistItem }) => (
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
  );

  const renderSection = (section: ArtistSection, index: number) => {
    if (section.items.length === 0) return null;
    const isLastSection = index === artistData.sections.length - 1;

    return (
      <View key={section.title} style={[styles.section, isLastSection && { marginTop: 0 }]}>
        <View style={[styles.sectionHeader, isLastSection && { marginBottom: 0 }]}>
          <View style={styles.sectionTitleContainer}>
            <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>
              {section.title}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}>
              ({section.items.length})
            </Text>
          </View>
          {section.items.length > 3 && (
            <Button 
              mode="text" 
              onPress={() => navigation.navigate('ShowAll', {
                sectionTitle: section.title,
                sectionType: section.type,
                items: section.items,
                artistName: artistData?.name,
                browseId: section.browseId,
                continuationToken: section.continuationToken
              })}
            >
              Show all
            </Button>
          )}
        </View>
        
        {section.type === 'artists' ? (
          <View style={{ marginBottom: -8 }}>
            <FlatList
              data={section.items.slice(0, 6)}
              renderItem={renderArtistItem}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.artistsList}
              style={{ marginBottom: 0 }}
            />
          </View>
        ) : (
          <View style={styles.sectionContent}>
            {section.items.slice(0, 5).map((item) => (
              <View key={item.id}>
                {renderSectionItem({ item })}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const handleItemPress = (item: ArtistItem) => {
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

      <Animated.ScrollView 
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Header with gradient */}
        <View style={styles.header}>
          <Image source={{ uri: artistData.thumbnail }} style={styles.headerImage} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.gradient}
          />
          
          {/* Navigation */}
          <View style={styles.navigation}>
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

          {/* Artist Info */}
          <View style={styles.artistInfo}>
            <Text variant="headlineLarge" style={styles.artistName}>
              {artistData.name}
            </Text>
            {artistData.subscribers && (
              <Text variant="bodyMedium" style={styles.subscribers}>
                {artistData.subscribers}
              </Text>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <Surface style={[styles.actionBar, { backgroundColor: theme.colors.surface }]}>
          <Button
            mode="contained"
            icon="play"
            onPress={() => {}}
            style={styles.playButton}
          >
            Play
          </Button>
          <Button
            mode="outlined"
            icon={isFollowing ? "account-check" : "account-plus"}
            onPress={() => setIsFollowing(!isFollowing)}
            style={styles.followButton}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Button>
          <IconButton
            icon="shuffle"
            size={24}
            iconColor={theme.colors.onSurface}
            onPress={() => {}}
          />
        </Surface>

        {/* Sections and About */}
        {artistData.sections.map((section, index) => {
          if (section.items.length === 0) return null;
          const isLastSection = index === artistData.sections.length - 1;
          
          return (
            <View key={section.title}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                  <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>
                    {section.title}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}>
                    ({section.items.length})
                  </Text>
                </View>
                {section.items.length > 3 && (
                  <Button 
                    mode="text" 
                    onPress={() => navigation.navigate('ShowAll', {
                      sectionTitle: section.title,
                      sectionType: section.type,
                      items: section.items,
                      artistName: artistData?.name,
                      browseId: section.browseId,
                      continuationToken: section.continuationToken
                    })}
                  >
                    Show all
                  </Button>
                )}
              </View>
              
              {section.type === 'artists' ? (
                <FlatList
                  data={section.items.slice(0, 6)}
                  renderItem={renderArtistItem}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16 }}
                  style={isLastSection ? { marginBottom: 0 } : { marginBottom: 8 }}
                />
              ) : (
                <View style={isLastSection ? { marginBottom: 0 } : { marginBottom: 8 }}>
                  {section.items.slice(0, 5).map((item) => (
                    <View key={item.id}>
                      {renderSectionItem({ item })}
                    </View>
                  ))}
                </View>
              )}
              
              {isLastSection && artistData.description && (
                <Surface style={[styles.aboutSection, { backgroundColor: theme.colors.surface }]}>
                  <Text variant="titleMedium" style={[styles.aboutTitle, { color: theme.colors.onSurface }]}>
                    About
                  </Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    {artistData.description}
                  </Text>
                </Surface>
              )}
            </View>
          );
        })}
      </Animated.ScrollView>
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
  header: {
    height: 300,
    position: 'relative',
  },
  headerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  navigation: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  artistInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  artistName: {
    color: 'white',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subscribers: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    elevation: 2,
  },
  playButton: {
    flex: 1,
  },
  followButton: {
    flex: 1,
  },
  aboutSection: {
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 1,
  },
  aboutTitle: {
    marginBottom: 8,
    fontWeight: '600',
  },
  content: {
    paddingBottom: 0,
  },
  section: {
    marginTop: 4,
    marginBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionContent: {
    backgroundColor: 'transparent',
  },
  artistsList: {
    paddingHorizontal: 16,
    paddingBottom: 0,
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
