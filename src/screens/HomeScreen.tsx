import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, Share, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ActivityIndicator, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { AuthenticatedHttpClient } from '../utils/authenticatedHttpClient';
import {
  parseHomeFeed,
  parseHomeFeedContinuation,
  type HomeFeedItem,
  type HomeFeedSection,
} from '../utils/homeFeedParser';
import { readCachedHomeFeed, writeCachedHomeFeed } from '../utils/homeFeedCache';
import { usePlayer } from '../contexts/PlayerContext';
import { PlaylistAPI } from '../../api/playlist';

const HomeScreen = React.memo(() => {
  const theme = useTheme();
  const navigation = useNavigation();
  const { playTrack } = usePlayer();
  const { width } = useWindowDimensions();
  const [sections, setSections] = useState<HomeFeedSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [continuationToken, setContinuationToken] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [communityPreviewMap, setCommunityPreviewMap] = useState<
    Record<string, { loading: boolean; tracks: Array<{ id: string; title: string; artist: string; thumbnail: string }> }>
  >({});
  const songStackPageWidth = 320;
  const songStackSnapInterval = songStackPageWidth + 8;
  const discoverPageWidth = Math.round(width * 0.84);

  const loadRemote = useCallback(async () => {
    const response = await AuthenticatedHttpClient.getRecommendations();
    const parsed = parseHomeFeed(response);
    if (!parsed.sections.length) throw new Error('Empty home feed response');
    setSections(parsed.sections);
    setContinuationToken(parsed.continuationToken);
    setError(null);
    await writeCachedHomeFeed(parsed.sections, parsed.continuationToken);
  }, []);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      setLoading(true);
      const cached = await readCachedHomeFeed();
      if (!mounted) return;

      if (cached.sections.length) {
        setSections(cached.sections);
        setContinuationToken(cached.continuationToken);
        setLoading(false);
        // Refresh in background to keep feed current.
        void loadRemote().catch(() => {
          // Keep cached feed silently.
        });
        return;
      }

      try {
        await loadRemote();
      } catch (err) {
        if (mounted) setError('Unable to load home feed.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [loadRemote]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadRemote();
    } catch {
      // Keep current state
    } finally {
      setRefreshing(false);
    }
  }, [loadRemote]);

  const normalizePlaylistId = useCallback((playlistId: string) => {
    if (!playlistId) return playlistId;
    if (playlistId.startsWith('VL')) return playlistId.slice(2);
    return playlistId;
  }, []);

  const ensureCommunityPreview = useCallback(
    async (playlistId: string) => {
      if (!playlistId) return;
      const normalized = normalizePlaylistId(playlistId);
      if (!normalized) return;
      if (communityPreviewMap[normalized]?.loading || communityPreviewMap[normalized]?.tracks?.length) return;

      setCommunityPreviewMap((prev) => ({
        ...prev,
        [normalized]: {
          loading: true,
          tracks: prev[normalized]?.tracks || [],
        },
      }));

      try {
        const details = await PlaylistAPI.getPlaylistDetails(normalized);
        const tracks =
          details?.tracks?.slice(0, 3).map((track) => ({
            id: track.id,
            title: track.title,
            artist: track.artist,
            thumbnail: track.thumbnail,
          })) || [];
        setCommunityPreviewMap((prev) => ({
          ...prev,
          [normalized]: {
            loading: false,
            tracks,
          },
        }));
      } catch {
        setCommunityPreviewMap((prev) => ({
          ...prev,
          [normalized]: {
            loading: false,
            tracks: prev[normalized]?.tracks || [],
          },
        }));
      }
    },
    [communityPreviewMap, normalizePlaylistId]
  );

  useEffect(() => {
    const communitySection = sections.find((section) => section.layout === 'community');
    if (!communitySection) return;
    communitySection.items
      .filter((item) => item.type === 'playlist')
      .slice(0, 14)
      .forEach((item) => {
        void ensureCommunityPreview(item.id);
      });
  }, [ensureCommunityPreview, sections]);

  const loadMore = useCallback(async () => {
    if (!continuationToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await AuthenticatedHttpClient.getRecommendationsContinuation(continuationToken);
      const parsed = parseHomeFeedContinuation(response);
      if (!parsed.sections.length) {
        setContinuationToken(undefined);
        return;
      }
      setSections((prev) => {
        const existing = new Set(prev.map((section) => `${section.title}:${section.items[0]?.id || ''}`));
        const next = parsed.sections.filter(
          (section) => !existing.has(`${section.title}:${section.items[0]?.id || ''}`)
        );
        const merged = [...prev, ...next];
        void writeCachedHomeFeed(merged, parsed.continuationToken);
        return merged;
      });
      setContinuationToken(parsed.continuationToken);
    } catch {
      // Keep token so user can retry by scrolling.
    } finally {
      setLoadingMore(false);
    }
  }, [continuationToken, loadingMore]);

  const handleItemPress = useCallback((item: HomeFeedItem, section: HomeFeedSection) => {
    if (item.type === 'song' || item.type === 'video') {
      playTrack(
        {
          id: item.id,
          title: item.title,
          artist: item.artist || item.subtitle || 'Unknown Artist',
          artistId: item.artistIds?.[0],
          artists: (item.artist || '')
            .split(/\s*(?:,|&|and| x | · |\/|feat\.?|ft\.?)\s*/i)
            .map((name) => name.trim())
            .filter(Boolean)
            .map((name, index) => ({ name, id: item.artistIds?.[index] })),
          thumbnail: item.thumbnail || '',
        },
        undefined,
        {
          source: {
            type: 'queue',
            label: section.title,
            ytQueuePlaylistId: item.watchPlaylistId,
            ytQueueParams: item.watchParams,
          },
        }
      );
      return;
    }

    if (item.type === 'album') {
      navigation.navigate('Album' as never, { albumId: item.id } as never);
      return;
    }
    if (item.type === 'artist') {
      navigation.navigate('Artist' as never, { artistId: item.id, artistName: item.title } as never);
      return;
    }
    if (item.type === 'profile') {
      navigation.navigate(
        'Profile' as never,
        {
          profileData: {
            title: item.title,
            description: item.subtitle || '',
            thumbnail: item.thumbnail || '',
            bannerThumbnail: '',
            subscriberCount: '',
            isSubscribed: false,
            channelId: item.id,
            sections: [],
          },
        } as never
      );
      return;
    }
    if (item.type === 'playlist') {
      navigation.navigate('Playlist' as never, { playlistId: item.id } as never);
      return;
    }
    if (item.type === 'podcast' || item.type === 'episode') {
      navigation.navigate('Podcast' as never, { podcastId: item.id, title: item.title } as never);
      return;
    }
    // Fallback for channel-like entries that parser marks as unknown.
    if (item.id?.startsWith('UC')) {
      navigation.navigate('Artist' as never, { artistId: item.id, artistName: item.title } as never);
    }
  }, [navigation, playTrack]);

  const renderItemCard = useCallback(
    ({ item, section }: { item: HomeFeedItem; section: HomeFeedSection }) => (
      <TouchableOpacity activeOpacity={0.82} onPress={() => handleItemPress(item, section)} style={styles.itemWrap}>
        <Surface style={[styles.itemCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={styles.itemThumb} />
          ) : (
            <View style={[styles.itemThumb, { backgroundColor: theme.colors.surfaceVariant }]} />
          )}
          <Text numberOfLines={2} style={[styles.itemTitle, { color: theme.colors.onSurface }]}>
            {item.title}
          </Text>
          <Text numberOfLines={2} style={[styles.itemSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            {item.artist || item.subtitle || ''}
          </Text>
        </Surface>
      </TouchableOpacity>
    ),
    [handleItemPress, theme.colors.onSurface, theme.colors.onSurfaceVariant, theme.colors.surface, theme.colors.surfaceVariant]
  );

  const renderSongStackCard = useCallback(
    ({ items, section }: { items: HomeFeedItem[]; section: HomeFeedSection }) => (
      <Surface style={[styles.songStackCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        {items.map((entry, index) => (
          <TouchableOpacity
            key={`${entry.id}-${index}`}
            activeOpacity={0.82}
            onPress={() => handleItemPress(entry, section)}
            style={styles.songRowTouch}
          >
            <View style={styles.songRow}>
              {entry.thumbnail ? (
                <Image source={{ uri: entry.thumbnail }} style={styles.songThumb} />
              ) : (
                <View style={[styles.songThumb, { backgroundColor: theme.colors.surfaceVariant }]} />
              )}
              <View style={styles.songMeta}>
                <Text numberOfLines={1} style={[styles.songTitle, { color: theme.colors.onSurface }]}>
                  {entry.title}
                </Text>
                <Text numberOfLines={1} style={[styles.songSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {entry.artist || entry.subtitle || ''}
                </Text>
              </View>
            </View>
            {index < items.length - 1 ? (
              <View style={[styles.songDivider, { backgroundColor: theme.colors.outlineVariant }]} />
            ) : null}
          </TouchableOpacity>
        ))}
      </Surface>
    ),
    [handleItemPress, theme.colors.onSurface, theme.colors.onSurfaceVariant, theme.colors.outlineVariant, theme.colors.surface, theme.colors.surfaceVariant]
  );

  const renderArtistCard = useCallback(
    ({ item, section }: { item: HomeFeedItem; section: HomeFeedSection }) => (
      <TouchableOpacity activeOpacity={0.82} onPress={() => handleItemPress(item, section)} style={styles.artistItemWrap}>
        <View style={styles.artistCard}>
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={styles.artistThumb} />
          ) : (
            <View style={[styles.artistThumb, { backgroundColor: theme.colors.surfaceVariant }]} />
          )}
          <Text numberOfLines={2} style={[styles.artistTitle, { color: theme.colors.onSurface }]}>
            {item.title}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [handleItemPress, theme.colors.onSurface, theme.colors.surfaceVariant]
  );

  const renderLandscapeCard = useCallback(
    ({ item, section }: { item: HomeFeedItem; section: HomeFeedSection }) => (
      <TouchableOpacity activeOpacity={0.82} onPress={() => handleItemPress(item, section)} style={styles.landscapeItemWrap}>
        <Surface style={[styles.landscapeCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={styles.landscapeThumb} />
          ) : (
            <View style={[styles.landscapeThumb, { backgroundColor: theme.colors.surfaceVariant }]} />
          )}
          <Text numberOfLines={2} style={[styles.itemTitle, { color: theme.colors.onSurface }]}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={[styles.itemSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            {item.artist || item.subtitle || ''}
          </Text>
        </Surface>
      </TouchableOpacity>
    ),
    [handleItemPress, theme.colors.onSurface, theme.colors.onSurfaceVariant, theme.colors.surface, theme.colors.surfaceVariant]
  );

  const renderDiscoverCard = useCallback(
    ({ item, section }: { item: HomeFeedItem; section: HomeFeedSection }) => (
      <TouchableOpacity
        activeOpacity={0.84}
        onPress={() => handleItemPress(item, section)}
        style={styles.discoverWrap}
      >
        <Surface
          style={[
            styles.discoverCard,
            {
              width: discoverPageWidth,
              backgroundColor: theme.colors.surface,
            },
          ]}
          elevation={2}
        >
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={styles.discoverThumb} />
          ) : (
            <View style={[styles.discoverThumb, { backgroundColor: theme.colors.surfaceVariant }]} />
          )}
          <View style={styles.discoverMeta}>
            <Text numberOfLines={2} style={[styles.discoverTitle, { color: theme.colors.onSurface }]}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={[styles.discoverSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {item.artist || item.subtitle || ''}
            </Text>
          </View>
        </Surface>
      </TouchableOpacity>
    ),
    [discoverPageWidth, handleItemPress, theme.colors.onSurface, theme.colors.onSurfaceVariant, theme.colors.surface, theme.colors.surfaceVariant]
  );

  const speedDialPageWidth = Math.round(width * 0.84);
  const speedDialCellWidth = Math.floor((speedDialPageWidth - 32) / 3);

  const renderSpeedDialPage = useCallback(
    ({ items, section }: { items: HomeFeedItem[]; section: HomeFeedSection }) => (
      <View style={styles.speedDialWrap}>
        <Surface
          style={[
            styles.speedDialPage,
            {
              width: speedDialPageWidth,
              backgroundColor: theme.colors.surfaceVariant,
            },
          ]}
          elevation={2}
        >
          <View style={styles.speedDialGrid}>
            {items.map((entry, index) => (
              <TouchableOpacity
                key={`${entry.id}-${index}`}
                activeOpacity={0.82}
                onPress={() => handleItemPress(entry, section)}
                style={[styles.speedDialCell, { width: speedDialCellWidth }]}
              >
                {entry.thumbnail ? (
                  <Image source={{ uri: entry.thumbnail }} style={styles.speedDialCellThumb} />
                ) : (
                  <View style={[styles.speedDialCellThumb, { backgroundColor: theme.colors.surface }]} />
                )}
                <Text numberOfLines={1} style={[styles.speedDialCellTitle, { color: theme.colors.onSurface }]}>
                  {entry.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Surface>
      </View>
    ),
    [handleItemPress, speedDialCellWidth, speedDialPageWidth, theme.colors.onSurface, theme.colors.surface, theme.colors.surfaceVariant]
  );

  const handlePlayCommunityPlaylist = useCallback(
    (item: HomeFeedItem) => {
      const normalized = normalizePlaylistId(item.id);
      const preview = communityPreviewMap[normalized]?.tracks || [];
      if (!preview.length) return;
      const queue = preview.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist || 'Unknown Artist',
        thumbnail: track.thumbnail || item.thumbnail || '',
      }));
      playTrack(queue[0], queue, {
        source: {
          type: 'playlist',
          label: item.title,
          id: normalized,
        },
      });
    },
    [communityPreviewMap, normalizePlaylistId, playTrack]
  );

  const handleShareCommunityPlaylist = useCallback(async (item: HomeFeedItem) => {
    const normalized = normalizePlaylistId(item.id);
    const url = `https://music.youtube.com/playlist?list=${normalized}`;
    try {
      await Share.share({
        message: `Listen to "${item.title}" on YouTube Music: ${url}`,
      });
    } catch {
      // no-op
    }
  }, [normalizePlaylistId]);

  const renderCommunityCard = useCallback(
    ({ item, section }: { item: HomeFeedItem; section: HomeFeedSection }) => {
      const normalized = normalizePlaylistId(item.id);
      const preview = communityPreviewMap[normalized];
      const tracks = preview?.tracks || [];
      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handleItemPress(item, section)}
          style={styles.communityItemWrap}
        >
          <Surface style={[styles.communityCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={2}>
            <View style={styles.communityHeader}>
              {item.thumbnail ? (
                <Image source={{ uri: item.thumbnail }} style={styles.communityCover} />
              ) : (
                <View style={[styles.communityCover, { backgroundColor: theme.colors.surfaceVariant }]} />
              )}
              <View style={styles.communityHeaderMeta}>
                <Text numberOfLines={2} style={[styles.communityTitle, { color: theme.colors.onSurface }]}>
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={[styles.communitySubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {item.subtitle || 'From the community'}
                </Text>
              </View>
            </View>

            <View style={styles.communitySongs}>
              {tracks.length ? (
                tracks.map((track, index) => (
                  <TouchableOpacity
                    key={`${track.id}-${index}`}
                    onPress={() => {
                      const queue = tracks.map((entry) => ({
                        id: entry.id,
                        title: entry.title,
                        artist: entry.artist || 'Unknown Artist',
                        thumbnail: entry.thumbnail || item.thumbnail || '',
                      }));
                      playTrack(queue[index], queue, {
                        source: {
                          type: 'playlist',
                          label: item.title,
                          id: normalized,
                        },
                      });
                    }}
                    style={styles.communitySongRow}
                    activeOpacity={0.75}
                  >
                    {track.thumbnail ? (
                      <Image source={{ uri: track.thumbnail }} style={styles.communitySongThumb} />
                    ) : (
                      <View style={[styles.communitySongThumb, { backgroundColor: theme.colors.surfaceVariant }]} />
                    )}
                    <Text numberOfLines={1} style={[styles.communitySongIndex, { color: theme.colors.onSurfaceVariant }]}>
                      {index + 1}
                    </Text>
                    <Text numberOfLines={1} style={[styles.communitySongTitle, { color: theme.colors.onSurface }]}>
                      {track.title}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.communityLoadingWrap}>
                  {preview?.loading ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <Text style={{ color: theme.colors.onSurfaceVariant }}>No preview songs</Text>
                  )}
                </View>
              )}
            </View>

            <View style={styles.communityActions}>
              <IconButton
                icon="play"
                size={20}
                mode="contained"
                containerColor={theme.colors.primaryContainer}
                iconColor={theme.colors.onPrimaryContainer}
                onPress={() => handlePlayCommunityPlaylist(item)}
                disabled={!tracks.length}
              />
              <IconButton
                icon="share-variant"
                size={20}
                mode="contained-tonal"
                onPress={() => void handleShareCommunityPlaylist(item)}
              />
            </View>
          </Surface>
        </TouchableOpacity>
      );
    },
    [
      communityPreviewMap,
      handleItemPress,
      handlePlayCommunityPlaylist,
      handleShareCommunityPlaylist,
      normalizePlaylistId,
      playTrack,
      theme.colors.onPrimaryContainer,
      theme.colors.onSurface,
      theme.colors.onSurfaceVariant,
      theme.colors.primary,
      theme.colors.primaryContainer,
      theme.colors.surface,
    ]
  );

  const renderSection = useCallback(
    ({ item }: { item: HomeFeedSection }) => {
      const songStacks =
        item.layout === 'song'
          ? item.items.reduce<HomeFeedItem[][]>((acc, entry, index) => {
              const groupIndex = Math.floor(index / 3);
              if (!acc[groupIndex]) acc[groupIndex] = [];
              acc[groupIndex].push(entry);
              return acc;
            }, [])
          : [];
      const speedDialPages =
        item.layout === 'speed-dial'
          ? item.items.reduce<HomeFeedItem[][]>((acc, entry, index) => {
              const groupIndex = Math.floor(index / 9);
              if (!acc[groupIndex]) acc[groupIndex] = [];
              acc[groupIndex].push(entry);
              return acc;
            }, [])
          : [];

      return (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>{item.title}</Text>
          <FlashList
            data={item.layout === 'song' ? songStacks : item.layout === 'speed-dial' ? speedDialPages : item.items}
            horizontal
            estimatedItemSize={
              item.layout === 'community'
                ? 320
                : item.layout === 'discover'
                  ? discoverPageWidth
                : item.layout === 'speed-dial'
                  ? speedDialPageWidth
                  : item.layout === 'song'
                    ? songStackPageWidth
                    : item.layout === 'artist'
                      ? 130
                      : item.layout === 'landscape'
                        ? 220
                        : 166
            }
            keyExtractor={(entry: any, index) =>
              item.layout === 'song'
                ? `stack-${(entry as HomeFeedItem[]).map((song) => song.id).join('-')}-${index}`
                : item.layout === 'speed-dial'
                  ? `speeddial-${(entry as HomeFeedItem[]).map((song) => song.id).join('-')}-${index}`
                : `${(entry as HomeFeedItem).id}-${index}`
            }
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sectionRow}
            decelerationRate={item.layout === 'speed-dial' || item.layout === 'song' || item.layout === 'discover' ? 'fast' : 'normal'}
            snapToInterval={
              item.layout === 'speed-dial'
                ? speedDialPageWidth + 12
                : item.layout === 'song'
                  ? songStackSnapInterval
                  : item.layout === 'discover'
                    ? discoverPageWidth + 12
                  : undefined
            }
            snapToAlignment={item.layout === 'speed-dial' || item.layout === 'song' || item.layout === 'discover' ? 'start' : undefined}
            disableIntervalMomentum={item.layout === 'speed-dial' || item.layout === 'song' || item.layout === 'discover'}
            renderItem={({ item: feedItem }) => {
              if (item.layout === 'song') {
                return renderSongStackCard({ items: feedItem as HomeFeedItem[], section: item });
              }
              if (item.layout === 'discover') {
                return renderDiscoverCard({ item: feedItem as HomeFeedItem, section: item });
              }
              if (item.layout === 'community') {
                return renderCommunityCard({ item: feedItem as HomeFeedItem, section: item });
              }
              if (item.layout === 'speed-dial') {
                return renderSpeedDialPage({ items: feedItem as HomeFeedItem[], section: item });
              }
              if (item.layout === 'artist') return renderArtistCard({ item: feedItem as HomeFeedItem, section: item });
              if (item.layout === 'landscape') return renderLandscapeCard({ item: feedItem as HomeFeedItem, section: item });
              return renderItemCard({ item: feedItem as HomeFeedItem, section: item });
            }}
          />
        </View>
      );
    },
    [discoverPageWidth, renderArtistCard, renderCommunityCard, renderDiscoverCard, renderItemCard, renderLandscapeCard, renderSongStackCard, renderSpeedDialPage, songStackPageWidth, songStackSnapInterval, speedDialPageWidth, theme.colors.onBackground]
  );

  const listEmpty = useMemo(() => !loading && !sections.length, [loading, sections.length]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlashList
        data={sections}
        estimatedItemSize={260}
        keyExtractor={(section, index) => `${section.title}-${index}`}
        contentContainerStyle={styles.listContent}
        onEndReachedThreshold={0.45}
        onEndReached={() => {
          void loadMore();
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={theme.colors.primary}
          />
        }
        renderItem={renderSection}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          listEmpty ? (
            <View style={styles.empty}>
              <Text style={{ color: theme.colors.onSurface }}>{error || 'No home feed available.'}</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
});

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionRow: {
    paddingHorizontal: 12,
  },
  itemWrap: {
    width: 164,
    marginHorizontal: 4,
  },
  itemCard: {
    borderRadius: 14,
    padding: 8,
  },
  itemThumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12,
  },
  songStackCard: {
    width: 320,
    marginHorizontal: 4,
    borderRadius: 12,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  songRowTouch: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  songThumb: {
    width: 58,
    height: 58,
    borderRadius: 8,
  },
  songMeta: {
    flex: 1,
  },
  songDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 6,
  },
  songTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  songSubtitle: {
    fontSize: 12,
  },
  artistItemWrap: {
    width: 126,
    marginHorizontal: 4,
  },
  artistCard: {
    alignItems: 'center',
  },
  artistThumb: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginBottom: 8,
  },
  artistTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  landscapeItemWrap: {
    width: 218,
    marginHorizontal: 4,
  },
  landscapeCard: {
    borderRadius: 14,
    padding: 8,
  },
  communityItemWrap: {
    width: 320,
    marginHorizontal: 4,
  },
  communityCard: {
    borderRadius: 16,
    padding: 12,
  },
  communityHeader: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  communityHeaderMeta: {
    flex: 1,
  },
  communityCover: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  communityTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  communitySubtitle: {
    fontSize: 12,
  },
  communitySongs: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  communitySongRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  communitySongThumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  communitySongIndex: {
    width: 16,
    fontSize: 12,
    fontWeight: '700',
  },
  communitySongTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  communityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  communityLoadingWrap: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  discoverWrap: {
    marginHorizontal: 6,
  },
  discoverCard: {
    borderRadius: 18,
    padding: 10,
  },
  discoverThumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    marginBottom: 10,
  },
  discoverMeta: {
    paddingHorizontal: 2,
  },
  discoverTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 3,
  },
  discoverSubtitle: {
    fontSize: 12,
  },
  speedDialWrap: {
    marginHorizontal: 6,
  },
  speedDialPage: {
    borderRadius: 18,
    padding: 10,
  },
  speedDialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  speedDialCell: {
    alignItems: 'center',
  },
  speedDialCellThumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 6,
  },
  speedDialCellTitle: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  landscapeThumb: {
    width: '100%',
    height: 122,
    borderRadius: 12,
    marginBottom: 8,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  footerLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
