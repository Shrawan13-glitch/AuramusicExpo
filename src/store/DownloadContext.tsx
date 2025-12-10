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

      const updatedSongs = [...downloadedSongs, downloadedSong];
      await saveDownloadedSongs(updatedSongs);
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