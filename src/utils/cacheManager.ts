import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_DIR = `${FileSystem.documentDirectory}song_cache`;
const CACHE_META_KEY = 'song_cache_meta_v1';
const CACHE_LIMIT_MB_KEY = 'song_cache_limit_mb_v1';
const DEFAULT_CACHE_LIMIT_MB = 512;

export interface CachedSong {
  id: string;
  title: string;
  artist: string;
  thumbnail?: string;
  localPath: string;
  size: number;
  cachedAt: number;
  lastAccessedAt: number;
}

const inflight = new Map<string, Promise<CachedSong | null>>();

const ensureCacheDir = async () => {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
};

const readMeta = async (): Promise<Record<string, CachedSong>> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CachedSong>;
    return parsed || {};
  } catch {
    return {};
  }
};

const writeMeta = async (meta: Record<string, CachedSong>) => {
  await AsyncStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
};

const getFileSizeSafe = async (uri: string): Promise<number> => {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    return info.exists && typeof info.size === 'number' ? info.size : 0;
  } catch {
    return 0;
  }
};

const getCacheLimitBytes = async () => {
  const raw = await AsyncStorage.getItem(CACHE_LIMIT_MB_KEY);
  const mb = raw ? Number(raw) : DEFAULT_CACHE_LIMIT_MB;
  const resolvedMb = Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_CACHE_LIMIT_MB;
  return Math.floor(resolvedMb * 1024 * 1024);
};

const guessExtension = (url: string) => {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.m4a')) return 'm4a';
  if (clean.endsWith('.mp4')) return 'mp4';
  if (clean.endsWith('.mp3')) return 'mp3';
  if (clean.endsWith('.webm')) return 'webm';
  return 'm4a';
};

const safeDeleteFile = async (uri: string) => {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // no-op
  }
};

const enforceLimit = async () => {
  const meta = await readMeta();
  const entries = Object.values(meta);
  const limitBytes = await getCacheLimitBytes();
  let total = entries.reduce((sum, item) => sum + (item.size || 0), 0);
  if (total <= limitBytes) return;

  const sorted = [...entries].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
  for (const item of sorted) {
    if (total <= limitBytes) break;
    await safeDeleteFile(item.localPath);
    delete meta[item.id];
    total -= item.size || 0;
  }
  await writeMeta(meta);
};

const retryDownload = async (url: string, target: string, retries = 3): Promise<FileSystem.FileSystemDownloadResult> => {
  let lastError: unknown;
  for (let i = 0; i < retries; i += 1) {
    try {
      const result = await FileSystem.downloadAsync(url, target);
      if (result.status === 200) return result;
      throw new Error(`Download status ${result.status}`);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Download failed');
};

export const getCacheLimitMB = async () => {
  const raw = await AsyncStorage.getItem(CACHE_LIMIT_MB_KEY);
  const mb = raw ? Number(raw) : DEFAULT_CACHE_LIMIT_MB;
  return Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_CACHE_LIMIT_MB;
};

export const setCacheLimitMB = async (mb: number) => {
  const value = Number.isFinite(mb) && mb > 0 ? Math.floor(mb) : DEFAULT_CACHE_LIMIT_MB;
  await AsyncStorage.setItem(CACHE_LIMIT_MB_KEY, String(value));
  await enforceLimit();
};

export const getCachedSong = async (id: string): Promise<CachedSong | null> => {
  const meta = await readMeta();
  const item = meta[id];
  if (!item) return null;
  const info = await FileSystem.getInfoAsync(item.localPath);
  if (!info.exists) {
    delete meta[id];
    await writeMeta(meta);
    return null;
  }
  item.lastAccessedAt = Date.now();
  meta[id] = item;
  await writeMeta(meta);
  return item;
};

export const getCachedSongs = async (): Promise<CachedSong[]> => {
  const meta = await readMeta();
  const sanitized: Record<string, CachedSong> = {};
  const songs: CachedSong[] = [];

  for (const item of Object.values(meta)) {
    const info = await FileSystem.getInfoAsync(item.localPath);
    if (!info.exists) continue;
    const size = item.size || (await getFileSizeSafe(item.localPath));
    const normalized: CachedSong = {
      ...item,
      size,
    };
    sanitized[item.id] = normalized;
    songs.push(normalized);
  }

  await writeMeta(sanitized);
  return songs.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
};

export const getCacheUsageBytes = async (): Promise<number> => {
  const songs = await getCachedSongs();
  return songs.reduce((sum, song) => sum + (song.size || 0), 0);
};

export const getCachedSongPath = async (id: string): Promise<string | null> => {
  const cached = await getCachedSong(id);
  return cached?.localPath ?? null;
};

export const cacheSongFromUrl = async (song: {
  id: string;
  title: string;
  artist: string;
  thumbnail?: string;
  url: string;
}): Promise<CachedSong | null> => {
  const existing = await getCachedSong(song.id);
  if (existing) return existing;

  const existingInflight = inflight.get(song.id);
  if (existingInflight) return existingInflight;

  const request = (async () => {
    await ensureCacheDir();
    const ext = guessExtension(song.url);
    const localPath = `${CACHE_DIR}/${song.id}.${ext}`;
    const result = await retryDownload(song.url, localPath);
    const info = await FileSystem.getInfoAsync(result.uri, { size: true });
    const size = typeof info.size === 'number' ? info.size : 0;

    const cached: CachedSong = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      thumbnail: song.thumbnail,
      localPath: result.uri,
      size,
      cachedAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    const meta = await readMeta();
    meta[song.id] = cached;
    await writeMeta(meta);
    await enforceLimit();
    return cached;
  })();

  inflight.set(song.id, request);
  request.finally(() => inflight.delete(song.id));
  return request;
};
