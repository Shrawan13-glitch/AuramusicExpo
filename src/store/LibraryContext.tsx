import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Song, PlayHistory } from '../types';
import { InnerTube } from '../api/innertube';
import { AuraDB } from '../services/auraDB';

interface LibraryContextType {
  likedSongs: Song[];
  recentlyPlayed: PlayHistory[];
  playlists: any[];
  addLikedSong: (song: Song) => void;
  removeLikedSong: (songId: string) => void;
  isLiked: (songId: string) => boolean;
  addToRecentlyPlayed: (song: Song, duration: number) => void;
  loadMoreHistory: (offset: number) => Promise<PlayHistory[]>;
  syncLikedSongs: () => Promise<void>;
  createPlaylist: (title: string, description?: string) => Promise<string | null>;
  addToPlaylist: (playlistId: string, song: Song) => Promise<boolean>;
  removeFromPlaylist: (playlistId: string, songId: string) => Promise<boolean>;
  editPlaylist: (playlistId: string, title?: string, description?: string, privacy?: string, thumbnailUrl?: string) => Promise<boolean>;
  deletePlaylist: (playlistId: string) => Promise<boolean>;
  syncPlaylists: () => Promise<void>;
  loadPlaylistSongs: (playlistId: string) => Promise<Song[]>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<PlayHistory[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);

  useEffect(() => {
    loadLibrary();
  }, []);

  // Sync liked songs when authentication changes
  useEffect(() => {
    const checkAuth = async () => {
      const cookies = await AsyncStorage.getItem('ytm_cookies');
      if (cookies) {
        syncLikedSongs();
        syncPlaylists();
        
        // Set up periodic sync every 5 minutes when authenticated
        const interval = setInterval(() => {
          syncLikedSongs();
          syncPlaylists();
        }, 5 * 60 * 1000);
        
        return () => clearInterval(interval);
      }
    };
    checkAuth();
  }, [syncLikedSongs, syncPlaylists]);

  const loadLibrary = async () => {
    try {
      const liked = await AsyncStorage.getItem('likedSongs');
      
      // Migrate old recently played to new DB
      const oldRecent = await AsyncStorage.getItem('recentlyPlayed');
      if (oldRecent) {
        const oldSongs: Song[] = JSON.parse(oldRecent);
        for (const song of oldSongs) {
          await AuraDB.addPlayHistory(song, 30000); // Add with 30s duration
        }
        await AsyncStorage.removeItem('recentlyPlayed'); // Remove old data
      }
      
      const history = await AuraDB.getHistory(0, 50);
      if (liked) setLikedSongs(JSON.parse(liked));
      setRecentlyPlayed(history);
      
      // Auto-sync if authenticated
      const cookies = await AsyncStorage.getItem('ytm_cookies');
      if (cookies) {
        syncLikedSongs();
      }
    } catch (e) {
      // Error handled silently
    }
  };

  const syncLikedSongs = useCallback(async () => {
    try {
      const cookies = await AsyncStorage.getItem('ytm_cookies');
      if (!cookies) return;

      // Get local liked songs first
      const localLiked = await AsyncStorage.getItem('likedSongs');
      const localLikedSongs: Song[] = localLiked ? JSON.parse(localLiked) : [];

      // Get YouTube Music liked songs
      const ytmLibrary = await InnerTube.getLibrary('VLLM');
      const ytmLikedSongs = ytmLibrary.items?.filter((item: any) => item.type === 'song') || [];
      
      // Sync local songs to YouTube Music first
      await Promise.all(localLikedSongs.map(async (localSong) => {
        try {
          await InnerTube.likeSong(localSong.id, true);
        } catch (error) {
          // Continue if individual song sync fails
        }
      }));
      
      // Create a map for faster lookup
      const localLikedMap = new Map(localLikedSongs.map(song => [song.id, song]));
      const ytmLikedMap = new Map(ytmLikedSongs.map((song: any) => [song.id, song]));
      
      // Merge songs: prioritize YTM data but keep local songs not in YTM
      const mergedSongs: Song[] = [];
      const processedIds = new Set<string>();
      
      // Add all YTM liked songs first
      ytmLikedSongs.forEach((ytmSong: any) => {
        mergedSongs.push(ytmSong);
        processedIds.add(ytmSong.id);
      });
      
      // Add local songs that aren't in YTM
      localLikedSongs.forEach((localSong: Song) => {
        if (!processedIds.has(localSong.id)) {
          mergedSongs.push(localSong);
        }
      });
      
      // Update state and storage
      setLikedSongs(mergedSongs);
      await AsyncStorage.setItem('likedSongs', JSON.stringify(mergedSongs));
      
    } catch (error) {
      // Sync failed, continue with local data
    }
  }, []);

