import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Image, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';
import { Song } from '../types';
import SongOptionsModal from '../components/SongOptionsModal';
import { useSongOptions } from '../hooks/useSongOptions';

const FILTERS = [
  { label: 'All', value: null },
  { label: 'Songs', value: 'EgWKAQIIAWoKEAoQAxAEEAkQBQ%3D%3D' },
  { label: 'Albums', value: 'EgWKAQIYAWoKEAoQAxAEEAkQBQ%3D%3D' },
  { label: 'Artists', value: 'EgWKAQIgAWoKEAoQAxAEEAkQBQ%3D%3D' },
  { label: 'Playlists', value: 'EgWKAQIoAWoKEAoQAxAEEAkQBQ%3D%3D' },
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
  const debounceTimer = useRef<NodeJS.Timeout>();
  const { playSong } = usePlayer();
  const { modalVisible, selectedSong, showOptions, hideOptions } = useSongOptions();

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
    }, 400); // Increased debounce for better performance

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
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.header}>Search</Text>
      </View>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
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
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {showSuggestions && suggestions.length > 0 ? (
        <FlatList
          data={suggestions}
          keyExtractor={(item, index) => `suggestion-${index}`}
          removeClippedSubviews={true}
          maxToRenderPerBatch={5}
          windowSize={5}
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
        <ActivityIndicator size="large" color="#fff" style={styles.loader} />
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
            <FlatList
              data={filteredItems}
              renderItem={renderItem}
              keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={10}
              initialNumToRender={15}
              ListEmptyComponent={
                query.length >= 2 && !loading && filteredItems.length === 0 ? (
                  <Text style={styles.emptyText}>No results found</Text>
                ) : null
              }
            />
          ) : (
            <FlatList
              data={sections}
              keyExtractor={(section, index) => `section-${index}`}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  backButton: { padding: 4 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#fff', flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    padding: 12,
    fontSize: 16,
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
});
