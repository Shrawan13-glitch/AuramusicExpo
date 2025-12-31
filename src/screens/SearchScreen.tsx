import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Image, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';
import SongOptionsModal from '../components/SongOptionsModal';
import { useSongOptions } from '../hooks/useSongOptions';
import TabHeader from '../components/TabHeader';

const FILTERS = [
  { label: 'All', value: null },
  { label: 'Songs', value: 'EgWKAQIIAWoKEAoQAxAEEAkQBQ%3D%3D' },
  { label: 'Albums', value: 'EgWKAQIYAWoKEAoQAxAEEAkQBQ%3D%3D' },
  { label: 'Artists', value: 'EgWKAQIgAWoKEAoQAxAEEAkQBQ%3D%3D' },
  { label: 'Playlists', value: 'EgWKAQIoAWoKEAoQAxAEEAkQBQ%3D%3D' },
];

const MOOD_COLORS = [
  ['#ff6b6b', '#ee5a52'], ['#4ecdc4', '#44a08d'], ['#45b7d1', '#2980b9'], 
  ['#96ceb4', '#74b9ff'], ['#feca57', '#ff9ff3'], ['#ff9ff3', '#a29bfe'],
  ['#54a0ff', '#2e86de'], ['#5f27cd', '#341f97'], ['#00d2d3', '#0abde3'],
  ['#ff9f43', '#ee5a24'], ['#10ac84', '#00a085'], ['#ee5a24', '#c44569'],
  ['#0abde3', '#006ba6'], ['#c44569', '#8e44ad'], ['#f8b500', '#f39c12']
];

