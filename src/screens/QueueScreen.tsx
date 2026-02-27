import React, { useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, InteractionManager, BackHandler } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Appbar, Text, useTheme, Surface, Divider, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePlayer } from '../contexts/PlayerContext';

interface QueueScreenProps {
  navigation?: any;
  embedded?: boolean;
  onClose?: () => void;
}

export default function QueueScreen({ navigation, embedded = false, onClose }: QueueScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { queue, currentIndex, currentTrack, playTrack, playbackSource } = usePlayer();
  const closeToPlayer = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }
    if (typeof navigation?.canGoBack === 'function' && navigation.canGoBack() && typeof navigation?.goBack === 'function') {
      navigation.goBack();
      return;
    }
    if (typeof navigation?.replace === 'function') {
      navigation.replace('Player');
      return;
    }
    navigation?.navigate?.('Player');
  }, [navigation, onClose]);

  useEffect(() => {
    if (embedded) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeToPlayer();
      return true;
    });
    return () => sub.remove();
  }, [closeToPlayer, embedded]);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      const targets = queue
        .slice(0, 16)
        .map((track) => track.thumbnail)
        .filter(Boolean);
      targets.forEach((uri) => {
        if (cancelled) return;
        void Image.prefetch(uri).catch(() => {
          // no-op
        });
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [queue]);

  const sourceLabel = useMemo(
    () => playbackSource?.label?.trim() || 'Now playing',
    [playbackSource?.label]
  );
  const getArtistLabel = useCallback((track: any) => {
    const artists = (track?.artists || [])
      .map((item: any) => item?.name?.trim())
      .filter(Boolean);
    if (artists.length) return artists.join(', ');
    return track?.artist || 'Unknown Artist';
  }, []);

  const nextTrack = queue[currentIndex + 1];
  const remainingAfterNext = Math.max(queue.length - currentIndex - 2, 0);

  const handleSelectTrack = useCallback(
    (index: number) => {
      const selected = queue[index];
      if (!selected) return;
      playTrack(selected, queue, { source: playbackSource });
      if (embedded && onClose) {
        onClose();
      }
    },
    [embedded, onClose, playTrack, playbackSource, queue]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: (typeof queue)[number]; index: number }) => {
      const isCurrent = index === currentIndex;
      const isPlayed = index < currentIndex;

      return (
        <TouchableOpacity onPress={() => handleSelectTrack(index)} activeOpacity={0.82}>
          <Surface
            style={[
              styles.row,
              {
                backgroundColor: isCurrent ? theme.colors.primaryContainer : theme.colors.surface,
                borderColor: isCurrent ? theme.colors.primary : theme.colors.outlineVariant,
              },
            ]}
            elevation={isCurrent ? 3 : 1}
          >
            <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
            <View style={styles.meta}>
              <Text
                numberOfLines={1}
                style={[
                  styles.title,
                  {
                    color: isCurrent ? theme.colors.onPrimaryContainer : theme.colors.onSurface,
                    opacity: isPlayed ? 0.7 : 1,
                  },
                ]}
              >
                {item.title}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.artist,
                  {
                    color: isCurrent ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                {getArtistLabel(item)}
              </Text>
            </View>
            {isCurrent ? (
              <MaterialCommunityIcons name="volume-high" size={20} color={theme.colors.primary} />
            ) : (
              <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '700' }}>{index + 1}</Text>
            )}
          </Surface>
        </TouchableOpacity>
      );
    },
    [currentIndex, getArtistLabel, handleSelectTrack, theme.colors]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <View style={{ paddingTop: insets.top, backgroundColor: theme.colors.surface }}>
        <Appbar.Header style={{ backgroundColor: theme.colors.surface }} statusBarHeight={0}>
          <Appbar.Action
            icon="chevron-down"
            onPress={closeToPlayer}
          />
        <Appbar.Content title="Queue" subtitle={sourceLabel} />
        </Appbar.Header>
      </View>

      <View style={styles.headerMeta}>
        {currentTrack ? (
          <Surface
            style={[
              styles.nowPlayingCard,
              {
                backgroundColor: theme.colors.primaryContainer,
                borderColor: theme.colors.primary,
              },
            ]}
            elevation={2}
          >
            <Image source={{ uri: currentTrack.thumbnail }} style={styles.nowPlayingThumb} />
            <View style={styles.nowPlayingMeta}>
              <Text numberOfLines={1} style={[styles.nowPlayingTitle, { color: theme.colors.onPrimaryContainer }]}>
                {currentTrack.title}
              </Text>
              <Text numberOfLines={1} style={[styles.nowPlayingArtist, { color: theme.colors.onPrimaryContainer }]}>
                {getArtistLabel(currentTrack)}
              </Text>
            </View>
            <Chip compact mode="flat" style={{ backgroundColor: theme.colors.secondaryContainer }}>
              <Text style={{ color: theme.colors.onSecondaryContainer, fontWeight: '700' }}>NOW</Text>
            </Chip>
          </Surface>
        ) : null}
        <Chip mode="flat" compact style={{ backgroundColor: theme.colors.surfaceVariant }}>
          <Text numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
            {nextTrack
              ? `Up Next: ${nextTrack.title}${remainingAfterNext > 0 ? ` and ${remainingAfterNext} more songs` : ''}`
              : 'Up Next: End of queue'}
          </Text>
        </Chip>
      </View>

      <Divider />

      <FlashList
        data={queue}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        estimatedItemSize={86}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 120 }]}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerMeta: {
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  nowPlayingCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nowPlayingThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#2a2a2e',
  },
  nowPlayingMeta: {
    flex: 1,
  },
  nowPlayingTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  nowPlayingArtist: {
    fontSize: 12,
    opacity: 0.9,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  row: {
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 58,
    height: 58,
    borderRadius: 10,
    backgroundColor: '#2a2a2e',
  },
  meta: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  artist: {
    fontSize: 12,
  },
});
