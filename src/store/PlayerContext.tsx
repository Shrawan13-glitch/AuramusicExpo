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
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);

  const hasTriggeredNext = useRef(false);
  const skipNextRef = useRef<() => Promise<void>>();
  const lastUpdateRef = useRef<number>(0);
  const positionUpdateRef = useRef<NodeJS.Timeout | null>(null);

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
    
    // Only update app state to reflect AudioPro's current state
    setState(prev => {
      const newState = { ...prev };
      
      if (audioState.state === 'PLAYING') {
        newState.isPlaying = true;
      } else if (audioState.state === 'PAUSED') {
        newState.isPlaying = false;
      }
      
      newState.position = currentPosition;
      newState.duration = currentDuration;
      
      return newState;
    });
    
    // Disable autoplay - let AudioPro handle it completely
    // if (currentDuration > 0 && currentPosition >= currentDuration - 1000 && audioState.state !== 'PLAYING') {
    //   if (!hasTriggeredNext.current) {
    //     console.log('AUTOPLAY: Song ended, triggering next');
    //     hasTriggeredNext.current = true;
    //     setTimeout(() => {
    //       skipNext();
    //       hasTriggeredNext.current = false;
    //     }, 500);
    //   }
    // }

  }, [audioState.state, audioState.position, audioState.duration, intendedPlaying, skipNext]);

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
          console.log('AUTOPLAY: Track ended in background');
          if (skipNextRef.current) {
            skipNextRef.current();
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
            console.log('No stream URL found for song:', song.title);
            return;
          }
          audioSource = streamUrl;
          
          // Cache the song in background
          cacheManager.cacheSong(
            song.id,
            song.title || 'Unknown Title',
            song.artists?.[0]?.name || song.artist || 'Unknown Artist',
            streamUrl
          ).catch(error => {
            console.log('Background caching failed:', error);
          });
        }
      }

      // Validate URL format
      if (!audioSource || (!audioSource.startsWith('http') && !audioSource.startsWith('file://'))) {
        console.log('Invalid audio source:', audioSource);
        return;
      }

      hasTriggeredNext.current = false;
      setIntendedPlaying(true);
      
      const track = {
        id: song.id,
        url: audioSource,
        title: song.title || 'Unknown Title',
        artist: song.artists?.[0]?.name || song.artist || 'Unknown Artist',
        artwork: song.thumbnail || song.thumbnailUrl,
        onEnd: () => {
          if (!hasTriggeredNext.current) {
            hasTriggeredNext.current = true;
            setTimeout(() => {
              skipNext();
              hasTriggeredNext.current = false;
            }, 100);
          }
        }
      };
      
      await AudioPro.play(track);
      
      // Update app state to match AudioPro
      setState(prev => ({ ...prev, currentSong: song }));
      
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
      
      if (queue) {
        setRadioContinuation(null);
        setOriginalQueue(queue);
        const finalQueue = shuffle ? shuffleArray([...queue]) : queue;
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
      console.log('Error playing song:', error);
    } finally {
      setIsChangingSong(false);
    }
  }, [library, shuffle, downloadContext, isChangingSong]);

  const pause = useCallback(async () => {
    setIntendedPlaying(false);
    await AudioPro.pause();
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const resume = useCallback(async () => {
    setIntendedPlaying(true);
    await AudioPro.resume();
    setState(prev => ({ ...prev, isPlaying: true }));
  }, []);

  const seek = useCallback(async (position: number) => {
    setIntendedPlaying(true);
    try {
      await AudioPro.seekTo(position); // AudioPro expects milliseconds
      setState(prev => ({ ...prev, position }));
    } catch (error) {
      console.log('Seek error:', error);
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
    
    const totalSeconds = Math.round(minutes * 60);
    setSleepTimerRemaining(minutes);
    
    sleepTimerRef.current = setInterval(() => {
      setSleepTimerRemaining(prev => {
        if (prev === null || prev <= (1/60)) { // Less than 1 second remaining
          if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
          pause();
          return null;
        }
        return prev - (1/60); // Decrease by 1 second
      });
    }, 1000); // Update every second
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
