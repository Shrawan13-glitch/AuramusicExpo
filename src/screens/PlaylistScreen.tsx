import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  Text,
  useTheme,
  IconButton,
  Button,
  Snackbar,
  Appbar,
  Portal,
  Modal,
  TextInput,
  RadioButton,
  HelperText,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlaylistAPI, PlaylistDetails, PlaylistTrack } from '../../api/playlist';
import { AuthenticatedHttpClient } from '../utils/authenticatedHttpClient';
import { useSongOptions } from '../contexts/SongOptionsContext';
import { usePlayer } from '../contexts/PlayerContext';
import {
  downloadPlaylist,
  getPlaylistDownloadStatus,
  getPlaylistDownloadStatusSync,
  pausePlaylistDownload,
  resumePlaylistDownload,
  subscribeDownloadedSongs,
  type PlaylistDownloadStatusItem,
} from '../utils/downloadManager';

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList) as typeof FlashList;

const TRACK_ROW_HEIGHT = 72;

type TrackRowProps = {
  item: PlaylistTrack;
  theme: ReturnType<typeof useTheme>;
  onPressTrack: (item: PlaylistTrack) => void;
  onOpenTrackOptions: (item: {
    videoId: string;
    title: string;
    artist: string;
    thumbnail: string;
  }) => void;
};

const TrackRow = React.memo(function TrackRow({
  item,
  theme,
  onPressTrack,
  onOpenTrackOptions,
}: TrackRowProps) {
  return (
    <TouchableOpacity
      style={[styles.trackItem, { borderBottomColor: theme.colors.outline }]}
      activeOpacity={0.7}
      onPress={() => onPressTrack(item)}
      onLongPress={() => onOpenTrackOptions({
        videoId: item.id,
        title: item.title,
        artist: item.artist,
        thumbnail: item.thumbnail,
      })}
    >
      <Image
        source={{ uri: item.thumbnail }}
        style={[styles.trackThumbnail, { backgroundColor: theme.colors.surfaceVariant }]}
      />

      <View style={styles.trackInfo}>
        <Text
          variant="bodyMedium"
          numberOfLines={1}
          style={[styles.trackTitle, { color: theme.colors.onSurface }]}
        >
          {item.title}
        </Text>
        <Text
          variant="bodySmall"
          numberOfLines={1}
          style={[styles.trackArtist, { color: theme.colors.onSurfaceVariant }]}
        >
          {item.artist}
        </Text>
      </View>

      {item.duration && (
        <Text
          variant="bodySmall"
          style={[styles.trackDuration, { color: theme.colors.onSurfaceVariant }]}
        >
          {item.duration}
        </Text>
      )}

      <IconButton
        icon="dots-vertical"
        size={20}
        iconColor={theme.colors.onSurfaceVariant}
        onPress={() => onOpenTrackOptions({
          videoId: item.id,
          title: item.title,
          artist: item.artist,
          thumbnail: item.thumbnail,
        })}
      />
    </TouchableOpacity>
  );
});

type PlaylistHeaderProps = {
  onBack: () => void;
  onPlay: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onLoadMore: () => void;
  loadingMore: boolean;
  canLoadMore: boolean;
  canPlay: boolean;
  downloadButtonLabel: string;
  title?: string;
  subtitle?: string;
  secondSubtitle?: string;
  description?: string;
  thumbnail?: string;
  downloadStatusText?: string;
  colors: {
    surface: string;
    surfaceVariant: string;
    onSurface: string;
    onSurfaceVariant: string;
  };
};

