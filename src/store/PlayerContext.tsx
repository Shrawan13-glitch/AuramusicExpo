import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Song, PlayerState } from '../types';
import { InnerTube } from '../api/innertube';
import { useLibrary } from './LibraryContext';
import { useDownload } from './DownloadContext';
import { setAudioModeAsync } from 'expo-audio';

interface PlayerContextType extends PlayerState {
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  playSong: (song: Song) => Promise<void>;
  pause: () => void;
  resume: () => void;
  seek: (position: number) => void;
  addToQueue: (song: Song) => void;
  playNext: (song: Song) => void;
  skipNext: () => Promise<void>;
  skipPrevious: () => Promise<void>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const library = useLibrary();
  const downloadContext = useDownload();
  const [state, setState] = useState<PlayerState>({
    currentSong: null,
    queue: [],
    isPlaying: false,
    position: 0,
    duration: 0,
  });
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [originalQueue, setOriginalQueue] = useState<Song[]>([]);
  const [radioContinuation, setRadioContinuation] = useState<string | null>(null);
  const [previousSongs, setPreviousSongs] = useState<Song[]>([]);
  const [intendedPlaying, setIntendedPlaying] = useState(false);

  const player = useAudioPlayer('');
  const status = useAudioPlayerStatus(player);
  const hasTriggeredNext = useRef(false);
  const skipNextRef = useRef<() => Promise<void>>();
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    setupAudio();
  }, []);

  const setupAudio = async () => {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        staysActiveInBackground: true,
        shouldPlayInBackground: true,
      });

    } catch (error) {
    }
  };

  // Update state from player status with throttling
  useEffect(() => {
    if (!status) return;
    
    const position = Math.floor(status.currentTime * 1000);
    const duration = Math.floor(status.duration * 1000);
    
    // Throttle updates to prevent lag - 2 updates per second
    const now = Date.now();
    if (now - (lastUpdateRef.current || 0) < 500) return;
    lastUpdateRef.current = now;
    
    setState(prev => {
      // Only update if position changed by 1+ seconds or other properties changed
      if (Math.abs(prev.position - position) < 1000 && prev.duration === duration && prev.isPlaying === intendedPlaying) {
        return prev;
      }
      return {
        ...prev,
        position,
        duration,
        isPlaying: intendedPlaying,
      };
    });
  }, [status?.currentTime, status?.duration, intendedPlaying]);

  // Separate effect for song end detection
  useEffect(() => {
    if (!status || !skipNextRef.current) return;
    
    const position = Math.floor(status.currentTime * 1000);
    const duration = Math.floor(status.duration * 1000);
    
    if (duration > 0 && position >= duration - 100 && !hasTriggeredNext.current) {
      hasTriggeredNext.current = true;
      skipNextRef.current();
    }
  }, [status?.currentTime, status?.duration]);

  const playSong = useCallback(async (song: Song, queue?: Song[], generateRadio = true) => {
    try {
      // Check if song is downloaded first
      const downloadedSong = downloadContext?.getDownloadedSong(song.id);
      let audioSource;
      
      if (downloadedSong) {
        // Use local file for downloaded songs
        audioSource = downloadedSong.localPath;
      } else {
        // Try to get stream URL for online playback
        const streamUrl = await InnerTube.getStreamUrl(song.id);
        if (!streamUrl) {
          // No stream URL found and song not downloaded
          return;
        }
        audioSource = streamUrl;
      }

      hasTriggeredNext.current = false;
      setIntendedPlaying(true);
      
      player.replace(audioSource);
      player.play();
      
      // Update state in single batch
      setState(prev => ({ ...prev, currentSong: song, isPlaying: true }));
      
      // Add to recently played and cache (non-blocking)
      library.addToRecentlyPlayed(song);
      
      // Cache the song for offline-like experience
      AsyncStorage.getItem('cached_songs').then(cached => {
        const cachedSongs = cached ? JSON.parse(cached) : [];
        const exists = cachedSongs.find((s: any) => s.id === song.id);
        if (!exists) {
          const updatedCache = [song, ...cachedSongs].slice(0, 100); // Keep last 100 songs
          AsyncStorage.setItem('cached_songs', JSON.stringify(updatedCache)).catch(() => {});
        }
      }).catch(() => {});
      
      if (queue) {
        // Use provided queue (for playlists/albums)
        setRadioContinuation(null);
        setOriginalQueue(queue);
        const finalQueue = shuffle ? shuffleArray([...queue]) : queue;
        setState(prev => ({ ...prev, queue: finalQueue }));
      } else if (generateRadio) {
        // Generate radio queue
        const { songs, continuation } = await InnerTube.next(song.id);
        const radioQueue = songs.filter(s => s.id !== song.id);
        setRadioContinuation(continuation);
        setOriginalQueue(radioQueue);
        const finalQueue = shuffle ? shuffleArray([...radioQueue]) : radioQueue;
        setState(prev => ({ ...prev, queue: finalQueue }));
      }
    } catch (error) {
      // Error playing song handled silently
    }
  }, [player, library, shuffle, downloadContext]);

  const pause = useCallback(() => {
    setIntendedPlaying(false);
    player.pause();
    setState(prev => ({ ...prev, isPlaying: false }));
  }, [player]);

  const resume = useCallback(() => {
    setIntendedPlaying(true);
    player.play();
    setState(prev => ({ ...prev, isPlaying: true }));
  }, [player]);

  const seek = useCallback((position: number) => {
    setIntendedPlaying(true);
    player.seekTo(position / 1000);
  }, [player]);

  const addToQueue = useCallback((song: Song) => {
    setState(prev => ({ ...prev, queue: [...prev.queue, song] }));
  }, []);

  const playNext = useCallback((song: Song) => {
    setState(prev => ({ ...prev, queue: [song, ...prev.queue] }));
  }, []);

  const skipNext = useCallback(async () => {
    const currentState = state;
    const { currentSong, queue } = currentState;
    
    if (repeat === 'one' && currentSong) {
      await playSong(currentSong, undefined, false);
      return;
    }

    // Load more songs if queue is low
    if (queue.length <= 5 && radioContinuation && currentSong) {
      try {
        const { songs, continuation } = await InnerTube.next(currentSong.id, radioContinuation);
        setRadioContinuation(continuation);
        setOriginalQueue(prev => [...prev, ...songs]);
        const newSongs = shuffle ? shuffleArray([...songs]) : songs;
        setState(prev => ({ ...prev, queue: [...prev.queue, ...newSongs] }));
      } catch (error) {
        // Error loading more songs handled silently
      }
    }

    if (queue.length > 0) {
      const nextSong = queue[0];
      if (currentSong) {
        setPreviousSongs(prev => [...prev, currentSong]);
      }
      setState(prev => ({ ...prev, queue: prev.queue.slice(1) }));
      await playSong(nextSong, undefined, false);
    } else if (repeat === 'all' && originalQueue.length > 0) {
      const newQueue = shuffle ? shuffleArray([...originalQueue]) : [...originalQueue];
      if (currentSong) {
        setPreviousSongs(prev => [...prev, currentSong]);
      }
      setState(prev => ({ ...prev, queue: newQueue.slice(1) }));
      await playSong(newQueue[0], undefined, false);
    }
  }, [state, repeat, radioContinuation, shuffle, originalQueue, playSong]);

  useEffect(() => {
    skipNextRef.current = skipNext;
  }, [skipNext]);

  const skipPrevious = useCallback(async () => {
    if (state.position > 3000) {
      // Restart current song if more than 3 seconds in
      player.seekTo(0);
    } else if (previousSongs.length > 0) {
      // Play previous song from history
      const prevSong = previousSongs[previousSongs.length - 1];
      setPreviousSongs(prev => prev.slice(0, -1));
      if (state.currentSong) {
        setState(prev => ({ ...prev, queue: [state.currentSong!, ...prev.queue] }));
      }
      await playSong(prevSong, undefined, false);
    } else if (state.currentSong) {
      // Restart current song
      player.seekTo(0);
    }
  }, [state.position, state.currentSong, previousSongs, player, playSong]);

  const toggleShuffle = useCallback(() => {
    const newShuffle = !shuffle;
    setShuffle(newShuffle);
    if (newShuffle) {
      setState(prev => ({ ...prev, queue: shuffleArray([...prev.queue]) }));
    } else {
      setState(prev => ({ ...prev, queue: [...originalQueue] }));
    }
  }, [shuffle, originalQueue]);

  const toggleRepeat = useCallback(() => {
    setRepeat(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  }, []);

  const contextValue = useMemo(() => ({
    ...state,
    shuffle,
    repeat,
    playSong,
    pause,
    resume,
    seek,
    addToQueue,
    playNext,
    skipNext,
    skipPrevious,
    toggleShuffle,
    toggleRepeat,
  }), [state, shuffle, repeat, playSong, pause, resume, seek, addToQueue, playNext, skipNext, skipPrevious, toggleShuffle, toggleRepeat]);

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
    </PlayerContext.Provider>
  );
};

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
};
