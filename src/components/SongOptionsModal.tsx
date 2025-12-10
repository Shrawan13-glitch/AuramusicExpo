import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDownload } from '../store/DownloadContext';
import { useLibrary } from '../store/LibraryContext';

interface SongOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  song: any;
  showDeleteOption?: boolean;
  navigation?: any;
}

export default function SongOptionsModal({ visible, onClose, song, showDeleteOption = false, navigation }: SongOptionsModalProps) {
  const { deleteSong } = useDownload();
  const { isLiked, addLikedSong, removeLikedSong } = useLibrary();

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
      console.error('Share error:', error);
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

  const liked = isLiked(song?.id);
  
  const options = [
    { 
      icon: liked ? 'heart' : 'heart-outline', 
      label: liked ? 'Remove from Liked Songs' : 'Add to Liked Songs', 
      onPress: handleLike,
      color: liked ? '#1db954' : '#fff'
    },
    { icon: 'share-outline', label: 'Share', onPress: handleShare, color: '#fff' },
    { icon: 'person-outline', label: 'Go to Artist', onPress: handleGoToArtist, color: '#fff' },
    { icon: 'disc-outline', label: 'Go to Album', onPress: handleGoToAlbum, color: '#fff' },
  ];

  if (showDeleteOption) {
    options.push({ icon: 'trash-outline', label: 'Delete Download', onPress: handleDelete, color: '#ff4757' });
  }

  return (
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
          <View style={styles.options}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.option}
                onPress={option.onPress}
                activeOpacity={0.7}
              >
                <Ionicons name={option.icon as any} size={24} color={option.color || '#fff'} />
                <Text style={[styles.optionText, { color: option.color || '#fff' }]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  songTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#aaa',
  },
  options: {
    paddingTop: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  optionText: {
    fontSize: 16,
    marginLeft: 16,
  },
});