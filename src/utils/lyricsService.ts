import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Track } from '../contexts/PlayerContext';
import type { LyricsPayload } from '../types/lyrics';
import { parseLrcText, parsePlainLyrics } from './lyricsParser';

const LYRICS_CACHE_PREFIX = 'lyrics_cache_v1:';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 4500;

const memoryCache = new Map<string, LyricsPayload>();

interface CachedLyricsEntry {
  payload: LyricsPayload;
  fetchedAt: number;
  signature: string;
}

const normalize = (value?: string) => (value || '').trim().toLowerCase();

const trackSignature = (track: Track): string => {
  const title = normalize(track.title);
  const artist = normalize(track.artist);
  const duration = Math.round(track.duration || 0);
  return `${title}|${artist}|${duration}`;
};

const cacheKeyForTrack = (track: Track) => `${LYRICS_CACHE_PREFIX}${track.id}`;

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('Lyrics provider timeout')), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

const fetchJson = async (url: string, signal?: AbortSignal) => {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};

const fetchText = async (url: string, signal?: AbortSignal) => {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'text/plain,application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
};

const fetchFromLrcLibGet = async (track: Track, signal?: AbortSignal): Promise<LyricsPayload | null> => {
  const params = new URLSearchParams({
    track_name: track.title || '',
    artist_name: track.artist || '',
  });
  if (track.duration && track.duration > 0) {
    params.set('duration', String(Math.round(track.duration)));
  }

  const data = await fetchJson(`https://lrclib.net/api/get?${params.toString()}`, signal);
  const synced = typeof data?.syncedLyrics === 'string' ? parseLrcText(data.syncedLyrics) : [];
  if (synced.length > 0) {
    return { source: 'lrclib-get', timed: true, lines: synced };
  }

  const plain = typeof data?.plainLyrics === 'string' ? parsePlainLyrics(data.plainLyrics) : [];
  if (plain.length > 0) {
    return { source: 'lrclib-get', timed: false, lines: plain };
  }

  return null;
};

const fetchFromLrcLibSearch = async (track: Track, signal?: AbortSignal): Promise<LyricsPayload | null> => {
  const params = new URLSearchParams({
    q: `${track.title || ''} ${track.artist || ''}`.trim(),
  });

  const data = await fetchJson(`https://lrclib.net/api/search?${params.toString()}`, signal);
  if (!Array.isArray(data) || data.length === 0) return null;

  for (const candidate of data) {
    const synced = typeof candidate?.syncedLyrics === 'string' ? parseLrcText(candidate.syncedLyrics) : [];
    if (synced.length > 0) {
      return { source: 'lrclib-search', timed: true, lines: synced };
    }
  }

  const firstPlain = data.find((entry: any) => typeof entry?.plainLyrics === 'string')?.plainLyrics;
  const plain = typeof firstPlain === 'string' ? parsePlainLyrics(firstPlain) : [];
  if (plain.length > 0) {
    return { source: 'lrclib-search', timed: false, lines: plain };
  }

  return null;
};

const parseYouTubeTimedtext = (raw: any): LyricsPayload | null => {
  const events = Array.isArray(raw?.events) ? raw.events : [];
  if (!events.length) return null;

  const lines = events
    .map((event: any) => {
      const startMs = Number(event?.tStartMs);
      const segs = Array.isArray(event?.segs) ? event.segs : [];
      const text = segs
        .map((seg: any) => String(seg?.utf8 || ''))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();

      if (!Number.isFinite(startMs) || !text) return null;
      if (/^\[[^\]]+\]$/.test(text)) return null;
      return {
        timeSec: startMs / 1000,
        text,
      };
    })
    .filter(Boolean) as Array<{ timeSec: number; text: string }>;

  if (!lines.length) return null;

  const deduped: Array<{ timeSec: number; text: string }> = [];
  for (const line of lines) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.text === line.text && Math.abs(prev.timeSec - line.timeSec) < 0.2) continue;
    deduped.push(line);
  }

  if (deduped.length < 6) return null;
  return { source: 'youtube-timedtext', timed: true, lines: deduped };
};