const PlaylistHeader = React.memo(function PlaylistHeader({
  onBack,
  onPlay,
  onDownload,
  onEdit,
  onLoadMore,
  loadingMore,
  canLoadMore,
  canPlay,
  downloadButtonLabel,
  title,
  subtitle,
  secondSubtitle,
  description,
  thumbnail,
  downloadStatusText,
  colors,
}: PlaylistHeaderProps) {
  return (
    <View>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <View style={styles.headerContent}>
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor={colors.onSurface}
            onPress={onBack}
            style={styles.backButton}
          />

          <Image
            source={{ uri: thumbnail }}
            style={[styles.playlistThumbnail, { backgroundColor: colors.surfaceVariant }]}
          />

          <View style={styles.playlistInfo}>
            <Text variant="headlineSmall" style={[styles.playlistTitle, { color: colors.onSurface }]}>
              {title}
            </Text>

            <Text variant="bodyMedium" style={[styles.playlistSubtitle, { color: colors.onSurfaceVariant }]}>
              {subtitle}
            </Text>

            <Text variant="bodySmall" style={[styles.playlistSecondSubtitle, { color: colors.onSurfaceVariant }]}>
              {secondSubtitle}
            </Text>

            {!!description && (
              <Text
                variant="bodySmall"
                numberOfLines={2}
                style={[styles.playlistDescription, { color: colors.onSurfaceVariant }]}
              >
                {description}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            icon="play"
            onPress={onPlay}
            disabled={!canPlay}
            style={styles.playButton}
          >
            Play
          </Button>
          <Button
            mode="outlined"
            icon="download"
            onPress={onDownload}
            disabled={!canPlay}
            style={styles.downloadButton}
          >
            {downloadButtonLabel}
          </Button>

          <IconButton
            icon="pencil"
            size={24}
            iconColor={colors.onSurface}
            onPress={onEdit}
          />
        </View>
        {canLoadMore ? (
          <View style={styles.loadMoreInlineWrap}>
            <Button
              mode="text"
              icon="chevron-down"
              onPress={onLoadMore}
              loading={loadingMore}
              disabled={loadingMore}
              compact
            >
              {loadingMore ? 'Loading songs...' : 'Load more songs'}
            </Button>
          </View>
        ) : null}
        {downloadStatusText ? (
          <Text style={[styles.downloadStatusText, { color: colors.onSurfaceVariant }]}>
            {downloadStatusText}
          </Text>
        ) : null}
        <View style={styles.headerSpacer} />
      </View>
    </View>
  );
});

interface PlaylistScreenProps {
  route: {
    params: {
      playlistId: string;
    };
  };
  navigation: any;
}

export default function PlaylistScreen({ route, navigation }: PlaylistScreenProps) {
  const { playlistId } = route.params;
  const [playlist, setPlaylist] = useState<PlaylistDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [scrollY] = useState(new Animated.Value(0));
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrivacy, setEditPrivacy] = useState<'PUBLIC' | 'UNLISTED' | 'PRIVATE'>('PRIVATE');
  const [editVotePermission, setEditVotePermission] = useState<'UNCHANGED' | 'EVERYONE' | 'COLLABORATORS' | 'OFF'>('UNCHANGED');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [playlistDownloadStatus, setPlaylistDownloadStatus] = useState<PlaylistDownloadStatusItem | null>(null);
  const theme = useTheme();
  const { openSongOptions } = useSongOptions();
  const { playTrack } = usePlayer();
  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  useEffect(() => {
    loadPlaylist();
  }, [playlistId]);

  useEffect(() => {
    let mounted = true;
    const loadStatus = async () => {
      const status = await getPlaylistDownloadStatus(playlistId);
      if (mounted) setPlaylistDownloadStatus(status);
    };
    void loadStatus();
    const unsubscribe = subscribeDownloadedSongs(() => {
      const next = getPlaylistDownloadStatusSync(playlistId);
      if (mounted) setPlaylistDownloadStatus(next);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [playlistId]);

  const loadPlaylist = async () => {
    setLoading(true);
    const data = await PlaylistAPI.getPlaylistDetails(playlistId);
    setPlaylist(data);
    setLoading(false);
  };

  const derivedPrivacy = useMemo(() => {
    const subtitle = playlist?.subtitle || '';
    if (subtitle.toLowerCase().includes('unlisted')) return 'UNLISTED';
    if (subtitle.toLowerCase().includes('public')) return 'PUBLIC';
    if (subtitle.toLowerCase().includes('private')) return 'PRIVATE';
    return 'PRIVATE';
  }, [playlist?.subtitle]);

  const openEditModal = useCallback(() => {
    if (!playlist) return;
    setEditTitle(playlist.title || '');
    setEditDescription(playlist.description || '');
    setEditPrivacy(derivedPrivacy);
    setEditVotePermission('UNCHANGED');
    setEditError(null);
    setEditModalVisible(true);
  }, [playlist, derivedPrivacy]);

  const closeEditModal = useCallback(() => {
    if (savingEdit) return;
    setEditModalVisible(false);
  }, [savingEdit]);

  const handleSaveEdit = useCallback(async () => {
    if (!playlist) return;
    if (!editTitle.trim()) {
      setEditError('Please enter a playlist name.');
      return;
    }

    const actions: Array<Record<string, unknown>> = [];
    const titleValue = editTitle.trim();
    const descriptionValue = editDescription.trim();

    if (titleValue !== (playlist.title || '').trim()) {
      actions.push({ action: 'ACTION_SET_PLAYLIST_NAME', playlistName: titleValue });
    }
    if (descriptionValue !== (playlist.description || '').trim()) {
      actions.push({ action: 'ACTION_SET_PLAYLIST_DESCRIPTION', playlistDescription: descriptionValue });
    }
    if (editPrivacy !== derivedPrivacy) {
      actions.push({ action: 'ACTION_SET_PLAYLIST_PRIVACY', playlistPrivacy: editPrivacy });
    }
    if (editVotePermission !== 'UNCHANGED') {
      const permissionValue = editVotePermission === 'EVERYONE'
        ? 1
        : editVotePermission === 'COLLABORATORS'
          ? 2
          : 3;
      actions.push({ action: 'ACTION_SET_ALLOW_ITEM_VOTE', itemVotePermission: permissionValue });
    }

    if (actions.length === 0) {
      setEditModalVisible(false);
      return;
    }

    setSavingEdit(true);
    setEditError(null);

    try {
      await AuthenticatedHttpClient.editPlaylist(playlistId, actions);
      await loadPlaylist();
      setEditModalVisible(false);
    } catch (error) {
      console.error('Failed to edit playlist', error);
      setEditError('Unable to save changes right now.');
    } finally {
      setSavingEdit(false);
    }
  }, [
    playlist,
    playlistId,
    editTitle,
    editDescription,
    editPrivacy,
    editVotePermission,
    derivedPrivacy,
  ]);

  const trackQueue = useMemo(() => (
    playlist?.tracks.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      thumbnail: track.thumbnail,
    })) ?? []
  ), [playlist?.tracks]);
  const trackQueueRef = useRef(trackQueue);
  useEffect(() => {
    trackQueueRef.current = trackQueue;
  }, [trackQueue]);

  const handlePlayPlaylist = useCallback(() => {
    if (!trackQueue.length) return;
    playTrack(trackQueue[0], trackQueue, {
      source: {
        type: 'playlist',
        label: playlist?.title ? `Playlist: ${playlist.title}` : 'Playlist',
        id: playlistId,
      },
    });
  }, [playTrack, playlist?.title, playlistId, trackQueue]);

  const sourceLabel = useMemo(
    () => (playlist?.title ? `Playlist: ${playlist.title}` : 'Playlist'),
    [playlist?.title]
  );

  const handlePlayTrack = useCallback((track: PlaylistTrack) => {
    playTrack({
      id: track.id,
      title: track.title,
      artist: track.artist,
      thumbnail: track.thumbnail,
    }, trackQueueRef.current, {
      source: {
        type: 'playlist',
        label: sourceLabel,
        id: playlistId,
      },
    });
  }, [playTrack, playlistId, sourceLabel]);

  const handleOpenTrackOptions = useCallback((track: {
    videoId: string;
    title: string;
    artist: string;
    thumbnail: string;
  }) => {
    openSongOptions(track);
  }, [openSongOptions]);

  const handleDownloadPlaylist = useCallback(async () => {
    if (!playlist || !trackQueue.length) return;
    const currentState = playlistDownloadStatus?.state;
    if (currentState === 'downloading' || currentState === 'queued') {
      await pausePlaylistDownload(playlistId);
      return;
    }
    if (currentState === 'paused') {
      await resumePlaylistDownload(playlistId);
      return;
    }
    await downloadPlaylist({
      playlistId,
      title: playlist.title || 'Playlist',
      thumbnail: playlist.thumbnail,
      songs: trackQueue.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail,
      })),
    });
  }, [playlist, playlistDownloadStatus?.state, playlistId, trackQueue]);
  const handleDownloadPress = useCallback(() => {
    void handleDownloadPlaylist();
  }, [handleDownloadPlaylist]);
  const headerColors = useMemo(() => ({
    surface: theme.colors.surface,
    surfaceVariant: theme.colors.surfaceVariant,
    onSurface: theme.colors.onSurface,
    onSurfaceVariant: theme.colors.onSurfaceVariant,
  }), [theme.colors.onSurface, theme.colors.onSurfaceVariant, theme.colors.surface, theme.colors.surfaceVariant]);

  const downloadButtonLabel = useMemo(() => {
    if (!playlistDownloadStatus) return 'Download';
    const progress = `${playlistDownloadStatus.completedSongs}/${playlistDownloadStatus.totalSongs}`;
    if (playlistDownloadStatus.state === 'downloading' || playlistDownloadStatus.state === 'queued') {
      return `Pause ${progress}`;
    }
    if (playlistDownloadStatus.state === 'paused') {
      return `Resume ${progress}`;
    }
    if (playlistDownloadStatus.state === 'completed') {
      return 'Downloaded';
    }
    if (playlistDownloadStatus.state === 'failed') {
      return `Retry ${progress}`;
    }
    return 'Download';
  }, [playlistDownloadStatus]);

  const renderTrack = useCallback(
    ({ item }: { item: PlaylistTrack }) => (
      <TrackRow
        item={item}
        theme={theme}
        onPressTrack={handlePlayTrack}
        onOpenTrackOptions={handleOpenTrackOptions}
      />
    ),
    [handleOpenTrackOptions, handlePlayTrack, theme]
  );

  const keyExtractor = useCallback(
    (item: PlaylistTrack) => item.playlistSetVideoId || item.id,
    []
  );

  const renderHeader = useCallback(() => (
    <PlaylistHeader
      onBack={handleBack}
      onPlay={handlePlayPlaylist}
      onDownload={handleDownloadPress}
      onEdit={openEditModal}
      onLoadMore={loadMoreSongs}
      loadingMore={loadingMore}
      canLoadMore={!!playlist?.continuationToken}
      canPlay={!!trackQueue.length}
      downloadButtonLabel={downloadButtonLabel}
      title={playlist?.title}
      subtitle={playlist?.subtitle}
      secondSubtitle={playlist?.secondSubtitle}
      description={playlist?.description}
      thumbnail={playlist?.thumbnail}
      downloadStatusText={
        playlistDownloadStatus
          ? playlistDownloadStatus.state === 'downloading' && playlistDownloadStatus.activeSongTitle
            ? `Downloading: ${playlistDownloadStatus.activeSongTitle}`
            : `Download status: ${playlistDownloadStatus.state} (${playlistDownloadStatus.completedSongs}/${playlistDownloadStatus.totalSongs}${playlistDownloadStatus.failedSongs ? `, failed ${playlistDownloadStatus.failedSongs}` : ''})`
          : undefined
      }
      colors={headerColors}
    />
  ), [downloadButtonLabel, handleBack, handleDownloadPress, handlePlayPlaylist, headerColors, loadMoreSongs, loadingMore, openEditModal, playlist?.continuationToken, playlist?.description, playlist?.secondSubtitle, playlist?.subtitle, playlist?.thumbnail, playlist?.title, playlistDownloadStatus, trackQueue.length]);

  const renderFooter = useCallback(() => {
    if (!playlist?.continuationToken) return null;
    return (
      <Button
        mode="outlined"
        onPress={loadMoreSongs}
        loading={loadingMore}
        disabled={loadingMore}
        style={styles.loadMoreButton}
      >
        {loadingMore ? 'Loading...' : 'Load more songs'}
      </Button>
    );
  }, [loadMoreSongs, loadingMore, playlist?.continuationToken]);

  async function loadMoreSongs() {
    if (!playlist?.continuationToken || loadingMore) return;
    
    setLoadingMore(true);
    const result = await PlaylistAPI.loadMoreTracks(playlist.continuationToken);
    
    if (result && result.tracks.length > 0) {
      const existingIds = new Set(playlist.tracks.map(t => `${t.id}-${t.playlistSetVideoId}`));
      const newTracks = result.tracks.filter(t => !existingIds.has(`${t.id}-${t.playlistSetVideoId}`));
      
      if (newTracks.length === 0) {
        setSnackbarVisible(true);
        setPlaylist(prev => prev ? { ...prev, continuationToken: undefined } : null);
      } else {
        setPlaylist(prev => prev ? {
          ...prev,
          tracks: [...prev.tracks, ...newTracks],
          continuationToken: result.continuationToken
        } : null);
      }
    } else if (result) {
      setPlaylist(prev => prev ? {
        ...prev,
        continuationToken: result.continuationToken
      } : null);
    }
    
    setLoadingMore(false);
  }

  const renderSkeletonTrack = (index: number) => (
    <View key={index} style={styles.trackItem}>
      <View style={[styles.skeletonThumbnail, { backgroundColor: theme.colors.surfaceVariant }]} />
      <View style={styles.trackInfo}>
        <View style={[styles.skeletonTitle, { backgroundColor: theme.colors.surfaceVariant }]} />
        <View style={[styles.skeletonArtist, { backgroundColor: theme.colors.surfaceVariant }]} />
      </View>
      <View style={[styles.skeletonDuration, { backgroundColor: theme.colors.surfaceVariant }]} />
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.surface }]} edges={['top']}>
          <View style={styles.animatedHeader}>
            <IconButton
              icon="arrow-left"
              size={24}
              iconColor={theme.colors.onSurface}
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            />
          </View>
        </SafeAreaView>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.headerContent}>
              <View style={[styles.skeletonPlaylistThumbnail, { backgroundColor: theme.colors.surfaceVariant }]} />
              
              <View style={styles.playlistInfo}>
                <View style={[styles.skeletonPlaylistTitle, { backgroundColor: theme.colors.surfaceVariant }]} />
                <View style={[styles.skeletonPlaylistSubtitle, { backgroundColor: theme.colors.surfaceVariant }]} />
                <View style={[styles.skeletonPlaylistSubtitle, { backgroundColor: theme.colors.surfaceVariant }]} />
              </View>
            </View>
            
            <View style={styles.actionButtons}>
              <View style={[styles.skeletonPlayButton, { backgroundColor: theme.colors.surfaceVariant }]} />
              <View style={[styles.skeletonIconButton, { backgroundColor: theme.colors.surfaceVariant }]} />
            </View>
          </View>
          
          <View style={[styles.tracksContainer, { backgroundColor: theme.colors.background }]}>
            {Array.from({ length: 8 }, (_, i) => renderSkeletonTrack(i))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!playlist) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loading}>
          <Text>Playlist not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Animated Header */}
      <Animated.View 
        style={[
          styles.animatedHeader,
          {
            backgroundColor: theme.colors.surface,
            opacity: scrollY.interpolate({
              inputRange: [200, 250],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
          }
        ]}
      >
        <Appbar.Header style={{ backgroundColor: 'transparent' }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={playlist?.title || ''} />
          <Appbar.Action icon="pencil" onPress={openEditModal} />
        </Appbar.Header>
      </Animated.View>

      <AnimatedFlashList
        data={playlist.tracks}
        renderItem={renderTrack}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        estimatedItemSize={TRACK_ROW_HEIGHT}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        getItemType={() => 'track'}
        overrideItemLayout={(layout) => { layout.size = TRACK_ROW_HEIGHT; }}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[styles.listContent, { backgroundColor: theme.colors.background }]}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
      />

      <Portal>
        <Modal
          visible={editModalVisible}
          onDismiss={closeEditModal}
          contentContainerStyle={[styles.editModal, { backgroundColor: theme.colors.surface }]}
        >
          <ScrollView contentContainerStyle={styles.editModalContent}>
            <Text variant="titleLarge" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Edit playlist
            </Text>

            <TextInput
              label="Playlist name"
              mode="outlined"
              value={editTitle}
              onChangeText={setEditTitle}
              autoCapitalize="sentences"
              autoCorrect={false}
              style={styles.modalInput}
            />

            <TextInput
              label="Description"
              mode="outlined"
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
              numberOfLines={3}
              style={styles.modalInput}
            />

            <Text variant="titleSmall" style={[styles.modalSectionTitle, { color: theme.colors.onSurface }]}>
              Privacy
            </Text>
            <RadioButton.Group
              onValueChange={(value) => setEditPrivacy(value as 'PUBLIC' | 'UNLISTED' | 'PRIVATE')}
              value={editPrivacy}
            >
              <View style={styles.radioRow}>
                <RadioButton value="PRIVATE" />
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Private</Text>
              </View>
              <View style={styles.radioRow}>
                <RadioButton value="UNLISTED" />
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Unlisted</Text>
              </View>
              <View style={styles.radioRow}>
                <RadioButton value="PUBLIC" />
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Public</Text>
              </View>
            </RadioButton.Group>

            <Text variant="titleSmall" style={[styles.modalSectionTitle, { color: theme.colors.onSurface }]}>
              Voting
            </Text>
            <RadioButton.Group
              onValueChange={(value) => setEditVotePermission(value as 'UNCHANGED' | 'EVERYONE' | 'COLLABORATORS' | 'OFF')}
              value={editVotePermission}
            >
              <View style={styles.radioRow}>
                <RadioButton value="UNCHANGED" />
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Keep current</Text>
              </View>
              <View style={styles.radioRow}>
                <RadioButton value="EVERYONE" />
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Everyone</Text>
              </View>
              <View style={styles.radioRow}>
                <RadioButton value="COLLABORATORS" />
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Collaborators only</Text>
              </View>
              <View style={styles.radioRow}>
                <RadioButton value="OFF" />
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Off</Text>
              </View>
            </RadioButton.Group>

            <HelperText type="error" visible={!!editError}>
              {editError}
            </HelperText>

            <View style={styles.modalActions}>
              <Button
                mode="text"
                onPress={closeEditModal}
                disabled={savingEdit}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSaveEdit}
                loading={savingEdit}
                disabled={savingEdit}
              >
                Save
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
      
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        No more songs available
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 12,
  },
  skeletonTitle: {
    height: 16,
    width: '70%',
    borderRadius: 4,
    marginBottom: 6,
  },
  skeletonArtist: {
    height: 14,
    width: '50%',
    borderRadius: 4,
  },
  skeletonDuration: {
    height: 14,
    width: 30,
    borderRadius: 4,
    marginRight: 8,
  },
  skeletonPlaylistThumbnail: {
    width: 200,
    height: 200,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 16,
  },
  skeletonPlaylistTitle: {
    height: 24,
    width: '80%',
    borderRadius: 4,
    marginBottom: 8,
    alignSelf: 'center',
  },
  skeletonPlaylistSubtitle: {
    height: 16,
    width: '60%',
    borderRadius: 4,
    marginBottom: 4,
    alignSelf: 'center',
  },
  skeletonPlayButton: {
    height: 40,
    width: 80,
    borderRadius: 24,
    marginRight: 8,
  },
  skeletonIconButton: {
    height: 40,
    width: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  header: {
    paddingBottom: 24,
  },
  editModal: {
    margin: 20,
    borderRadius: 16,
    maxHeight: '80%',
  },
  editModalContent: {
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    marginBottom: 8,
  },
  modalInput: {
    marginBottom: 4,
  },
  modalSectionTitle: {
    marginTop: 4,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  headerContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  playlistThumbnail: {
    width: 200,
    height: 200,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 16,
  },
  playlistInfo: {
    alignItems: 'center',
    gap: 4,
  },
  playlistTitle: {
    fontWeight: '600',
    textAlign: 'center',
  },
  playlistSubtitle: {
    textAlign: 'center',
  },
  playlistSecondSubtitle: {
    textAlign: 'center',
  },
  playlistDescription: {
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 24,
    gap: 8,
  },
  playButton: {
    borderRadius: 24,
  },
  downloadButton: {
    borderRadius: 24,
  },
  downloadStatusText: {
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 16,
    fontSize: 12,
  },
  loadMoreInlineWrap: {
    marginTop: 4,
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 120,
  },
  headerSpacer: {
    height: 16,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  trackThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 12,
  },
  trackInfo: {
    flex: 1,
    gap: 2,
  },
  trackTitle: {
    fontWeight: '500',
  },
  trackArtist: {
    fontSize: 13,
  },
  trackDuration: {
    fontSize: 12,
    marginRight: 8,
  },
  loadMoreButton: {
    margin: 16,
    borderRadius: 24,
  },
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 4,
  },
});
