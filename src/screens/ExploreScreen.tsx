import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InnerTube } from '../api/innertube';
import TabHeader from '../components/TabHeader';

export default function ExploreScreen({ navigation }: any) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExplore();
  }, []);

  const loadExplore = async () => {
    const result = await InnerTube.explore();
    setData(result);
    setLoading(false);
  };

  if (loading) return <SafeAreaView style={styles.container}><Text style={styles.text}>Loading...</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="Explore" navigation={navigation} />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>

      {data?.newReleases?.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>New Releases</Text>
            <TouchableOpacity onPress={() => navigation.navigate('NewReleases')}>
              <Text style={styles.viewAll}>View all</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            horizontal
            data={data.newReleases.slice(0, 10)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('Album', { albumId: item.id })}>
                <Image source={{ uri: item.thumbnailUrl }} style={styles.gridThumbnail} />
                <Text style={styles.gridTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.gridSubtitle} numberOfLines={1}>{item.subtitle}</Text>
              </TouchableOpacity>
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      {data?.moodAndGenres?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Moods & Genres</Text>
          <View style={styles.genreGrid}>
            {data.moodAndGenres.map((genre: any, index: number) => (
              <TouchableOpacity
                key={index}
                style={styles.genreItem}
                onPress={() => navigation.navigate('Browse', { params: genre.params })}
              >
                <Text style={styles.genreText}>{genre.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  text: { color: '#fff', textAlign: 'center', marginTop: 100 },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  viewAll: { fontSize: 14, color: '#1db954', fontWeight: '600' },
  gridItem: { width: 140, marginRight: 12 },
  gridThumbnail: { width: 140, height: 140, borderRadius: 4 },
  gridTitle: { fontSize: 14, color: '#fff', marginTop: 8, fontWeight: '500' },
  gridSubtitle: { fontSize: 12, color: '#aaa', marginTop: 2 },
  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  genreItem: { backgroundColor: '#1db954', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
  genreText: { color: '#000', fontSize: 14, fontWeight: '600' },
});
