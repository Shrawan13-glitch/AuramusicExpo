import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions, Share, Alert, ScrollView, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDownload } from '../store/DownloadContext';
import { useLibrary } from '../store/LibraryContext';
import { useNotification } from '../store/NotificationContext';
import CreatePlaylistModal from './CreatePlaylistModal';

const OptionItem = React.memo(({ option }: any) => (
  <TouchableOpacity style={styles.option} onPress={option.onPress} activeOpacity={0.7}>
    <Ionicons name={option.icon as any} size={24} color={option.color || '#fff'} />
    <Text style={[styles.optionText, { color: option.color || '#fff' }]}>{option.label}</Text>
  </TouchableOpacity>
));

interface SongOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  song: any;
  showDeleteOption?: boolean;
  playlistId?: string;
  navigation?: any;
}

export default function SongOptionsModal({ visible, onClose, song, showDeleteOption = false, playlistId, navigation }: SongOptionsModalProps) {
  const { deleteSong } = useDownload();
  const { isLiked, addLikedSong, removeLikedSong, playlists, addToPlaylist, removeFromPlaylist } = useLibrary();
  const { showToast } = useNotification();
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);

  const handleDelete = () => {
    deleteSong(song.id);
    onClose();
  };

  const handleShare = async () => {
    try {
      const artistNames = song?.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';
      const youtubeUrl = `https://music.youtube.com/watch?v=${song?.id}`;
      
      const shareMessage = `🎵 ${song?.title}\n👤 ${artistNames}\n\n🎧 Listen on YouTube Music:\n${youtubeUrl}\n\nShared via AuraMusic`;
      
      await Share.share({
        message: shareMessage,
        title: `${song?.title} - ${artistNames}`,
        url: youtubeUrl,
      });
    } catch (error) {
      // Share error handled silently
    }
    onClose();
  };

  const handleLike = () => {
    const liked = isLiked(song.id);
    if (liked) {
      removeLikedSong(song.id);
    } else {
      addLikedSong(song);
    }
    onClose();
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    
    setShowPlaylistPicker(false);
    onClose();
    
    // Background sync
    const result = await addToPlaylist(playlistId, song);
    
    if (result) {
      showToast(`Added to ${playlist.title}`);
    } else {
      showToast(`Failed to add to ${playlist.title}`);
    }
  };

  const handleGoToArtist = () => {
    if (song?.artists?.[0]?.id && navigation) {
      navigation.navigate('Artist', { artistId: song.artists[0].id });
    }
    onClose();
  };

  const handleGoToAlbum = () => {
    if (song?.album?.id && navigation) {
      navigation.navigate('Album', { albumId: song.album.id });
    } else {
      Alert.alert('Album Not Available', 'Album information is not available for this song.');
    }
    onClose();
  };

  const handleRemoveFromPlaylist = async () => {
    if (!playlistId) return;
    
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    
    onClose();
    
    const result = await removeFromPlaylist(playlistId, song.id);
    
    if (result) {
      showToast(`Removed from ${playlist.title}`);
      // Force refresh of the playlist screen by triggering a re-render
      setTimeout(() => {
        if (navigation && navigation.getState) {
          const currentRoute = navigation.getState().routes[navigation.getState().index];
          if (currentRoute.name === 'Playlist') {
            navigation.replace('Playlist', { playlistId, videoId: currentRoute.params?.videoId });
          }
        }
      }, 100);
    } else {
      showToast(`Failed to remove from ${playlist.title}`);
    }
  };

  const liked = isLiked(song?.id);
  const userPlaylists = useMemo(() => playlists.filter(p => p.type === 'playlist' || !p.type), [playlists]);
  const currentPlaylist = playlistId ? playlists.find(p => p.id === playlistId) : null;
  
  // Check if we can remove from playlist - more permissive check
  const canRemoveFromPlaylist = playlistId && currentPlaylist && (
    currentPlaylist.isLocal === true || 
    currentPlaylist.author === 'You' ||
    currentPlaylist.author === 'you' ||
    !currentPlaylist.author // Local playlists might not have author set
  );
  
  const renderOption = useCallback(({ item }: any) => <OptionItem option={item} />, []);
  const keyExtractor = useCallback((item: any) => item.id, []);
  
  const options = [
    { 
      icon: liked ? 'heart' : 'heart-outline', 
      label: liked ? 'Remove from Liked Songs' : 'Add to Liked Songs', 
      onPress: handleLike,
      color: liked ? '#1db954' : '#fff',
      id: 'like'
    },
    { 
      icon: 'add-outline', 
      label: 'Add to Playlist', 
      onPress: () => setShowPlaylistPicker(true), 
      color: '#fff',
      id: 'add-playlist'
    },
    { 
      icon: 'share-outline', 
      label: 'Share', 
      onPress: handleShare, 
      color: '#fff',
      id: 'share'
    },
    { 
      icon: 'person-outline', 
      label: 'Go to Artist', 
      onPress: handleGoToArtist, 
      color: '#fff',
      id: 'artist'
    },
    { 
      icon: 'disc-outline', 
      label: 'Go to Album', 
      onPress: handleGoToAlbum, 
      color: '#fff',
      id: 'album'
    },
  ];

  if (canRemoveFromPlaylist) {
    options.splice(1, 0, { 
      icon: 'remove-circle-outline', 
      label: `Remove from ${currentPlaylist.title}`, 
      onPress: handleRemoveFromPlaylist, 
      color: '#ff6b6b',
      id: 'remove-playlist'
    });
  }

  if (showDeleteOption) {
    options.push({ icon: 'trash-outline', label: 'Delete Download', onPress: handleDelete, color: '#ff4757' });
  }

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.songTitle} numberOfLines={1}>{song?.title}</Text>
              <Text style={styles.songArtist} numberOfLines={1}>
                {song?.artists?.map((a: any) => a.name).join(', ')}
              </Text>
            </View>
            <FlatList
              data={options}
              keyExtractor={keyExtractor}
              renderItem={renderOption}
              style={styles.options}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showPlaylistPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPlaylistPicker(false)}
      >
        <TouchableOpacity style={styles.overlay} onPress={() => setShowPlaylistPicker(false)} activeOpacity={1}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.songTitle}>Add to Playlist</Text>
            </View>
            <ScrollView style={styles.options} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.option}
                onPress={() => {
                  setShowPlaylistPicker(false);
                  setShowCreatePlaylist(true);
                }}
              >
                <Ionicons name="add-circle-outline" size={24} color="#1db954" />
                <Text style={[styles.optionText, { color: '#1db954' }]}>Create New Playlist</Text>
              </TouchableOpacity>
              {userPlaylists.map((playlist) => (
                <TouchableOpacity
                  key={playlist.id}
                  style={styles.option}
                  onPress={() => handleAddToPlaylist(playlist.id)}
                >
                  <Ionicons name="musical-notes-outline" size={24} color="#fff" />
                  <Text style={styles.optionText}>{playlist.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <CreatePlaylistModal 
        visible={showCreatePlaylist} 
        onClose={() => setShowCreatePlaylist(false)}
        onPlaylistCreated={(playlistId) => {
          setShowCreatePlaylist(false);
          handleAddToPlaylist(playlistId);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: '80%' },
  handle: { width: 40, height: 4, backgroundColor: '#666', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
  songTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
  songArtist: { fontSize: 14, color: '#bbb' },
  options: { paddingTop: 20, maxHeight: 400 },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: 'transparent' },
  optionText: { fontSize: 16, marginLeft: 16, color: '#fff' },
});