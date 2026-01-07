import AsyncStorage from '@react-native-async-storage/async-storage';

interface LyricsData {
  lines: Array<{ text: string; startTime?: number }>;
}

interface CachedLyrics {
  videoId: string;
  title: string;
  artist: string;
  lyrics: LyricsData | null;
  timestamp: number;
  size: number;
}

class LyricsCache {
  private cache = new Map<string, CachedLyrics>();
  private readonly CACHE_KEY = 'lyrics_cache';
  private readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
  private currentSize = 0;

  async initialize() {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        this.cache = new Map(data.entries);
        this.currentSize = data.size || 0;
        this.cleanExpired();
      }
    } catch (error) {
      console.log('Failed to load lyrics cache:', error);
    }
  }

  async get(videoId: string): Promise<LyricsData | null | undefined> {
    const cached = this.cache.get(videoId);
    if (!cached) return undefined;

    // Check if expired
    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(videoId);
      this.currentSize -= cached.size;
      await this.save();
      return undefined;
    }

    // Move to end (LRU)
    this.cache.delete(videoId);
    this.cache.set(videoId, cached);
    return cached.lyrics;
  }

  async set(videoId: string, title: string, artist: string, lyrics: LyricsData | null) {
    const lyricsSize = this.calculateSize(lyrics);
    const entry: CachedLyrics = {
      videoId,
      title,
      artist,
      lyrics,
      timestamp: Date.now(),
      size: lyricsSize,
    };

    // Remove existing entry if present
    const existing = this.cache.get(videoId);
    if (existing) {
      this.currentSize -= existing.size;
    }

    // Ensure we have space
    while (this.currentSize + lyricsSize > this.MAX_CACHE_SIZE && this.cache.size > 0) {
      const firstKey = this.cache.keys().next().value;
      const firstEntry = this.cache.get(firstKey)!;
      this.cache.delete(firstKey);
      this.currentSize -= firstEntry.size;
    }

    this.cache.set(videoId, entry);
    this.currentSize += lyricsSize;
    await this.save();
  }

  async getCachedLyrics(): Promise<CachedLyrics[]> {
    return Array.from(this.cache.values()).reverse();
  }

  async deleteLyrics(videoId: string) {
    const entry = this.cache.get(videoId);
    if (entry) {
      this.cache.delete(videoId);
      this.currentSize -= entry.size;
      await this.save();
    }
  }

  async clearAll() {
    this.cache.clear();
    this.currentSize = 0;
    await AsyncStorage.removeItem(this.CACHE_KEY);
  }

  getCacheInfo() {
    return {
      count: this.cache.size,
      size: this.currentSize,
      maxSize: this.MAX_CACHE_SIZE,
    };
  }

  private calculateSize(lyrics: LyricsData | null): number {
    if (!lyrics) return 100; // Small size for null entries
    return JSON.stringify(lyrics).length * 2; // Rough estimate
  }

  private cleanExpired() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_DURATION) {
        this.cache.delete(key);
        this.currentSize -= entry.size;
      }
    }
  }

  private async save() {
    try {
      const data = {
        entries: Array.from(this.cache.entries()),
        size: this.currentSize,
      };
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.log('Failed to save lyrics cache:', error);
    }
  }
}

export const lyricsCache = new LyricsCache();