  const addLikedSong = useCallback(async (song: Song) => {
    const updated = [song, ...likedSongs.filter(s => s.id !== song.id)];
    setLikedSongs(updated);
    
    // Non-blocking storage and sync
    AsyncStorage.setItem('likedSongs', JSON.stringify(updated)).catch(() => {});
    
    // Sync with YouTube Music if authenticated (non-blocking)
    AsyncStorage.getItem('ytm_cookies').then(cookies => {
      if (cookies) {
        InnerTube.likeSong(song.id, true).catch(() => {});
      }
    }).catch(() => {});
  }, [likedSongs]);

  const removeLikedSong = useCallback(async (songId: string) => {
    const updated = likedSongs.filter(s => s.id !== songId);
    setLikedSongs(updated);
    
    // Non-blocking storage and sync
    AsyncStorage.setItem('likedSongs', JSON.stringify(updated)).catch(() => {});
    
    // Sync with YouTube Music if authenticated (non-blocking)
    AsyncStorage.getItem('ytm_cookies').then(cookies => {
      if (cookies) {
        InnerTube.likeSong(songId, false).catch(() => {});
      }
    }).catch(() => {});
  }, [likedSongs]);

  const isLiked = useCallback((songId: string) => likedSongs.some(s => s.id === songId), [likedSongs]);

  const addToRecentlyPlayed = useCallback(async (song: Song, duration: number = 0) => {
    await AuraDB.addPlayHistory(song, duration);
    const updated = await AuraDB.getHistory(0, 50);
    setRecentlyPlayed(updated);
  }, []);

  const loadMoreHistory = useCallback(async (offset: number): Promise<PlayHistory[]> => {
    return await AuraDB.getHistory(offset, 50);
  }, []);

  const createPlaylist = useCallback(async (title: string, description: string = ''): Promise<string | null> => {
    // Always create local playlist first for immediate UI response
    const localId = `local_${Date.now()}`;
    const newPlaylist = { 
      id: localId, 
      title, 
      description, 
      songs: [], 
      isLocal: true,
      thumbnailUrl: 'https://i.imgur.com/placeholder.png',
      type: 'playlist'
    };
    const updated = [newPlaylist, ...playlists];
    setPlaylists(updated);
    await AsyncStorage.setItem('playlists', JSON.stringify(updated));
    
    // Try to sync with YouTube Music in background if authenticated
    const cookies = await AsyncStorage.getItem('ytm_cookies');
    if (cookies) {
      try {
        const remoteId = await InnerTube.createPlaylist(title, description);
        if (remoteId) {
          // Replace local playlist with remote one
          const syncedPlaylist = { ...newPlaylist, id: remoteId, isLocal: false };
          const synced = updated.map(p => p.id === localId ? syncedPlaylist : p);
          setPlaylists(synced);
          await AsyncStorage.setItem('playlists', JSON.stringify(synced));
          return remoteId;
        }
      } catch (error) {
        // Keep local playlist if sync fails
      }
    }
    
    return localId;
  }, [playlists]);

