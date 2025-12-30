import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import axios from 'axios';
import { InnerTube } from '../api/innertube';

interface DownloadedSong {
  id: string;
  title: string;
  artists: Array<{ name: string; id?: string }>;
  thumbnailUrl: string;
  localPath: string;
  downloadedAt: number;
  size: number;
}

interface DownloadedPlaylist {
  id: string;
  title: string;
  thumbnail: string;
  songs: DownloadedSong[];
  downloadedAt: number;
  totalSize: number;
}

interface DownloadProgress {
  songId: string;
  progress: number;
  status: 'downloading' | 'completed' | 'failed' | 'paused';
}

interface PlaylistDownloadProgress {
  playlistId: string;
  totalSongs: number;
  downloadedSongs: number;
  currentSong?: string;
  status: 'downloading' | 'paused' | 'completed' | 'failed';
  progress: number; // 0-1
}

interface DownloadContextType {
  downloadedSongs: DownloadedSong[];
  downloadedPlaylists: DownloadedPlaylist[];
  downloadProgress: { [key: string]: DownloadProgress };
  playlistProgress: { [key: string]: PlaylistDownloadProgress };
  downloadSong: (song: any) => Promise<void>;
  downloadPlaylist: (playlist: any, songs: any[]) => Promise<void>;
  pausePlaylistDownload: (playlistId: string) => void;
  resumePlaylistDownload: (playlistId: string) => void;
  deleteSong: (songId: string) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  isDownloaded: (songId: string) => boolean;
  isPlaylistDownloaded: (playlistId: string) => boolean;
  isPlaylistPartiallyDownloaded: (playlistId: string) => boolean;
  getDownloadedSong: (songId: string) => DownloadedSong | null;
  getDownloadedPlaylist: (playlistId: string) => DownloadedPlaylist | null;
  getPlaylistProgress: (playlistId: string) => PlaylistDownloadProgress | null;
  getTotalDownloadSize: () => number;
  clearAllDownloads: () => Promise<void>;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export const useDownload = () => {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error('useDownload must be used within a DownloadProvider');
  }
  return context;
};

