import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Appbar, Button, ProgressBar, Surface, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayer } from '../contexts/PlayerContext';
import {
  cancelPlaylistDownload,
  downloadSong,
  getAllDownloadStatuses,
  getAllDownloadStatusesSync,
  getAllPlaylistDownloadStatuses,
  getAllPlaylistDownloadStatusesSync,
  getDownloadedSongs,
  pauseSongDownload,
  pausePlaylistDownload,
  resumePlaylistDownload,
  type DownloadStatusItem,
  type PlaylistDownloadStatusItem,
  subscribeDownloadedSongs,
} from '../utils/downloadManager';
import { FlashList } from '@shopify/flash-list';

type DownloadsRow =
  | { type: 'section'; key: string; title: string }
  | { type: 'song'; key: string; item: DownloadStatusItem }
  | { type: 'playlist'; key: string; item: PlaylistDownloadStatusItem };

export default function DownloadsScreen({ navigation }: { navigation: any }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { playTrack } = usePlayer();
  const [items, setItems] = useState<DownloadStatusItem[]>([]);
  const [playlistItems, setPlaylistItems] = useState<PlaylistDownloadStatusItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [statuses, playlistStatuses] = await Promise.all([
      getAllDownloadStatuses(),
      getAllPlaylistDownloadStatuses(),
    ]);
    setItems(statuses);
    setPlaylistItems(playlistStatuses);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = subscribeDownloadedSongs(() => {
      setItems(getAllDownloadStatusesSync());
      setPlaylistItems(getAllPlaylistDownloadStatusesSync());
    });
    return unsubscribe;
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onPressItem = useCallback(
    async (item: DownloadStatusItem) => {
      if (item.state === 'downloading') {
        await pauseSongDownload(item.id);
        await load();
        return;
      }
      if (item.state === 'failed' || item.state === 'idle' || item.state === 'paused') {
        await downloadSong({
          id: item.id,
          title: item.title,
          artist: item.artist,
          thumbnail: item.thumbnail,
        });
        await load();
        return;
      }

      if (item.state !== 'downloaded' || !item.localPath) return;

      const downloaded = await getDownloadedSongs();
      const queue = downloaded.map((song) => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        thumbnail: song.thumbnail || '',
        streamUrl: song.localPath,
      }));
      const index = queue.findIndex((track) => track.id === item.id);
      if (index < 0) return;
      playTrack(queue[index], queue, { source: { type: 'queue', label: 'Downloaded Songs' } });
    },
    [load, playTrack]
  );

  const rows = useMemo<DownloadsRow[]>(() => {
    const queueSongs = items.filter((item) => item.state === 'queued' || item.state === 'downloading');
    const otherSongs = items.filter((item) => item.state !== 'queued' && item.state !== 'downloading');
    const nextRows: DownloadsRow[] = [];

    if (queueSongs.length) {
      nextRows.push({ type: 'section', key: 'section-queue', title: 'Download Queue' });
      queueSongs.forEach((item) => nextRows.push({ type: 'song', key: `song-queue-${item.id}`, item }));
    }

    if (playlistItems.length) {
      nextRows.push({ type: 'section', key: 'section-playlists', title: 'Playlist Downloads' });
      playlistItems.forEach((item) => nextRows.push({ type: 'playlist', key: `playlist-${item.playlistId}`, item }));
    }

    if (otherSongs.length) {
      nextRows.push({ type: 'section', key: 'section-songs', title: 'Songs' });
      otherSongs.forEach((item) => nextRows.push({ type: 'song', key: `song-${item.id}`, item }));
    }

    return nextRows;
  }, [items, playlistItems]);

  const empty = useMemo(() => rows.length === 0, [rows.length]);

  const onPressPlaylistAction = useCallback(
    async (item: PlaylistDownloadStatusItem, action: 'pause' | 'resume' | 'cancel') => {
      if (action === 'pause') {
        await pausePlaylistDownload(item.playlistId);
      } else if (action === 'resume') {
        await resumePlaylistDownload(item.playlistId);
      } else {
        await cancelPlaylistDownload(item.playlistId);
      }
      await load();
    },
    [load]
  );

  const renderSongRow = useCallback(
    (item: DownloadStatusItem) => (
      <TouchableOpacity activeOpacity={0.8} onPress={() => void onPressItem(item)}>
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, { backgroundColor: theme.colors.surfaceVariant }]} />
          )}
          <View style={styles.meta}>
            <Text numberOfLines={1} style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
              {item.artist}
            </Text>
            <Text style={{ color: theme.colors.primary, fontSize: 12, marginTop: 4 }}>
              {item.state === 'downloaded'
                ? 'Downloaded'
                : item.state === 'downloading'
                  ? `Downloading ${Math.round(item.progress * 100)}% - tap to pause`
                : item.state === 'queued'
                    ? 'Queued'
                    : item.state === 'paused'
                      ? 'Paused - tap to resume'
                    : item.state === 'failed'
                      ? 'Failed - tap to retry'
                      : 'Idle'}
            </Text>
            {(item.state === 'downloading' || item.state === 'queued') && (
              <ProgressBar progress={item.state === 'queued' ? 0 : item.progress} style={styles.progress} />
            )}
          </View>
        </Surface>
      </TouchableOpacity>
    ),
    [onPressItem, theme.colors.onSurface, theme.colors.onSurfaceVariant, theme.colors.primary, theme.colors.surface, theme.colors.surfaceVariant]
  );

  const renderPlaylistRow = useCallback(
    (item: PlaylistDownloadStatusItem) => {
      const total = Math.max(item.totalSongs, 1);
      const done = Math.min(item.completedSongs + item.failedSongs, total);
      const progress = done / total;
      const isActive = item.state === 'downloading' || item.state === 'queued';
      const canResume = item.state === 'paused' || item.state === 'failed';

      return (
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, { backgroundColor: theme.colors.surfaceVariant }]} />
          )}
          <View style={styles.meta}>
            <Text numberOfLines={1} style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
              {item.activeSongTitle
                ? `Now: ${item.activeSongTitle}`
                : `${item.completedSongs}/${item.totalSongs} done${item.failedSongs ? `, ${item.failedSongs} failed` : ''}`}
            </Text>
            <Text style={{ color: theme.colors.primary, fontSize: 12, marginTop: 4 }}>
              {item.state}
            </Text>
            <ProgressBar progress={Math.max(0, Math.min(1, progress))} style={styles.progress} />
            <View style={styles.playlistActions}>
              {isActive ? (
                <Button mode="outlined" compact onPress={() => void onPressPlaylistAction(item, 'pause')}>
                  Pause
                </Button>
              ) : canResume ? (
                <Button mode="outlined" compact onPress={() => void onPressPlaylistAction(item, 'resume')}>
                  Resume
                </Button>
              ) : (
                <Button mode="outlined" compact disabled>
                  {item.state === 'completed' ? 'Completed' : 'Stopped'}
                </Button>
              )}
              <Button mode="text" compact onPress={() => void onPressPlaylistAction(item, 'cancel')}>
                Remove
              </Button>
            </View>
          </View>
        </Surface>
      );
    },
    [onPressPlaylistAction, theme.colors.onSurface, theme.colors.onSurfaceVariant, theme.colors.primary, theme.colors.surface, theme.colors.surfaceVariant]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={{ paddingTop: insets.top, backgroundColor: theme.colors.surface }}>
        <Appbar.Header statusBarHeight={0}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Downloads" />
          <Appbar.Action icon="refresh" onPress={load} />
        </Appbar.Header>
      </View>

      {empty ? (
        <View style={styles.empty}>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>No downloads yet.</Text>
        </View>
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(item) => item.key}
          estimatedItemSize={84}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={theme.colors.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            if (item.type === 'section') {
              return (
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                  {item.title}
                </Text>
              );
            }
            if (item.type === 'playlist') {
              return renderPlaylistRow(item.item);
            }
            return renderSongRow(item.item);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 2,
  },
  card: {
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  meta: {
    flex: 1,
  },
  progress: {
    marginTop: 6,
    height: 4,
    borderRadius: 4,
  },
  playlistActions: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