  const addToPlaylist = useCallback(async (playlistId: string, song: Song): Promise<boolean> => {
    try {
      const playlist = playlists.find(p => p.id === playlistId);
      if (!playlist) return false;

      // Check if song already exists in playlist
      const songExists = playlist.songs?.some(s => s.id === song.id);
      if (songExists) return true;

      // Always update locally first
      const updatedSongs = [...(playlist.songs || []), song];
      const updated = playlists.map(p => 
        p.id === playlistId ? { ...p, songs: updatedSongs } : p
      );
      
      setPlaylists(updated);
      await AsyncStorage.setItem('playlists', JSON.stringify(updated));

      // Try to sync with YouTube Music if authenticated and not local
      const cookies = await AsyncStorage.getItem('ytm_cookies');
      if (!playlist.isLocal && cookies) {
        try {
          const syncResult = await InnerTube.addToPlaylist(playlistId, song.id);
          if (!syncResult) {
            // Revert on failure
            const reverted = playlists.map(p => 
              p.id === playlistId ? { ...p, songs: (p.songs || []).filter(s => s.id !== song.id) } : p
            );
            setPlaylists(reverted);
            await AsyncStorage.setItem('playlists', JSON.stringify(reverted));
            return false;
          }
        } catch (syncError) {
          // Revert on failure
          const reverted = playlists.map(p => 
            p.id === playlistId ? { ...p, songs: (p.songs || []).filter(s => s.id !== song.id) } : p
          );
          setPlaylists(reverted);
          await AsyncStorage.setItem('playlists', JSON.stringify(reverted));
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }, [playlists]);

  const removeFromPlaylist = useCallback(async (playlistId: string, songId: string): Promise<boolean> => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return false;

    // Update locally first
    const updatedSongs = (playlist.songs || []).filter((s: Song) => s.id !== songId);
    const updatedPlaylist = { ...playlist, songs: updatedSongs };
    const updated = playlists.map(p => p.id === playlistId ? updatedPlaylist : p);
    
    setPlaylists(updated);
    await AsyncStorage.setItem('playlists', JSON.stringify(updated));

    const cookies = await AsyncStorage.getItem('ytm_cookies');
    
    if (!playlist.isLocal && cookies) {
      try {
        const success = await InnerTube.removeFromPlaylist(playlistId, songId);
        if (!success) {
          // Revert on failure
          setPlaylists(playlists);
          await AsyncStorage.setItem('playlists', JSON.stringify(playlists));
          return false;
        }
      } catch (error) {
        // Revert on failure
        setPlaylists(playlists);
        await AsyncStorage.setItem('playlists', JSON.stringify(playlists));
        return false;
      }
    }
    
    return true;
  }, [playlists]);

  const syncPlaylists = useCallback(async () => {
    try {
      const cookies = await AsyncStorage.getItem('ytm_cookies');
      if (!cookies) return;

      // Get current local playlists
      const localPlaylists = await AsyncStorage.getItem('playlists');
      const localPlaylistsData: any[] = localPlaylists ? JSON.parse(localPlaylists) : [];
      const localOnlyPlaylists = localPlaylistsData.filter(p => p.isLocal);

      // Sync local playlists to YouTube Music
      await Promise.all(localOnlyPlaylists.map(async (localPlaylist) => {
        try {
          const remoteId = await InnerTube.createPlaylist(localPlaylist.title, localPlaylist.description || '');
          if (remoteId) {
            // Add all songs to the remote playlist
            await Promise.all((localPlaylist.songs || []).map(async (song: Song) => {
              try {
                await InnerTube.addToPlaylist(remoteId, song.id);
              } catch (error) {
                // Continue if individual song fails
              }
            }));
            // Update local playlist to point to remote
            localPlaylist.id = remoteId;
            localPlaylist.isLocal = false;
          }
        } catch (error) {
          // Keep as local if sync fails
        }
      }));

      // Get YouTube Music playlists
      const [libraryData, artistsData] = await Promise.all([
        InnerTube.getLibrary('FEmusic_library_landing'),
        InnerTube.getLibrary('FEmusic_library_corpus_artists')
      ]);
      
      const ytmPlaylists = libraryData.items?.filter((item: any) => item.type === 'playlist') || [];
      const ytmArtists = artistsData.items?.filter((item: any) => item.type === 'artist') || [];
      
      // Merge all playlists
      const mergedPlaylists = [
        ...ytmPlaylists.map((p: any) => ({ ...p, isLocal: false, synced: true })),
        ...ytmArtists.map((a: any) => ({ ...a, isLocal: false, synced: true })),
        ...localPlaylistsData.filter((p: any) => p.isLocal) // Keep remaining local playlists
      ];
      
      setPlaylists(mergedPlaylists);
      await AsyncStorage.setItem('playlists', JSON.stringify(mergedPlaylists));
    } catch (error) {
      // Sync failed, continue with local data
    }
  }, []);

  const editPlaylist = useCallback(async (playlistId: string, title?: string, description?: string, privacy?: string, thumbnailUrl?: string): Promise<boolean> => {
    try {
      const playlist = playlists.find(p => p.id === playlistId);
      if (!playlist) {
        // If playlist not found in context, try to find it by creating a basic entry
        const basicPlaylist = {
          id: playlistId,
          title: title || 'Playlist',
          description: description || '',
          privacy: privacy || 'PRIVATE',
          isLocal: false,
          type: 'playlist'
        };
        const updated = [...playlists, basicPlaylist];
        setPlaylists(updated);
        await AsyncStorage.setItem('playlists', JSON.stringify(updated));
      }

      // Update locally first
      const updatedPlaylist = { ...(playlist || { id: playlistId, type: 'playlist' }) };
      if (title !== undefined) updatedPlaylist.title = title;
      if (description !== undefined) updatedPlaylist.description = description;
      if (privacy !== undefined) updatedPlaylist.privacy = privacy;
      if (thumbnailUrl !== undefined) updatedPlaylist.thumbnailUrl = thumbnailUrl;
      
      const updated = playlists.map(p => p.id === playlistId ? updatedPlaylist : p);
      if (!playlist) {
        updated.push(updatedPlaylist);
      }
      
      setPlaylists(updated);
      await AsyncStorage.setItem('playlists', JSON.stringify(updated));

      // Try to sync with YouTube Music if authenticated and not local
      const cookies = await AsyncStorage.getItem('ytm_cookies');
      if (!updatedPlaylist.isLocal && cookies) {
        try {
          const syncResult = await InnerTube.editPlaylist(playlistId, title, description, privacy);
          if (!syncResult) {
            // Revert on failure
            setPlaylists(playlists);
            await AsyncStorage.setItem('playlists', JSON.stringify(playlists));
            return false;
          }
        } catch (syncError) {
          // Revert on failure
          setPlaylists(playlists);
          await AsyncStorage.setItem('playlists', JSON.stringify(playlists));
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }, [playlists]);

  const deletePlaylist = useCallback(async (playlistId: string): Promise<boolean> => {
    try {
      const playlist = playlists.find(p => p.id === playlistId);
      if (!playlist) return false;

      // Try to delete from YouTube Music first if not local
      const cookies = await AsyncStorage.getItem('ytm_cookies');
      if (!playlist.isLocal && cookies) {
        try {
          const syncResult = await InnerTube.deletePlaylist(playlistId);
          if (!syncResult) {
            return false;
          }
        } catch (syncError) {
          return false;
        }
      }

      // Remove locally
      const updated = playlists.filter(p => p.id !== playlistId);
      setPlaylists(updated);
      await AsyncStorage.setItem('playlists', JSON.stringify(updated));
      
      return true;
    } catch (error) {
      return false;
    }
  }, [playlists]);

  const loadPlaylistSongs = useCallback(async (playlistId: string): Promise<Song[]> => {
    try {
      const playlistData = await InnerTube.getPlaylist(playlistId);
      return playlistData?.songs || [];
    } catch (error) {
      return [];
    }
  }, []);

  const contextValue = useMemo(() => ({
    likedSongs,
    recentlyPlayed,
    playlists,
    addLikedSong,
    removeLikedSong,
    isLiked,
    addToRecentlyPlayed,
    loadMoreHistory,
    syncLikedSongs,
    createPlaylist,
    addToPlaylist,
    removeFromPlaylist,
    editPlaylist,
    deletePlaylist,
    syncPlaylists,
    loadPlaylistSongs
  }), [likedSongs, recentlyPlayed, playlists, addLikedSong, removeLikedSong, isLiked, addToRecentlyPlayed, loadMoreHistory, syncLikedSongs, createPlaylist, addToPlaylist, removeFromPlaylist, editPlaylist, deletePlaylist, syncPlaylists, loadPlaylistSongs]);

  return (
    <LibraryContext.Provider value={contextValue}>
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used within LibraryProvider');
  return context;
};
