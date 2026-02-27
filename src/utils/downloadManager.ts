import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import { getStreamUrl } from '../streaming';
import { CookieManager } from './cookieManager';
import { getCachedSongPath } from './cacheManager';

const DOWNLOADED_SONGS_KEY = 'downloaded_songs_v1';
const DOWNLOAD_STATUS_KEY = 'download_status_v1';
const PLAYLIST_DOWNLOAD_STATUS_KEY = 'playlist_download_status_v1';
const PLAYLIST_DOWNLOAD_TASKS_KEY = 'playlist_download_tasks_v1';
const DOWNLOAD_DIR = `${FileSystem.documentDirectory}downloads`;
const FAST_DOWNLOAD_MAX_BITRATE = 70000;
const FAST_RANGE_END = 10000000;

export interface DownloadedSong {
  id: string;
  title: string;
  artist: string;
  thumbnail?: string;
  localPath: string;
  downloadedAt: number;
}

export type DownloadState = 'idle' | 'queued' | 'downloading' | 'paused' | 'downloaded' | 'failed';

export interface DownloadStatusItem {
  id: string;
  title: string;
  artist: string;
  thumbnail?: string;
  state: DownloadState;
  progress: number; // 0..1
  localPath?: string;
  downloadedAt?: number;
  error?: string;
  updatedAt: number;
}

interface DownloadSongInput {
  id: string;
  title: string;
  artist: string;
  thumbnail?: string;
}

export interface PlaylistDownloadInput {
  playlistId: string;
  title: string;
  thumbnail?: string;
  songs: DownloadSongInput[];
}

export type PlaylistDownloadState =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface PlaylistDownloadStatusItem {
  playlistId: string;
  title: string;
  thumbnail?: string;
  totalSongs: number;
  completedSongs: number;
  failedSongs: number;
  state: PlaylistDownloadState;
  activeSongId?: string;
  activeSongTitle?: string;
  updatedAt: number;
}

interface PersistedPlaylistTask {
  playlistId: string;
  title: string;
  thumbnail?: string;
  songs: DownloadSongInput[];
}

type Listener = () => void;
const listeners = new Set<Listener>();
const inflight = new Map<string, Promise<DownloadedSong>>();
// Prioritize single active manual download for max per-file throughput.
const MAX_CONCURRENT_DOWNLOADS = 1;
let activeDownloads = 0;
const waiters: Array<() => void> = [];
let authCache: { cookie?: string; authorization?: string } | null = null;
let statusLoaded = false;
const statusMap = new Map<string, DownloadStatusItem>();
let playlistStatusLoaded = false;
const playlistStatusMap = new Map<string, PlaylistDownloadStatusItem>();
const playlistTaskMap = new Map<string, PersistedPlaylistTask>();
const playlistControlMap = new Map<string, { paused: boolean; cancelled: boolean; running: boolean }>();
const activeResumables = new Map<string, FileSystem.DownloadResumable>();
const resumeDataMap = new Map<string, string>();
const pausedByUser = new Set<string>();
let notifyScheduled = false;
let persistStatusTimer: ReturnType<typeof setTimeout> | null = null;
let persistPlaylistStatusTimer: ReturnType<typeof setTimeout> | null = null;

const emitNotify = () => {
  listeners.forEach((listener) => listener());
};

const notify = () => {
  if (notifyScheduled) return;
  notifyScheduled = true;
  setTimeout(() => {
    notifyScheduled = false;
    emitNotify();
  }, 33);
};

const persistStatuses = async () => {
  const payload = Object.fromEntries(statusMap.entries());
  await AsyncStorage.setItem(DOWNLOAD_STATUS_KEY, JSON.stringify(payload));
};

const schedulePersistStatuses = () => {
  if (persistStatusTimer) return;
  persistStatusTimer = setTimeout(() => {
    persistStatusTimer = null;
    void persistStatuses();
  }, 250);
};

