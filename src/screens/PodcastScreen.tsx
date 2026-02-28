import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { ActivityIndicator, Appbar, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { PodcastAPI, PodcastDetails, PodcastEpisode } from '../../api/podcast';
import { usePlayer } from '../contexts/PlayerContext';

interface PodcastScreenProps {
  route: {
    params: {
      podcastId: string;
      title?: string;
    };
  };
  navigation: any;
}

export default function PodcastScreen({ route, navigation }: PodcastScreenProps) {
  const { podcastId, title: initialTitle } = route.params;
  const theme = useTheme();
  const { playTrack } = usePlayer();
  const [podcast, setPodcast] = useState<PodcastDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPodcast = useCallback(async () => {
    try {
      setError(null);
      const details = await PodcastAPI.getPodcastDetails(podcastId);
      if (!details) {
        setError('Unable to load this podcast.');
        return;
      }
      setPodcast(details);
    } catch {
      setError('Unable to load this podcast.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [podcastId]);

  useEffect(() => {
    setLoading(true);
    void loadPodcast();
  }, [loadPodcast]);

  const playableQueue = useMemo(
    () =>
      (podcast?.episodes || [])
        .filter((episode) => !!episode.videoId)
        .map((episode) => ({
          id: episode.videoId as string,
          title: episode.title,
          artist: podcast?.title || initialTitle || 'Podcast',
          thumbnail: episode.thumbnail || podcast?.thumbnail || '',
        })),
    [podcast, initialTitle]
  );

  const handleEpisodePress = useCallback((episode: PodcastEpisode) => {
    if (!episode.videoId) return;
    const queueIndex = playableQueue.findIndex((track) => track.id === episode.videoId);
    if (queueIndex < 0) return;

    playTrack(playableQueue[queueIndex], playableQueue, {
      source: {
        type: 'queue',
        label: podcast?.title || initialTitle || 'Podcast',
        id: podcast?.id || podcastId,
      },
    });
  }, [playTrack, playableQueue, podcast, initialTitle, podcastId]);

  const renderEpisode = useCallback(
    ({ item }: { item: PodcastEpisode }) => (
      <TouchableOpacity
        activeOpacity={0.72}
        onPress={() => handleEpisodePress(item)}
        disabled={!item.videoId}
        style={[
          styles.episodeRow,
          {
            opacity: item.videoId ? 1 : 0.6,
            borderBottomColor: theme.colors.outlineVariant,
          },
        ]}
      >
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.episodeThumb} />
        ) : (
          <View style={[styles.episodeThumb, { backgroundColor: theme.colors.surfaceVariant }]} />
        )}

        <View style={styles.episodeContent}>
          <Text variant="titleSmall" numberOfLines={2} style={{ color: theme.colors.onSurface }}>
            {item.title}
          </Text>
          {!!item.subtitle && (
            <Text variant="bodySmall" numberOfLines={2} style={{ color: theme.colors.onSurfaceVariant }}>
              {item.subtitle}
            </Text>
          )}
        </View>

        <View style={styles.episodeMeta}>
          {!!item.duration && (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {item.duration}
            </Text>
          )}
          <IconButton
            icon={item.videoId ? 'play-circle-outline' : 'information-outline'}
            size={22}
            iconColor={theme.colors.onSurfaceVariant}
            disabled={!item.videoId}
            onPress={() => handleEpisodePress(item)}
          />
        </View>
      </TouchableOpacity>
    ),
    [handleEpisodePress, theme.colors.onSurface, theme.colors.onSurfaceVariant, theme.colors.outlineVariant, theme.colors.surfaceVariant]
  );

  const renderHeader = useMemo(
    () => (
      <View style={styles.headerWrap}>
        {podcast?.thumbnail ? (
          <Image source={{ uri: podcast.thumbnail }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, { backgroundColor: theme.colors.surfaceVariant }]} />
        )}
        <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>
          {podcast?.title || initialTitle || 'Podcast'}
        </Text>
        {!!podcast?.subtitle && (
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            {podcast.subtitle}
          </Text>
        )}
        {!!podcast?.description && (
          <Text variant="bodySmall" style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
            {podcast.description}
          </Text>
        )}
      </View>
    ),
    [podcast, initialTitle, theme.colors.onSurface, theme.colors.onSurfaceVariant, theme.colors.surfaceVariant]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      <Appbar.Header mode="center-aligned" statusBarHeight={0}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={podcast?.title || initialTitle || 'Podcast'} />
      </Appbar.Header>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => {
            setRefreshing(true);
            void loadPodcast();
          }}>
            <Text style={{ color: theme.colors.primary, marginTop: 12 }}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlashList
          data={podcast?.episodes || []}
          renderItem={renderEpisode}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          estimatedItemSize={86}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <Surface style={[styles.emptyCard, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>No episodes found.</Text>
            </Surface>
          }
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadPodcast();
          }}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  listContent: {
    paddingBottom: 20,
  },
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  cover: {
    width: 164,
    height: 164,
    borderRadius: 14,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    lineHeight: 18,
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  episodeThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  episodeContent: {
    flex: 1,
    gap: 4,
  },
  episodeMeta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  emptyCard: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
  },
});
