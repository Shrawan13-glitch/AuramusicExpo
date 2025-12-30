import React from 'react';
import { TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDownload } from '../store/DownloadContext';

interface PlaylistDownloadButtonProps {
  playlist: any;
  songs: any[];
}

export default function PlaylistDownloadButton({ playlist, songs }: PlaylistDownloadButtonProps) {
  const { 
    downloadPlaylist, 
    isPlaylistDownloaded, 
    getPlaylistProgress, 
    pausePlaylistDownload, 
    resumePlaylistDownload 
  } = useDownload();

  const progress = getPlaylistProgress(playlist.id);
  const isDownloaded = isPlaylistDownloaded(playlist.id);

  const handlePress = () => {
    if (isDownloaded) return;
    
    if (progress?.status === 'downloading') {
      pausePlaylistDownload(playlist.id);
    } else if (progress?.status === 'paused') {
      resumePlaylistDownload(playlist.id);
    } else {
      downloadPlaylist(playlist, songs);
    }
  };

  if (isDownloaded) {
    return (
      <TouchableOpacity style={styles.button} disabled>
        <Ionicons name="checkmark-circle" size={24} color="#1db954" />
        <Text style={styles.downloadedText}>Downloaded</Text>
      </TouchableOpacity>
    );
  }

  if (progress) {
    const percentage = Math.round(progress.progress * 100);
    const isPaused = progress.status === 'paused';
    
    return (
      <TouchableOpacity style={styles.button} onPress={handlePress}>
        <View style={styles.progressContainer}>
          <Ionicons 
            name={isPaused ? "play" : "pause"} 
            size={20} 
            color={isPaused ? "#1db954" : "#ff9500"} 
          />
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              {percentage}% • {progress.downloadedSongs}/{progress.totalSongs}
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${percentage}%` }]} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.button} onPress={handlePress}>
      <Ionicons name="download-outline" size={24} color="#fff" />
      <Text style={styles.buttonText}>Download</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  downloadedText: { color: '#1db954', fontSize: 14, fontWeight: '500' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressInfo: { flex: 1 },
  progressText: { color: '#fff', fontSize: 12, marginBottom: 2 },
  progressBar: { height: 2, backgroundColor: '#555', borderRadius: 1 },
  progressFill: { height: 2, backgroundColor: '#1db954', borderRadius: 1 },
});