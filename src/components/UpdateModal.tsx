import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UpdateInfo, openUpdateUrl } from '../utils/updateChecker';

interface UpdateModalProps {
  visible: boolean;
  updateInfo: UpdateInfo;
  onDismiss: () => void;
}

export default function UpdateModal({ visible, updateInfo, onDismiss }: UpdateModalProps) {
  const isStrict = updateInfo.isStrict === 'true';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Ionicons name="cloud-download-outline" size={48} color="#1db954" />
            <Text style={styles.title}>Update Available</Text>
            <Text style={styles.version}>Version {updateInfo.latestVersion}</Text>
          </View>

          <ScrollView style={styles.notesContainer}>
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
              onPress={() => {
                openUpdateUrl(updateInfo.downloadUrl);
                if (!isStrict) onDismiss();
              }}
            >
              <Text style={styles.updateButtonText}>Update Now</Text>
            </TouchableOpacity>
            {!isStrict && (
              <TouchableOpacity style={styles.laterButton} onPress={onDismiss}>
                <Text style={styles.laterButtonText}>No Thanks</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  container: { backgroundColor: '#1a1a1a', borderRadius: 16, width: '100%', maxWidth: 400, maxHeight: '80%' },
  header: { alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#333' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 16 },
  version: { fontSize: 16, color: '#aaa', marginTop: 4 },
  notesContainer: { maxHeight: 300, padding: 20 },
  notesTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 12 },
  noteItem: { flexDirection: 'row', marginBottom: 8 },
  bullet: { fontSize: 16, color: '#1db954', marginRight: 8 },
  noteText: { fontSize: 16, color: '#ddd', flex: 1 },
  buttons: { padding: 20, gap: 12 },
  updateButton: { backgroundColor: '#1db954', padding: 16, borderRadius: 8, alignItems: 'center' },
  updateButtonText: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  laterButton: { padding: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#666' },
  laterButtonText: { fontSize: 16, color: '#fff' },
});
