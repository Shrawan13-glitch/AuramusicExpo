import React, { createContext, useContext, useState, useEffect } from 'react';
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
      console.error('Failed to load library', e);
    }
  };

  const addLikedSong = async (song: Song) => {
    const updated = [song, ...likedSongs.filter(s => s.id !== song.id)];
    setLikedSongs(updated);
    await AsyncStorage.setItem('likedSongs', JSON.stringify(updated));
    
    // Sync with YouTube Music if authenticated
    const cookies = await AsyncStorage.getItem('ytm_cookies');
    if (cookies) {
      try {
        await InnerTube.likeSong(song.id, true);
      } catch (error) {
        console.error('Failed to sync like to YTM:', error);
      }
    }
  };

  const removeLikedSong = async (songId: string) => {
    const updated = likedSongs.filter(s => s.id !== songId);
    setLikedSongs(updated);
    await AsyncStorage.setItem('likedSongs', JSON.stringify(updated));
    
    // Sync with YouTube Music if authenticated
    const cookies = await AsyncStorage.getItem('ytm_cookies');
    if (cookies) {
      try {
        await InnerTube.likeSong(songId, false);
      } catch (error) {
        console.error('Failed to sync unlike to YTM:', error);
      }
    }
  };

  const isLiked = (songId: string) => likedSongs.some(s => s.id === songId);

  const addToRecentlyPlayed = async (song: Song) => {
    const updated = [song, ...recentlyPlayed.filter(s => s.id !== song.id)].slice(0, 50);
    setRecentlyPlayed(updated);
    await AsyncStorage.setItem('recentlyPlayed', JSON.stringify(updated));
  };

  return (
    <LibraryContext.Provider value={{ likedSongs, recentlyPlayed, addLikedSong, removeLikedSong, isLiked, addToRecentlyPlayed }}>
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used within LibraryProvider');
  return context;
};
