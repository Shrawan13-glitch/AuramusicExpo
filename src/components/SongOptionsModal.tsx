import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  Button,
  Divider,
  HelperText,
  ActivityIndicator,
  IconButton,
  List,
  Modal,
  Portal,
  Text,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AuthenticatedHttpClient } from '../utils/authenticatedHttpClient';
import { parseLibraryData, LibraryItem } from '../utils/libraryParser';
import { PlaylistAPI } from '../../api/playlist';

export interface SongOptionItem {
  videoId: string;
  title: string;
  artist?: string;
  thumbnail?: string;
  isLiked?: boolean;
}

interface SongOptionsModalProps {
  visible: boolean;
  song: SongOptionItem | null;
  onDismiss: () => void;
}

const SongOptionsModal = ({ visible, song, onDismiss }: SongOptionsModalProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [rendered, setRendered] = useState(visible);
  const [likeLoading, setLikeLoading] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [likedStatus, setLikedStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlists, setPlaylists] = useState<LibraryItem[]>([]);
  const [addingPlaylistId, setAddingPlaylistId] = useState<string | null>(null);

  const loadLikedIds = useCallback(async () => {
    if (likedStatus === 'loading' || likedStatus === 'ready') return;
    setLikedStatus('loading');
    try {
      const response = await AuthenticatedHttpClient.getUserLibrary();
      const sections = parseLibraryData(response);
      const allItems = sections.flatMap((section) => section.items);
      const likedPlaylist =
        allItems.find((item) => item.type === 'playlist' && /liked music/i.test(item.title)) ||
        allItems.find((item) => item.type === 'playlist' && /liked/i.test(item.title));
      const likedPlaylistId = likedPlaylist?.id || 'LM';

      const playlist = await PlaylistAPI.getPlaylistDetails(likedPlaylistId);
      if (!playlist) {
        setLikedStatus('error');
        return;
      }

      const nextLikedIds = new Set<string>();
      playlist.tracks.forEach((track) => nextLikedIds.add(track.id));

      let continuation = playlist.continuationToken;
      let guard = 0;
      while (continuation && guard < 10 && nextLikedIds.size < 2000) {
        const more = await PlaylistAPI.loadMoreTracks(continuation);
        if (!more) break;
        more.tracks.forEach((track) => nextLikedIds.add(track.id));
        continuation = more.continuationToken;
        guard += 1;
      }

      setLikedIds(nextLikedIds);
      setLikedStatus('ready');
    } catch (error) {
      console.error('Failed to load liked songs', error);
      setLikedStatus('error');
    }
  }, [likedStatus]);

  useEffect(() => {
    if (!visible) {
      setActionError(null);
      setMessage(null);
      setExpanded(false);
      setPlaylists([]);
      setAddingPlaylistId(null);
      setPlaylistLoading(false);
      return;
    }
    if (likedStatus === 'idle') {
      loadLikedIds();
    }
  }, [likedIds, likedStatus, loadLikedIds, song?.isLiked, song?.videoId, visible]);

  useEffect(() => {
    if (!visible) return;
    if (song?.videoId) {
      const cachedLiked = likedIds.has(song.videoId);
      setIsLiked(song.isLiked ?? cachedLiked);
    } else {
      setIsLiked(false);
    }
  }, [likedIds, song?.isLiked, song?.videoId, visible]);

  const subtitle = useMemo(() => {
    const parts = [];
    if (song?.artist) parts.push(song.artist);
    return parts.join(' • ');
  }, [song?.artist]);

  const handleLike = useCallback(async () => {
    if (!song?.videoId || likeLoading) return;
    setLikeLoading(true);
    setActionError(null);
    setMessage(null);

    try {
      if (isLiked) {
        await AuthenticatedHttpClient.removeLikeSong(song.videoId);
        setIsLiked(false);
        setLikedIds((prev) => {
          const next = new Set(prev);
          next.delete(song.videoId);
          return next;
        });
        setMessage('Removed from liked music');
        setLikeLoading(false);
        return;
      }

      await AuthenticatedHttpClient.likeSong(song.videoId);
      setIsLiked(true);
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.add(song.videoId);
        return next;
      });
      setMessage('Saved to liked music');
    } catch (error) {
      console.error('Failed to like song', error);
      setActionError(isLiked ? 'Unable to remove like right now.' : 'Unable to like this song right now.');
    } finally {
      setLikeLoading(false);
    }
  }, [isLiked, likeLoading, song?.videoId]);

  const openPlaylistPicker = useCallback(async () => {
    if (!song?.videoId) return;
    setExpanded(true);
    setPlaylistLoading(true);
    setActionError(null);
    setMessage(null);

    try {
      const response = await AuthenticatedHttpClient.getUserLibrary();
      const sections = parseLibraryData(response);
      const playlistItems = sections
        .flatMap((section) => section.items)
        .filter((item) => item.type === 'playlist');
      setPlaylists(playlistItems);
    } catch (error) {
      console.error('Failed to load playlists', error);
      setActionError('Unable to load playlists right now.');
    } finally {
      setPlaylistLoading(false);
    }
  }, [song?.videoId]);

  const handleAddToPlaylist = useCallback(async (playlistId: string) => {
    if (!song?.videoId || addingPlaylistId) return;
    setAddingPlaylistId(playlistId);
    setActionError(null);
    setMessage(null);

    try {
      await AuthenticatedHttpClient.addToPlaylist(playlistId, song.videoId);
      setMessage('Added to playlist');
      setExpanded(false);
    } catch (error) {
      console.error('Failed to add to playlist', error);
      setActionError('Unable to add to playlist right now.');
    } finally {
      setAddingPlaylistId(null);
    }
  }, [addingPlaylistId, song?.videoId]);

  const maxSheetHeight = expanded ? Math.max(windowHeight * 0.92, 420) : Math.max(windowHeight * 0.45, 280);
  const bottomPadding = Math.max(insets.bottom, 16);
  const subtitleText = subtitle || ' ';
  const translateY = useSharedValue(maxSheetHeight);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      translateY.value = maxSheetHeight;
      translateY.value = withTiming(0, { duration: 260 });
      return;
    }
    if (rendered) {
      translateY.value = withTiming(maxSheetHeight, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(setRendered)(false);
        }
      });
    }
  }, [maxSheetHeight, rendered, translateY, visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <>
      <Portal>
        <Modal
          visible={rendered}
          onDismiss={onDismiss}
          dismissable={false}
          style={styles.modalRoot}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalFill}>
            <Pressable style={styles.backdrop} onPress={onDismiss} />
            <Animated.View
              style={[
                styles.sheet,
                {
                  backgroundColor: theme.colors.surface,
                  paddingBottom: bottomPadding,
                  maxHeight: maxSheetHeight,
                  height: expanded ? maxSheetHeight : undefined,
                },
                sheetStyle,
              ]}
            >
              <View style={[styles.handle, { backgroundColor: theme.colors.onSurfaceVariant }]} />
              <View style={styles.headerRow}>
                <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                  {expanded ? 'Add to playlist' : 'Song options'}
                </Text>
                <View style={styles.headerActions}>
                  <IconButton
                    icon={expanded ? 'chevron-down' : 'chevron-up'}
                    size={20}
                    onPress={() => setExpanded((prev) => !prev)}
                    iconColor={theme.colors.onSurfaceVariant}
                  />
                  <IconButton
                    icon="close"
                    size={20}
                    onPress={onDismiss}
                    iconColor={theme.colors.onSurfaceVariant}
                  />
                </View>
              </View>

          <View style={styles.songRow}>
            {song?.thumbnail ? (
              <Image source={{ uri: song.thumbnail }} style={styles.thumbnail} />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
                <MaterialCommunityIcons
                  name="music-note"
                  size={22}
                  color={theme.colors.onSurfaceVariant}
                />
              </View>
            )}
            <View style={styles.songMeta}>
              <Text variant="titleSmall" numberOfLines={1} style={{ color: theme.colors.onSurface }}>
                {song?.title || 'Song options'}
              </Text>
              <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
                {subtitleText}
              </Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          {!expanded ? (
            <List.Section>
              <List.Item
                title={isLiked ? 'Remove from liked' : 'Like'}
                onPress={handleLike}
                left={(props) => (
                  <List.Icon {...props} icon={isLiked ? 'thumb-up' : 'thumb-up-outline'} />
                )}
                right={() => likeLoading ? <ActivityIndicator size="small" /> : null}
                disabled={likeLoading}
              />
              <List.Item
                title="Add to playlist"
                onPress={openPlaylistPicker}
                left={(props) => <List.Icon {...props} icon="playlist-music-outline" />}
                disabled={likeLoading}
              />
            </List.Section>
          ) : (
            <View style={styles.playlistSection}>
              {playlistLoading ? (
                <Text style={{ color: theme.colors.onSurfaceVariant }}>Loading playlists...</Text>
              ) : playlists.length === 0 ? (
                <Text style={{ color: theme.colors.onSurfaceVariant }}>No playlists found.</Text>
              ) : (
                <ScrollView style={styles.playlistList} contentContainerStyle={styles.playlistContent}>
                  {playlists.map((playlist) => (
                    <Button
                      key={playlist.id}
                      mode="text"
                      onPress={() => handleAddToPlaylist(playlist.id)}
                      loading={addingPlaylistId === playlist.id}
                      disabled={!!addingPlaylistId}
                      style={styles.playlistButton}
                      contentStyle={styles.playlistButtonContent}
                      labelStyle={{ color: theme.colors.onSurface }}
                    >
                      {playlist.title || 'Untitled playlist'}
                    </Button>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

              <HelperText type="error" visible={!!actionError}>
                {actionError}
              </HelperText>
              <HelperText type="info" visible={!!message}>
                {message}
              </HelperText>
            </Animated.View>
          </View>
        </Modal>
      </Portal>
    </>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    margin: 0,
  },
  modalContainer: {
    width: '100%',
    flex: 1,
  },
  modalFill: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 999,
    marginBottom: 8,
    opacity: 0.7,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  songMeta: {
    flex: 1,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    marginVertical: 10,
  },
  playlistSection: {
    flex: 1,
  },
  playlistList: {
    flex: 1,
  },
  playlistContent: {
    gap: 8,
  },
  playlistButton: {
    alignItems: 'flex-start',
  },
  playlistButtonContent: {
    justifyContent: 'flex-start',
  },
});

export default SongOptionsModal;
