import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Searchbar, 
  Text, 
  Chip, 
  useTheme, 
  Surface,
  ActivityIndicator
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePlayer } from '../contexts/PlayerContext';
import SearchSuggestions from '../components/SearchSuggestions';
import SearchResultItem from '../components/SearchResultItem';
import { YouTubeMusicAPI, SearchResult, SearchFilter, SEARCH_FILTERS } from '../../api';

interface EnhancedSearchScreenProps {
  navigation?: any;
}

const EnhancedSearchScreen = React.memo(({ navigation }: EnhancedSearchScreenProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<SearchFilter>(SEARCH_FILTERS[0]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  const theme = useTheme();
  const { playTrack } = usePlayer();
  const debounceRef = useRef<NodeJS.Timeout>();

  // Debounced search function
  const debouncedSearch = useCallback(async (query: string, filter: SearchFilter = SEARCH_FILTERS[0]) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setShowSuggestions(false);
    
    try {
      const searchResults = await YouTubeMusicAPI.search(query, filter.value === 'all' ? undefined : filter);
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFilterChange = useCallback((filter: SearchFilter) => {
    setSelectedFilter(filter);
    if (searchQuery.trim()) {
      debouncedSearch(searchQuery, filter);
    }
  }, [searchQuery, debouncedSearch]);

  const handlePlayTrack = useCallback((track: SearchResult) => {
    if (track.type === 'playlist') {
      navigation?.navigate('Playlist', { playlistId: track.id });
    } else if (track.type === 'album') {
      navigation?.navigate('Album', { albumId: track.id });
    } else if (track.type === 'artist') {
      navigation?.navigate('Artist', { artistId: track.id, artistName: track.title });
    } else if (track.type === 'profile') {
      navigation?.navigate('Profile', { 
        profileData: {
          title: track.title,
          description: '',
          thumbnail: track.thumbnail,
          bannerThumbnail: '',
          subscriberCount: track.subscribers || '0',
          isSubscribed: false,
          channelId: track.id,
          sections: []
        }
      });
    } else if (track.type === 'song' || track.type === 'video') {
      playTrack({
        id: track.id,
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail,
        artistId: track.artistIds?.[0]
      }, undefined, {
        source: {
          type: 'search',
          label: 'Search',
          ytQueuePlaylistId: track.watchPlaylistId,
          ytQueueParams: track.watchParams,
        },
      });
    }
  }, [playTrack, navigation]);

  const onChangeText = useCallback((query: string) => {
    setSearchQuery(query);
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    if (query.length === 0) {
      setShowSuggestions(true);
      setResults([]);
    } else if (query.length > 2) {
      // Debounce search by 300ms
      debounceRef.current = setTimeout(() => {
        debouncedSearch(query, selectedFilter);
      }, 300);
    }
  }, [selectedFilter, debouncedSearch]);

  const handleSuggestionPress = useCallback((suggestion: string) => {
    setSearchQuery(suggestion);
    debouncedSearch(suggestion, selectedFilter);
  }, [selectedFilter, debouncedSearch]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const renderResult = useCallback(({ item }: { item: SearchResult }) => (
    <SearchResultItem
      item={item}
      onPress={() => handlePlayTrack(item)}
      navigation={navigation}
    />
  ), [handlePlayTrack, navigation]);

  const keyExtractor = useCallback((item: SearchResult) => item.id, []);

  const filterChips = useMemo(() => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.filtersContainer}
      contentContainerStyle={styles.filtersContent}
    >
      {SEARCH_FILTERS.map((filter) => (
        <Chip
          key={filter.value}
          selected={selectedFilter.value === filter.value}
          onPress={() => handleFilterChange(filter)}
          mode="flat"
          style={[
            styles.filterChip,
            {
              backgroundColor: selectedFilter.value === filter.value 
                ? theme.colors.primaryContainer 
                : theme.colors.surfaceVariant
            }
          ]}
          textStyle={{
            color: selectedFilter.value === filter.value 
              ? theme.colors.onPrimaryContainer 
              : theme.colors.onSurfaceVariant
          }}
        >
          {filter.label}
        </Chip>
      ))}
    </ScrollView>
  ), [selectedFilter, theme.colors, handleFilterChange]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <Surface style={[styles.searchHeader, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <Searchbar
          placeholder="Search songs, videos, albums, artists..."
          onChangeText={onChangeText}
          value={searchQuery}
          style={[styles.searchbar, { backgroundColor: theme.colors.surfaceVariant }]}
          inputStyle={{ color: theme.colors.onSurface }}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          iconColor={theme.colors.onSurfaceVariant}
        />
      </Surface>

      {!showSuggestions && filterChips}

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text variant="bodyMedium" style={[styles.loadingText, { color: theme.colors.onBackground }]}>
            Searching...
          </Text>
        </View>
      )}

      {showSuggestions && (
        <SearchSuggestions onSuggestionPress={handleSuggestionPress} />
      )}

      {!loading && !showSuggestions && (
        <View style={styles.results}>
          {results.length > 0 ? (
            <FlashList
              data={results}
              renderItem={renderResult}
              keyExtractor={keyExtractor}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.resultsList}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={10}
              initialNumToRender={10}
              estimatedItemSize={72}
            />
          ) : (
            <View style={styles.noResults}>
              <MaterialCommunityIcons 
                name="music-off" 
                size={64} 
                color={theme.colors.onSurfaceVariant} 
              />
              <Text variant="titleMedium" style={[styles.noResultsText, { color: theme.colors.onSurfaceVariant }]}>
                No results found
              </Text>
              <Text variant="bodyMedium" style={[styles.noResultsSubtext, { color: theme.colors.onSurfaceVariant }]}>
                Try searching for something else
              </Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
});

export default EnhancedSearchScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchbar: {
    elevation: 0,
    borderRadius: 28,
  },
  filtersContainer: {
    maxHeight: 48,
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    marginRight: 8,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  results: {
    flex: 1,
  },
  resultsList: {
    paddingBottom: 132,
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  noResultsText: {
    fontWeight: '500',
  },
  noResultsSubtext: {
    textAlign: 'center',
  },
});
