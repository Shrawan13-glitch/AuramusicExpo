import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { AudioPro, AudioProContentType, AudioProEventType } from 'react-native-audio-pro';
import CryptoJS from 'crypto-js';
import { getStreamUrl } from '../streaming';
import { CookieManager } from '../utils/cookieManager';
import { AuthenticatedHttpClient } from '../utils/authenticatedHttpClient';

export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  thumbnail: string;
  streamUrl?: string;
  duration?: number;
}

export interface PlaybackSource {
  type: 'search' | 'playlist' | 'album' | 'queue' | 'unknown';
  label: string;
  id?: string;
  ytQueuePlaylistId?: string;
  ytQueueParams?: string;
}

export interface PlayTrackOptions {
  source?: PlaybackSource;
  preserveQueue?: boolean;
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
  playbackSource: PlaybackSource;
  playTrack: (track: Track, queue?: Track[], options?: PlayTrackOptions) => void;
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
  const [playbackSource, setPlaybackSource] = useState<PlaybackSource>({
    type: 'unknown',
    label: 'Now playing',
  });
  const streamRequestId = useRef(0);
  const currentTrackRef = useRef<Track | null>(null);
  const visitorDataRef = useRef<string | null>(null);
  const authHeadersRef = useRef<{ cookie?: string; authorization?: string } | null>(null);
  const queueHydrationLock = useRef(false);

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

  const playTrack = useCallback((track: Track, newQueue?: Track[], options?: PlayTrackOptions) => {
    if (options?.preserveQueue) {
      // Keep queue/currentIndex as managed by caller (skip next/previous flows).
    } else if (newQueue) {
      setQueue(newQueue);
      const index = newQueue.findIndex(t => t.id === track.id);
      setCurrentIndex(index >= 0 ? index : 0);
    } else {
      setQueue([track]);
      setCurrentIndex(0);
    }
    if (options?.source) {
      setPlaybackSource(options.source);
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

  const parseWatchNextQueueTracks = useCallback((response: any): Track[] => {
    const contentTabs =
      response?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs ||
      [];

    const panelFromTabs = contentTabs.flatMap((tab: any) => {
      const tabContent = tab?.tabRenderer?.content;
      return (
        tabContent?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents ||
        tabContent?.playlistPanelRenderer?.contents ||
        []
      );
    });

    const fallbackPanel =
      response?.contents?.singleColumnMusicWatchNextResultsRenderer?.playlist?.playlistPanelRenderer?.contents ||
      response?.contents?.twoColumnWatchNextResults?.playlist?.playlist?.contents ||
      [];

    const directPanelItems: any[] = panelFromTabs.length ? panelFromTabs : fallbackPanel;

    const collectPlaylistPanelRenderers = (node: any, depth = 0, acc: any[] = []): any[] => {
      if (!node || depth > 12) return acc;
      if (Array.isArray(node)) {
        node.forEach((item) => collectPlaylistPanelRenderers(item, depth + 1, acc));
        return acc;
      }
      if (typeof node !== 'object') return acc;

      if (node.playlistPanelVideoRenderer) {
        acc.push(node.playlistPanelVideoRenderer);
      }

      Object.values(node).forEach((value) => collectPlaylistPanelRenderers(value, depth + 1, acc));
      return acc;
    };

    const candidateRenderers =
      directPanelItems
        .map((entry) => entry?.playlistPanelVideoRenderer)
        .filter(Boolean)
        .length > 0
        ? directPanelItems.map((entry) => entry?.playlistPanelVideoRenderer).filter(Boolean)
        : collectPlaylistPanelRenderers(response);

    const seen = new Set<string>();
    return candidateRenderers
      .map((renderer) => {
        if (!renderer?.videoId) return null;
        if (seen.has(renderer.videoId)) return null;
        seen.add(renderer.videoId);
        const title =
          renderer?.title?.simpleText ||
          renderer?.title?.runs?.map((run: any) => run.text).join('') ||
          'Unknown Title';
        const artistRuns = renderer?.longBylineText?.runs || renderer?.shortBylineText?.runs || [];
        const artist = artistRuns
          .filter((run: any) => run?.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC'))
          .map((run: any) => run.text)
          .join(', ') || 'Unknown Artist';
        const artistId = artistRuns.find((run: any) => run?.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC'))
          ?.navigationEndpoint?.browseEndpoint?.browseId;
        const thumbnail =
          renderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
          renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
          '';
        return {
          id: renderer.videoId,
          title,
          artist,
          artistId,
          thumbnail,
        } as Track;
      })
      .filter(Boolean) as Track[];
  }, []);

  const hydrateQueueFromYouTube = useCallback(async () => {
    if (queueHydrationLock.current) return false;
    const current = currentTrackRef.current;
    if (!current?.id) return false;

    queueHydrationLock.current = true;
    try {
      const nextResponse = await AuthenticatedHttpClient.getWatchNextQueue(current.id, {
        playlistId:
          playbackSource.type === 'playlist'
            ? playbackSource.id
            : playbackSource.ytQueuePlaylistId || `RDAMVM${current.id}`,
        params: playbackSource.ytQueueParams,
      });
      const ytTracks = parseWatchNextQueueTracks(nextResponse);
      if (!ytTracks.length) return false;

      let added = 0;
      setQueue((prev) => {
        const seen = new Set(prev.map((track) => track.id));
        const appendable = ytTracks.filter((track) => {
          if (!track.id || track.id === current.id || seen.has(track.id)) return false;
          seen.add(track.id);
          return true;
        });
        added = appendable.length;
        return appendable.length ? [...prev, ...appendable] : prev;
      });
      return added > 0;
    } catch (error) {
      console.error('Failed to hydrate queue from YouTube', error);
      return false;
    } finally {
      queueHydrationLock.current = false;
    }
  }, [parseWatchNextQueueTracks, playbackSource.id, playbackSource.type]);

  useEffect(() => {
    if (!currentTrack?.id) return;
    if (playbackSource.type === 'playlist') return;
    if (queue.length > 1) return;
    void hydrateQueueFromYouTube();
  }, [currentTrack?.id, hydrateQueueFromYouTube, playbackSource.type, queue.length]);

  const skipNext = useCallback(() => {
    if (currentIndex < queue.length - 1) {
      const nextTrack = queue[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      playTrack(nextTrack, queue, { preserveQueue: true });
      return;
    }

    void (async () => {
      const hydrated = await hydrateQueueFromYouTube();
      if (!hydrated) return;

      setQueue((latestQueue) => {
        if (currentIndex >= latestQueue.length - 1) return latestQueue;
        const nextTrack = latestQueue[currentIndex + 1];
        if (nextTrack) {
          setCurrentIndex(currentIndex + 1);
          playTrack(nextTrack, latestQueue, {
            preserveQueue: true,
            source: playbackSource.type === 'unknown'
              ? { type: 'queue', label: 'YouTube Queue' }
              : playbackSource,
          });
        }
        return latestQueue;
      });
    })();
  }, [currentIndex, hydrateQueueFromYouTube, playTrack, playbackSource, queue]);

  const skipPrevious = useCallback(() => {
    if (currentIndex > 0) {
      const prevTrack = queue[currentIndex - 1];
      setCurrentIndex(currentIndex - 1);
      playTrack(prevTrack, queue, { preserveQueue: true });
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
    playbackSource,
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
    playbackSource,
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