const fetchFromYouTubeTimedtext = async (track: Track, signal?: AbortSignal): Promise<LyricsPayload | null> => {
  if (!track.id) return null;

  const urls = [
    `https://www.youtube.com/api/timedtext?lang=en&v=${encodeURIComponent(track.id)}&fmt=json3`,
    `https://www.youtube.com/api/timedtext?lang=en&kind=asr&v=${encodeURIComponent(track.id)}&fmt=json3`,
    `https://www.youtube.com/api/timedtext?lang=en-US&kind=asr&v=${encodeURIComponent(track.id)}&fmt=json3`,
  ];

  for (const url of urls) {
    try {
      const rawText = await fetchText(url, signal);
      if (!rawText || rawText.startsWith('<?xml')) continue;
      const json = JSON.parse(rawText);
      const parsed = parseYouTubeTimedtext(json);
      if (parsed) return parsed;
    } catch {
      // try next timedtext candidate
    }
  }

  return null;
};

const fetchFromLyricsOvh = async (track: Track, signal?: AbortSignal): Promise<LyricsPayload | null> => {
  const artist = encodeURIComponent(track.artist || '');
  const title = encodeURIComponent(track.title || '');
  if (!artist || !title) return null;

  const data = await fetchJson(`https://api.lyrics.ovh/v1/${artist}/${title}`, signal);
  const plain = typeof data?.lyrics === 'string' ? parsePlainLyrics(data.lyrics) : [];
  if (plain.length > 0) {
    return { source: 'lyrics-ovh', timed: false, lines: plain };
  }
  return null;
};

export const loadCachedLyrics = async (track: Track): Promise<LyricsPayload | null> => {
  const signature = trackSignature(track);
  const memKey = `${track.id}|${signature}`;
  const mem = memoryCache.get(memKey);
  if (mem) return mem;

  try {
    const raw = await AsyncStorage.getItem(cacheKeyForTrack(track));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLyricsEntry;
    if (!parsed?.payload || !parsed?.signature || !parsed?.fetchedAt) return null;
    if (parsed.signature !== signature) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    if (!Array.isArray(parsed.payload.lines) || parsed.payload.lines.length === 0) return null;

    memoryCache.set(memKey, parsed.payload);
    return parsed.payload;
  } catch {
    return null;
  }
};

const saveCachedLyrics = async (track: Track, payload: LyricsPayload) => {
  const signature = trackSignature(track);
  const memKey = `${track.id}|${signature}`;
  memoryCache.set(memKey, payload);

  const entry: CachedLyricsEntry = {
    payload,
    signature,
    fetchedAt: Date.now(),
  };

  try {
    await AsyncStorage.setItem(cacheKeyForTrack(track), JSON.stringify(entry));
  } catch {
    // no-op
  }
};

export const fetchBestLyrics = async (track: Track): Promise<LyricsPayload | null> => {
  const cached = await loadCachedLyrics(track);
  if (cached) return cached;

  const providers: Array<(signal: AbortSignal) => Promise<LyricsPayload | null>> = [
    (signal) => withTimeout(fetchFromLrcLibGet(track, signal), PROVIDER_TIMEOUT_MS),
    (signal) => withTimeout(fetchFromLrcLibSearch(track, signal), PROVIDER_TIMEOUT_MS),
    (signal) => withTimeout(fetchFromYouTubeTimedtext(track, signal), PROVIDER_TIMEOUT_MS),
  ];

  const controllers = providers.map(() => new AbortController());

  const timedWinner = await new Promise<LyricsPayload | null>((resolve) => {
    let pending = providers.length;
    let settled = false;

    providers.forEach((provider, index) => {
      provider(controllers[index].signal)
        .then((result) => {
          if (settled) return;
          if (result?.timed && result.lines.length > 0) {
            settled = true;
            controllers.forEach((controller, i) => {
              if (i !== index) controller.abort();
            });
            resolve(result);
            return;
          }

          pending -= 1;
          if (pending === 0 && !settled) {
            settled = true;
            resolve(null);
          }
        })
        .catch(() => {
          pending -= 1;
          if (pending === 0 && !settled) {
            settled = true;
            resolve(null);
          }
        });
    });
  });

  if (timedWinner) {
    await saveCachedLyrics(track, timedWinner);
    return timedWinner;
  }

  // fallback to plain lyrics provider when no timed lyrics exists
  try {
    const fallback = await withTimeout(fetchFromLyricsOvh(track), PROVIDER_TIMEOUT_MS);
    if (fallback?.lines.length) {
      await saveCachedLyrics(track, fallback);
      return fallback;
    }
  } catch {
    // no-op
  }

  return null;
};
