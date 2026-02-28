import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  Text,
  useTheme,
  Appbar,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ArtistItem, YouTubeMusicAPI } from '../../api';
import ArtistCard from '../components/ArtistCard';
import { useSongOptions } from '../contexts/SongOptionsContext';

const { width } = Dimensions.get('window');

interface ShowAllScreenProps {
  route: {
    params: {
      sectionTitle: string;
      sectionType: 'songs' | 'albums' | 'videos' | 'playlists' | 'artists';
      items: ArtistItem[];
      artistName?: string;
      browseId?: string;
      continuationToken?: string;
    };
  };
  navigation: any;
}

export default function ShowAllScreen({ route, navigation }: ShowAllScreenProps) {
  const theme = useTheme();
  const { sectionTitle, sectionType, items, artistName, browseId, continuationToken } = route.params;
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(sectionType === 'artists' ? 'grid' : 'list');
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'recent'>('default');
  const [sortedItems, setSortedItems] = useState<ArtistItem[]>(items);
  const [loading, setLoading] = useState(false);
  const [allItems, setAllItems] = useState<ArtistItem[]>(items);
  const { openSongOptions } = useSongOptions();

  useEffect(() => {
    if ((browseId || continuationToken) && items.length <= 10) {
      loadCompleteSection();
    }
  }, [browseId, continuationToken]);

  const loadCompleteSection = async () => {
    if (!browseId && !continuationToken) return;
    
    setLoading(true);
    try {
      const completeItems = await YouTubeMusicAPI.getArtistSection(
        browseId || '', 
        continuationToken
      );
      if (completeItems.length > 0) {
        setAllItems(completeItems);
      }
    } catch (error) {
      console.error('Error loading complete section:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let sorted = [...allItems];
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'recent':
        sorted.reverse();
        break;
      default:
        sorted = allItems;
    }
    setSortedItems(sorted);
  }, [sortBy, allItems]);

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
      case 'podcast':
      case 'episode':
        navigation.navigate('Podcast', { podcastId: item.id, title: item.title });
        break;
    }
  };

  const renderListItem = ({ item, index }: { item: ArtistItem; index: number }) => (
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

  const renderGridItem = ({ item, index }: { item: ArtistItem; index: number }) => (
    <View style={styles.gridItemContainer}>
      <ArtistCard
        id={item.id}
        title={item.title}
        subtitle={item.subtitle}
        thumbnail={item.thumbnail}
        type={item.type}
        onPress={() => handleItemPress(item)}
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
        variant="grid"
      />
    </View>
  );

  const getEmptyStateIcon = () => {
    switch (sectionType) {
      case 'songs': return 'music-note-off';
      case 'albums': return 'album';
      case 'videos': return 'video-off';
      case 'playlists': return 'playlist-remove';
      case 'artists': return 'account-music-outline';
      default: return 'music-off';
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons 
        name={getEmptyStateIcon()} 
        size={64} 
        color={theme.colors.onSurfaceVariant} 
      />
      <Text variant="titleMedium" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
        No {sectionType} found
      </Text>
      <Text variant="bodyMedium" style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
        {artistName ? `${artistName} doesn't have any ${sectionType} available` : `No ${sectionType} available`}
      </Text>
    </View>
  );

  const numColumns = viewMode === 'grid' ? 2 : 1;
  const key = `${viewMode}-${numColumns}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content 
          title={sectionTitle} 
          subtitle={`${sortedItems.length} ${sectionType}`}
        />
        {sectionType === 'artists' && (
          <Appbar.Action
            icon={viewMode === 'grid' ? 'view-list' : 'view-grid'}
            onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          />
        )}
      </Appbar.Header>

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <Chip
          selected={sortBy === 'default'}
          onPress={() => setSortBy('default')}
          style={[styles.sortChip, { 
            backgroundColor: sortBy === 'default' ? theme.colors.primaryContainer : theme.colors.surfaceVariant 
          }]}
          textStyle={{ 
            color: sortBy === 'default' ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant 
          }}
        >
          Default
        </Chip>
        <Chip
          selected={sortBy === 'name'}
          onPress={() => setSortBy('name')}
          style={[styles.sortChip, { 
            backgroundColor: sortBy === 'name' ? theme.colors.primaryContainer : theme.colors.surfaceVariant 
          }]}
          textStyle={{ 
            color: sortBy === 'name' ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant 
          }}
        >
          A-Z
        </Chip>
        <Chip
          selected={sortBy === 'recent'}
          onPress={() => setSortBy('recent')}
          style={[styles.sortChip, { 
            backgroundColor: sortBy === 'recent' ? theme.colors.primaryContainer : theme.colors.surfaceVariant 
          }]}
          textStyle={{ 
            color: sortBy === 'recent' ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant 
          }}
        >
          Recent
        </Chip>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ color: theme.colors.onSurface, marginTop: 16 }}>Loading complete section...</Text>
        </View>
      ) : sortedItems.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlashList
          key={key}
          data={sortedItems}
          renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContainer,
            viewMode === 'grid' && styles.gridContainer
          ]}
          columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
          estimatedItemSize={viewMode === 'grid' ? 220 : 80}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  sortChip: {
    borderRadius: 16,
  },
  listContainer: {
    paddingBottom: 100,
  },
  gridContainer: {
    paddingHorizontal: 8,
  },
  gridRow: {
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  gridItemContainer: {
    width: (width - 48) / 2,
    marginVertical: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyTitle: {
    fontWeight: '600',
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
});