export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [downloadedSongs, setDownloadedSongs] = useState<DownloadedSong[]>([]);
  const [downloadedPlaylists, setDownloadedPlaylists] = useState<DownloadedPlaylist[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: DownloadProgress }>({});
  const [playlistProgress, setPlaylistProgress] = useState<{ [key: string]: PlaylistDownloadProgress }>({});

  useEffect(() => {
    loadDownloadedSongs();
    loadDownloadedPlaylists();
  }, []);

  const loadDownloadedSongs = async () => {
    try {
      const filePath = FileSystem.documentDirectory + 'downloads.json';
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        const data = await FileSystem.readAsStringAsync(filePath);
        setDownloadedSongs(JSON.parse(data));
      }
    } catch (error) {
      // Error loading downloaded songs handled silently
    }
  };

  const saveDownloadedSongs = async (songs: DownloadedSong[]) => {
    try {
      const filePath = FileSystem.documentDirectory + 'downloads.json';
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(songs));
      setDownloadedSongs(songs);
    } catch (error) {
      // Error saving downloaded songs handled silently
    }
  };

  const addSongToDatabase = async (song: DownloadedSong) => {
    try {
      setDownloadedSongs(prev => {
        const existing = prev.find(s => s.id === song.id);
        if (!existing) {
          const updated = [...prev, song];
          // Save to storage in background
          const filePath = FileSystem.documentDirectory + 'downloads.json';
          FileSystem.writeAsStringAsync(filePath, JSON.stringify(updated)).catch(() => {});
          return updated;
        }
        return prev;
      });
    } catch (error) {
      // Error adding song handled silently
    }
  };

  const addSongToPlaylistDatabase = async (playlistId: string, song: DownloadedSong) => {
    try {
      console.log('Adding song to playlist database:', playlistId, song.title);
      const currentPlaylists = [...downloadedPlaylists];
      const playlistIndex = currentPlaylists.findIndex(p => p.id === playlistId);
      
      if (playlistIndex >= 0) {
        // Update existing playlist
        const playlist = currentPlaylists[playlistIndex];
        const updatedSongs = [...playlist.songs.filter(s => s.id !== song.id), song];
        const updatedPlaylist = { 
          ...playlist, 
          songs: updatedSongs, 
          totalSize: updatedSongs.reduce((sum, s) => sum + s.size, 0) 
        };
        currentPlaylists[playlistIndex] = updatedPlaylist;
        console.log('Updated existing playlist, now has', updatedSongs.length, 'songs');
      } else {
        // Create new playlist entry
        const newPlaylist: DownloadedPlaylist = {
          id: playlistId,
          title: 'Downloading...',
          thumbnail: song.thumbnailUrl,
          songs: [song],
          downloadedAt: Date.now(),
          totalSize: song.size
        };
        currentPlaylists.push(newPlaylist);
        console.log('Created new playlist with first song');
      }
      
      await saveDownloadedPlaylists(currentPlaylists);
      console.log('Saved playlist to database');
    } catch (error) {
      console.error('Error adding song to playlist:', error);
    }
  };

  const loadDownloadedPlaylists = async () => {
    try {
      const filePath = FileSystem.documentDirectory + 'downloaded_playlists.json';
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        const data = await FileSystem.readAsStringAsync(filePath);
        setDownloadedPlaylists(JSON.parse(data));
      }
    } catch (error) {
      // Error loading downloaded playlists handled silently
    }
  };

  const saveDownloadedPlaylists = async (playlists: DownloadedPlaylist[]) => {
    try {
      const filePath = FileSystem.documentDirectory + 'downloaded_playlists.json';
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(playlists));
      setDownloadedPlaylists(playlists);
    } catch (error) {
      // Error saving downloaded playlists handled silently
    }
  };

  const downloadSong = useCallback(async (song: any) => {
    const songId = song.id;
    console.log('Starting download for:', song.title, songId);
    
    if (isDownloaded(songId)) {
      console.log('Song already downloaded:', songId);
      return;
    }

    setDownloadProgress(prev => ({
      ...prev,
      [songId]: { songId, progress: 0, status: 'downloading' }
    }));

    try {
      console.log('Getting stream URL for:', songId);
      const urlStartTime = Date.now();
      
      // Force low quality for fastest downloads
      const quality = 'low';
      console.log('Using quality:', quality);
      
      // Get actual stream URL with quality preference
      const streamUrl = await InnerTube.getStreamUrl(songId, quality);
      if (!streamUrl) {
        console.error('No stream URL found for:', songId);
        throw new Error('No stream URL found');
      }
      const urlTime = Date.now() - urlStartTime;
      console.log(`Got stream URL in ${urlTime}ms:`, streamUrl.substring(0, 50) + '...');
      
      // Test URL speed with a small range request
      const testStart = Date.now();
      try {
        const testResponse = await fetch(streamUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36',
          },
        });
        const testTime = Date.now() - testStart;
        console.log(`URL test response in ${testTime}ms, status:`, testResponse.status);
        console.log('Content-Length:', testResponse.headers.get('content-length'));
      } catch (error) {
        console.log('URL test failed:', error.message);
      }

      const fileName = `${song.title.replace(/[^a-zA-Z0-9]/g, '_')}_${songId}.mp3`;
      const filePath = FileSystem.documentDirectory + fileName;
      console.log('Creating file:', fileName);
      console.log('File path:', filePath);
      
      console.log('=== METROLIST-STYLE DOWNLOAD ===');
      const downloadStartTime = Date.now();
      
      // Add range parameter like Metrolist does
      const rangedUrl = `${streamUrl}&range=0-10000000`;
      console.log('Using ranged URL for download');
      
      const downloadResult = await FileSystem.downloadAsync(
        rangedUrl,
        filePath,
        {
          headers: {
            'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
            'Accept': '*/*',
            'Accept-Encoding': 'identity',
          },
        }
      );
      
      const totalTime = Date.now() - downloadStartTime;
      console.log(`Download completed in ${totalTime}ms, status: ${downloadResult.status}`);
      
      if (downloadResult.status !== 200 && downloadResult.status !== 206) {
        console.error('Download failed with status:', downloadResult.status);
        throw new Error(`Download failed: ${downloadResult.status}`);
      }
      
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      const speed = fileInfo.size > 0 ? (fileInfo.size / 1024 / (totalTime / 1000)).toFixed(1) : 'unknown';
      console.log(`🎉 SUCCESS: ${fileInfo.size} bytes in ${totalTime}ms (${speed} KB/s)`);
      
      const downloadedSong: DownloadedSong = {
        id: songId,
        title: song.title,
        artists: song.artists || [{ name: 'Unknown Artist' }],
        thumbnailUrl: song.thumbnailUrl,
        localPath: filePath,
        downloadedAt: Date.now(),
        size: fileInfo.size || 0,
      };
      
      setDownloadProgress(prev => ({
        ...prev,
        [songId]: { songId, progress: 1, status: 'completed' }
      }));

      await addSongToDatabase(downloadedSong);
      console.log('Download completed successfully for:', song.title);

      setTimeout(() => {
        setDownloadProgress(prev => {
          const { [songId]: removed, ...rest } = prev;
          return rest;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Download failed for:', song.title, error);
      setDownloadProgress(prev => ({
        ...prev,
        [songId]: { songId, progress: 0, status: 'failed' }
      }));
    }
  }, [downloadedSongs]);

  const deleteSong = useCallback(async (songId: string) => {
    const song = downloadedSongs.find(s => s.id === songId);
    if (song) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(song.localPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(song.localPath);
        }
        const updatedSongs = downloadedSongs.filter(s => s.id !== songId);
        await saveDownloadedSongs(updatedSongs);
      } catch (error) {
        // Error deleting song handled silently
        const updatedSongs = downloadedSongs.filter(s => s.id !== songId);
        await saveDownloadedSongs(updatedSongs);
      }
    }
  }, [downloadedSongs]);

  const isDownloaded = useCallback((songId: string) => {
    return downloadedSongs.some(song => song.id === songId);
  }, [downloadedSongs]);

  const getDownloadedSong = useCallback((songId: string) => {
    return downloadedSongs.find(song => song.id === songId) || null;
  }, [downloadedSongs]);

  const getTotalDownloadSize = useCallback(() => {
    return downloadedSongs.reduce((total, song) => total + song.size, 0);
  }, [downloadedSongs]);

  const downloadPlaylist = useCallback(async (playlist: any, songs: any[]) => {
    const playlistId = playlist.id;
    
    setPlaylistProgress(prev => ({
      ...prev,
      [playlistId]: {
        playlistId,
        totalSongs: songs.length,
        downloadedSongs: 0,
        status: 'downloading',
        progress: 0
      }
    }));

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      
      const currentState = playlistProgress[playlistId];
      if (currentState?.status === 'paused') {
        break;
      }

      setPlaylistProgress(prev => ({
        ...prev,
        [playlistId]: {
          ...prev[playlistId],
          currentSong: song.title,
          progress: i / songs.length
        }
      }));

      try {
        if (!isDownloaded(song.id)) {
          await downloadSong(song);
        }

        setPlaylistProgress(prev => ({
          ...prev,
          [playlistId]: {
            ...prev[playlistId],
            downloadedSongs: i + 1,
            progress: (i + 1) / songs.length
          }
        }));
      } catch (error) {
        console.log(`Failed to download ${song.title}:`, error);
      }
    }

    setPlaylistProgress(prev => {
      const { [playlistId]: removed, ...rest } = prev;
      return rest;
    });
  }, [downloadSong, isDownloaded, playlistProgress]);

  const deletePlaylist = useCallback(async (playlistId: string) => {
    const playlist = downloadedPlaylists.find(p => p.id === playlistId);
    if (playlist) {
      for (const song of playlist.songs) {
        await deleteSong(song.id);
      }
      
      const updatedPlaylists = downloadedPlaylists.filter(p => p.id !== playlistId);
      await saveDownloadedPlaylists(updatedPlaylists);
    }
  }, [downloadedPlaylists, deleteSong]);

  const isPlaylistDownloaded = useCallback((playlistId: string) => {
    const playlist = downloadedPlaylists.find(p => p.id === playlistId);
    console.log('Checking if playlist downloaded:', playlistId, !!playlist, playlist?.songs?.length || 0);
    return !!playlist && playlist.songs && playlist.songs.length > 0;
  }, [downloadedPlaylists]);

  const isPlaylistPartiallyDownloaded = useCallback((playlistId: string) => {
    return !!playlistProgress[playlistId] || downloadedPlaylists.some(p => p.id === playlistId);
  }, [playlistProgress, downloadedPlaylists]);

  const getPlaylistProgress = useCallback((playlistId: string) => {
    return playlistProgress[playlistId] || null;
  }, [playlistProgress]);

  const getDownloadedPlaylist = useCallback((playlistId: string) => {
    return downloadedPlaylists.find(playlist => playlist.id === playlistId) || null;
  }, [downloadedPlaylists]);

  const pausePlaylistDownload = useCallback((playlistId: string) => {
    setPlaylistProgress(prev => ({
      ...prev,
      [playlistId]: {
        ...prev[playlistId],
        status: 'paused'
      }
    }));
  }, []);

  const resumePlaylistDownload = useCallback((playlistId: string) => {
    setPlaylistProgress(prev => ({
      ...prev,
      [playlistId]: {
        ...prev[playlistId],
        status: 'downloading'
      }
    }));
  }, []);

  const clearAllDownloads = useCallback(async () => {
    try {
      for (const song of downloadedSongs) {
        const fileInfo = await FileSystem.getInfoAsync(song.localPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(song.localPath);
        }
      }
      await saveDownloadedSongs([]);
    } catch (error) {
      // Error clearing downloads handled silently
    }
  }, [downloadedSongs]);

  return (
    <DownloadContext.Provider value={{
      downloadedSongs,
      downloadedPlaylists,
      downloadProgress,
      playlistProgress,
      downloadSong,
      downloadPlaylist,
      pausePlaylistDownload,
      resumePlaylistDownload,
      deleteSong,
      deletePlaylist,
      isDownloaded,
      isPlaylistDownloaded,
      isPlaylistPartiallyDownloaded,
      getDownloadedSong,
      getDownloadedPlaylist,
      getPlaylistProgress,
      getTotalDownloadSize,
      clearAllDownloads,
    }}>
      {children}
    </DownloadContext.Provider>
  );
};