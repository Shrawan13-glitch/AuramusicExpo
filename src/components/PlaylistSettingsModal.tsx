import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Image, TextInput, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../store/LibraryContext';
import { useNotification } from '../store/NotificationContext';
import SettingsModal from './SettingsModal';

interface PlaylistSettingsModalProps {
  visible: boolean;
  playlist: any;
  onClose: () => void;
  navigation?: any;
}

export default function PlaylistSettingsModal({ visible, playlist, onClose, navigation }: PlaylistSettingsModalProps) {
  const { editPlaylist, deletePlaylist } = useLibrary();
  const { showToast } = useNotification();
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [title, setTitle] = useState(playlist?.title || '');
  const [description, setDescription] = useState(playlist?.description || '');
  const [updating, setUpdating] = useState(false);

  const handleSaveTitle = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a playlist title');
      return;
    }
    
    setUpdating(true);
    const result = await editPlaylist(playlist.id, title.trim());
    setUpdating(false);
    
    if (result) {
      showToast('Title updated');
      setEditingTitle(false);
    } else {
      showToast('Failed to update title');
    }
  };

  const handleSaveDescription = async () => {
    setUpdating(true);
    const result = await editPlaylist(playlist.id, undefined, description.trim());
    setUpdating(false);
    
    if (result) {
      showToast('Description updated');
      setEditingDescription(false);
    } else {
      showToast('Failed to update description');
    }
  };

  const handleVisibilityChange = async (privacy: string) => {
    const result = await editPlaylist(playlist.id, undefined, undefined, privacy);
    if (result) {
      showToast(`Playlist is now ${privacy.toLowerCase()}`);
    } else {
      showToast('Failed to change visibility');
    }
  };

  const handleShare = async () => {
    try {
      const playlistUrl = `https://music.youtube.com/playlist?list=${playlist?.id}`;
      const shareMessage = `🎵 Check out this playlist: ${playlist?.title}\n\n🎧 Listen on YouTube Music:\n${playlistUrl}\n\nShared via AuraMusic`;
      
      await Share.share({
        message: shareMessage,
        title: playlist?.title,
        url: playlistUrl,
      });
    } catch (error) {
      // Share error handled silently
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete "${playlist?.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deletePlaylist(playlist.id);
            if (result) {
              showToast('Playlist deleted');
              onClose();
              if (navigation) {
                navigation.goBack();
              }
            } else {
              showToast('Failed to delete playlist');
            }
          },
        },
      ]
    );
  };

  const visibilityOptions = [
    { key: 'PUBLIC', label: 'Public', subtitle: 'Anyone can search for and view' },
    { key: 'UNLISTED', label: 'Unlisted', subtitle: 'Anyone with the link can view' },
    { key: 'PRIVATE', label: 'Private', subtitle: 'Only you can view' },
  ];

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelButton}>Done</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Playlist Settings</Text>
            <View style={styles.placeholder} />
          </View>
          
          <ScrollView style={styles.content}>
            {/* Artwork Section */}
            <View style={styles.artworkSection}>
              <View style={styles.artworkContainer}>
                <Image 
                  source={{ uri: playlist?.thumbnail || playlist?.thumbnailUrl || 'https://via.placeholder.com/120' }} 
                  style={styles.artwork} 
                  defaultSource={{ uri: 'https://via.placeholder.com/120' }}
                />
                <TouchableOpacity style={styles.editArtworkButton} onPress={() => {
                  Alert.alert('Change Artwork', 'Artwork customization requires a custom development build.');
                }}>
                  <Ionicons name="pencil" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Title Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Title</Text>
              {editingTitle ? (
                <View style={styles.editContainer}>
                  <TextInput
                    style={styles.textInput}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Playlist title"
                    placeholderTextColor="#666"
                    maxLength={100}
                    autoFocus
                  />
                  <View style={styles.editButtons}>
                    <TouchableOpacity onPress={() => {
                      setTitle(playlist?.title || '');
                      setEditingTitle(false);
                    }}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSaveTitle} disabled={updating}>
                      <Text style={[styles.saveText, updating && styles.disabled]}>
                        {updating ? 'Saving...' : 'Save'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.settingRow} onPress={() => {
                  setTitle(playlist?.title || '');
                  setEditingTitle(true);
                }}>
                  <Text style={styles.settingValue}>{playlist?.title || 'Untitled Playlist'}</Text>
                  <Ionicons name="pencil" size={16} color="#666" />
                </TouchableOpacity>
              )}
            </View>

            {/* Description Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              {editingDescription ? (
                <View style={styles.editContainer}>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Add a description..."
                    placeholderTextColor="#666"
                    maxLength={500}
                    multiline
                    autoFocus
                  />
                  <View style={styles.editButtons}>
                    <TouchableOpacity onPress={() => {
                      setDescription(playlist?.description || '');
                      setEditingDescription(false);
                    }}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSaveDescription} disabled={updating}>
                      <Text style={[styles.saveText, updating && styles.disabled]}>
                        {updating ? 'Saving...' : 'Save'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.settingRow} onPress={() => {
                  setDescription(playlist?.description || '');
                  setEditingDescription(true);
                }}>
                  <Text style={styles.settingValue}>
                    {playlist?.description || 'Add a description...'}
                  </Text>
                  <Ionicons name="pencil" size={16} color="#666" />
                </TouchableOpacity>
              )}
            </View>

            {/* Visibility Section */}
            <TouchableOpacity style={styles.section} onPress={() => setShowVisibilityModal(true)}>
              <Text style={styles.sectionTitle}>Visibility</Text>
              <View style={styles.settingRow}>
                <Text style={styles.settingValue}>Change who can see this playlist</Text>
                <Ionicons name="chevron-forward" size={16} color="#666" />
              </View>
            </TouchableOpacity>

            {/* Actions Section */}
            <View style={styles.section}>
              <TouchableOpacity style={styles.actionRow} onPress={handleShare}>
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text style={styles.actionText}>Share Playlist</Text>
              </TouchableOpacity>
              
              {(playlist?.isLocal || playlist?.author === 'You') && (
                <TouchableOpacity style={styles.actionRow} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={20} color="#ff4757" />
                  <Text style={[styles.actionText, { color: '#ff4757' }]}>Delete Playlist</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <SettingsModal
        visible={showVisibilityModal}
        title="Playlist Visibility"
        options={visibilityOptions}
        selectedKey=""
        onSelect={handleVisibilityChange}
        onClose={() => setShowVisibilityModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a'
  },
  cancelButton: { fontSize: 16, color: '#1db954' },
  title: { fontSize: 18, fontWeight: '600', color: '#fff' },
  placeholder: { width: 60 },
  content: { flex: 1 },
  
  artworkSection: { alignItems: 'center', paddingVertical: 30 },
  artworkContainer: { position: 'relative' },
  artwork: { width: 120, height: 120, borderRadius: 8 },
  editArtworkButton: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: '#1db954',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000'
  },
  
  section: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  sectionTitle: { fontSize: 14, color: '#666', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingValue: { fontSize: 16, color: '#fff', flex: 1, marginRight: 12 },
  
  editContainer: { gap: 12 },
  textInput: { backgroundColor: '#1a1a1a', color: '#fff', padding: 12, borderRadius: 8, fontSize: 16 },
  textArea: { height: 80, textAlignVertical: 'top' },
  editButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  cancelText: { fontSize: 16, color: '#666' },
  saveText: { fontSize: 16, color: '#1db954', fontWeight: '600' },
  disabled: { opacity: 0.5 },
  
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 16 },
  actionText: { fontSize: 16, color: '#fff' },
});