const persistPlaylistStatuses = async () => {
  const payload = Object.fromEntries(playlistStatusMap.entries());
  await AsyncStorage.setItem(PLAYLIST_DOWNLOAD_STATUS_KEY, JSON.stringify(payload));
};

const schedulePersistPlaylistStatuses = () => {
  if (persistPlaylistStatusTimer) return;
  persistPlaylistStatusTimer = setTimeout(() => {
    persistPlaylistStatusTimer = null;
    void persistPlaylistStatuses();
  }, 250);
};

const persistPlaylistTasks = async () => {
  const payload = Object.fromEntries(playlistTaskMap.entries());
  await AsyncStorage.setItem(PLAYLIST_DOWNLOAD_TASKS_KEY, JSON.stringify(payload));
};

const ensureStatusesLoaded = async () => {
  if (statusLoaded) return;
  statusLoaded = true;
  try {
    const raw = await AsyncStorage.getItem(DOWNLOAD_STATUS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, DownloadStatusItem>;
    Object.values(parsed).forEach((item) => {
      if (!item?.id) return;
      // Any interrupted app session should not appear as "actively downloading".
      if (item.state === 'downloading') {
        statusMap.set(item.id, {
          ...item,
          state: 'failed',
          error: 'Download interrupted',
          updatedAt: Date.now(),
        });
      } else {
        statusMap.set(item.id, item);
      }
    });
    const existingDownloads = await readDownloadedSongs();
    existingDownloads.forEach((song) => {
      if (statusMap.has(song.id)) return;
      statusMap.set(song.id, {
        id: song.id,
        title: song.title,
        artist: song.artist,
        thumbnail: song.thumbnail,
        state: 'downloaded',
        progress: 1,
        localPath: song.localPath,
        downloadedAt: song.downloadedAt,
        updatedAt: song.downloadedAt || Date.now(),
      });
    });
    await persistStatuses();
  } catch {
    // no-op
  }
};

const ensurePlaylistStatusesLoaded = async () => {
  if (playlistStatusLoaded) return;
  playlistStatusLoaded = true;
  try {
    const rawStatuses = await AsyncStorage.getItem(PLAYLIST_DOWNLOAD_STATUS_KEY);
    if (rawStatuses) {
      const parsed = JSON.parse(rawStatuses) as Record<string, PlaylistDownloadStatusItem>;
      Object.values(parsed).forEach((item) => {
        if (!item?.playlistId) return;
        // Recover interrupted sessions as paused.
        const recoveredState =
          item.state === 'downloading' || item.state === 'queued' ? 'paused' : item.state;
        playlistStatusMap.set(item.playlistId, {
          ...item,
          state: recoveredState,
          activeSongId: undefined,
          activeSongTitle: undefined,
          updatedAt: Date.now(),
        });
      });
    }
    const rawTasks = await AsyncStorage.getItem(PLAYLIST_DOWNLOAD_TASKS_KEY);
    if (rawTasks) {
      const parsed = JSON.parse(rawTasks) as Record<string, PersistedPlaylistTask>;
      Object.values(parsed).forEach((task) => {
        if (!task?.playlistId || !Array.isArray(task.songs)) return;
        playlistTaskMap.set(task.playlistId, task);
      });
    }
    await persistPlaylistStatuses();
    await persistPlaylistTasks();
    notify();
  } catch {
    // no-op
  }
};

const setStatus = async (id: string, updater: (prev?: DownloadStatusItem) => DownloadStatusItem) => {
  await ensureStatusesLoaded();
  const next = updater(statusMap.get(id));
  statusMap.set(id, next);
  schedulePersistStatuses();
  notify();
};

const setPlaylistStatus = async (
  playlistId: string,
  updater: (prev?: PlaylistDownloadStatusItem) => PlaylistDownloadStatusItem
) => {
  await ensurePlaylistStatusesLoaded();
  const next = updater(playlistStatusMap.get(playlistId));
  playlistStatusMap.set(playlistId, next);
  schedulePersistPlaylistStatuses();
  notify();
};

export const subscribeDownloadedSongs = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const readDownloadedSongs = async (): Promise<DownloadedSong[]> => {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADED_SONGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DownloadedSong[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeDownloadedSongs = async (songs: DownloadedSong[]) => {
  await AsyncStorage.setItem(DOWNLOADED_SONGS_KEY, JSON.stringify(songs));
  notify();
};

const ensureDownloadDirectory = async () => {
  const info = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
  }
};

const guessExtension = (url: string) => {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.m4a')) return 'm4a';
  if (clean.endsWith('.mp4')) return 'mp4';
  if (clean.endsWith('.mp3')) return 'mp3';
  if (clean.endsWith('.webm')) return 'webm';
  return 'm4a';
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const withRangeQuery = (url: string, end = FAST_RANGE_END) => {
  if (!url) return url;
  if (/[?&]range=\d*-\d*/.test(url)) return url;
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}range=0-${end}`;
};

const getAuthHeaders = async () => {
  if (authCache) return authCache;

  const cookies = await CookieManager.getCookies();
  const cookieString = CookieManager.formatCookiesForRequest(cookies);
  const find = (name: string) => cookies.find((cookie) => cookie.name === name)?.value || '';
  const sapisid = find('SAPISID');
  const sapisid1p = find('__Secure-1PAPISID');
  const sapisid3p = find('__Secure-3PAPISID');
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

  authCache = {
    cookie: cookieString || undefined,
    authorization: parts.length ? parts.join(' ') : undefined,
  };
  return authCache;
};

export const getDownloadedSongs = async (): Promise<DownloadedSong[]> => {
  const songs = await readDownloadedSongs();
  return songs.sort((a, b) => b.downloadedAt - a.downloadedAt);
};

export const getDownloadStatus = async (id: string): Promise<DownloadStatusItem | null> => {
  await ensureStatusesLoaded();
  return statusMap.get(id) ?? null;
};

export const getDownloadStatusSync = (id: string): DownloadStatusItem | null => {
  return statusMap.get(id) ?? null;
};

export const getAllDownloadStatuses = async (): Promise<DownloadStatusItem[]> => {
  await ensureStatusesLoaded();
  return Array.from(statusMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
};

export const getAllDownloadStatusesSync = (): DownloadStatusItem[] => {
  return Array.from(statusMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
};

export const getPlaylistDownloadStatus = async (
  playlistId: string
): Promise<PlaylistDownloadStatusItem | null> => {
  await ensurePlaylistStatusesLoaded();
  return playlistStatusMap.get(playlistId) ?? null;
};

export const getPlaylistDownloadStatusSync = (
  playlistId: string
): PlaylistDownloadStatusItem | null => {
  return playlistStatusMap.get(playlistId) ?? null;
};

export const getAllPlaylistDownloadStatuses = async (): Promise<PlaylistDownloadStatusItem[]> => {
  await ensurePlaylistStatusesLoaded();
  return Array.from(playlistStatusMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
};

export const getAllPlaylistDownloadStatusesSync = (): PlaylistDownloadStatusItem[] => {
  return Array.from(playlistStatusMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
};

export const pauseSongDownload = async (songId: string) => {
  const resumable = activeResumables.get(songId);
  if (!resumable) return false;
  pausedByUser.add(songId);
  try {
    const snapshot = await resumable.pauseAsync();
    if (snapshot?.resumeData) {
      resumeDataMap.set(songId, snapshot.resumeData);
    }
    const prev = statusMap.get(songId);
    if (prev) {
      statusMap.set(songId, {
        ...prev,
        state: 'paused',
        updatedAt: Date.now(),
      });
      schedulePersistStatuses();
      notify();
    }
    return true;
  } catch {
    return false;
  }
};

export const isSongDownloaded = async (id: string): Promise<boolean> => {
  const songs = await readDownloadedSongs();
  return songs.some((song) => song.id === id);
};

export const downloadSong = async (input: DownloadSongInput): Promise<DownloadedSong> => {
  const existingRequest = inflight.get(input.id);
  if (existingRequest) return existingRequest;

  const acquireSlot = async () => {
    if (activeDownloads < MAX_CONCURRENT_DOWNLOADS) {
      activeDownloads += 1;
      return;
    }
    await new Promise<void>((resolve) => waiters.push(resolve));
    activeDownloads += 1;
  };

  const releaseSlot = () => {
    activeDownloads = Math.max(0, activeDownloads - 1);
    const next = waiters.shift();
    if (next) next();
  };

  const performDownload = async () => {
    const existingSongs = await readDownloadedSongs();
    const existing = existingSongs.find((song) => song.id === input.id);
    if (existing) {
      const fileInfo = await FileSystem.getInfoAsync(existing.localPath);
      if (fileInfo.exists) {
        await setStatus(input.id, () => ({
          id: input.id,
          title: input.title,
          artist: input.artist,
          thumbnail: input.thumbnail,
          state: 'downloaded',
          progress: 1,
          localPath: existing.localPath,
          downloadedAt: existing.downloadedAt,
          updatedAt: Date.now(),
        }));
        return existing;
      }
    }

    await ensureDownloadDirectory();
    await setStatus(input.id, (prev) => ({
      id: input.id,
      title: input.title,
      artist: input.artist,
      thumbnail: input.thumbnail,
      state: 'downloading',
      progress: prev?.progress ?? 0,
      updatedAt: Date.now(),
    }));

    const cachedPath = await getCachedSongPath(input.id);
    if (cachedPath) {
      const extension = cachedPath.split('.').pop() || 'm4a';
      const localPath = `${DOWNLOAD_DIR}/${input.id}.${extension}`;
      await FileSystem.copyAsync({
        from: cachedPath,
        to: localPath,
      });

      const downloaded: DownloadedSong = {
        id: input.id,
        title: input.title,
        artist: input.artist,
        thumbnail: input.thumbnail,
        localPath,
        downloadedAt: Date.now(),
      };

      const deduped = existingSongs.filter((song) => song.id !== input.id);
      await writeDownloadedSongs([downloaded, ...deduped]);
      await setStatus(input.id, () => ({
        id: input.id,
        title: input.title,
        artist: input.artist,
        thumbnail: input.thumbnail,
        state: 'downloaded',
        progress: 1,
        localPath: downloaded.localPath,
        downloadedAt: downloaded.downloadedAt,
        updatedAt: Date.now(),
      }));
      return downloaded;
    }

    const auth = await getAuthHeaders();
    let stream = await getStreamUrl(input.id, {
      preferOpus: true,
      maxBitrate: FAST_DOWNLOAD_MAX_BITRATE,
      cookie: auth.cookie,
      authorization: auth.authorization,
    });

    if (!stream.ok || !stream.url) {
      throw new Error('Unable to resolve stream URL');
    }

    let downloadUrl = withRangeQuery(stream.url);
    const extension = guessExtension(downloadUrl);
    const localPath = `${DOWNLOAD_DIR}/${input.id}.${extension}`;
    let lastProgressTs = 0;
    const downloadHeaders = {
      Accept: '*/*',
      'Accept-Encoding': 'identity',
      'User-Agent':
        'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
    };
    const onProgress = ({
      totalBytesExpectedToWrite,
      totalBytesWritten,
    }: {
      totalBytesExpectedToWrite: number;
      totalBytesWritten: number;
    }) => {
      const now = Date.now();
      if (now - lastProgressTs < 250) return;
      lastProgressTs = now;
      const progress =
        totalBytesExpectedToWrite > 0
          ? totalBytesWritten / totalBytesExpectedToWrite
          : 0;
      const prev = statusMap.get(input.id);
      if (!prev) return;
      statusMap.set(input.id, {
        ...prev,
        progress: Math.max(prev.progress ?? 0, Math.min(1, progress)),
        state: 'downloading',
        updatedAt: now,
      });
      notify();
    };
    const createResumable = (url: string, resumeData?: string) =>
      FileSystem.createDownloadResumable(
        url,
        localPath,
        { headers: downloadHeaders },
        onProgress,
        resumeData
      );

    let downloadResult: FileSystem.FileSystemDownloadResult | null = null;
    let lastError: unknown;
    let resumable = createResumable(downloadUrl, resumeDataMap.get(input.id));
    activeResumables.set(input.id, resumable);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const hasResumeData = Boolean(resumeDataMap.get(input.id));
        if (attempt === 0) {
          if (hasResumeData) {
            downloadResult = await resumable.resumeAsync();
            resumeDataMap.delete(input.id);
          } else {
            downloadResult = await resumable.downloadAsync();
          }
        } else {
          const prev = statusMap.get(input.id);
          if (prev) {
            statusMap.set(input.id, {
              ...prev,
              state: 'downloading',
              error: `Retrying (${attempt + 1}/3)...`,
              updatedAt: Date.now(),
            });
            notify();
          }
          // Try resuming first; fallback to a fresh resumable if resume data is unavailable.
          try {
            downloadResult = await resumable.resumeAsync();
          } catch {
            // Signed stream URLs can expire quickly; refresh before retrying.
            stream = await getStreamUrl(input.id, {
              preferOpus: true,
              maxBitrate: FAST_DOWNLOAD_MAX_BITRATE,
              cookie: auth.cookie,
              authorization: auth.authorization,
            });
            if (!stream.ok || !stream.url) {
              throw new Error('Unable to refresh stream URL');
            }
            downloadUrl = withRangeQuery(stream.url);
            const partial = await FileSystem.getInfoAsync(localPath);
            if (partial.exists) {
              await FileSystem.deleteAsync(localPath, { idempotent: true });
            }
            resumable = createResumable(downloadUrl);
            activeResumables.set(input.id, resumable);
            downloadResult = await resumable.downloadAsync();
          }
        }
        if (!downloadResult || (downloadResult.status !== 200 && downloadResult.status !== 206)) {
          throw new Error(`Download failed with status ${downloadResult?.status ?? 'unknown'}`);
        }
        break;
      } catch (error) {
        if (pausedByUser.has(input.id)) {
          pausedByUser.delete(input.id);
          throw new Error('DOWNLOAD_PAUSED');
        }
        lastError = error;
        await delay(500 * (attempt + 1));
      }
    }

    if (!downloadResult || (downloadResult.status !== 200 && downloadResult.status !== 206)) {
      throw lastError instanceof Error ? lastError : new Error('Download failed');
    }

    const downloaded: DownloadedSong = {
      id: input.id,
      title: input.title,
      artist: input.artist,
      thumbnail: input.thumbnail,
      localPath: downloadResult.uri,
      downloadedAt: Date.now(),
    };

    const deduped = existingSongs.filter((song) => song.id !== input.id);
    await writeDownloadedSongs([downloaded, ...deduped]);
    await setStatus(input.id, () => ({
      id: input.id,
      title: input.title,
      artist: input.artist,
      thumbnail: input.thumbnail,
      state: 'downloaded',
      progress: 1,
      localPath: downloaded.localPath,
      downloadedAt: downloaded.downloadedAt,
      updatedAt: Date.now(),
    }));
    activeResumables.delete(input.id);
    resumeDataMap.delete(input.id);
    pausedByUser.delete(input.id);
    return downloaded;
  };
  const request = (async () => {
    await setStatus(input.id, (prev) => ({
      id: input.id,
      title: input.title,
      artist: input.artist,
      thumbnail: input.thumbnail,
      state: 'queued',
      progress: prev?.progress ?? 0,
      updatedAt: Date.now(),
    }));
    await acquireSlot();
    try {
      return await performDownload();
    } finally {
      releaseSlot();
    }
  })();

  inflight.set(input.id, request);
  request.catch(async (error) => {
    if (error instanceof Error && error.message === 'DOWNLOAD_PAUSED') {
      await setStatus(input.id, (prev) => ({
        id: input.id,
        title: prev?.title || input.title,
        artist: prev?.artist || input.artist,
        thumbnail: prev?.thumbnail || input.thumbnail,
        state: 'paused',
        progress: prev?.progress ?? 0,
        updatedAt: Date.now(),
      }));
      return;
    }
    await setStatus(input.id, (prev) => ({
      id: input.id,
      title: prev?.title || input.title,
      artist: prev?.artist || input.artist,
      thumbnail: prev?.thumbnail || input.thumbnail,
      state: 'failed',
      progress: prev?.progress ?? 0,
      error: error instanceof Error ? error.message : 'Download failed',
      updatedAt: Date.now(),
    }));
  }).finally(() => {
    inflight.delete(input.id);
    activeResumables.delete(input.id);
  });
  return request;
};

const ensurePlaylistControl = (playlistId: string) => {
  const existing = playlistControlMap.get(playlistId);
  if (existing) return existing;
  const next = { paused: false, cancelled: false, running: false };
  playlistControlMap.set(playlistId, next);
  return next;
};

const runPlaylistDownload = async (playlistId: string) => {
  await ensurePlaylistStatusesLoaded();
  const task = playlistTaskMap.get(playlistId);
  const status = playlistStatusMap.get(playlistId);
  if (!task || !status) return;

  const control = ensurePlaylistControl(playlistId);
  if (control.running) return;
  control.running = true;
  control.cancelled = false;

  await setPlaylistStatus(playlistId, (prev) => ({
    ...(prev || status),
    state: 'downloading',
    updatedAt: Date.now(),
  }));

  let completed = 0;
  let failed = 0;
  task.songs.forEach((song) => {
    const songStatus = statusMap.get(song.id);
    if (songStatus?.state === 'downloaded') {
      completed += 1;
    }
  });

  try {
    for (let index = 0; index < task.songs.length; index += 1) {
      const song = task.songs[index];
      if (control.cancelled) {
        await setPlaylistStatus(playlistId, (prev) => ({
          ...(prev || status),
          state: 'cancelled',
          activeSongId: undefined,
          activeSongTitle: undefined,
          updatedAt: Date.now(),
        }));
        return;
      }
      while (control.paused && !control.cancelled) {
        await setPlaylistStatus(playlistId, (prev) => ({
          ...(prev || status),
          state: 'paused',
          activeSongId: undefined,
          activeSongTitle: undefined,
          updatedAt: Date.now(),
        }));
        await delay(350);
      }
      if (control.cancelled) continue;

      const songStatus = statusMap.get(song.id);
      if (songStatus?.state === 'downloaded') {
        continue;
      }

      await setPlaylistStatus(playlistId, (prev) => ({
        ...(prev || status),
        state: 'downloading',
        activeSongId: song.id,
        activeSongTitle: song.title,
        completedSongs: Math.min(task.songs.length, completed),
        failedSongs: failed,
        updatedAt: Date.now(),
      }));

      try {
        await downloadSong(song);
        completed += 1;
      } catch (error) {
        if (error instanceof Error && error.message === 'DOWNLOAD_PAUSED') {
          index -= 1;
          continue;
        }
        failed += 1;
      }

      await setPlaylistStatus(playlistId, (prev) => ({
        ...(prev || status),
        completedSongs: Math.min(task.songs.length, completed),
        failedSongs: failed,
        updatedAt: Date.now(),
      }));
    }

    const finalState: PlaylistDownloadState =
      completed >= task.songs.length
        ? failed > 0
          ? 'failed'
          : 'completed'
        : failed > 0
          ? 'failed'
          : 'paused';

    await setPlaylistStatus(playlistId, (prev) => ({
      ...(prev || status),
      state: finalState,
      activeSongId: undefined,
      activeSongTitle: undefined,
      completedSongs: Math.min(task.songs.length, completed),
      failedSongs: failed,
      updatedAt: Date.now(),
    }));
  } finally {
    control.running = false;
    if (!control.cancelled) {
      control.paused = false;
    }
    if (control.cancelled) {
      playlistTaskMap.delete(playlistId);
      await persistPlaylistTasks();
      playlistControlMap.delete(playlistId);
    }
  }
};

export const downloadPlaylist = async (input: PlaylistDownloadInput) => {
  await ensurePlaylistStatusesLoaded();

  const dedupedSongs: DownloadSongInput[] = [];
  const seen = new Set<string>();
  input.songs.forEach((song) => {
    if (!song?.id || seen.has(song.id)) return;
    seen.add(song.id);
    dedupedSongs.push(song);
  });

  playlistTaskMap.set(input.playlistId, {
    playlistId: input.playlistId,
    title: input.title,
    thumbnail: input.thumbnail,
    songs: dedupedSongs,
  });
  await persistPlaylistTasks();

  await setPlaylistStatus(input.playlistId, (prev) => ({
    playlistId: input.playlistId,
    title: input.title,
    thumbnail: input.thumbnail,
    totalSongs: dedupedSongs.length,
    completedSongs: 0,
    failedSongs: 0,
    state: 'queued',
    activeSongId: undefined,
    activeSongTitle: undefined,
    updatedAt: Date.now(),
  }));

  void runPlaylistDownload(input.playlistId);
};

export const pausePlaylistDownload = async (playlistId: string) => {
  await ensurePlaylistStatusesLoaded();
  const control = ensurePlaylistControl(playlistId);
  control.paused = true;
  const activeSongId = playlistStatusMap.get(playlistId)?.activeSongId;
  if (activeSongId) {
    await pauseSongDownload(activeSongId);
  }
  await setPlaylistStatus(playlistId, (prev) => ({
    ...(prev || {
      playlistId,
      title: 'Playlist',
      totalSongs: 0,
      completedSongs: 0,
      failedSongs: 0,
      state: 'paused' as PlaylistDownloadState,
      updatedAt: Date.now(),
    }),
    state: 'paused',
    activeSongId: undefined,
    activeSongTitle: undefined,
    updatedAt: Date.now(),
  }));
};

export const resumePlaylistDownload = async (playlistId: string) => {
  await ensurePlaylistStatusesLoaded();
  const control = ensurePlaylistControl(playlistId);
  control.paused = false;
  control.cancelled = false;
  await setPlaylistStatus(playlistId, (prev) => ({
    ...(prev || {
      playlistId,
      title: 'Playlist',
      totalSongs: 0,
      completedSongs: 0,
      failedSongs: 0,
      state: 'queued' as PlaylistDownloadState,
      updatedAt: Date.now(),
    }),
    state: 'queued',
    updatedAt: Date.now(),
  }));
  void runPlaylistDownload(playlistId);
};

export const cancelPlaylistDownload = async (playlistId: string) => {
  await ensurePlaylistStatusesLoaded();
  const control = ensurePlaylistControl(playlistId);
  control.cancelled = true;
  control.paused = false;
  if (!control.running) {
    playlistTaskMap.delete(playlistId);
    playlistStatusMap.delete(playlistId);
    playlistControlMap.delete(playlistId);
    await persistPlaylistTasks();
    await persistPlaylistStatuses();
    notify();
    return;
  }
  await setPlaylistStatus(playlistId, (prev) => ({
    ...(prev || {
      playlistId,
      title: 'Playlist',
      totalSongs: 0,
      completedSongs: 0,
      failedSongs: 0,
      state: 'cancelled' as PlaylistDownloadState,
      updatedAt: Date.now(),
    }),
    state: 'cancelled',
    activeSongId: undefined,
    activeSongTitle: undefined,
    updatedAt: Date.now(),
  }));
};