export default function SearchScreen({ navigation }: any) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [topResult, setTopResult] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [exploreData, setExploreData] = useState<any>(null);
  const [exploreLoading, setExploreLoading] = useState(true);
  const debounceTimer = useRef<NodeJS.Timeout>();
  const { playSong } = usePlayer();
  const { modalVisible, selectedSong, showOptions, hideOptions } = useSongOptions();

  useEffect(() => {
    loadExplore();
  }, []);

  const loadExplore = async () => {
    setExploreLoading(true);
    const result = await InnerTube.explore();
    setExploreData(result);
    setExploreLoading(false);
  };

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      if (query.length === 0) {
        setTopResult(null);
        setSections([]);
        setFilteredItems([]);
        setShowSuggestions(true);
      }
      return;
    }

    if (!showSuggestions) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      try {
        const sugg = await InnerTube.searchSuggestions(query);
        setSuggestions(sugg.slice(0, 8)); // Limit suggestions for performance
      } catch (error) {
        // Search suggestions error handled silently
      }
    }, 150); // Reduced debounce for faster suggestions

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, showSuggestions]);

  const executeSearch = useCallback(async (searchQuery: string, filter: string | null = null) => {
    setQuery(searchQuery);
    setShowSuggestions(false);
    setLoading(true);
    setSelectedFilter(filter);
    try {
      if (filter) {
        const { items } = await InnerTube.search(searchQuery, filter);
        setFilteredItems(items);
        setTopResult(null);
        setSections([]);
      } else {
        const { topResult: top, sections: secs } = await InnerTube.searchSummary(searchQuery);
        setTopResult(top);
        setSections(secs);
        setFilteredItems([]);
      }
    } catch (error) {
      // Search error handled silently
    } finally {
      setLoading(false);
    }
  }, []);

  const renderItem = useCallback(({ item }: { item: any }) => {
    const getSubtitle = () => {
      if (item.type === 'song') {
        return item.artists?.map((a: any) => a.name).join(', ') || 'Song';
      }
      if (item.type === 'artist') {
        return 'Artist';
      }
      if (item.type === 'album') {
        const artists = item.artists?.map((a: any) => a.name).join(', ');
        return artists ? `Album • ${artists}` : 'Album';
      }
      if (item.type === 'playlist') {
        return item.description || 'Playlist';
      }
      return '';
    };

    const thumbnailStyle = item.type === 'artist' 
      ? [styles.thumbnail, styles.roundThumbnail] 
      : styles.thumbnail;

    const title = item.type === 'artist' ? item.name : item.title;

    return (
      <TouchableOpacity 
        style={styles.item} 
        onPress={() => {
          if (item.type === 'song') {
            playSong(item);
          } else if (item.type === 'artist') {
            navigation?.navigate('Artist', { artistId: item.id });
          } else if (item.type === 'album') {
            navigation?.navigate('Album', { albumId: item.id });
          } else if (item.type === 'playlist') {
            navigation?.navigate('Playlist', { playlistId: item.id });
          }
        }}
        onLongPress={item.type === 'song' ? () => showOptions(item) : undefined}
      >
        <Image 
          source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : require('../../assets/icon.png')} 
          style={thumbnailStyle}
          resizeMode="cover"
          onError={() => {}}
        />
        <View style={styles.itemInfo}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{getSubtitle()}</Text>
        </View>
        {item.type === 'song' && (
          <TouchableOpacity onPress={() => showOptions(item)}>
            <Ionicons name="ellipsis-vertical" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }, [playSong, navigation, showOptions]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={22} color="#1db954" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search songs, artists, albums..."
          placeholderTextColor="#666"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (!showSuggestions) setShowSuggestions(true);
            if (text.length === 0) {
              setTopResult(null);
              setSections([]);
              setFilteredItems([]);
              setSelectedFilter(null);
            }
          }}
          onSubmitEditing={() => executeSearch(query)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { 
            setQuery(''); 
            setSuggestions([]);
            setTopResult(null);
            setSections([]);
            setFilteredItems([]);
            setSelectedFilter(null);
            setShowSuggestions(true);
          }}>
            <Ionicons name="close-circle" size={22} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {query.length === 0 ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
          <View style={styles.section}>
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionTitle}>Browse all</Text>
              <Text style={styles.sectionSubtitle}>Discover music by mood and genre</Text>
            </View>
            <View style={styles.genreGrid}>
              {exploreLoading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <View key={`skeleton-${index}`} style={styles.skeletonItem}>
                    <View style={styles.skeletonContent} />
                  </View>
                ))
              ) : (
                exploreData?.moodAndGenres?.map((genre: any, index: number) => {
                  const colors = MOOD_COLORS[index % MOOD_COLORS.length];
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.genreItem,
                        {
                          background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
                          backgroundColor: colors[0],
                          shadowColor: colors[1],
                        }
                      ]}
                      onPress={() => navigation.navigate('Browse', { params: genre.params })}
                    >
                      <View style={styles.genreContent}>
                        <Text style={styles.genreText}>{genre.title}</Text>
                      </View>
                      <View style={[styles.genreAccent, { backgroundColor: colors[1] }]} />
                      <View style={[styles.genreAccent2, { backgroundColor: colors[0], opacity: 0.1 }]} />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        </ScrollView>
      ) : showSuggestions && suggestions.length > 0 ? (
        <FlashList
          data={suggestions}
          keyExtractor={(item, index) => `suggestion-${index}`}
          estimatedItemSize={60}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.suggestionItem}
              onPress={() => executeSearch(item)}
            >
              <Ionicons name="search" size={18} color="#666" style={{ marginRight: 12 }} />
              <Text style={styles.suggestionText}>{item}</Text>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setQuery(item);
                }}
                style={styles.fillButton}
              >
                <Ionicons name="arrow-up" size={18} color="#666" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      ) : loading ? (
        <View style={styles.skeletonContainer}>
          {Array.from({ length: 6 }).map((_, index) => (
            <View key={`search-skeleton-${index}`} style={styles.searchSkeletonItem}>
              <View style={styles.searchSkeletonThumb} />
              <View style={styles.searchSkeletonInfo}>
                <View style={styles.searchSkeletonTitle} />
                <View style={styles.searchSkeletonSubtitle} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {query.length >= 2 && (
            <View style={styles.filterChips}>
              {FILTERS.map((filter) => (
                <TouchableOpacity
                  key={filter.label}
                  style={[
                    styles.chip,
                    selectedFilter === filter.value && styles.chipSelected,
                  ]}
                  onPress={() => executeSearch(query, filter.value)}
                >
                  <Text style={[
                    styles.chipText,
                    selectedFilter === filter.value && styles.chipTextSelected,
                  ]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {selectedFilter ? (
            <FlashList
              data={filteredItems}
              renderItem={renderItem}
              keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
              estimatedItemSize={80}
              ListEmptyComponent={
                query.length >= 2 && !loading && filteredItems.length === 0 ? (
                  <Text style={styles.emptyText}>No results found</Text>
                ) : null
              }
            />
          ) : (
            <FlashList
              data={sections}
              keyExtractor={(section, index) => `section-${index}`}
              estimatedItemSize={200}
              renderItem={({ item: section }) => (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  {section.items.map((item: any, idx: number) => (
                    <View key={`${item.id}-${idx}`}>
                      {renderItem({ item })}
                    </View>
                  ))}
                </View>
              )}
              ListEmptyComponent={
                query.length >= 2 && !loading && sections.length === 0 ? (
                  <Text style={styles.emptyText}>No results found</Text>
                ) : null
              }
            />
          )}

        </View>
      )}

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
  container: { flex: 1, backgroundColor: '#000' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  searchIcon: { marginRight: 12, opacity: 0.7 },
  searchInput: { 
    flex: 1, 
    color: '#fff', 
    paddingVertical: 16, 
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionHeaderContainer: {
    marginBottom: 20,
  },
  sectionTitle: { 
    fontSize: 24, 
    fontWeight: '900', 
    color: '#fff', 
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 4,
    fontWeight: '500',
  },
  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genreItem: { 
    width: '48%',
    height: 120,
    borderRadius: 16,
    padding: 0,
    justifyContent: 'flex-end',
    position: 'relative',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  genreContent: {
    padding: 20,
    zIndex: 3,
  },
  genreText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    letterSpacing: 0.5,
    lineHeight: 22,
  },
  genreAccent: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.15,
    transform: [{ rotate: '25deg' }],
  },
  genreAccent2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 60,
    height: 60,
    borderRadius: 30,
    transform: [{ rotate: '-15deg' }],
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  suggestionText: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  fillButton: {
    padding: 8,
  },
  item: { flexDirection: 'row', padding: 12, alignItems: 'center' },
  thumbnail: { width: 56, height: 56, borderRadius: 4 },
  roundThumbnail: { borderRadius: 28 },
  itemInfo: { flex: 1, marginLeft: 12 },
  title: { fontSize: 16, color: '#fff', fontWeight: '500' },
  subtitle: { fontSize: 14, color: '#aaa', marginTop: 4 },
  loader: { marginTop: 50 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 50, fontSize: 16 },
  filterChips: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333' },
  chipSelected: { backgroundColor: '#1db954', borderColor: '#1db954' },
  chipText: { color: '#aaa', fontSize: 14, fontWeight: '500' },
  chipTextSelected: { color: '#000', fontWeight: '600' },
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  skeletonItem: {
    width: '48%',
    height: 120,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
  },
  skeletonContent: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    margin: 1,
    borderRadius: 15,
  },
  skeletonContainer: {
    padding: 16,
  },
  searchSkeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchSkeletonThumb: {
    width: 56,
    height: 56,
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
  },
  searchSkeletonInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchSkeletonTitle: {
    height: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginBottom: 8,
    width: '70%',
  },
  searchSkeletonSubtitle: {
    height: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    width: '50%',
  },
});
