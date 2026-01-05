import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, Share, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../store/LibraryContext';
import { useNotification } from '../store/NotificationContext';

interface PlaylistOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  playlist: any;
  navigation?: any;
}

export default function PlaylistOptionsModal({ visible, onClose, playlist, navigation }: PlaylistOptionsModalProps) {
  const { editPlaylist, deletePlaylist } = useLibrary();
  const { showToast } = useNotification();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [editTitle, setEditTitle] = useState(playlist?.title || '');
  const [editDescription, setEditDescription] = useState(playlist?.description || '');
  const [updating, setUpdating] = useState(false);

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
    onClose();
  };

  const handleEdit = () => {
    setEditTitle(playlist?.title || '');
    setEditDescription(playlist?.description || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      Alert.alert('Error', 'Please enter a playlist title');
      return;
    }

    setUpdating(true);
    const result = await editPlaylist(playlist.id, editTitle.trim(), editDescription.trim());
    setUpdating(false);

    if (result) {
      showToast('Playlist updated successfully');
      setShowEditModal(false);
      onClose();
    } else {
      showToast('Failed to update playlist');
    }
  };

  const handleChangeVisibility = (privacy: string) => {
    setShowVisibilityModal(false);
    onClose();
    
    Alert.alert(
      'Change Visibility',
      `Are you sure you want to make this playlist ${privacy.toLowerCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: async () => {
            const result = await editPlaylist(playlist.id, undefined, undefined, privacy);
            if (result) {
              showToast(`Playlist is now ${privacy.toLowerCase()}`);
            } else {
              showToast('Failed to change visibility');
            }
          },
        },
      ]
    );
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
              showToast('Playlist deleted successfully');
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

  const handleChangeArtwork = async () => {
    Alert.alert(
      'Change Artwork',
      'Artwork customization requires a custom development build. This feature will be available when you build the app with EAS Build.',
      [{ text: 'OK' }]
    );
    onClose();
  };

  const options = [
    { icon: 'create-outline', label: 'Edit Playlist', onPress: handleEdit, color: '#fff' },
    { icon: 'eye-outline', label: 'Change Visibility', onPress: () => setShowVisibilityModal(true), color: '#fff' },
    { icon: 'share-outline', label: 'Share Playlist', onPress: handleShare, color: '#fff' },
    { icon: 'image-outline', label: 'Change Artwork', onPress: handleChangeArtwork, color: '#fff' },
  ];

  // Only show delete option for local playlists or user-owned playlists
  if (playlist?.isLocal || playlist?.author === 'You') {
    options.push({ icon: 'trash-outline', label: 'Delete Playlist', onPress: handleDelete, color: '#ff4757' });
  }

  return (
    <>
      <Modal
        visible={visible && !showEditModal}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
          <View style={styles.modal} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.playlistTitle} numberOfLines={1}>{playlist?.title}</Text>
              <Text style={styles.playlistInfo} numberOfLines={1}>
                {playlist?.author} • {playlist?.songCount || '0 songs'}
              </Text>
            </View>
            <View style={styles.options}>
              {options.map((option, index) => (
                <TouchableOpacity key={index} style={styles.option} onPress={option.onPress}>
                  <Ionicons name={option.icon as any} size={24} color={option.color} />
                  <Text style={[styles.optionText, { color: option.color }]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.overlay} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.overlay} onPress={() => setShowEditModal(false)} activeOpacity={1}>
            <View style={styles.modal} onStartShouldSetResponder={() => true}>
              <View style={styles.handle} />
              
              <View style={styles.header}>
                <Text style={styles.playlistTitle}>Edit Playlist</Text>
              </View>

              <View style={styles.content}>
                <TextInput
                  style={styles.input}
                  placeholder="Playlist title"
                  placeholderTextColor="#666"
                  value={editTitle}
                  onChangeText={setEditTitle}
                  maxLength={100}
                  autoFocus
                />

                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Description (optional)"
                  placeholderTextColor="#666"
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                  maxLength={500}
                />

                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>Description (optional)</Text>
                </View>
              </View>

              <View style={styles.buttons}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowEditModal(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.saveButton, updating && styles.disabled]} 
                  onPress={handleSaveEdit}
                  disabled={updating}
                >
                  <Text style={styles.saveText}>
                    {updating ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showVisibilityModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVisibilityModal(false)}
      >
        <TouchableOpacity style={styles.overlay} onPress={() => setShowVisibilityModal(false)} activeOpacity={1}>
          <View style={styles.modal} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            
            <View style={styles.header}>
              <Text style={styles.playlistTitle}>Change Visibility</Text>
              <Text style={styles.playlistInfo}>Choose who can see this playlist</Text>
            </View>

            <View style={styles.options}>
              <TouchableOpacity style={styles.option} onPress={() => handleChangeVisibility('PUBLIC')}>
                <Ionicons name="globe-outline" size={24} color="#fff" />
                <View style={styles.optionContent}>
                  <Text style={styles.optionText}>Public</Text>
                  <Text style={styles.optionSubtext}>Anyone can search for and view</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.option} onPress={() => handleChangeVisibility('UNLISTED')}>
                <Ionicons name="link-outline" size={24} color="#fff" />
                <View style={styles.optionContent}>
                  <Text style={styles.optionText}>Unlisted</Text>
                  <Text style={styles.optionSubtext}>Anyone with the link can view</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.option} onPress={() => handleChangeVisibility('PRIVATE')}>
                <Ionicons name="lock-closed-outline" size={24} color="#fff" />
                <View style={styles.optionContent}>
                  <Text style={styles.optionText}>Private</Text>
                  <Text style={styles.optionSubtext}>Only you can view</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: '#666', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
  playlistTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
  playlistInfo: { fontSize: 14, color: '#bbb' },
  options: { paddingTop: 20 },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  optionText: { fontSize: 16, marginLeft: 16, color: '#fff' },
  optionContent: { marginLeft: 16, flex: 1 },
  optionSubtext: { fontSize: 14, color: '#bbb', marginTop: 2 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  input: { backgroundColor: '#333', color: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 16 },
  textArea: { height: 80, textAlignVertical: 'top' },
  switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  switchLabel: { fontSize: 16, color: '#fff' },
  buttons: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  cancelButton: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#333', alignItems: 'center' },
  saveButton: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#1db954', alignItems: 'center' },
  disabled: { opacity: 0.5 },
  cancelText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});