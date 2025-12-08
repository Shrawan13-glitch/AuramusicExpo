import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';

export default function NewReleasesScreen({ navigation }: any) {
  const [albums, setAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlbums();
  }, []);

  const loadAlbums = async () => {
    const result = await InnerTube.newReleaseAlbums();
    setAlbums(result);
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Releases</Text>
      </View>

      <FlatList
        data={albums}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ paddingBottom: 80, paddingTop: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate('Album', { albumId: item.id })}
          >
            <Image source={{ uri: item.thumbnailUrl }} style={styles.gridThumbnail} />
            <Text style={styles.gridTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.gridSubtitle} numberOfLines={1}>{item.subtitle}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 50, gap: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1 },
  gridItem: { flex: 1, margin: 8, maxWidth: '45%' },
  gridThumbnail: { width: '100%', aspectRatio: 1, borderRadius: 4 },
  gridTitle: { fontSize: 14, color: '#fff', marginTop: 8, fontWeight: '500' },
  gridSubtitle: { fontSize: 12, color: '#aaa', marginTop: 2 },
});
