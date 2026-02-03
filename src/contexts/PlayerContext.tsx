import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { AudioPro, AudioProContentType, AudioProEventType } from 'react-native-audio-pro';
import CryptoJS from 'crypto-js';
import { getStreamUrl } from '../streaming';
import { CookieManager } from '../utils/cookieManager';

interface Track {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  thumbnail: string;
  streamUrl?: string;
  duration?: number;
}

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  streamStatus: 'idle' | 'loading' | 'ready' | 'error';
  streamError: string | null;
  queue: Track[];
  currentIndex: number;
  playTrack: (track: Track, queue?: Track[]) => void;
  pause: () => void;
  resume: () => void;
  seekTo: (position: number) => void;
  skipNext: () => void;
  skipPrevious: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [streamStatus, setStreamStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [streamError, setStreamError] = useState<string | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const streamRequestId = useRef(0);
  const currentTrackRef = useRef<Track | null>(null);
  const visitorDataRef = useRef<string | null>(null);
  const authHeadersRef = useRef<{ cookie?: string; authorization?: string } | null>(null);

  const buildAuthHeaders = useCallback(async () => {
    if (authHeadersRef.current) return authHeadersRef.current;
    const cookies = await CookieManager.getCookies();
    const cookieString = CookieManager.formatCookiesForRequest(cookies);
    const getCookieValue = (name: string) =>
      cookies.find((cookie) => cookie.name === name)?.value || '';

    const sapisid = getCookieValue('SAPISID');
    const sapisid1p = getCookieValue('__Secure-1PAPISID');
    const sapisid3p = getCookieValue('__Secure-3PAPISID');

    const timestamp = Math.floor(Date.now() / 1000);
    const parts: string[] = [];

    if (sapisid) {
      const hash = CryptoJS.SHA1(`${timestamp} ${sapisid} https://music.youtube.com`).toString();
      parts.push(`SAPISIDHASH ${timestamp}_${hash}`);
    }
    if (sapisid1p) {
      const hash = CryptoJS.SHA1(`${timestamp} ${sapisid1p} https://music.youtube.com`).toString();
      parts.push(`SAPISID1PHASH ${timestamp}_${hash}`);
    }
    if (sapisid3p) {
      const hash = CryptoJS.SHA1(`${timestamp} ${sapisid3p} https://music.youtube.com`).toString();
      parts.push(`SAPISID3PHASH ${timestamp}_${hash}`);
    }

    authHeadersRef.current = {
      cookie: cookieString || undefined,
      authorization: parts.length ? parts.join(' ') : undefined,
    };
    return authHeadersRef.current;
  }, []);

  const resolveStreamUrl = useCallback(async (trackId: string) => {
    const requestId = streamRequestId.current + 1;
    streamRequestId.current = requestId;
    setStreamStatus('loading');
    setStreamError(null);

    const cookies = await CookieManager.getCookies();
    if (!visitorDataRef.current) {
      const visitorCookie = cookies.find((cookie) => cookie.name === 'VISITOR_INFO1_LIVE');
      visitorDataRef.current = visitorCookie?.value ?? null;
    }
    const authHeaders = await buildAuthHeaders();

    const result = await getStreamUrl(trackId, {
      preferOpus: true,
      visitorData: visitorDataRef.current ?? undefined,
      cookie: authHeaders?.cookie,
      authorization: authHeaders?.authorization,
    });
    if (streamRequestId.current !== requestId) return;

    if (result.ok) {
      setCurrentTrack((prev) => {
        if (!prev || prev.id !== trackId) return prev;
        const shouldUpdateArtist =
          result.artistName &&
          (!prev.artist || prev.artist.toLowerCase() === 'unknown artist');
        return {
          ...prev,
          streamUrl: result.url,
          artist: shouldUpdateArtist ? result.artistName : prev.artist,
          artistId: result.artistId ?? prev.artistId,
        };
      });
      const trackInfo = currentTrackRef.current;
      if (trackInfo && trackInfo.id === trackId) {
        AudioPro.play({
          id: trackInfo.id,
          url: result.url,
          title: trackInfo.title,
          artist: trackInfo.artist,
          artwork: trackInfo.thumbnail,
        });
      }
      setStreamStatus('ready');
      setStreamError(null);
    } else {
      setStreamStatus('error');
      setStreamError(result.error);
      console.error('[PlayerContext] Stream URL error', {
        error: result.error,
        triedClients: result.triedClients,
        playabilityStatus: result.playabilityStatus,
        playabilityReason: result.playabilityReason,
      });
      setIsPlaying(false);
    }
  }, [buildAuthHeaders]);

  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {
    if (newQueue) {
      setQueue(newQueue);
      const index = newQueue.findIndex(t => t.id === track.id);
      setCurrentIndex(index >= 0 ? index : 0);
    }
    currentTrackRef.current = track;
    setCurrentTrack(track);
    setIsPlaying(true);
    setPosition(0);
    void resolveStreamUrl(track.id);
  }, [resolveStreamUrl]);

  const pause = useCallback(() => {
    AudioPro.pause();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    AudioPro.resume();
    setIsPlaying(true);
  }, []);

  const seekTo = useCallback((newPosition: number) => {
    AudioPro.seekTo(newPosition);
    setPosition(newPosition);
  }, []);

  const skipNext = useCallback(() => {
    if (currentIndex < queue.length - 1) {
      const nextTrack = queue[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      playTrack(nextTrack);
    }
  }, [currentIndex, queue, playTrack]);

  const skipPrevious = useCallback(() => {
    if (currentIndex > 0) {
      const prevTrack = queue[currentIndex - 1];
      setCurrentIndex(currentIndex - 1);
      playTrack(prevTrack);
    }
  }, [currentIndex, queue, playTrack]);

  useEffect(() => {
    AudioPro.configure({
      contentType: AudioProContentType.MUSIC,
      showNextPrevControls: true,
      showSkipControls: false,
      debug: false,
    });

    const subscription = AudioPro.addEventListener((event) => {
      switch (event.type) {
        case AudioProEventType.PROGRESS: {
          const positionMs = event.payload?.position ?? 0;
          const durationMs = event.payload?.duration ?? 0;
          setPosition(positionMs / 1000);
          setDuration(durationMs / 1000);
          break;
        }
        case AudioProEventType.STATE_CHANGED: {
          const state = event.payload?.state;
          if (state === 'PLAYING') setIsPlaying(true);
          if (state === 'PAUSED' || state === 'STOPPED' || state === 'ERROR') setIsPlaying(false);
          break;
        }
        case AudioProEventType.TRACK_ENDED: {
          skipNext();
          break;
        }
        case AudioProEventType.REMOTE_NEXT: {
          skipNext();
          break;
        }
        case AudioProEventType.REMOTE_PREV: {
          skipPrevious();
          break;
        }
        case AudioProEventType.PLAYBACK_ERROR: {
          setStreamStatus('error');
          setStreamError(event.payload?.error ?? 'Playback error');
          setIsPlaying(false);
          break;
        }
        default:
          break;
      }
    });

    return () => subscription.remove();
  }, [skipNext, skipPrevious]);

  const contextValue = useMemo(() => ({
    currentTrack,
    isPlaying,
    position,
    duration,
    streamStatus,
    streamError,
    queue,
    currentIndex,
    playTrack,
    pause,
    resume,
    seekTo,
    skipNext,
    skipPrevious,
  }), [
    currentTrack,
    isPlaying,
    position,
    duration,
    streamStatus,
    streamError,
    queue,
    currentIndex,
    playTrack,
    pause,
    resume,
    seekTo,
    skipNext,
    skipPrevious,
  ]);

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
