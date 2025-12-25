import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Song, PlayHistory } from '../types';
import { InnerTube } from '../api/innertube';
import { AuraDB } from '../services/auraDB';

interface LibraryContextType {
  likedSongs: Song[];
  recentlyPlayed: PlayHistory[];
  addLikedSong: (song: Song) => void;
  removeLikedSong: (songId: string) => void;
  isLiked: (songId: string) => boolean;
  addToRecentlyPlayed: (song: Song, duration: number) => void;
  loadMoreHistory: (offset: number) => Promise<PlayHistory[]>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<PlayHistory[]>([]);

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    try {
      const liked = await AsyncStorage.getItem('likedSongs');
      
      // Migrate old recently played to new DB
      const oldRecent = await AsyncStorage.getItem('recentlyPlayed');
      if (oldRecent) {
        const oldSongs: Song[] = JSON.parse(oldRecent);
        for (const song of oldSongs) {
          await AuraDB.addPlayHistory(song, 30000); // Add with 30s duration
        }
        await AsyncStorage.removeItem('recentlyPlayed'); // Remove old data
      }
      
      const history = await AuraDB.getHistory(0, 50);
      if (liked) setLikedSongs(JSON.parse(liked));
      setRecentlyPlayed(history);
    } catch (e) {
    }
  };

  const addLikedSong = useCallback(async (song: Song) => {
    const updated = [song, ...likedSongs.filter(s => s.id !== song.id)];
    setLikedSongs(updated);
    
    // Non-blocking storage and sync
    AsyncStorage.setItem('likedSongs', JSON.stringify(updated)).catch(() => {});
    
    // Sync with YouTube Music if authenticated (non-blocking)
    AsyncStorage.getItem('ytm_cookies').then(cookies => {
      if (cookies) {
        InnerTube.likeSong(song.id, true).catch(() => {});
      }
    }).catch(() => {});
  }, [likedSongs]);

  const removeLikedSong = useCallback(async (songId: string) => {
    const updated = likedSongs.filter(s => s.id !== songId);
    setLikedSongs(updated);
    
    // Non-blocking storage and sync
    AsyncStorage.setItem('likedSongs', JSON.stringify(updated)).catch(() => {});
    
    // Sync with YouTube Music if authenticated (non-blocking)
    AsyncStorage.getItem('ytm_cookies').then(cookies => {
      if (cookies) {
        InnerTube.likeSong(songId, false).catch(() => {});
      }
    }).catch(() => {});
  }, [likedSongs]);

  const isLiked = useCallback((songId: string) => likedSongs.some(s => s.id === songId), [likedSongs]);

  const addToRecentlyPlayed = useCallback(async (song: Song, duration: number = 0) => {
    await AuraDB.addPlayHistory(song, duration);
    const updated = await AuraDB.getHistory(0, 50);
    setRecentlyPlayed(updated);
  }, []);

  const loadMoreHistory = useCallback(async (offset: number): Promise<PlayHistory[]> => {
    return await AuraDB.getHistory(offset, 50);
  }, []);

  const contextValue = useMemo(() => ({
    likedSongs,
    recentlyPlayed,
    addLikedSong,
    removeLikedSong,
    isLiked,
    addToRecentlyPlayed,
    loadMoreHistory
  }), [likedSongs, recentlyPlayed, addLikedSong, removeLikedSong, isLiked, addToRecentlyPlayed, loadMoreHistory]);

  return (
    <LibraryContext.Provider value={contextValue}>
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used within LibraryProvider');
  return context;
};
