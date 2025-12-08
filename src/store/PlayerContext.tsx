import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { Song, PlayerState } from '../types';
import { InnerTube } from '../api/innertube';
import { useLibrary } from './LibraryContext';

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

  const player = useAudioPlayer('');

  useEffect(() => {
    const interval = setInterval(() => {
      if (player.playing) {
        const position = player.currentTime * 1000;
        const duration = player.duration * 1000;
        
        setState(prev => ({
          ...prev,
          position,
          duration,
          isPlaying: player.playing,
        }));

        // Auto-play next song when current ends
        if (duration > 0 && position >= duration - 500) {
          skipNext();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [player.playing, state.queue.length]);

  const playSong = async (song: Song, queue?: Song[], generateRadio = true) => {
    try {
      setState(prev => ({ ...prev, currentSong: song, isPlaying: true }));
      library.addToRecentlyPlayed(song);

      const streamUrl = await InnerTube.getStreamUrl(song.id);
      if (!streamUrl) {
        console.error('No stream URL found');
        return;
      }

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
        console.log(`Queue generated: ${queue.length} songs, continuation: ${!!continuation}`);
      }
    } catch (error) {
      console.error('Error playing song:', error);
    }
  };

  const pause = () => {
    player.pause();
    setState(prev => ({ ...prev, isPlaying: false }));
  };

  const resume = () => {
    player.play();
    setState(prev => ({ ...prev, isPlaying: true }));
  };

  const seek = (position: number) => {
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
      await playSong(state.currentSong, false);
      return;
    }

    if (state.queue.length <= 5 && radioContinuation && state.currentSong) {
      const { songs, continuation } = await InnerTube.next(state.currentSong.id, radioContinuation);
      setRadioContinuation(continuation);
      setOriginalQueue(prev => [...prev, ...songs]);
      const newSongs = shuffle ? shuffleArray([...songs]) : songs;
      setState(prev => ({ ...prev, queue: [...prev.queue, ...newSongs] }));
    }

    if (state.queue.length > 0) {
      const nextSong = state.queue[0];
      setState(prev => ({ ...prev, queue: prev.queue.slice(1) }));
      await playSong(nextSong, false);
    } else if (repeat === 'all' && originalQueue.length > 0) {
      const newQueue = shuffle ? shuffleArray([...originalQueue]) : [...originalQueue];
      setState(prev => ({ ...prev, queue: newQueue }));
      await playSong(newQueue[0], false);
    }
  };

  const skipPrevious = async () => {
    if (state.currentSong) {
      await playSong(state.currentSong);
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
