import React, { useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../store/PlayerContext';
import { useSongOptions } from '../hooks/useSongOptions';
import SongOptionsModal from '../components/SongOptionsModal';

export default function SectionView({ route, navigation }: any) {
  const { sectionTitle, sectionType, items } = route.params;
  const { playSong, currentSong } = usePlayer();
  const { modalVisible, selectedSong, showOptions, hideOptions } = useSongOptions();
  const scrollY = useRef(new Animated.Value(0)).current;

  const theme = {
    trending: { color: '#ff6b6b', icon: 'trending-up' },
    playlists: { color: '#4ecdc4', icon: 'musical-notes' },
    mixes: { color: '#9b59b6', icon: 'disc' },
    dailyDiscover: { color: '#f39c12', icon: 'sunny' },
    longListens: { color: '#8e44ad', icon: 'hourglass' },
    default: { color: '#6366f1', icon: 'library' }
  }[sectionType] || { color: '#6366f1', icon: 'library' };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });

  const handleItemPress = (item: any) => {
    if (item.type === 'song') playSong(item);
    else if (item.type === 'artist') navigation.navigate('Artist', { artistId: item.id });
    else if (item.type === 'album') navigation.navigate('Album', { albumId: item.id });
    else if (item.type === 'playlist') navigation.navigate('Playlist', { playlistId: item.id, videoId: item.videoId });
  };

  const renderItem = ({ item, index }: any) => (
    <TouchableOpacity 
      style={styles.item} 
      onPress={() => handleItemPress(item)}
      onLongPress={item.type === 'song' ? () => showOptions(item) : undefined}
    >
      <View style={styles.itemImage}>
        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={styles.image} />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: theme.color }]}>
            <Ionicons name={theme.icon as any} size={24} color="#fff" />
          </View>
        )}
        {currentSong?.id === item.id && <View style={styles.playing} />}
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.title, currentSong?.id === item.id && { color: theme.color }]} numberOfLines={2}>
          {item.type === 'artist' ? item.name : item.title}
        </Text>
        {(item.artists || item.subtitle) && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {item.type === 'song' ? item.artists?.map((a: any) => a.name).join(', ') : item.subtitle}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {sectionTitle}
        </Text>
        <Text style={styles.headerSubtitle}>{items.length} items</Text>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        numColumns={2}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

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
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  list: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 100,
  },
  item: {
    flex: 1,
    margin: 8,
  },
  itemImage: {
    position: 'relative',
    marginBottom: 12,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  placeholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playing: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1DB954',
  },
  itemContent: {
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#999',
    fontWeight: '400',
  },
});