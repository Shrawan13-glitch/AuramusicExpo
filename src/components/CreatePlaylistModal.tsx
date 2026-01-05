import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../store/LibraryContext';

interface CreatePlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  onPlaylistCreated?: (playlistId: string) => void;
}

export default function CreatePlaylistModal({ visible, onClose, onPlaylistCreated }: CreatePlaylistModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const { createPlaylist } = useLibrary();

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a playlist title');
      return;
    }

    setCreating(true);
    const playlistId = await createPlaylist(title.trim(), description.trim());
    setCreating(false);

    if (playlistId) {
      setTitle('');
      setDescription('');
      onClose();
      if (onPlaylistCreated) {
        onPlaylistCreated(playlistId);
      } else {
        Alert.alert('Success', 'Playlist created successfully!');
      }
    } else {
      Alert.alert('Error', 'Failed to create playlist');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView 
        style={styles.overlay} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            
            <View style={styles.header}>
              <Text style={styles.title}>Create Playlist</Text>
            </View>

            <View style={styles.content}>
              <TextInput
                style={styles.input}
                placeholder="Playlist title"
                placeholderTextColor="#666"
                value={title}
                onChangeText={setTitle}
                maxLength={100}
                autoFocus
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (optional)"
                placeholderTextColor="#666"
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={500}
              />
            </View>

            <View style={styles.buttons}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.createButton, creating && styles.disabled]} 
                onPress={handleCreate}
                disabled={creating}
              >
                <Text style={styles.createText}>
                  {creating ? 'Creating...' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: '#666', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
  title: { fontSize: 18, fontWeight: '600', color: '#fff', textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  input: { backgroundColor: '#333', color: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16 },
  textArea: { height: 80, textAlignVertical: 'top' },
  buttons: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  cancelButton: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#333', alignItems: 'center' },
  createButton: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#1db954', alignItems: 'center' },
  disabled: { opacity: 0.5 },
  cancelText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  createText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});