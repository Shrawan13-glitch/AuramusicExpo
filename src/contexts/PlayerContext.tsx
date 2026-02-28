import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { AudioPro } from 'react-native-audio-pro';
import { registerAudioHandlers } from '../audioSetup';
import CryptoJS from 'crypto-js';
import { getStreamUrl } from '../streaming';
import { CookieManager } from '../utils/cookieManager';
import { AuthenticatedHttpClient } from '../utils/authenticatedHttpClient';
import { cacheSongFromUrl, getCachedSongPath } from '../utils/cacheManager';

export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artists?: Array<{ id?: string; name: string }>;
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
  shuffleEnabled: boolean;
  repeatMode: 'off' | 'all' | 'one';
  playTrack: (track: Track, queue?: Track[], options?: PlayTrackOptions) => void;
  pause: () => void;
  resume: () => void;
  seekTo: (position: number) => void;
  skipNext: () => void;
  skipPrevious: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
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
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const streamRequestId = useRef(0);
  const currentTrackRef = useRef<Track | null>(null);
  const visitorDataRef = useRef<string | null>(null);
  const authHeadersRef = useRef<{ cookie?: string; authorization?: string } | null>(null);
  const queueHydrationLock = useRef(false);
  const streamUrlCacheRef = useRef<Map<string, string>>(new Map());
  const artistMetaCacheRef = useRef<Map<string, Array<{ id?: string; name: string }>>>(new Map());
  const inflightStreamRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const queuePreloadTokenRef = useRef(0);
  const queueRef = useRef<Track[]>([]);
  const currentIndexRef = useRef(0);
  const playHistoryRef = useRef<number[]>([]);
  const playbackSourceRef = useRef<PlaybackSource>({
    type: 'unknown',
    label: 'Now playing',
  });

  const setQueueSynced = useCallback((nextQueue: Track[]) => {
    queueRef.current = nextQueue;
    setQueue(nextQueue);
  }, []);

  const setCurrentIndexSynced = useCallback((nextIndex: number) => {
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
  }, []);

  const setPlaybackSourceSynced = useCallback((nextSource: PlaybackSource) => {
    playbackSourceRef.current = nextSource;
    setPlaybackSource(nextSource);
  }, []);

  const normalizeArtists = useCallback((track: Track): Array<{ id?: string; name: string }> => {
    const splitArtistNames = (value: string) =>
      value
        .split(/\s*(?:,|&|and| x | · |\/|feat\.?|ft\.?)\s*/i)
        .map((item) => item.trim())
        .filter(Boolean);

    const direct = (track.artists || [])
      .flatMap((artist) => {
        const names = splitArtistNames(artist?.name || '');
        return names.map((name, index) => ({
          id: index === 0 ? artist?.id : undefined,
          name,
        }));
      })
      .filter((artist) => !!artist.name);
    if (direct.length) {
      const dedup = new Map<string, { id?: string; name: string }>();
      direct.forEach((artist) => {
        const key = artist.id || artist.name.toLowerCase();
        if (!dedup.has(key)) dedup.set(key, artist);
      });
      return Array.from(dedup.values());
    }

    const rawArtist = (track.artist || '').trim();
    if (!rawArtist) return [];
    const split = splitArtistNames(rawArtist);
    if (!split.length) return [];
    return split.map((name, index) => ({
      name,
      id: index === 0 ? track.artistId : undefined,
    }));
  }, []);

  const withNormalizedArtists = useCallback((track: Track): Track => {
    const artists = normalizeArtists(track);
    if (!artists.length) return track;
    return {
      ...track,
      artists,
      artist: artists.map((entry) => entry.name).join(', '),
      artistId: artists[0]?.id || track.artistId,
    };
  }, [normalizeArtists]);

  const mergeArtistLists = useCallback((
    base: Array<{ id?: string; name: string }>,
    incoming: Array<{ id?: string; name: string }>
  ) => {
    const merged = new Map<string, { id?: string; name: string }>();
    [...base, ...incoming].forEach((artist) => {
      const name = artist?.name?.trim();
      if (!name) return;
      const key = artist.id || name.toLowerCase();
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { id: artist.id, name });
      } else if (!existing.id && artist.id) {
        merged.set(key, { id: artist.id, name: existing.name });
      }
    });
    return Array.from(merged.values());
  }, []);

  const applyArtistMetaToState = useCallback((trackId: string, artists: Array<{ id?: string; name: string }>) => {
    if (!trackId || !artists.length) return;
    setCurrentTrack((prev) => {
      if (!prev || prev.id !== trackId) return prev;
      const updated = withNormalizedArtists({
        ...prev,
        artists,
        artist: artists.map((entry) => entry.name).join(', '),
        artistId: artists[0]?.id || prev.artistId,
      });
      currentTrackRef.current = updated;
      return updated;
    });
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id !== trackId) return item;
        return withNormalizedArtists({
          ...item,
          artists,
          artist: artists.map((entry) => entry.name).join(', '),
          artistId: artists[0]?.id || item.artistId,
        });
      })
    );
  }, [withNormalizedArtists]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    playbackSourceRef.current = playbackSource;
  }, [playbackSource]);

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

  const fetchStreamUrl = useCallback(async (
    trackId: string,
    options?: { silent?: boolean }
  ): Promise<string | null> => {
    const silent = options?.silent ?? false;
    const cached = streamUrlCacheRef.current.get(trackId);
    if (cached) return cached;

    const inflight = inflightStreamRef.current.get(trackId);
    if (inflight) return inflight;

    const request = (async () => {
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

      if (!result.ok) {
        if (!silent) {
          console.error('[PlayerContext] Stream URL error', {
            error: result.error,
            triedClients: result.triedClients,
            playabilityStatus: result.playabilityStatus,
            playabilityReason: result.playabilityReason,
            trackId,
          });
        }
        return null;
      }

      if (result.artistName) {
        const resolvedArtists = [{ id: result.artistId, name: result.artistName }];
        const currentArtists =
          currentTrackRef.current?.id === trackId
            ? normalizeArtists(currentTrackRef.current)
            : normalizeArtists(queueRef.current.find((item) => item.id === trackId) || {
                id: trackId,
                title: '',
                artist: result.artistName,
                thumbnail: '',
              } as Track);
        const mergedArtists = mergeArtistLists(currentArtists, resolvedArtists);
        artistMetaCacheRef.current.set(trackId, mergedArtists);
        applyArtistMetaToState(trackId, mergedArtists);
      }

      streamUrlCacheRef.current.set(trackId, result.url);
      return result.url;
    })();

    inflightStreamRef.current.set(trackId, request);
    request.finally(() => {
      inflightStreamRef.current.delete(trackId);
    });
    return request;
  }, [applyArtistMetaToState, buildAuthHeaders, mergeArtistLists, normalizeArtists]);

  const resolveStreamUrl = useCallback(async (
    trackId: string,
    options: { playWhenReady?: boolean; updateStatus?: boolean; silentFetchErrors?: boolean } = {}
  ) => {
    const { playWhenReady = true, updateStatus = true, silentFetchErrors = false } = options;
    const requestId = streamRequestId.current + 1;
    streamRequestId.current = requestId;
    if (updateStatus) {
      setStreamStatus('loading');
      setStreamError(null);
    }

    const url = await fetchStreamUrl(trackId, { silent: silentFetchErrors });
    if (streamRequestId.current !== requestId) return;

      if (url) {
      const cachedArtists = artistMetaCacheRef.current.get(trackId);
      if (cachedArtists?.length) {
        applyArtistMetaToState(trackId, cachedArtists);
      }
      setCurrentTrack((prev) => {
        if (!prev || prev.id !== trackId) return prev;
        return {
          ...prev,
          streamUrl: url,
        };
      });
      const trackInfo = currentTrackRef.current;
      if (playWhenReady && trackInfo && trackInfo.id === trackId) {
        AudioPro.play({
          id: trackInfo.id,
          url,
          title: trackInfo.title,
          artist: trackInfo.artist,
          artwork: trackInfo.thumbnail,
        });
        void cacheSongFromUrl({
          id: trackInfo.id,
          title: trackInfo.title,
          artist: trackInfo.artist,
          thumbnail: trackInfo.thumbnail,
          url,
        });
      }
      if (updateStatus) {
        setStreamStatus('ready');
        setStreamError(null);
      }
    } else {
      if (updateStatus) {
        setStreamStatus('error');
        setStreamError('Unable to resolve stream URL');
        setIsPlaying(false);
      }
    }
  }, [applyArtistMetaToState, fetchStreamUrl]);


  const playTrack = useCallback((track: Track, newQueue?: Track[], options?: PlayTrackOptions) => {
    const normalizedTrack = withNormalizedArtists(track);
    if (options?.preserveQueue) {
      // Keep queue/currentIndex as managed by caller (skip next/previous flows).
    } else if (newQueue) {
      playHistoryRef.current = [];
      const normalizedQueue = newQueue.map(withNormalizedArtists);
      setQueueSynced(normalizedQueue);
      const index = normalizedQueue.findIndex(t => t.id === normalizedTrack.id);
      setCurrentIndexSynced(index >= 0 ? index : 0);
    } else {
      playHistoryRef.current = [];
      setQueueSynced([normalizedTrack]);
      setCurrentIndexSynced(0);
    }
    if (options?.source) {
      setPlaybackSourceSynced(options.source);
    }
    const existingStreamUrl = normalizedTrack.streamUrl || streamUrlCacheRef.current.get(normalizedTrack.id);
    if (existingStreamUrl) {
      streamUrlCacheRef.current.set(normalizedTrack.id, existingStreamUrl);
    }
    currentTrackRef.current = normalizedTrack;
    setCurrentTrack(existingStreamUrl ? { ...normalizedTrack, streamUrl: existingStreamUrl } : normalizedTrack);
    setIsPlaying(true);
    setPosition(0);
    void (async () => {
      if (!existingStreamUrl && !normalizedTrack.streamUrl) {
        const cachedPath = await getCachedSongPath(normalizedTrack.id);
        if (cachedPath) {
          const localUri = cachedPath.startsWith('file://') ? cachedPath : `file://${cachedPath}`;
          AudioPro.play({
            id: normalizedTrack.id,
            url: localUri,
            title: normalizedTrack.title,
            artist: normalizedTrack.artist,
            artwork: normalizedTrack.thumbnail,
          });
          setStreamStatus('ready');
          setStreamError(null);
          setCurrentTrack((prev) => (prev && prev.id === normalizedTrack.id ? { ...prev, streamUrl: localUri } : prev));
          void hydrateArtistsForTrack(normalizedTrack.id);
          return;
        }
      }

      if (existingStreamUrl) {
        AudioPro.play({
          id: normalizedTrack.id,
          url: existingStreamUrl,
          title: normalizedTrack.title,
          artist: normalizedTrack.artist,
          artwork: normalizedTrack.thumbnail,
        });
        setStreamStatus('ready');
        setStreamError(null);
        if (!existingStreamUrl.startsWith('file://')) {
          void cacheSongFromUrl({
            id: normalizedTrack.id,
            title: normalizedTrack.title,
            artist: normalizedTrack.artist,
            thumbnail: normalizedTrack.thumbnail,
            url: existingStreamUrl,
          });
        }
        void resolveStreamUrl(normalizedTrack.id, {
          playWhenReady: false,
          updateStatus: false,
          silentFetchErrors: true,
        });
        void hydrateArtistsForTrack(normalizedTrack.id);
      } else {
        void resolveStreamUrl(normalizedTrack.id, { playWhenReady: true, updateStatus: true });
        void hydrateArtistsForTrack(normalizedTrack.id);
      }
    })();
  }, [hydrateArtistsForTrack, resolveStreamUrl, setCurrentIndexSynced, setPlaybackSourceSynced, setQueueSynced, withNormalizedArtists]);

  const pause = useCallback(() => {
    AudioPro.pause();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    AudioPro.resume();
    setIsPlaying(true);
  }, []);

  const seekTo = useCallback((newPosition: number) => {
    AudioPro.seekTo(newPosition * 1000);
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
        const parsedArtists = Array.from(
          new Map(
            artistRuns
              .filter((run: any) => {
                const name = run?.text?.trim();
                if (!name || name === '•') return false;
                const browseId = run?.navigationEndpoint?.browseEndpoint?.browseId;
                return !browseId || browseId.startsWith('UC');
              })
              .map((run: any) => {
                const name = run.text.trim();
                const id = run?.navigationEndpoint?.browseEndpoint?.browseId;
                return [id || name.toLowerCase(), { id, name }] as const;
              })
          ).values()
        );
        const artist = parsedArtists.map((entry) => entry.name).join(', ') || 'Unknown Artist';
        const artistId = parsedArtists[0]?.id;
        const thumbnail =
          renderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
          renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
          '';
        return {
          id: renderer.videoId,
          title,
          artist,
          artistId,
          artists: parsedArtists,
          thumbnail,
        } as Track;
      })
      .filter(Boolean) as Track[];
  }, []);

  const extractArtistsForTrackFromWatchNext = useCallback((response: any, trackId: string) => {
    const artists: Array<{ id?: string; name: string }> = [];
    const visit = (node: any, depth = 0): boolean => {
      if (!node || depth > 14) return false;
      if (Array.isArray(node)) {
        for (const item of node) {
          if (visit(item, depth + 1)) return true;
        }
        return false;
      }
      if (typeof node !== 'object') return false;

      const renderer = node?.playlistPanelVideoRenderer;
      if (renderer?.videoId === trackId) {
        const runs = renderer?.longBylineText?.runs || renderer?.shortBylineText?.runs || [];
        runs.forEach((run: any) => {
          const name = run?.text?.trim();
          if (!name || name === '•') return;
          const browseId = run?.navigationEndpoint?.browseEndpoint?.browseId;
          if (browseId && !browseId.startsWith('UC')) return;
          const key = browseId || name.toLowerCase();
          if (!artists.some((artist) => (artist.id || artist.name.toLowerCase()) === key)) {
            artists.push({ id: browseId, name });
          }
        });
        return true;
      }

      for (const value of Object.values(node)) {
        if (visit(value, depth + 1)) return true;
      }
      return false;
    };
    visit(response);
    return artists;
  }, []);

  const hydrateArtistsForTrack = useCallback(async (trackId: string) => {
    if (!trackId) return;
    if (artistMetaCacheRef.current.has(trackId)) return;

    try {
      const response = await AuthenticatedHttpClient.getWatchNextQueue(trackId, {
        playlistId:
          playbackSourceRef.current.type === 'playlist'
            ? playbackSourceRef.current.id
            : playbackSourceRef.current.ytQueuePlaylistId || `RDAMVM${trackId}`,
        params: playbackSourceRef.current.ytQueueParams,
      });
      const parsedArtists = extractArtistsForTrackFromWatchNext(response, trackId);
      if (!parsedArtists.length) return;
      artistMetaCacheRef.current.set(trackId, parsedArtists);

      setCurrentTrack((prev) => {
        if (!prev || prev.id !== trackId) return prev;
        const updated = withNormalizedArtists({
          ...prev,
          artists: parsedArtists,
          artist: parsedArtists.map((item) => item.name).join(', '),
          artistId: parsedArtists[0]?.id || prev.artistId,
        });
        currentTrackRef.current = updated;
        return updated;
      });

      setQueue((prev) =>
        prev.map((item) => {
          if (item.id !== trackId) return item;
          return withNormalizedArtists({
            ...item,
            artists: parsedArtists,
            artist: parsedArtists.map((entry) => entry.name).join(', '),
            artistId: parsedArtists[0]?.id || item.artistId,
          });
        })
      );
    } catch {
      // no-op
    }
  }, [extractArtistsForTrackFromWatchNext, withNormalizedArtists]);

  const hydrateQueueFromYouTube = useCallback(async () => {
    if (queueHydrationLock.current) return false;
    const current = currentTrackRef.current;
    if (!current?.id) return false;

    queueHydrationLock.current = true;
    try {
      const nextResponse = await AuthenticatedHttpClient.getWatchNextQueue(current.id, {
        playlistId:
          playbackSourceRef.current.type === 'playlist'
            ? playbackSourceRef.current.id
            : playbackSourceRef.current.ytQueuePlaylistId || `RDAMVM${current.id}`,
        params: playbackSourceRef.current.ytQueueParams,
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
        const nextQueue = appendable.length ? [...prev, ...appendable] : prev;
        queueRef.current = nextQueue;
        return nextQueue;
      });
      return added > 0;
    } catch (error) {
      console.error('Failed to hydrate queue from YouTube', error);
      return false;
    } finally {
      queueHydrationLock.current = false;
    }
  }, [parseWatchNextQueueTracks]);

  useEffect(() => {
    if (!currentTrack?.id) return;
    if (playbackSource.type === 'playlist') return;
    if (queue.length > 1) return;
    void hydrateQueueFromYouTube();
  }, [currentTrack?.id, hydrateQueueFromYouTube, playbackSource.type, queue.length]);

  useEffect(() => {
    const token = ++queuePreloadTokenRef.current;
    const preload = async () => {
      const start = currentIndexRef.current + 1;
      const remaining = queueRef.current.slice(start).filter((track) => !!track?.id);
      if (!remaining.length) return;

      const concurrency = 3;
      let cursor = 0;

      const worker = async () => {
        while (cursor < remaining.length) {
          if (token !== queuePreloadTokenRef.current) return;
          const next = remaining[cursor];
          cursor += 1;
          if (!next?.id) continue;
          if (next.streamUrl || streamUrlCacheRef.current.has(next.id)) continue;
          try {
            await fetchStreamUrl(next.id, { silent: true });
          } catch {
            // no-op; skip failed preload and continue
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(concurrency, remaining.length) }, () => worker()));
    };

    void preload();
  }, [currentIndex, queue, fetchStreamUrl]);

  const skipNext = useCallback(() => {
    const currentQueue = queueRef.current;
    const currentIndexValue = currentIndexRef.current;
    const current = currentTrackRef.current;
    const pushHistory = (index: number) => {
      const history = playHistoryRef.current;
      if (history[history.length - 1] !== index) {
        history.push(index);
        if (history.length > 100) history.shift();
      }
    };

    if (repeatMode === 'one' && current) {
      playTrack(current, currentQueue, { preserveQueue: true });
      return;
    }

    if (shuffleEnabled && currentQueue.length > 1) {
      let nextIndex = currentIndexValue;
      let safety = 0;
      while (nextIndex === currentIndexValue && safety < 12) {
        nextIndex = Math.floor(Math.random() * currentQueue.length);
        safety += 1;
      }
      const nextTrack = currentQueue[nextIndex];
      if (nextTrack) {
        pushHistory(currentIndexValue);
        setCurrentIndexSynced(nextIndex);
        playTrack(nextTrack, currentQueue, { preserveQueue: true });
        return;
      }
    }

    if (currentIndexValue < currentQueue.length - 1) {
      const nextTrack = currentQueue[currentIndexValue + 1];
      pushHistory(currentIndexValue);
      setCurrentIndexSynced(currentIndexValue + 1);
      playTrack(nextTrack, currentQueue, { preserveQueue: true });
      return;
    }

    if (repeatMode === 'all' && currentQueue.length > 0) {
      const nextTrack = currentQueue[0];
      pushHistory(currentIndexValue);
      setCurrentIndexSynced(0);
      playTrack(nextTrack, currentQueue, { preserveQueue: true });
      return;
    }

    void (async () => {
      const hydrated = await hydrateQueueFromYouTube();
      if (!hydrated) {
        setIsPlaying(false);
        return;
      }

      setQueue((latestQueue) => {
        const latestIndex = currentIndexRef.current;
        if (latestIndex >= latestQueue.length - 1) return latestQueue;
        const nextTrack = latestQueue[latestIndex + 1];
        if (nextTrack) {
          pushHistory(latestIndex);
          setCurrentIndexSynced(latestIndex + 1);
          playTrack(nextTrack, latestQueue, {
            preserveQueue: true,
            source: playbackSourceRef.current.type === 'unknown'
              ? { type: 'queue', label: 'YouTube Queue' }
              : playbackSourceRef.current,
          });
        }
        queueRef.current = latestQueue;
        return latestQueue;
      });
    })();
  }, [hydrateQueueFromYouTube, playTrack, repeatMode, setCurrentIndexSynced, shuffleEnabled]);

  const skipPrevious = useCallback(() => {
    const currentQueue = queueRef.current;
    const currentIndexValue = currentIndexRef.current;

    if (shuffleEnabled && playHistoryRef.current.length > 0) {
      const previousIndex = playHistoryRef.current.pop();
      if (typeof previousIndex === 'number' && previousIndex >= 0 && previousIndex < currentQueue.length) {
        const prevTrack = currentQueue[previousIndex];
        setCurrentIndexSynced(previousIndex);
        playTrack(prevTrack, currentQueue, { preserveQueue: true });
        return;
      }
    }

    if (currentIndexValue > 0) {
      const prevTrack = currentQueue[currentIndexValue - 1];
      setCurrentIndexSynced(currentIndexValue - 1);
      playTrack(prevTrack, currentQueue, { preserveQueue: true });
    }
  }, [playTrack, setCurrentIndexSynced, shuffleEnabled]);

  const toggleShuffle = useCallback(() => {
    setShuffleEnabled((prev) => !prev);
  }, []);

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  }, []);

  useEffect(() => {
    registerAudioHandlers({
      onProgress: (positionMs, durationMs) => {
        setPosition(positionMs / 1000);
        setDuration(durationMs / 1000);
      },
      onStateChanged: (state) => {
        if (state === 'PLAYING') setIsPlaying(true);
        if (state === 'PAUSED' || state === 'STOPPED' || state === 'ERROR') setIsPlaying(false);
      },
      onTrackEnded: () => skipNext(),
      onRemoteNext: () => skipNext(),
      onRemotePrev: () => skipPrevious(),
      onPlaybackError: (error) => {
        setStreamStatus('error');
        setStreamError(error ?? 'Playback error');
        setIsPlaying(false);
      },
    });
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
    shuffleEnabled,
    repeatMode,
    playTrack,
    pause,
    resume,
    seekTo,
    skipNext,
    skipPrevious,
    toggleShuffle,
    cycleRepeatMode,
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
    shuffleEnabled,
    repeatMode,
    playTrack,
    pause,
    resume,
    seekTo,
    skipNext,
    skipPrevious,
    toggleShuffle,
    cycleRepeatMode,
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
