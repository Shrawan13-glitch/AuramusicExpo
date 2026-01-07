import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, TextInput, Modal, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLibrary } from '../store/LibraryContext';
import { InnerTube } from '../api/innertube';

interface CustomCommand {
  id: string;
  keyword: string;
  type: 'song' | 'playlist' | 'album' | 'artist';
  targetId: string;
  targetName: string;
}

export default function VoiceSettingsScreen({ navigation }: any) {
  const { likedSongs, playlists } = useLibrary();
  const [settings, setSettings] = useState({
    language: 'en-US',
    interimResults: true,
    continuous: false,
    autoPlay: true,
  });
  const [customCommands, setCustomCommands] = useState<CustomCommand[]>([]);
  const [showAddCommand, setShowAddCommand] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedType, setSelectedType] = useState<'song' | 'playlist' | 'album' | 'artist'>('song');

  useEffect(() => {
    loadSettings();
    loadCustomCommands();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('voiceAssistantSettings');
      if (saved) setSettings(JSON.parse(saved));
    } catch (error) {}
  };

  const loadCustomCommands = async () => {
    try {
      const saved = await AsyncStorage.getItem('voiceCustomCommands');
      if (saved) setCustomCommands(JSON.parse(saved));
    } catch (error) {}
  };

  const saveSettings = async (newSettings: typeof settings) => {
    try {
      await AsyncStorage.setItem('voiceAssistantSettings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {}
  };

  const saveCustomCommands = async (commands: CustomCommand[]) => {
    try {
      await AsyncStorage.setItem('voiceCustomCommands', JSON.stringify(commands));
      setCustomCommands(commands);
    } catch (error) {}
  };

  const loadLibraryContent = () => {
    const results = [];
    
    if (selectedType === 'playlist') {
      // Add liked songs as a special playlist
      if (likedSongs.length > 0) {
        results.push({
          id: 'liked-songs',
          name: 'Liked Songs',
          title: 'Liked Songs',
          description: `${likedSongs.length} songs`,
          thumbnailUrl: null,
          type: 'playlist',
          source: 'library'
        });
      }
      
      const libraryPlaylists = playlists.map(p => ({ ...p, type: 'playlist', source: 'library' }));
      results.push(...libraryPlaylists);
    }
    
    if (selectedType === 'song') {
      const librarySongs = likedSongs.map(s => ({ ...s, type: 'song', source: 'library' }));
      results.push(...librarySongs);
    }
    
    setSearchResults(results);
  };

  const searchContent = async (query: string) => {
    if (!query.trim()) return;
    
    try {
      const results = [];
      
      // Search library first
      if (selectedType === 'playlist') {
        const libraryPlaylists = playlists.filter(p => 
          p.name && p.name.toLowerCase().includes(query.toLowerCase())
        ).map(p => ({ ...p, type: 'playlist', source: 'library' }));
        results.push(...libraryPlaylists);
      }
      
      if (selectedType === 'song') {
        const librarySongs = likedSongs.filter(s => 
          s.title && s.title.toLowerCase().includes(query.toLowerCase())
        ).map(s => ({ ...s, type: 'song', source: 'library' }));
        results.push(...librarySongs);
      }
      
      // Search YouTube Music using filter
      const filterMap = {
        song: 'EgWKAQIIAWoKEAoQAxAEEAkQBQ%3D%3D',
        album: 'EgWKAQIYAWoKEAoQAxAEEAkQBQ%3D%3D', 
        artist: 'EgWKAQIgAWoKEAoQAxAEEAkQBQ%3D%3D',
        playlist: 'EgWKAQIoAWoKEAoQAxAEEAkQBQ%3D%3D'
      };
      
      const filter = filterMap[selectedType];
      const searchResult = await InnerTube.search(query, filter);
      
      if (searchResult?.items) {
        const filteredResults = searchResult.items
          .filter(item => item.type === selectedType)
          .map(item => ({ ...item, source: 'youtube' }));
        results.push(...filteredResults);
      }
      
      // Sort: library items first, then by relevance
      const sortedResults = results.sort((a, b) => {
        if (a.source === 'library' && b.source !== 'library') return -1;
        if (a.source !== 'library' && b.source === 'library') return 1;
        return 0;
      });
      
      setSearchResults(sortedResults.slice(0, 20));
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }
  };

  const addCustomCommand = (item: any) => {
    if (!newKeyword.trim()) return;
    
    const command: CustomCommand = {
      id: Date.now().toString(),
      keyword: newKeyword.toLowerCase(),
      type: selectedType,
      targetId: item.id,
      targetName: item.title || item.name,
    };
    
    console.log('Adding custom command:', command);
    const updated = [...customCommands, command];
    saveCustomCommands(updated);
    setNewKeyword('');
    setShowAddCommand(false);
    setShowSearch(false);
  };

  const removeCommand = (id: string) => {
    const updated = customCommands.filter(c => c.id !== id);
    saveCustomCommands(updated);
  };

  const languageOptions = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'es-ES', name: 'Spanish' },
    { code: 'fr-FR', name: 'French' },
    { code: 'de-DE', name: 'German' },
    { code: 'it-IT', name: 'Italian' },
    { code: 'pt-BR', name: 'Portuguese' },
    { code: 'ja-JP', name: 'Japanese' },
    { code: 'ko-KR', name: 'Korean' },
    { code: 'zh-CN', name: 'Chinese' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Speech Recognition Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Speech Recognition</Text>
          </View>
          
          <View style={styles.cardContent}>
            <View style={styles.languageSection}>
              <Text style={styles.label}>Language</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.languageScroll}>
                {languageOptions.map((lang) => (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.languageChip, settings.language === lang.code && styles.languageChipActive]}
                    onPress={() => saveSettings({ ...settings, language: lang.code })}
                  >
                    <Text style={[styles.languageChipText, settings.language === lang.code && styles.languageChipTextActive]}>
                      {lang.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.toggleGroup}>
              <View style={styles.toggleItem}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>Auto-play results</Text>
                  <Text style={styles.toggleDescription}>Automatically play found songs</Text>
                </View>
                <Switch
                  value={settings.autoPlay}
                  onValueChange={(value) => saveSettings({ ...settings, autoPlay: value })}
                  trackColor={{ false: '#333', true: '#1db954' }}
                  thumbColor={settings.autoPlay ? '#fff' : '#666'}
                />
              </View>

              <View style={styles.toggleItem}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>Show interim results</Text>
                  <Text style={styles.toggleDescription}>Display text while speaking</Text>
                </View>
                <Switch
                  value={settings.interimResults}
                  onValueChange={(value) => saveSettings({ ...settings, interimResults: value })}
                  trackColor={{ false: '#333', true: '#1db954' }}
                  thumbColor={settings.interimResults ? '#fff' : '#666'}
                />
              </View>

              <View style={[styles.toggleItem, styles.toggleItemLast]}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>Continuous listening</Text>
                  <Text style={styles.toggleDescription}>Keep listening after commands</Text>
                </View>
                <Switch
                  value={settings.continuous}
                  onValueChange={(value) => saveSettings({ ...settings, continuous: value })}
                  trackColor={{ false: '#333', true: '#1db954' }}
                  thumbColor={settings.continuous ? '#fff' : '#666'}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Custom Commands Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Custom Commands</Text>
              <Text style={styles.cardSubtitle}>Create voice shortcuts for your content</Text>
            </View>
            <TouchableOpacity onPress={() => setShowAddCommand(true)} style={styles.addButton}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.cardContent}>
            {customCommands.length > 0 ? (
              <View style={styles.commandsList}>
                {customCommands.map((command, index) => (
                  <View key={command.id} style={[styles.commandItem, index === customCommands.length - 1 && styles.commandItemLast]}>
                    <View style={styles.commandInfo}>
                      <Text style={styles.commandKeyword}>"{command.keyword}"</Text>
                      <Text style={styles.commandTarget}>{command.targetName}</Text>
                      <View style={styles.commandTypeContainer}>
                        <Text style={styles.commandType}>{command.type}</Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => removeCommand(command.id)} style={styles.deleteButton}>
                      <Ionicons name="trash-outline" size={18} color="#ff4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="mic-outline" size={32} color="#666" />
                </View>
                <Text style={styles.emptyTitle}>No custom commands</Text>
                <Text style={styles.emptyDescription}>Tap the + button to create voice shortcuts</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal visible={showAddCommand} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddCommand(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddCommand(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Voice Command</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.instructionCard}>
              <Ionicons name="information-circle" size={24} color="#1db954" />
              <View style={styles.instructionText}>
                <Text style={styles.instructionTitle}>How it works</Text>
                <Text style={styles.instructionDescription}>
                  Create a voice shortcut by saying a keyword to instantly play your favorite content.
                </Text>
              </View>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Voice Command</Text>
              <Text style={styles.inputDescription}>What you'll say to trigger this command</Text>
              <TextInput
                style={styles.textInput}
                placeholder='e.g., "my playlist", "workout music", "chill vibes"'
                placeholderTextColor="#666"
                value={newKeyword}
                onChangeText={setNewKeyword}
              />
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Content Type</Text>
              <Text style={styles.inputDescription}>What type of content to play</Text>
              <View style={styles.typeSelector}>
                {(['song', 'playlist', 'album', 'artist'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeOption, selectedType === type && styles.typeOptionActive]}
                    onPress={() => setSelectedType(type)}
                  >
                    <Ionicons 
                      name={type === 'song' ? 'musical-note' : type === 'playlist' ? 'list' : type === 'album' ? 'disc' : 'person'} 
                      size={16} 
                      color={selectedType === type ? '#fff' : '#aaa'} 
                    />
                    <Text style={[styles.typeText, selectedType === type && styles.typeTextActive]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Select {selectedType}</Text>
              <Text style={styles.inputDescription}>Choose from your library or search online</Text>
              <View style={styles.sourceButtons}>
                <TouchableOpacity 
                  style={[styles.sourceButton, !newKeyword.trim() && styles.sourceButtonDisabled]} 
                  onPress={() => {
                    if (!newKeyword.trim()) return;
                    setSearchQuery('');
                    setSearchResults([]);
                    loadLibraryContent();
                    setShowSearch(true);
                  }}
                  disabled={!newKeyword.trim()}
                >
                  <Ionicons name="library" size={20} color={newKeyword.trim() ? '#fff' : '#666'} />
                  <Text style={[styles.sourceButtonText, !newKeyword.trim() && styles.sourceButtonTextDisabled]}>From Library</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.sourceButton, !newKeyword.trim() && styles.sourceButtonDisabled]} 
                  onPress={() => {
                    if (!newKeyword.trim()) return;
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowSearch(true);
                  }}
                  disabled={!newKeyword.trim()}
                >
                  <Ionicons name="search" size={20} color={newKeyword.trim() ? '#fff' : '#666'} />
                  <Text style={[styles.sourceButtonText, !newKeyword.trim() && styles.sourceButtonTextDisabled]}>Search Online</Text>
                </TouchableOpacity>
              </View>
              {!newKeyword.trim() && (
                <Text style={styles.helperText}>Enter a voice command first</Text>
              )}
            </View>

            <View style={styles.exampleSection}>
              <Text style={styles.exampleTitle}>Example</Text>
              <View style={styles.exampleCard}>
                <Text style={styles.exampleText}>
                  Say: <Text style={styles.exampleKeyword}>"good morning"</Text>
                </Text>
                <Text style={styles.exampleResult}>
                  → Plays your selected {selectedType}
                </Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showSearch} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSearch(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSearch(false)}>
              <Text style={styles.cancelText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select {selectedType}</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={`Search ${selectedType}s...`}
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => searchContent(searchQuery)}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => searchContent(searchQuery)} style={styles.searchButton}>
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={searchResults}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            renderItem={({ item }) => {
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
                ? [styles.resultThumbnail, styles.roundThumbnail] 
                : styles.resultThumbnail;

              const title = item.type === 'artist' ? item.name : (item.title || item.name);
              
              const thumbnailSource = item.id === 'liked-songs' 
                ? { uri: 'https://misc.scdn.co/liked-songs/liked-songs-300.png' }
                : item.thumbnailUrl 
                  ? { uri: item.thumbnailUrl } 
                  : require('../../assets/icon.png');

              return (
                <TouchableOpacity style={styles.resultItem} onPress={() => addCustomCommand(item)}>
                  <View style={styles.resultLeft}>
                    <Image 
                      source={thumbnailSource}
                      style={thumbnailStyle}
                      resizeMode="cover"
                    />
                    {item.id === 'liked-songs' && (
                      <View style={styles.likedOverlay}>
                        <Ionicons name="heart" size={12} color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultTitle}>{title || 'Unknown'}</Text>
                    <Text style={styles.resultSubtitle}>{getSubtitle()}</Text>
                    <View style={styles.resultMeta}>
                      <View style={styles.sourceTag}>
                        <Text style={styles.sourceText}>{item.source}</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.addItemButton} onPress={() => addCustomCommand(item)}>
                    <Ionicons name="add" size={20} color="#1db954" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
            style={styles.resultsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyResults}>
                <Ionicons name="search" size={48} color="#666" />
                <Text style={styles.emptyResultsText}>No {selectedType}s found</Text>
                <Text style={styles.emptyResultsSubtext}>Try searching with different keywords</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 0,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 4,
  },
  cardContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  languageSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  languageScroll: {
    marginTop: 0,
  },
  languageChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  languageChipActive: {
    backgroundColor: '#1db954',
    borderColor: '#1db954',
  },
  languageChipText: {
    fontSize: 13,
    color: '#ccc',
    fontWeight: '500',
  },
  languageChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  toggleGroup: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  toggleItemLast: {
    borderBottomWidth: 0,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 12,
    color: '#999',
  },
  commandsList: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  commandItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  commandItemLast: {
    borderBottomWidth: 0,
  },
  commandInfo: {
    flex: 1,
    marginRight: 16,
  },
  commandKeyword: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1db954',
    marginBottom: 2,
  },
  commandTarget: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  commandTypeContainer: {
    alignSelf: 'flex-start',
  },
  commandType: {
    fontSize: 11,
    color: '#666',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  addButton: {
    backgroundColor: '#1db954',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyDescription: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  cancelText: {
    fontSize: 16,
    color: '#1db954',
  },
  modalContent: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 0,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 6,
  },
  typeOptionActive: {
    backgroundColor: '#1db954',
    borderColor: '#1db954',
  },
  typeText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  typeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  searchButton: {
    backgroundColor: '#1db954',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
  },
  clearButton: {
    padding: 4,
  },
  searchButton: {
    backgroundColor: '#1db954',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  resultLeft: {
    position: 'relative',
  },
  likedOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#000',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  sourceTag: {
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceText: {
    fontSize: 10,
    color: '#1db954',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  addItemButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
  },
  emptyResults: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyResultsText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyResultsSubtext: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 2,
  },
  resultSource: {
    fontSize: 12,
    color: '#1db954',
    marginTop: 2,
  },
  sourceButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  sourceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1db954',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  sourceButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resultThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 4,
    marginRight: 12,
  },
  roundThumbnail: {
    borderRadius: 28,
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 3,
    borderLeftColor: '#1db954',
  },
  instructionText: {
    flex: 1,
    marginLeft: 12,
  },
  instructionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1db954',
    marginBottom: 4,
  },
  instructionDescription: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 18,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputDescription: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 8,
  },
  sourceButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sourceButtonTextDisabled: {
    color: '#666',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  exampleSection: {
    marginTop: 8,
  },
  exampleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  exampleCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  exampleText: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 4,
  },
  exampleKeyword: {
    color: '#1db954',
    fontWeight: '600',
  },
  exampleResult: {
    fontSize: 13,
    color: '#aaa',
  },
});