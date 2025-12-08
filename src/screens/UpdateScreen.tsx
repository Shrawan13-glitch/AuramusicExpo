import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UpdateInfo, openUpdateUrl } from '../utils/updateChecker';

interface UpdateScreenProps {
  route: any;
  navigation: any;
}

export default function UpdateScreen({ route, navigation }: UpdateScreenProps) {
  const updateInfo: UpdateInfo = route.params?.updateInfo;
  const isStrict = updateInfo?.isStrict === 'true';

  if (!updateInfo) {
    navigation.goBack();
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Ionicons name="cloud-download-outline" size={64} color="#1db954" />
        <Text style={styles.title}>Update Available</Text>
        <Text style={styles.version}>Version {updateInfo.latestVersion}</Text>
      </View>

      <ScrollView style={styles.notesContainer} contentContainerStyle={{ paddingBottom: 100 }}>
        <Text style={styles.notesTitle}>What's New:</Text>
        {updateInfo.notes.map((note, index) => (
          <View key={index} style={styles.noteItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.noteText}>{note}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.updateButton}
          onPress={() => openUpdateUrl(updateInfo.downloadUrl)}
        >
          <Text style={styles.updateButtonText}>Update Now</Text>
        </TouchableOpacity>
        {!isStrict && (
          <TouchableOpacity style={styles.laterButton} onPress={() => navigation.goBack()}>
            <Text style={styles.laterButtonText}>No Thanks</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { alignItems: 'center', padding: 32 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginTop: 16 },
  version: { fontSize: 18, color: '#aaa', marginTop: 8 },
  notesContainer: { flex: 1, paddingHorizontal: 24 },
  notesTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 16 },
  noteItem: { flexDirection: 'row', marginBottom: 12 },
  bullet: { fontSize: 18, color: '#1db954', marginRight: 12 },
  noteText: { fontSize: 16, color: '#ddd', flex: 1, lineHeight: 24 },
  buttons: { padding: 24, gap: 12 },
  updateButton: { backgroundColor: '#1db954', padding: 18, borderRadius: 8, alignItems: 'center' },
  updateButtonText: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  laterButton: { padding: 18, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#666' },
  laterButtonText: { fontSize: 18, color: '#fff' },
});
