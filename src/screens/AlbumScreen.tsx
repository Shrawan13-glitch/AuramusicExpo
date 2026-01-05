import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, ImageBackground } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';

// Add hashCode method for color generation
String.prototype.hashCode = function() {
  let hash = 0;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
};

const ITEM_HEIGHT = 60;

const SongItem = React.memo(({ item, index, onPress }: any) => (
  <TouchableOpacity style={styles.songItem} onPress={onPress}>
    <Text style={styles.trackNumber}>{index + 1}</Text>
    <View style={styles.songInfo}>
      <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.songArtist} numberOfLines={1}>
        {item.artists?.map((a: any) => a.name).join(', ')}
      </Text>
    </View>
    <Ionicons name="ellipsis-vertical" size={20} color="#666" />
  </TouchableOpacity>
));

const AlbumHeader = React.memo(({ data, onPlay, onShuffle }: any) => {
  // Generate artwork if no thumbnail
  const generateArtwork = () => {
    if (data.album.thumbnail) return null;
    
    const colors = [`hsl(${(Math.abs(data.album.id?.hashCode() || 0) * 137) % 360}, 80%, 55%)`, `hsl(${(Math.abs(data.album.id?.hashCode() || 0) * 137 + 120) % 360}, 80%, 35%)`];
    const patterns = ['▲', '●', '■', '♦', '★', '▼', '◆', '♪'];
    const pattern = patterns[Math.abs(data.album.id?.hashCode() || 0) % patterns.length];
    
    return (
      <View style={[styles.generatedArtwork, { backgroundColor: colors[0] }]}>
        <View style={[styles.artworkPattern, { backgroundColor: colors[1] }]}>
          <Text style={styles.patternText}>{pattern}</Text>
        </View>
        <View style={[styles.artworkOverlay, { backgroundColor: colors[1] }]} />
        <View style={styles.artworkTitle}>
          <Text style={styles.artworkTitleText} numberOfLines={2}>{data.album.title}</Text>
        </View>
      </View>
    );
  };
  
  return (
    <View style={styles.albumHeader}>
      {data.album.thumbnail ? (
        <Image source={{ uri: data.album.thumbnail }} style={styles.albumArt} />
      ) : (
        generateArtwork()
      )}
      <Text style={styles.albumType}>{data.album.type || 'Album'}</Text>
      <Text style={styles.albumTitle}>{data.album.title || 'Unknown Album'}</Text>
      <Text style={styles.albumArtist}>{data.album.artist || 'Unknown Artist'}</Text>
      <Text style={styles.albumYear}>{data.album.year || ''} {data.album.year && '•'} {data.songs?.length || 0} songs</Text>
    
    <View style={styles.buttonRow}>
      <TouchableOpacity style={styles.playButton} onPress={onPlay}>
        <Ionicons name="play" size={24} color="#000" />
        <Text style={styles.playButtonText}>Play</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.shuffleButton} onPress={onShuffle}>
        <Ionicons name="shuffle" size={24} color="#fff" />
        <Text style={styles.shuffleButtonText}>Shuffle</Text>
      </TouchableOpacity>
    </View>
  </View>
  );
});

export default function AlbumScreen({ route, navigation }: any) {
  const { albumId } = route.params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const { playSong } = usePlayer();

  useEffect(() => {
    loadAlbum();
    const timer = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(timer);
  }, [albumId]);

  const loadAlbum = useCallback(async () => {
    setLoading(true);
    try {
      const result = await InnerTube.getAlbum(albumId);
      setData(result);
    } catch (error) {
      // Error loading album handled silently
    } finally {
      setLoading(false);
    }
  }, [albumId]);

  const renderSongItem = useCallback(({ item, index }: any) => (
    <SongItem
      item={item}
      index={index}
      onPress={() => {
        const queue = data.songs.slice(index + 1);
        playSong(item, queue, false);
      }}
    />
  ), [data?.songs, playSong]);

  const keyExtractor = useCallback((item: any, index: number) => `${item.id}-${index}`, []);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  const headerComponent = useMemo(() => (
    <AlbumHeader
      data={data}
      onPlay={() => {
        if (data.songs.length > 0) {
          const queue = data.songs.slice(1);
          playSong(data.songs[0], queue, false);
        }
      }}
      onShuffle={() => {
        if (data.songs.length > 0) {
          const shuffled = [...data.songs].sort(() => Math.random() - 0.5);
          const queue = shuffled.slice(1);
          playSong(shuffled[0], queue, false);
        }
      }}
    />
  ), [data, playSong]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!data || !data.album) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.errorText}>Failed to load album</Text>
        {data && <Text style={styles.errorText}>{JSON.stringify(data, null, 2)}</Text>}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={data?.album?.thumbnail ? { uri: data.album.thumbnail } : undefined}
        style={StyleSheet.absoluteFillObject}
        blurRadius={50}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', '#000']}
          locations={[0, 0.4, 0.7]}
          style={StyleSheet.absoluteFillObject}
        />
      </ImageBackground>
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.backButtonContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <FlashList
          data={showContent ? data.songs : []}
          keyExtractor={keyExtractor}
          renderItem={renderSongItem}
          estimatedItemSize={60}
          ListHeaderComponent={headerComponent}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  backButtonContainer: { position: 'absolute', top: 50, left: 16, zIndex: 10 },
  backButton: { padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  albumHeader: { alignItems: 'center', padding: 16, paddingTop: 60 },
  albumArt: { width: 200, height: 200, borderRadius: 8, marginBottom: 16 },
  generatedArtwork: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  artworkPattern: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  patternText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '900',
  },
  artworkOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    opacity: 0.4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  artworkTitle: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
  },
  artworkTitleText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  albumType: { fontSize: 12, color: '#aaa', textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' },
  albumTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 8 },
  albumArtist: { fontSize: 16, color: '#fff', marginBottom: 4, textAlign: 'center' },
  albumYear: { fontSize: 14, color: '#aaa', marginBottom: 24, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  playButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1db954', paddingVertical: 12, borderRadius: 24, gap: 8 },
  playButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  shuffleButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', paddingVertical: 12, borderRadius: 24, gap: 8 },
  shuffleButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  songItem: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16 },
  trackNumber: { width: 30, fontSize: 16, color: '#666', textAlign: 'center' },
  songInfo: { flex: 1, marginLeft: 12 },
  songTitle: { fontSize: 16, color: '#fff', fontWeight: '500' },
  songArtist: { fontSize: 14, color: '#aaa', marginTop: 2 },
  errorText: { color: '#fff', textAlign: 'center', marginTop: 100, fontSize: 16 },
});
