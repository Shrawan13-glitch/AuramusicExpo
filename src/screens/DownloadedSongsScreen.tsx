import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDownload } from '../store/DownloadContext';
import { usePlayer } from '../store/PlayerContext';
import SongOptionsModal from '../components/SongOptionsModal';
import { useSongOptions } from '../hooks/useSongOptions';

export default function DownloadedSongsScreen({ navigation }: any) {
  const { downloadedSongs } = useDownload();
  const { playSong } = usePlayer();
  const { modalVisible, selectedSong, showOptions, hideOptions } = useSongOptions();
  const scrollY = new Animated.Value(0);

  const handlePlayAll = () => {
    if (downloadedSongs.length > 0) {
      const songsAsQueue = downloadedSongs.map(song => ({
        id: song.id,
        title: song.title,
        artists: song.artists,
        thumbnailUrl: song.thumbnailUrl,
        duration: -1
      }));
      playSong(songsAsQueue[0], songsAsQueue, false);
    }
  };

  const handleShuffle = () => {
    if (downloadedSongs.length > 0) {
      const songsAsQueue = downloadedSongs.map(song => ({
        id: song.id,
        title: song.title,
        artists: song.artists,
        thumbnailUrl: song.thumbnailUrl,
        duration: -1
      }));
      const shuffled = [...songsAsQueue].sort(() => Math.random() - 0.5);
      playSong(shuffled[0], shuffled, false);
    }
  };

  const handleSongPress = (item: any, index: number) => {
    const songsAsQueue = downloadedSongs.map(song => ({
      id: song.id,
      title: song.title,
      artists: song.artists,
      thumbnailUrl: song.thumbnailUrl,
      duration: -1
    }));
    const queueFromIndex = [...songsAsQueue.slice(index), ...songsAsQueue.slice(0, index)];
    playSong(queueFromIndex[0], queueFromIndex, false);
  };

  const renderSong = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity 
      style={styles.songItem}
      onPress={() => handleSongPress(item, index)}
      onLongPress={() => showOptions(item)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.songArtist} numberOfLines={1}>
          {item.artists.map((a: any) => a.name).join(', ')}
        </Text>
      </View>
      <TouchableOpacity style={styles.menuButton} onPress={() => showOptions(item)}>
        <Ionicons name="ellipsis-vertical" size={20} color="#666" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="download-outline" size={64} color="#666" />
      <Text style={styles.emptyTitle}>No Downloaded Songs</Text>
      <Text style={styles.emptySubtitle}>
        Download songs to listen offline. Look for the download button on any song.
      </Text>
    </View>
  );

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Animated.Text style={[styles.headerTitle, { opacity: headerOpacity }]}>
          Downloaded Songs
        </Animated.Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={downloadedSongs}
        renderItem={renderSong}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={EmptyState}
        ListHeaderComponent={
          downloadedSongs.length > 0 ? (
            <View style={styles.playlistHeader}>
              <View style={styles.playlistInfo}>
                <View style={styles.playlistIcon}>
                  <Ionicons name="download" size={32} color="#1db954" />
                </View>
                <View style={styles.playlistDetails}>
                  <Text style={styles.playlistTitle}>Downloaded Songs</Text>
                  <Text style={styles.playlistSubtitle}>{downloadedSongs.length} songs</Text>
                </View>
              </View>
              <View style={styles.playlistControls}>
                <TouchableOpacity style={styles.shuffleButton} onPress={handleShuffle}>
                  <Ionicons name="shuffle" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Shuffle</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.playButton} onPress={handlePlayAll}>
                  <Ionicons name="play" size={24} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
          ) : null
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      />

      <SongOptionsModal
        visible={modalVisible}
        onClose={hideOptions}
        song={selectedSong}
        showDeleteOption={true}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 16,
    backgroundColor: '#000',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#fff', flex: 1, textAlign: 'center' },
  playlistHeader: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 20 },
  playlistInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  playlistIcon: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#1db954' + '20', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  playlistDetails: { flex: 1 },
  playlistTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 4 },
  playlistSubtitle: { fontSize: 14, color: '#aaa' },
  playlistControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  shuffleButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, gap: 8 },
  playButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1db954', alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  listContent: { paddingBottom: 100 },
  songItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12,
    paddingHorizontal: 20
  },
  thumbnail: { width: 48, height: 48, borderRadius: 4 },
  songInfo: { flex: 1, marginLeft: 12 },
  songTitle: { fontSize: 16, fontWeight: '500', color: '#fff', marginBottom: 2 },
  songArtist: { fontSize: 14, color: '#aaa' },
  menuButton: { padding: 8 },
  emptyState: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingTop: 200,
    paddingHorizontal: 40
  },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 16, color: '#aaa', textAlign: 'center', lineHeight: 22 },
});