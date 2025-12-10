import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Song } from '../types';
import { InnerTube } from '../api/innertube';

interface LibraryContextType {
  likedSongs: Song[];
  recentlyPlayed: Song[];
  addLikedSong: (song: Song) => void;
  removeLikedSong: (songId: string) => void;
  isLiked: (songId: string) => boolean;
  addToRecentlyPlayed: (song: Song) => void;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    try {
      const liked = await AsyncStorage.getItem('likedSongs');
      const recent = await AsyncStorage.getItem('recentlyPlayed');
      if (liked) setLikedSongs(JSON.parse(liked));
      if (recent) setRecentlyPlayed(JSON.parse(recent));
    } catch (e) {
    }
  };

  const addLikedSong = useCallback(async (song: Song) => {
    const updated = [song, ...likedSongs.filter(s => s.id !== song.id)];
    setLikedSongs(updated);
    
    // Non-blocking storage and sync
    AsyncStorage.setItem('likedSongs', JSON.stringify(updated)).catch(console.error);
    
    // Sync with YouTube Music if authenticated (non-blocking)
    AsyncStorage.getItem('ytm_cookies').then(cookies => {
      if (cookies) {
        InnerTube.likeSong(song.id, true).catch(console.error);
      }
    }).catch(console.error);
  }, [likedSongs]);

  const removeLikedSong = useCallback(async (songId: string) => {
    const updated = likedSongs.filter(s => s.id !== songId);
    setLikedSongs(updated);
    
    // Non-blocking storage and sync
    AsyncStorage.setItem('likedSongs', JSON.stringify(updated)).catch(console.error);
    
    // Sync with YouTube Music if authenticated (non-blocking)
    AsyncStorage.getItem('ytm_cookies').then(cookies => {
      if (cookies) {
        InnerTube.likeSong(songId, false).catch(console.error);
      }
    }).catch(console.error);
  }, [likedSongs]);

  const isLiked = useCallback((songId: string) => likedSongs.some(s => s.id === songId), [likedSongs]);

  const addToRecentlyPlayed = useCallback(async (song: Song) => {
    const updated = [song, ...recentlyPlayed.filter(s => s.id !== song.id)].slice(0, 50);
    setRecentlyPlayed(updated);
    
    // Non-blocking storage
    AsyncStorage.setItem('recentlyPlayed', JSON.stringify(updated)).catch(console.error);
  }, [recentlyPlayed]);

  const contextValue = useMemo(() => ({
    likedSongs,
    recentlyPlayed,
    addLikedSong,
    removeLikedSong,
    isLiked,
    addToRecentlyPlayed
  }), [likedSongs, recentlyPlayed, addLikedSong, removeLikedSong, isLiked, addToRecentlyPlayed]);

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
