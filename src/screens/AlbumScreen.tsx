import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Animated,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Text, useTheme, IconButton, Button, Appbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlbumAPI, AlbumDetails, AlbumTrack, AlbumSuggestion } from '../../api/album';
import { useSongOptions } from '../contexts/SongOptionsContext';
import { usePlayer } from '../contexts/PlayerContext';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as typeof FlatList;

interface AlbumScreenProps {
  route: {
    params: {
      albumId: string;
    };
  };
  navigation: any;
}

export default function AlbumScreen({ route, navigation }: AlbumScreenProps) {
  const { albumId } = route.params;
  const [album, setAlbum] = useState<AlbumDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrollY] = useState(new Animated.Value(0));
  const theme = useTheme();
  const { openSongOptions } = useSongOptions();
  const { playTrack } = usePlayer();

  useEffect(() => {
    loadAlbum();
  }, [albumId]);

  const loadAlbum = async () => {
    setLoading(true);
    const data = await AlbumAPI.getAlbumDetails(albumId);
    setAlbum(data);
    setLoading(false);
  };

  const trackQueue = album?.tracks.map((track) => ({
    id: track.id,
    title: track.title,
    artist: track.artist && track.artist !== 'Unknown Artist' ? track.artist : album?.artist || 'Unknown Artist',
    thumbnail: track.thumbnail || album?.thumbnail || '',
  })) ?? [];

  const renderTrack = useCallback(({ item, index }: { item: AlbumTrack; index: number }) => (
    <TouchableOpacity
      key={`${item.id}-${index}`}
      style={[styles.trackItem, { borderBottomColor: theme.colors.outline }]}
      activeOpacity={0.7}
      onPress={() => playTrack({
        id: item.id,
        title: item.title,
        artist: item.artist && item.artist !== 'Unknown Artist' ? item.artist : album?.artist || 'Unknown Artist',
        thumbnail: item.thumbnail || album?.thumbnail || '',
      }, undefined, {
        source: {
          type: 'album',
          label: album?.title ? `Album: ${album.title}` : 'Album',
          id: albumId,
        },
      })}
      onLongPress={() => openSongOptions({
        videoId: item.id,
        title: item.title,
        artist: item.artist && item.artist !== 'Unknown Artist' ? item.artist : album?.artist || 'Unknown Artist',
        thumbnail: item.thumbnail,
      })}
    >
      <Image 
        source={{ uri: album?.thumbnail }} 
        style={[styles.trackThumbnail, { backgroundColor: theme.colors.surfaceVariant }]}
      />
      
      <View style={styles.trackInfo}>
        <Text 
          variant="bodyMedium" 
          numberOfLines={1}
          style={[styles.trackTitle, { color: theme.colors.onSurface }]}
        >
          {item.title}
        </Text>
        <Text 
          variant="bodySmall" 
          numberOfLines={1}
          style={[styles.trackArtist, { color: theme.colors.onSurfaceVariant }]}
        >
          {item.artist && item.artist !== 'Unknown Artist' ? item.artist : album?.artist || 'Unknown Artist'}
        </Text>
      </View>
      
      {item.duration && (
        <Text 
          variant="bodySmall" 
          style={[styles.trackDuration, { color: theme.colors.onSurfaceVariant }]}
        >
          {item.duration}
        </Text>
      )}
      
      <IconButton
        icon="dots-vertical"
        size={20}
        iconColor={theme.colors.onSurfaceVariant}
        onPress={() => openSongOptions({
          videoId: item.id,
          title: item.title,
          artist: item.artist && item.artist !== 'Unknown Artist' ? item.artist : album?.artist || 'Unknown Artist',
          thumbnail: item.thumbnail,
        })}
      />
    </TouchableOpacity>
  ), [album?.thumbnail, openSongOptions, playTrack, theme.colors.onSurface, theme.colors.onSurfaceVariant, theme.colors.outline, theme.colors.surfaceVariant, trackQueue]);

  const keyExtractor = useCallback((item: AlbumTrack, index: number) => `${item.id}-${index}`, []);

  const handlePlayAlbum = useCallback(() => {
    if (!trackQueue.length) return;
    playTrack(trackQueue[0], undefined, {
      source: {
        type: 'album',
        label: album?.title ? `Album: ${album.title}` : 'Album',
        id: albumId,
      },
    });
  }, [album?.title, albumId, playTrack, trackQueue]);

  const renderHeader = useCallback(() => (
    <View>
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.headerContent}>
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor={theme.colors.onSurface}
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          />
          
          <Image 
            source={{ uri: album?.thumbnail }} 
            style={[styles.albumThumbnail, { backgroundColor: theme.colors.surfaceVariant }]}
          />
          
          <View style={styles.albumInfo}>
            <Text variant="headlineSmall" style={[styles.albumTitle, { color: theme.colors.onSurface }]}>
              {album?.title}
            </Text>
            
            <Text variant="bodyMedium" style={[styles.albumArtist, { color: theme.colors.onSurfaceVariant }]}>
              {album?.artist}
            </Text>
            
            <Text variant="bodySmall" style={[styles.albumSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {album?.subtitle}
            </Text>
            
            <Text variant="bodySmall" style={[styles.albumSecondSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {album?.secondSubtitle}
            </Text>
          </View>
        </View>
        
        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            icon="play"
            onPress={handlePlayAlbum}
            disabled={!trackQueue.length}
            style={styles.playButton}
          >
            Play
          </Button>
          
          <IconButton
            icon="shuffle"
            size={24}
            iconColor={theme.colors.onSurface}
            onPress={() => {}}
          />
          
          <IconButton
            icon="plus"
            size={24}
            iconColor={theme.colors.onSurface}
            onPress={() => {}}
          />
          
          <IconButton
            icon="dots-vertical"
            size={24}
            iconColor={theme.colors.onSurface}
            onPress={() => {}}
          />
        </View>
        <View style={styles.headerSpacer} />
      </View>
    </View>
  ), [album, handlePlayAlbum, navigation, theme.colors.onSurface, theme.colors.onSurfaceVariant, theme.colors.surface, theme.colors.surfaceVariant, trackQueue.length]);

  const renderSuggestion = (suggestion: AlbumSuggestion) => (
    <View key={suggestion.id} style={styles.suggestionItem}>
      <Image 
        source={{ uri: suggestion.thumbnail }} 
        style={[styles.suggestionThumbnail, { backgroundColor: theme.colors.surfaceVariant }]}
      />
      <Text 
        variant="bodySmall" 
        numberOfLines={2}
        style={[styles.suggestionTitle, { color: theme.colors.onSurface }]}
      >
        {suggestion.title}
      </Text>
      <Text 
        variant="bodySmall" 
        numberOfLines={1}
        style={[styles.suggestionArtist, { color: theme.colors.onSurfaceVariant }]}
      >
        {suggestion.artist}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.loading}>
          <Text>Loading album...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!album) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.loading}>
          <Text>Album not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
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
          <Appbar.Content title={album?.title || ''} />
          <Appbar.Action icon="dots-vertical" onPress={() => {}} />
        </Appbar.Header>
      </Animated.View>

      <AnimatedFlatList
        data={album.tracks}
        renderItem={renderTrack}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={
          album.suggestions && album.suggestions.length > 0 ? (
            <View style={[styles.suggestionsContainer, { backgroundColor: theme.colors.background }]}>
              <Text variant="titleMedium" style={[styles.suggestionsTitle, { color: theme.colors.onSurface }]}>
                Releases for you
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionsScroll}
              >
                {album.suggestions.map(renderSuggestion)}
              </ScrollView>
            </View>
          ) : null
        }
        contentContainerStyle={[styles.listContent, { backgroundColor: theme.colors.background }]}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        removeClippedSubviews
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingBottom: 24,
  },
  headerContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  albumThumbnail: {
    width: 200,
    height: 200,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 16,
  },
  albumInfo: {
    alignItems: 'center',
    gap: 4,
  },
  albumTitle: {
    fontWeight: '600',
    textAlign: 'center',
  },
  albumArtist: {
    textAlign: 'center',
    fontWeight: '500',
  },
  albumSubtitle: {
    textAlign: 'center',
  },
  albumSecondSubtitle: {
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 24,
    gap: 8,
  },
  playButton: {
    borderRadius: 24,
  },
  listContent: {
    paddingBottom: 120,
  },
  headerSpacer: {
    height: 16,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  trackThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 12,
  },
  trackInfo: {
    flex: 1,
    gap: 2,
  },
  trackTitle: {
    fontWeight: '500',
  },
  trackArtist: {
    fontSize: 13,
  },
  trackDuration: {
    fontSize: 12,
    marginRight: 8,
  },
  suggestionsContainer: {
    paddingTop: 24,
    paddingBottom: 16,
  },
  suggestionsTitle: {
    paddingHorizontal: 16,
    marginBottom: 16,
    fontWeight: '600',
  },
  suggestionsScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  suggestionItem: {
    width: 120,
  },
  suggestionThumbnail: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  suggestionTitle: {
    fontWeight: '500',
    marginBottom: 2,
  },
  suggestionArtist: {
    fontSize: 12,
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
