import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Searchbar, 
  Text, 
  Chip, 
  useTheme, 
  Surface,
  ActivityIndicator,
  Button
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePlayer } from '../contexts/PlayerContext';
import SearchResultItem from '../components/SearchResultItem';
import { YouTubeMusicAPI, SearchResult, SearchFilter, SEARCH_FILTERS } from '../../api';

interface EnhancedSearchScreenProps {
  navigation?: any;
}

const SEARCH_HISTORY_KEY = 'search_history_v1';
const MAX_SEARCH_HISTORY = 20;

type SuggestionRow =
  | { type: 'header'; key: string; title: string; action?: 'clear_history' }
  | { type: 'item'; key: string; value: string; source: 'history' | 'suggestion' };

const EnhancedSearchScreen = React.memo(({ navigation }: EnhancedSearchScreenProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<SearchFilter>(SEARCH_FILTERS[0]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  const theme = useTheme();
  const { playTrack } = usePlayer();
  const suggestionDebounceRef = useRef<NodeJS.Timeout>();

  const persistSearchHistory = useCallback(async (history: string[]) => {
    setSearchHistory(history);
    try {
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch {
      // no-op
    }
  }, []);

  const pushSearchHistory = useCallback(async (query: string) => {
    const normalized = query.trim();
    if (!normalized) return;
    const next = [normalized, ...searchHistory.filter((item) => item.toLowerCase() !== normalized.toLowerCase())]
      .slice(0, MAX_SEARCH_HISTORY);
    await persistSearchHistory(next);
  }, [persistSearchHistory, searchHistory]);

  const runSearch = useCallback(async (query: string, filter: SearchFilter = SEARCH_FILTERS[0]) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setShowSuggestions(false);
    
    try {
      const searchResults = await YouTubeMusicAPI.search(query, filter.value === 'all' ? undefined : filter);
      setResults(searchResults);
      await pushSearchHistory(query);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [pushSearchHistory]);

  const fetchSuggestions = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    setLoadingSuggestions(true);
    try {
      const list = await YouTubeMusicAPI.searchSuggestions(trimmed);
      setSuggestions(list);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const handleFilterChange = useCallback((filter: SearchFilter) => {
    setSelectedFilter(filter);
    if (searchQuery.trim() && !showSuggestions) {
      void runSearch(searchQuery, filter);
    }
  }, [runSearch, searchQuery, showSuggestions]);

  const handlePlayTrack = useCallback((track: SearchResult) => {
    if (track.type === 'playlist') {
      navigation?.navigate('Playlist', { playlistId: track.id });
    } else if (track.type === 'album') {
      navigation?.navigate('Album', { albumId: track.id });
    } else if (track.type === 'podcast' || track.type === 'episode') {
      navigation?.navigate('Podcast', { podcastId: track.id, title: track.title });
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
      const splitArtists = track.artist
        .split(/\s*(?:,|&|and| x | · |\/|feat\.?|ft\.?)\s*/i)
        .map((value) => value.trim())
        .filter(Boolean);
      const artists = splitArtists.map((name, index) => ({
        name,
        id: track.artistIds?.[index] || (index === 0 ? track.artistIds?.[0] : undefined),
      }));
      playTrack({
        id: track.id,
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail,
        artistId: track.artistIds?.[0],
        artists,
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

    if (suggestionDebounceRef.current) {
      clearTimeout(suggestionDebounceRef.current);
    }

    if (query.length === 0) {
      setShowSuggestions(true);
      setResults([]);
      setSuggestions([]);
    } else {
      setShowSuggestions(true);
      suggestionDebounceRef.current = setTimeout(() => {
        void fetchSuggestions(query);
      }, 160);
    }
  }, [fetchSuggestions]);

  const handleSuggestionPress = useCallback((suggestion: string) => {
    setSearchQuery(suggestion);
    setSuggestions([]);
    void runSearch(suggestion, selectedFilter);
  }, [runSearch, selectedFilter]);

  const clearHistory = useCallback(async () => {
    await persistSearchHistory([]);
  }, [persistSearchHistory]);

  // Cleanup debounce on unmount
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(SEARCH_HISTORY_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSearchHistory(parsed.filter((entry) => typeof entry === 'string').slice(0, MAX_SEARCH_HISTORY));
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
      if (suggestionDebounceRef.current) {
        clearTimeout(suggestionDebounceRef.current);
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

  const suggestionRows = useMemo<SuggestionRow[]>(() => {
    const rows: SuggestionRow[] = [];
    const query = searchQuery.trim().toLowerCase();
    const historyMatches = searchHistory
      .filter((item) => !query || item.toLowerCase().includes(query))
      .slice(0, 6);
    const suggestionMatches = suggestions
      .filter((item) => !historyMatches.some((h) => h.toLowerCase() === item.toLowerCase()))
      .slice(0, 12);

    if (historyMatches.length) {
      rows.push({ type: 'header', key: 'history-header', title: 'Recent Searches', action: 'clear_history' });
      historyMatches.forEach((value) => {
        rows.push({ type: 'item', key: `history-${value}`, value, source: 'history' });
      });
    }
    if (suggestionMatches.length) {
      rows.push({ type: 'header', key: 'suggestions-header', title: 'Suggestions' });
      suggestionMatches.forEach((value) => {
        rows.push({ type: 'item', key: `suggestion-${value}`, value, source: 'suggestion' });
      });
    }
    return rows;
  }, [searchHistory, searchQuery, suggestions]);

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
          onSubmitEditing={() => void runSearch(searchQuery, selectedFilter)}
        />
      </Surface>

      {!showSuggestions && (
        <View style={styles.filtersContainer}>
          <FlashList
            data={SEARCH_FILTERS}
            horizontal
            showsHorizontalScrollIndicator={false}
            estimatedItemSize={72}
            keyExtractor={(item) => item.value}
            contentContainerStyle={styles.filtersContent}
            renderItem={({ item: filter }) => (
              <Chip
                selected={selectedFilter.value === filter.value}
                onPress={() => handleFilterChange(filter)}
                mode="flat"
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selectedFilter.value === filter.value
                      ? theme.colors.primaryContainer
                      : theme.colors.surfaceVariant,
                  },
                ]}
                textStyle={{
                  color: selectedFilter.value === filter.value
                    ? theme.colors.onPrimaryContainer
                    : theme.colors.onSurfaceVariant,
                }}
              >
                {filter.label}
              </Chip>
            )}
          />
        </View>
      )}

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text variant="bodyMedium" style={[styles.loadingText, { color: theme.colors.onBackground }]}>
            Searching...
          </Text>
        </View>
      )}

      {showSuggestions && (
        <View style={styles.results}>
          {loadingSuggestions ? (
            <View style={styles.suggestionLoading}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : (
            <FlashList
              data={suggestionRows}
              estimatedItemSize={56}
              keyExtractor={(item) => item.key}
              contentContainerStyle={styles.suggestionsList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                if (item.type === 'header') {
                  return (
                    <View style={styles.suggestionHeader}>
                      <Text style={[styles.suggestionHeaderText, { color: theme.colors.onSurfaceVariant }]}>
                        {item.title}
                      </Text>
                      {item.action === 'clear_history' ? (
                        <Button compact mode="text" onPress={() => void clearHistory()}>
                          Clear
                        </Button>
                      ) : null}
                    </View>
                  );
                }
                return (
                  <TouchableOpacity
                    style={styles.suggestionRow}
                    onPress={() => handleSuggestionPress(item.value)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name={item.source === 'history' ? 'history' : 'magnify'}
                      size={18}
                      color={theme.colors.onSurfaceVariant}
                    />
                    <Text numberOfLines={1} style={[styles.suggestionText, { color: theme.colors.onSurface }]}>
                      {item.value}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.noResults}>
                  <MaterialCommunityIcons
                    name="magnify"
                    size={40}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Start typing to see suggestions
                  </Text>
                </View>
              }
            />
          )}
        </View>
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
    height: 52,
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterChip: {
    marginRight: 8,
  },
  suggestionsList: {
    paddingHorizontal: 16,
    paddingBottom: 132,
  },
  suggestionHeader: {
    marginTop: 10,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  suggestionRow: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  suggestionText: {
    flex: 1,
    fontSize: 15,
  },
  suggestionLoading: {
    paddingTop: 16,
    alignItems: 'center',
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
