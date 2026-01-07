import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CachedSong {
  id: string;
  title: string;
  artist: string;
  filePath: string;
  size: number;
  cachedAt: number;
  lastPlayed: number;
}

export interface CacheStats {
  totalSize: number;
  songCount: number;
  maxSize: number;
}

class CacheManager {
  private cacheDir: string;
  private metadataKey = 'cached_songs_metadata';
  private maxCacheSize = 500 * 1024 * 1024; // Default 500MB

  constructor() {
    this.cacheDir = `${RNFS.DocumentDirectoryPath}/cache/songs`;
    this.initializeCache();
  }

  private async initializeCache() {
    try {
      const exists = await RNFS.exists(this.cacheDir);
      if (!exists) {
        await RNFS.mkdir(this.cacheDir);
      }
    } catch (error) {
      console.log('Cache initialization error:', error);
    }
  }

  // Get cached songs metadata
  private async getCachedSongs(): Promise<CachedSong[]> {
    try {
      const data = await AsyncStorage.getItem(this.metadataKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.log('Error getting cached songs:', error);
      return [];
    }
  }

  // Save cached songs metadata
  private async saveCachedSongs(songs: CachedSong[]) {
    try {
      await AsyncStorage.setItem(this.metadataKey, JSON.stringify(songs));
    } catch (error) {
      console.log('Error saving cached songs:', error);
    }
  }

  // Check if song is cached
  async isSongCached(songId: string): Promise<boolean> {
    const songs = await this.getCachedSongs();
    const song = songs.find(s => s.id === songId);
    if (!song) return false;

    // Check if file actually exists
    const exists = await RNFS.exists(song.filePath);
    if (!exists) {
      // Remove from metadata if file doesn't exist
      await this.removeSongFromCache(songId);
      return false;
    }
    return true;
  }

  // Get cached song file path
  async getCachedSongPath(songId: string): Promise<string | null> {
    const songs = await this.getCachedSongs();
    const song = songs.find(s => s.id === songId);
    if (!song) return null;

    const exists = await RNFS.exists(song.filePath);
    if (!exists) {
      await this.removeSongFromCache(songId);
      return null;
    }

    // Update last played time
    song.lastPlayed = Date.now();
    await this.saveCachedSongs(songs);
    
    return song.filePath;
  }

  // Cache a song
  async cacheSong(songId: string, title: string, artist: string, audioUrl: string): Promise<boolean> {
    try {
      const fileName = `${songId}.m4a`;
      const filePath = `${this.cacheDir}/${fileName}`;

      // Download the song
      const downloadResult = await RNFS.downloadFile({
        fromUrl: audioUrl,
        toFile: filePath,
      }).promise;

      if (downloadResult.statusCode !== 200) {
        throw new Error(`Download failed with status: ${downloadResult.statusCode}`);
      }

      // Get file size
      const fileInfo = await RNFS.stat(filePath);
      const fileSize = fileInfo.size;

      // Add to cache metadata
      const songs = await this.getCachedSongs();
      const now = Date.now();
      
      const cachedSong: CachedSong = {
        id: songId,
        title,
        artist,
        filePath,
        size: fileSize,
        cachedAt: now,
        lastPlayed: now
      };

      // Remove if already exists
      const existingIndex = songs.findIndex(s => s.id === songId);
      if (existingIndex >= 0) {
        songs.splice(existingIndex, 1);
      }

      songs.push(cachedSong);
      await this.saveCachedSongs(songs);

      // Check cache size and evict if necessary
      await this.evictIfNecessary();

      return true;
    } catch (error) {
      console.log('Error caching song:', error);
      return false;
    }
  }

  // Remove song from cache
  async removeSongFromCache(songId: string) {
    try {
      const songs = await this.getCachedSongs();
      const songIndex = songs.findIndex(s => s.id === songId);
      
      if (songIndex >= 0) {
        const song = songs[songIndex];
        
        // Delete file
        const exists = await RNFS.exists(song.filePath);
        if (exists) {
          await RNFS.unlink(song.filePath);
        }
        
        // Remove from metadata
        songs.splice(songIndex, 1);
        await this.saveCachedSongs(songs);
      }
    } catch (error) {
      console.log('Error removing song from cache:', error);
    }
  }

  // Evict old songs if cache is full
  private async evictIfNecessary() {
    const songs = await this.getCachedSongs();
    const totalSize = songs.reduce((sum, song) => sum + song.size, 0);

    if (totalSize > this.maxCacheSize) {
      // Sort by last played (oldest first)
      songs.sort((a, b) => a.lastPlayed - b.lastPlayed);

      // Remove songs until under limit
      let currentSize = totalSize;
      while (currentSize > this.maxCacheSize && songs.length > 0) {
        const oldestSong = songs.shift()!;
        
        try {
          const exists = await RNFS.exists(oldestSong.filePath);
          if (exists) {
            await RNFS.unlink(oldestSong.filePath);
          }
          currentSize -= oldestSong.size;
        } catch (error) {
          console.log('Error removing old cached song:', error);
        }
      }

      await this.saveCachedSongs(songs);
    }
  }

  // Get cache statistics
  async getCacheStats(): Promise<CacheStats> {
    const songs = await this.getCachedSongs();
    const totalSize = songs.reduce((sum, song) => sum + song.size, 0);
    
    return {
      totalSize,
      songCount: songs.length,
      maxSize: this.maxCacheSize
    };
  }

  // Get all cached songs
  async getAllCachedSongs(): Promise<CachedSong[]> {
    return this.getCachedSongs();
  }

  // Set max cache size
  async setMaxCacheSize(sizeInMB: number) {
    this.maxCacheSize = sizeInMB * 1024 * 1024;
    await AsyncStorage.setItem('max_cache_size', sizeInMB.toString());
    await this.evictIfNecessary();
  }

  // Get max cache size
  async getMaxCacheSize(): Promise<number> {
    try {
      const size = await AsyncStorage.getItem('max_cache_size');
      if (size) {
        this.maxCacheSize = parseInt(size) * 1024 * 1024;
        return parseInt(size);
      }
    } catch (error) {
      console.log('Error getting max cache size:', error);
    }
    return 500; // Default 500MB
  }

  // Clear all cache
  async clearAllCache() {
    try {
      const songs = await this.getCachedSongs();
      
      // Delete all files
      for (const song of songs) {
        const exists = await RNFS.exists(song.filePath);
        if (exists) {
          await RNFS.unlink(song.filePath);
        }
      }
      
      // Clear metadata
      await AsyncStorage.removeItem(this.metadataKey);
    } catch (error) {
      console.log('Error clearing cache:', error);
    }
  }
}

export const cacheManager = new CacheManager();