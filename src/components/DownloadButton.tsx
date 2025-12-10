import React from 'react';
import { TouchableOpacity, StyleSheet, View, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDownload } from '../store/DownloadContext';

interface DownloadButtonProps {
  song: any;
  size?: number;
  color?: string;
}

export default function DownloadButton({ song, size = 20, color = '#fff' }: DownloadButtonProps) {
  const { downloadSong, isDownloaded, downloadProgress } = useDownload();

  const handlePress = async () => {
    if (!isDownloaded(song.id)) {
      console.log('Starting download for:', song.title);
      try {
        await downloadSong(song);
      } catch (error) {
        console.error('Download error:', error);
      }
    }
  };

  const progress = downloadProgress[song.id];
  const downloaded = isDownloaded(song.id);

  if (downloaded) {
    return (
      <TouchableOpacity style={styles.button} disabled>
        <Ionicons name="checkmark-circle" size={size} color="#1db954" />
      </TouchableOpacity>
    );
  }

  if (progress && progress.status === 'downloading') {
    const progressAngle = progress.progress * 360;
    
    return (
      <TouchableOpacity style={styles.button} disabled>
        <View style={[styles.progressContainer, { width: size, height: size }]}>
          <View style={[styles.progressBackground, { width: size, height: size, borderRadius: size / 2 }]} />
          <View 
            style={[
              styles.progressFill, 
              { 
                width: size, 
                height: size, 
                borderRadius: size / 2,
                transform: [{ rotate: `${progressAngle - 90}deg` }]
              }
            ]} 
          />
          <View style={[styles.progressIcon, { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }]}>
            <Ionicons name="download" size={size * 0.4} color="#1db954" />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.button} onPress={handlePress}>
      <Ionicons name="download-outline" size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
  },
  progressContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBackground: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#333',
  },
  progressFill: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: '#1db954',
    borderRightColor: '#1db954',
  },
  progressIcon: {
    position: 'absolute',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});