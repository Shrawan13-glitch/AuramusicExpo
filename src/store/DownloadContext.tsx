import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
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

interface DownloadProgress {
  songId: string;
  progress: number;
  status: 'downloading' | 'completed' | 'failed';
}

interface DownloadContextType {
  downloadedSongs: DownloadedSong[];
  downloadProgress: { [key: string]: DownloadProgress };
  downloadSong: (song: any) => Promise<void>;
  deleteSong: (songId: string) => Promise<void>;
  isDownloaded: (songId: string) => boolean;
  getDownloadedSong: (songId: string) => DownloadedSong | null;
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
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: DownloadProgress }>({});

  useEffect(() => {
    loadDownloadedSongs();
  }, []);

  const loadDownloadedSongs = async () => {
    try {
      const stored = await AsyncStorage.getItem('downloadedSongs');
      if (stored) {
        setDownloadedSongs(JSON.parse(stored));
      }
    } catch (error) {
      // Error loading downloaded songs handled silently
    }
  };

  const saveDownloadedSongs = async (songs: DownloadedSong[]) => {
    try {
      await AsyncStorage.setItem('downloadedSongs', JSON.stringify(songs));
      setDownloadedSongs(songs);
    } catch (error) {
      // Error saving downloaded songs handled silently
    }
  };

  const downloadSong = useCallback(async (song: any) => {
    const songId = song.id;
    
    if (isDownloaded(songId)) return;



    setDownloadProgress(prev => ({
      ...prev,
      [songId]: { songId, progress: 0, status: 'downloading' }
    }));

    try {
      const startTime = Date.now();
      
      // Get quality setting - default to low for faster downloads
      const quality = await AsyncStorage.getItem('downloadQuality') || 'low';
      
      // Get actual stream URL with quality preference
      const streamUrl = await InnerTube.getStreamUrl(songId, quality);
      if (!streamUrl) {
        throw new Error('No stream URL found');
      }
      
      const urlTime = Date.now();

      const downloadDir = `${FileSystem.documentDirectory}downloads/`;
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
      
      const fileName = `${song.title.replace(/[^a-zA-Z0-9]/g, '_')}_${songId}.mp3`;
      const localPath = `${downloadDir}${fileName}`;

      const downloadStartTime = Date.now();
      
      let bytesLogged = 0;
      
      // Download actual audio file with optimized settings
      const downloadResumable = FileSystem.createDownloadResumable(
        streamUrl,
        localPath,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Range': 'bytes=0-'
          }
        },
        (() => {
          let lastUpdate = 0;
          return (downloadProgress) => {
            const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            const now = Date.now();
            
            // Track download speed (logging removed)
            if (now - bytesLogged > 5000) {
              bytesLogged = now;
            }
            
            // Throttle UI updates to every 2 seconds to reduce overhead
            if (now - lastUpdate > 2000 || progress >= 1) {
              lastUpdate = now;
              setDownloadProgress(prev => ({
                ...prev,
                [songId]: { songId, progress, status: 'downloading' }
              }));
            }
          };
        })()
      );

      const result = await downloadResumable.downloadAsync();
      const totalTime = Date.now() - startTime;
      
      if (result) {
        const fileInfo = await FileSystem.getInfoAsync(result.uri);
        const downloadedSong: DownloadedSong = {
          id: songId,
          title: song.title,
          artists: song.artists || [{ name: 'Unknown Artist' }],
          thumbnailUrl: song.thumbnailUrl,
          localPath: result.uri,
          downloadedAt: Date.now(),
          size: fileInfo.size || 0,
        };

        const updatedSongs = [...downloadedSongs, downloadedSong];
        await saveDownloadedSongs(updatedSongs);

        setDownloadProgress(prev => ({
          ...prev,
          [songId]: { songId, progress: 1, status: 'completed' }
        }));

        setTimeout(() => {
          setDownloadProgress(prev => {
            const { [songId]: removed, ...rest } = prev;
            return rest;
          });
        }, 2000);
      }
    } catch (error) {
      // Download failed handled silently
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
        // Still remove from list even if file deletion fails
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

  const clearAllDownloads = useCallback(async () => {
    try {
      for (const song of downloadedSongs) {
        await FileSystem.deleteAsync(song.localPath);
      }
      await saveDownloadedSongs([]);
    } catch (error) {
      // Error clearing downloads handled silently
    }
  }, [downloadedSongs]);

  return (
    <DownloadContext.Provider value={{
      downloadedSongs,
      downloadProgress,
      downloadSong,
      deleteSong,
      isDownloaded,
      getDownloadedSong,
      getTotalDownloadSize,
      clearAllDownloads,
    }}>
      {children}
    </DownloadContext.Provider>
  );
};