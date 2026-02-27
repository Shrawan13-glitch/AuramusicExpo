import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, StyleSheet, View } from 'react-native';
import { Appbar, Button, Dialog, Portal, RadioButton, Surface, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { CachedSong, getCachedSongs, getCacheLimitMB, getCacheUsageBytes, setCacheLimitMB } from '../utils/cacheManager';

const formatBytes = (bytes: number) => {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export default function CacheScreen({ navigation }: { navigation: any }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [songs, setSongs] = useState<CachedSong[]>([]);
  const [usageBytes, setUsageBytes] = useState(0);
  const [limitMb, setLimitMb] = useState(512);
  const [refreshing, setRefreshing] = useState(false);
  const [sizeDialogVisible, setSizeDialogVisible] = useState(false);

  const load = useCallback(async () => {
    const [cachedSongs, usage, limit] = await Promise.all([
      getCachedSongs(),
      getCacheUsageBytes(),
      getCacheLimitMB(),
    ]);
    setSongs(cachedSongs);
    setUsageBytes(usage);
    setLimitMb(limit);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const usageLabel = useMemo(() => `${formatBytes(usageBytes)} / ${limitMb} MB`, [limitMb, usageBytes]);
  const renderItem = useCallback(
    ({ item }: { item: CachedSong }) => (
      <Surface style={[styles.songRow, { backgroundColor: theme.colors.surface }]} elevation={1}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, { backgroundColor: theme.colors.surfaceVariant }]} />
        )}
        <View style={styles.songMeta}>
          <Text numberOfLines={1} style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
            {item.artist}
          </Text>
        </View>
        <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>
          {formatBytes(item.size)}
        </Text>
      </Surface>
    ),
    [theme.colors.onSurface, theme.colors.onSurfaceVariant, theme.colors.primary, theme.colors.surface, theme.colors.surfaceVariant]
  );

  const onChangeLimit = useCallback(async (next: number) => {
    setLimitMb(next);
    await setCacheLimitMB(next);
    await load();
  }, [load]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={{ paddingTop: insets.top, backgroundColor: theme.colors.surface }}>
        <Appbar.Header statusBarHeight={0}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Cache" subtitle={usageLabel} />
          <Appbar.Action icon="refresh" onPress={onRefresh} />
        </Appbar.Header>
      </View>

      <FlashList
        data={songs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        estimatedItemSize={72}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: insets.bottom + 20 }}
        ListHeaderComponent={
          <Surface style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
              Cached songs: {songs.length}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
              Total size: {formatBytes(usageBytes)}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 10 }}>
              Limit: {limitMb} MB
            </Text>
            <Button mode="outlined" onPress={() => setSizeDialogVisible(true)}>
              Change cache size
            </Button>
          </Surface>
        }
        ListHeaderComponentStyle={{ marginBottom: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      />

      <Portal>
        <Dialog visible={sizeDialogVisible} onDismiss={() => setSizeDialogVisible(false)}>
          <Dialog.Title>Cache size limit</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              onValueChange={(value) => void onChangeLimit(Number(value))}
              value={String(limitMb)}
            >
              <View style={styles.radioRow}>
                <RadioButton value="256" />
                <Text>256 MB</Text>
              </View>
              <View style={styles.radioRow}>
                <RadioButton value="512" />
                <Text>512 MB</Text>
              </View>
              <View style={styles.radioRow}>
                <RadioButton value="1024" />
                <Text>1 GB</Text>
              </View>
              <View style={styles.radioRow}>
                <RadioButton value="2048" />
                <Text>2 GB</Text>
              </View>
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSizeDialogVisible(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 12,
  },
  songRow: {
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  songMeta: {
    flex: 1,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
