import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AudioPro, useAudioPro } from 'react-native-audio-pro';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Song, PlayerState } from '../types';
import { InnerTube } from '../api/innertube';
import { useLibrary } from './LibraryContext';
import { useDownload } from './DownloadContext';
import { cacheManager } from '../utils/cacheManager';

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
  setSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;
  sleepTimerRemaining: number | null;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const library = useLibrary();
  const downloadContext = useDownload();
  const audioState = useAudioPro();
  
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
  const [isChangingSong, setIsChangingSong] = useState(false);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);

  const hasTriggeredNext = useRef(false);
  const skipNextRef = useRef<() => Promise<void>>();
  const lastUpdateRef = useRef<number>(0);
  const positionUpdateRef = useRef<NodeJS.Timeout | null>(null);

  // Optimized state updates with batching
  const updateState = useCallback((updater: (prev: PlayerState) => PlayerState) => {
    setState(prev => {
      const newState = updater(prev);
      // Only update if state actually changed
      if (JSON.stringify(newState) !== JSON.stringify(prev)) {
        return newState;
      }
      return prev;
    });
  }, []);

  // Throttled position updates for better performance
  const throttledPositionUpdate = useCallback((position: number, duration: number) => {
    const now = Date.now();
    if (now - lastUpdateRef.current > 500) { // Update every 500ms for smoother UI
      lastUpdateRef.current = now;
      updateState(prev => ({
        ...prev,
        position,
        duration,
      }));
    }
  }, [updateState]);

  useEffect(() => {
    setupPlayer();
    return () => {
      if (positionUpdateRef.current) clearInterval(positionUpdateRef.current);
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const currentPosition = audioState.position || 0;
    const currentDuration = audioState.duration || 0;
    
    // Only update if not loading and not seeking
    if (!isLoading && !isChangingSong) {
      setState(prev => {
        const newState = { ...prev };
        let hasChanges = false;
        
        // Only update playing state if it actually changed
        if (audioState.state === 'PLAYING' && !prev.isPlaying) {
          newState.isPlaying = true;
          hasChanges = true;
        } else if (audioState.state === 'PAUSED' && prev.isPlaying && !intendedPlaying) {
          newState.isPlaying = false;
          hasChanges = true;
        }
        
        // Update position and duration
        if (Math.abs(currentPosition - prev.position) > 500 || currentDuration !== prev.duration) {
          newState.position = currentPosition;
          newState.duration = currentDuration;
          hasChanges = true;
        }
        
        return hasChanges ? newState : prev;
      });
    }
  }, [audioState.state, audioState.position, audioState.duration, isLoading, isChangingSong, intendedPlaying]);

  const setupPlayer = async () => {
    AudioPro.configure({ 
      contentType: 'music',
      showNextPrevControls: true,
      showSkipControls: false
    });
    
    AudioPro.addEventListener((event) => {
      switch (event.type) {
        case 'REMOTE_NEXT':
          if (skipNextRef.current) {
            skipNextRef.current();
          }
          break;
        case 'REMOTE_PREV':
          if (skipPreviousRef.current) {
            skipPreviousRef.current();
          }
          break;
        case 'PLAYBACK_TRACK_ENDED':
        case 'TRACK_ENDED':
          
          if (skipNextRef.current && !hasTriggeredNext.current) {
            hasTriggeredNext.current = true;
            skipNextRef.current().finally(() => {
              setTimeout(() => {
                hasTriggeredNext.current = false;
              }, 1000);
            });
          }
          break;
      }
    });
    

    
    // Start position update interval
    positionUpdateRef.current = setInterval(async () => {
      if (audioState.state === 'playing') {
        try {
          const position = await AudioPro.getPosition();
          const duration = await AudioPro.getDuration();
          setState(prev => ({
            ...prev,
            position: position || 0,
            duration: duration || 0,
          }));
        } catch (error) {
          // Position update error
        }
      }
    }, 1000);
  };

  const playSong = useCallback(async (song: Song, queue?: Song[], generateRadio = true) => {
    if (isChangingSong) return;
    setIsChangingSong(true);
    setIsLoading(true);
    
    try {
      let audioSource;
      
      // Check if song is cached first
      const cachedPath = await cacheManager.getCachedSongPath(song.id);
      if (cachedPath) {
        audioSource = `file://${cachedPath}`;
      } else {
        const downloadedSong = downloadContext?.getDownloadedSong(song.id);
        
        if (downloadedSong) {
          audioSource = downloadedSong.localPath;
        } else {
          const streamUrl = await InnerTube.getStreamUrl(song.id);
          if (!streamUrl) {
            return;
          }
          audioSource = streamUrl;
          
          // Cache the song in background
          cacheManager.cacheSong(
            song.id,
            song.title || 'Unknown Title',
            song.artists?.[0]?.name || song.artist || 'Unknown Artist',
            streamUrl
          ).catch(error => {});
        }
      }

      // Validate URL format
      if (!audioSource || (!audioSource.startsWith('http') && !audioSource.startsWith('file://'))) {
        return;
      }

      hasTriggeredNext.current = false;
      setIntendedPlaying(true);
      
      // Stop any existing track first
      try {
        await AudioPro.stop();
      } catch (error) {
        // Ignore stop errors
      }
      
      const track = {
        id: song.id,
        url: audioSource,
        title: song.title || 'Unknown Title',
        artist: song.artists?.[0]?.name || song.artist || 'Unknown Artist',
        artwork: song.thumbnail || song.thumbnailUrl,
      };
      
      await AudioPro.play(track);
      
      // Update app state to match AudioPro
      setState(prev => ({ 
        ...prev, 
        currentSong: song,
        isPlaying: true, // Assume playing when starting new song
      }));
      
      const startTime = Date.now();
      setTimeout(() => {
        const elapsed = Date.now() - startTime;
        library.addToRecentlyPlayed(song, elapsed);
      }, 3000);
      
      AsyncStorage.getItem('cached_songs').then(cached => {
        const cachedSongs = cached ? JSON.parse(cached) : [];
        const exists = cachedSongs.find((s: any) => s.id === song.id);
        if (!exists) {
          const updatedCache = [song, ...cachedSongs].slice(0, 100);
          AsyncStorage.setItem('cached_songs', JSON.stringify(updatedCache)).catch(() => {});
        }
      }).catch(() => {});
      
      // Only update queue if explicitly provided
      if (queue) {
        setRadioContinuation(null);
        // Remove the current song from the queue to avoid duplicates
        const queueWithoutCurrent = queue.filter(s => s.id !== song.id);
        setOriginalQueue(queue);
        const finalQueue = shuffle ? shuffleArray([...queueWithoutCurrent]) : queueWithoutCurrent;
        setState(prev => ({ ...prev, queue: finalQueue }));
      } else if (generateRadio) {
        const { songs, continuation } = await InnerTube.next(song.id);
        const radioQueue = songs.filter(s => s.id !== song.id);
        setRadioContinuation(continuation);
        setOriginalQueue(radioQueue);
        const finalQueue = shuffle ? shuffleArray([...radioQueue]) : radioQueue;
        setState(prev => ({ ...prev, queue: finalQueue }));
      }
    } catch (error) {
    } finally {
      setIsChangingSong(false);
      setIsLoading(false);
    }
  }, [library, shuffle, downloadContext, isChangingSong]);

  const pause = useCallback(async () => {
    // Immediate UI update for better perceived performance
    updateState(prev => ({ ...prev, isPlaying: false }));
    setIntendedPlaying(false);
    await AudioPro.pause();
  }, [updateState]);

  const resume = useCallback(async () => {
    // Immediate UI update for better perceived performance
    updateState(prev => ({ ...prev, isPlaying: true }));
    setIntendedPlaying(true);
    await AudioPro.resume();
  }, [updateState]);

  const seek = useCallback(async (position: number) => {
    // Keep playing state during seek
    setIntendedPlaying(true);
    setState(prev => ({ ...prev, position, isPlaying: true }));
    try {
      await AudioPro.seekTo(position);
    } catch (error) {
      // Revert position on error
      setState(prev => ({ ...prev, position: prev.position }));
    }
  }, []);

  const addToQueue = useCallback((song: Song) => {
    setState(prev => ({ ...prev, queue: [...prev.queue, song] }));
  }, []);

  const playNext = useCallback((song: Song) => {
    setState(prev => ({ ...prev, queue: [song, ...prev.queue] }));
  }, []);

  const skipNext = useCallback(async () => {
    if (isChangingSong) return;
    
    setState(currentState => {
      const { currentSong, queue } = currentState;
      
      if (repeat === 'one' && currentSong) {
        playSong(currentSong, undefined, false);
        return currentState;
      }

      // Load more songs if queue is low
      if (queue.length <= 5 && radioContinuation && currentSong) {
        InnerTube.next(currentSong.id, radioContinuation).then(({ songs, continuation }) => {
          setRadioContinuation(continuation);
          setOriginalQueue(prev => [...prev, ...songs]);
          const newSongs = shuffle ? shuffleArray([...songs]) : songs;
          setState(prev => ({ ...prev, queue: [...prev.queue, ...newSongs] }));
        }).catch(() => {});
      }

      if (queue.length > 0) {
        const nextSong = queue[0];
        if (currentSong) {
          setPreviousSongs(prev => [...prev, currentSong]);
        }
        playSong(nextSong, undefined, false);
        return { ...currentState, queue: queue.slice(1) };
      } else if (repeat === 'all' && originalQueue.length > 0) {
        const newQueue = shuffle ? shuffleArray([...originalQueue]) : [...originalQueue];
        if (currentSong) {
          setPreviousSongs(prev => [...prev, currentSong]);
        }
        playSong(newQueue[0], undefined, false);
        return { ...currentState, queue: newQueue.slice(1) };
      }
      
      return currentState;
    });
  }, [repeat, radioContinuation, shuffle, originalQueue, playSong, isChangingSong]);

  const skipPreviousRef = useRef<() => Promise<void>>();

  useEffect(() => {
    skipNextRef.current = skipNext;
    skipPreviousRef.current = skipPrevious;
  }, [skipNext, skipPrevious]);

  const skipPrevious = useCallback(async () => {
    if (isChangingSong) return;
    
    if (previousSongs.length > 0) {
      const prevSong = previousSongs[previousSongs.length - 1];
      setPreviousSongs(prev => prev.slice(0, -1));
      if (state.currentSong) {
        setState(prev => ({ ...prev, queue: [state.currentSong!, ...prev.queue] }));
      }
      await playSong(prevSong, undefined, false);
    } else if (state.position > 3000) {
      await AudioPro.seekTo(0);
    } else if (state.currentSong) {
      await AudioPro.seekTo(0);
    }
  }, [state.position, state.currentSong, previousSongs, playSong]);

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

  const setSleepTimer = useCallback((minutes: number) => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    
    const endTime = Date.now() + (minutes * 60 * 1000);
    setSleepTimerRemaining(minutes);
    
    sleepTimerRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const remainingMinutes = remaining / (60 * 1000);
      
      if (remaining <= 0) {
        if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
        setSleepTimerRemaining(null);
        pause();
      } else {
        setSleepTimerRemaining(remainingMinutes);
      }
    }, 1000);
  }, [pause]);

  const cancelSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    setSleepTimerRemaining(null);
  }, []);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    };
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
    setSleepTimer,
    cancelSleepTimer,
    sleepTimerRemaining,
  }), [state, shuffle, repeat, playSong, pause, resume, seek, addToQueue, playNext, skipNext, skipPrevious, toggleShuffle, toggleRepeat, setSleepTimer, cancelSleepTimer, sleepTimerRemaining]);

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
