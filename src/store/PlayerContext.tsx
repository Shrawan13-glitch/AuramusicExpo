import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Song, PlayerState } from '../types';
import { InnerTube } from '../api/innertube';
import { useLibrary } from './LibraryContext';
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
      console.log('Background audio enabled');
    } catch (error) {
      console.error('Failed to setup audio mode:', error);
    }
  };

  // Update state from player status
  useEffect(() => {
    if (!status) return;
    
    const position = status.currentTime * 1000;
    const duration = status.duration * 1000;
    
    setState(prev => {
      // Only update if changed significantly
      if (Math.abs(prev.position - position) < 500 && prev.duration === duration) {
        return prev;
      }
      return {
        ...prev,
        position,
        duration,
        isPlaying: intendedPlaying,
      };
    });

    // Detect song end and trigger next
    if (duration > 0 && position >= duration - 100 && !hasTriggeredNext.current && skipNextRef.current) {
      hasTriggeredNext.current = true;
      console.log('Song ended, playing next');
      skipNextRef.current();
    }
  }, [status?.currentTime, status?.duration, intendedPlaying]);

  const playSong = async (song: Song, queue?: Song[], generateRadio = true) => {
    try {
      library.addToRecentlyPlayed(song);

      const streamUrl = await InnerTube.getStreamUrl(song.id);
      if (!streamUrl) {
        console.error('No stream URL found');
        return;
      }

      hasTriggeredNext.current = false;
      setIntendedPlaying(true);
      setState(prev => ({ ...prev, currentSong: song, isPlaying: true }));
      player.replace(streamUrl);
      player.play();
      
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
        console.log(`Queue generated: ${radioQueue.length} songs, continuation: ${!!continuation}`);
      }
    } catch (error) {
      console.error('Error playing song:', error);
    }
  };

  const pause = () => {
    setIntendedPlaying(false);
    player.pause();
    setState(prev => ({ ...prev, isPlaying: false }));
  };

  const resume = () => {
    setIntendedPlaying(true);
    player.play();
    setState(prev => ({ ...prev, isPlaying: true }));
  };

  const seek = (position: number) => {
    setIntendedPlaying(true);
    player.seekTo(position / 1000);
  };

  const addToQueue = (song: Song) => {
    setState(prev => ({ ...prev, queue: [...prev.queue, song] }));
  };

  const playNext = (song: Song) => {
    setState(prev => ({ ...prev, queue: [song, ...prev.queue] }));
  };

  const skipNext = async () => {
    if (repeat === 'one' && state.currentSong) {
      await playSong(state.currentSong, undefined, false);
      return;
    }

    if (state.queue.length <= 5 && radioContinuation) {
      try {
        const { songs, continuation } = await InnerTube.next(state.currentSong?.id || '', radioContinuation);
        setRadioContinuation(continuation);
        setOriginalQueue(prev => [...prev, ...songs]);
        const newSongs = shuffle ? shuffleArray([...songs]) : songs;
        setState(prev => ({ ...prev, queue: [...prev.queue, ...newSongs] }));
      } catch (error) {
        console.error('Failed to load more songs:', error);
      }
    }

    if (state.queue.length > 0) {
      const nextSong = state.queue[0];
      if (state.currentSong) {
        setPreviousSongs(prev => [...prev, state.currentSong!]);
      }
      setState(prev => ({ ...prev, queue: prev.queue.slice(1) }));
      await playSong(nextSong, undefined, false);
    } else if (repeat === 'all' && originalQueue.length > 0) {
      const newQueue = shuffle ? shuffleArray([...originalQueue]) : [...originalQueue];
      setState(prev => ({ ...prev, queue: newQueue }));
      if (state.currentSong) {
        setPreviousSongs(prev => [...prev, state.currentSong!]);
      }
      await playSong(newQueue[0], undefined, false);
    }
  };

  useEffect(() => {
    skipNextRef.current = skipNext;
  });

  const skipPrevious = async () => {
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
  };

  const toggleShuffle = () => {
    const newShuffle = !shuffle;
    setShuffle(newShuffle);
    if (newShuffle) {
      setState(prev => ({ ...prev, queue: shuffleArray([...prev.queue]) }));
    } else {
      setState(prev => ({ ...prev, queue: [...originalQueue] }));
    }
  };

  const toggleRepeat = () => {
    setRepeat(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  };

  return (
    <PlayerContext.Provider
      value={{
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
      }}
    >
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
