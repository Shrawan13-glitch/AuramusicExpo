import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Image, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';
import { Song } from '../types';

interface SearchResults {
  songs: Song[];
  albums: any[];
  artists: any[];
  playlists: any[];
}

export default function SearchScreen({ navigation: tabNavigation }: any) {
  const navigation = tabNavigation.getParent();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResults>({ songs: [], albums: [], artists: [], playlists: [] });
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const debounceTimer = useRef<NodeJS.Timeout>();
  const { playSong } = usePlayer();

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      if (query.length === 0) {
        setResults({ songs: [], albums: [], artists: [], playlists: [] });
        setShowSuggestions(true);
      }
      return;
    }

    if (!showSuggestions) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      console.log('Fetching suggestions for:', query);
      const sugg = await InnerTube.searchSuggestions(query);
      console.log('Got suggestions:', sugg);
      setSuggestions(sugg);
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, showSuggestions]);

  const executeSearch = async (searchQuery: string) => {
    setQuery(searchQuery);
    setShowSuggestions(false);
    setLoading(true);
    try {
      const searchResults = await InnerTube.search(searchQuery);
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
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
      >
        <Image source={{ uri: item.thumbnailUrl }} style={thumbnailStyle} />
        <View style={styles.itemInfo}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{getSubtitle()}</Text>
        </View>
        <Ionicons name="ellipsis-vertical" size={20} color="#666" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
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
            if (text.length === 0) setResults({ songs: [], albums: [], artists: [], playlists: [] });
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
            setResults({ songs: [], albums: [], artists: [], playlists: [] }); 
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
        <FlatList
          data={[
            ...(results.songs || []),
            ...(results.artists || []),
            ...(results.albums || []),
            ...(results.playlists || []),
          ]}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
          ListEmptyComponent={
            query.length >= 2 && !showSuggestions ? (
              <Text style={styles.emptyText}>No results found</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
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
});
