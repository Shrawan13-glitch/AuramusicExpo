import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import { usePlayer } from '../store/PlayerContext';

export default function ArtistScreen({ route, navigation }: any) {
  const { artistId } = route.params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const { playSong } = usePlayer();
  const scrollY = useRef(new Animated.Value(0)).current;
  
  const headerOpacity = scrollY.interpolate({
    inputRange: [200, 250],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    loadArtist();
  }, [artistId]);

  const loadArtist = async () => {
    setLoading(true);
    const result = await InnerTube.getArtist(artistId);
    setData(result);
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load artist</Text>
      </View>
    );
  }

  // Find songs section (could be "Songs", "Top songs", or any section with song items)
  const songsSection = data.sections.find((s: any) => s.items[0]?.type === 'song');
  const otherSections = data.sections.filter((s: any) => s !== songsSection);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.animatedHeader, { opacity: headerOpacity }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{data?.artist.name}</Text>
      </Animated.View>

      <Animated.ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={28} color="#fff" />
      </TouchableOpacity>

      <Image source={{ uri: data.artist.thumbnail }} style={styles.artistImage} />
      
      <View style={styles.infoContainer}>
        <Text style={styles.artistName}>{data.artist.name}</Text>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.shuffleButton}
            onPress={async () => {
              if (songsSection && songsSection.items.length > 0) {
                const shuffled = [...songsSection.items].sort(() => Math.random() - 0.5);
                playSong(shuffled[0]);
              }
            }}
          >
            <Ionicons name="shuffle" size={20} color="#fff" />
            <Text style={styles.buttonText}>Shuffle</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.radioButton}
            onPress={async () => {
              if (songsSection && songsSection.items.length > 0) {
                playSong(songsSection.items[0]);
              }
            }}
          >
            <Ionicons name="radio" size={20} color="#fff" />
            <Text style={styles.buttonText}>Radio</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.subscribeButton}
          onPress={async () => {
            const success = await InnerTube.subscribeArtist(artistId, !subscribed);
            if (success) setSubscribed(!subscribed);
          }}
        >
          <Ionicons name={subscribed ? "checkmark-circle" : "add-circle-outline"} size={20} color="#fff" />
          <Text style={styles.buttonText}>{subscribed ? 'Subscribed' : 'Subscribe'}</Text>
        </TouchableOpacity>
      </View>

      {songsSection && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{songsSection.title}</Text>
            {songsSection.moreEndpoint && (
              <TouchableOpacity onPress={() => navigation.navigate('ArtistItems', { browseId: songsSection.moreEndpoint.browseId, params: songsSection.moreEndpoint.params })}>
                <Text style={styles.viewAll}>View all</Text>
              </TouchableOpacity>
            )}
          </View>
          {songsSection.items.slice(0, 5).map((song: any, idx: number) => (
            <TouchableOpacity
              key={idx}
              style={styles.songItem}
              onPress={() => playSong(song)}
            >
              <Text style={styles.trackNumber}>{idx + 1}</Text>
              <Image source={{ uri: song.thumbnailUrl }} style={styles.songThumbnail} />
              <View style={styles.songInfo}>
                <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
                <Text style={styles.songArtist} numberOfLines={1}>
                  {song.artists?.map((a: any) => a.name).join(', ')}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {otherSections.map((section: any, index: number) => (
        <View key={index} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.moreEndpoint && (
              <TouchableOpacity onPress={() => navigation.navigate('ArtistItems', { browseId: section.moreEndpoint.browseId, params: section.moreEndpoint.params })}>
                <Text style={styles.viewAll}>View all</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {section.items[0]?.type === 'song' ? (
            section.items.map((song: any, idx: number) => (
              <TouchableOpacity
                key={idx}
                style={styles.songItem}
                onPress={() => playSong(song)}
              >
                <Image source={{ uri: song.thumbnailUrl }} style={styles.songThumbnail} />
                <View style={styles.songInfo}>
                  <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
                  <Text style={styles.songArtist} numberOfLines={1}>
                    {song.artists?.map((a: any) => a.name).join(', ')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <FlatList
              horizontal
              data={section.items}
              keyExtractor={(item, idx) => `${item.id}-${idx}`}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.gridItem}
                  onPress={() => {
                    if (item.type === 'album') {
                      navigation.navigate('Album', { albumId: item.id });
                    } else if (item.type === 'playlist') {
                      navigation.navigate('Playlist', { playlistId: item.id });
                    } else if (item.type === 'artist') {
                      navigation.navigate('Artist', { artistId: item.id });
                    } else if (item.type === 'video') {
                      playSong(item);
                    } else if (item.type === 'song') {
                      playSong(item);
                    }
                  }}
                >
                  <Image source={{ uri: item.thumbnailUrl }} style={[styles.gridThumbnail, item.type === 'artist' && { borderRadius: 70 }]} />
                  <Text style={styles.gridTitle} numberOfLines={2}>{item.title || item.name}</Text>
                  {item.subtitle && (
                    <Text style={styles.gridSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                  )}
                </TouchableOpacity>
              )}
              showsHorizontalScrollIndicator={false}
            />
          )}
        </View>
      ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollView: { flex: 1 },
  contentContainer: { paddingBottom: 80 },
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    zIndex: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerBackButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
    flex: 1,
  },
  backButton: { position: 'absolute', top: 50, left: 16, zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  artistImage: { width: '100%', height: 300, resizeMode: 'cover' },
  infoContainer: { padding: 16 },
  artistName: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  shuffleButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1db954', padding: 12, borderRadius: 24, gap: 8 },
  radioButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', padding: 12, borderRadius: 24, gap: 8 },
  subscribeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', padding: 12, borderRadius: 24, gap: 8, marginTop: 12 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  viewAll: { fontSize: 14, color: '#1db954', fontWeight: '600' },
  trackNumber: { width: 30, fontSize: 16, color: '#666', textAlign: 'center' },
  songItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  songThumbnail: { width: 48, height: 48, borderRadius: 4, marginLeft: 8 },
  songInfo: { flex: 1, marginLeft: 12 },
  songTitle: { fontSize: 16, color: '#fff', fontWeight: '500' },
  songArtist: { fontSize: 14, color: '#aaa', marginTop: 2 },
  gridItem: { width: 140, marginRight: 12 },
  gridThumbnail: { width: 140, height: 140, borderRadius: 4 },
  gridTitle: { fontSize: 14, color: '#fff', marginTop: 8, fontWeight: '500' },
  gridSubtitle: { fontSize: 12, color: '#aaa', marginTop: 2 },
  errorText: { color: '#fff', textAlign: 'center', marginTop: 100, fontSize: 16 },
});
