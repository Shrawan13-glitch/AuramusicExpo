import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Appbar, Surface, Text, useTheme, ActivityIndicator, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppMessage, fetchMessagesIndex, getCachedMessagesIndex } from '../utils/messagesService';

const typeMeta: Record<AppMessage['type'], { label: string; icon: string; color: string }> = {
  update: { label: 'Update', icon: 'rocket-launch-outline', color: '#2ea8ff' },
  announcement: { label: 'Announcement', icon: 'bullhorn-outline', color: '#5cd38b' },
  alert: { label: 'Alert', icon: 'alert-outline', color: '#ff8d66' },
};

export default function MessagesScreen({ navigation }: { navigation: any }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRemote = useCallback(async (preserveOnError: boolean) => {
    try {
      const remote = await fetchMessagesIndex();
      setMessages(remote);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch messages index', err);
      if (!preserveOnError) {
        setError('Could not load messages right now.');
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      setLoading(true);
      const cached = await getCachedMessagesIndex();
      if (!mounted) return;
      if (cached.length) {
        setMessages(cached);
        setError(null);
        setLoading(false);
        await loadRemote(true);
        return;
      }

      await loadRemote(false);
      if (mounted) {
        setLoading(false);
      }
    };
    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [loadRemote]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRemote(messages.length > 0);
    setRefreshing(false);
  }, [loadRemote, messages.length]);

  const renderItem = useCallback(
    ({ item }: { item: AppMessage }) => {
      const meta = typeMeta[item.type];
      return (
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => navigation.navigate('MessageDetail', { message: item })}
        >
          <Surface
            style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
            elevation={1}
          >
            <View style={styles.rowTop}>
              <Chip
                compact
                icon={meta.icon}
                style={[styles.chip, { backgroundColor: `${meta.color}22` }]}
                textStyle={{ color: meta.color, fontWeight: '700' }}
              >
                {meta.label}
              </Chip>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {item.date}
              </Text>
            </View>
            <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
              {item.title}
            </Text>
            <View style={styles.rowBottom}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Tap to read full message
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
            </View>
          </Surface>
        </TouchableOpacity>
      );
    },
    [navigation, theme.colors.onSurface, theme.colors.onSurfaceVariant, theme.colors.outlineVariant, theme.colors.surface]
  );

  const emptyState = useMemo(() => !loading && !error && messages.length === 0, [error, loading, messages.length]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['left', 'right', 'bottom']}>
      <View style={{ paddingTop: insets.top, backgroundColor: theme.colors.surface }}>
      <Appbar.Header statusBarHeight={0}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Messages" />
        <Appbar.Action icon="refresh" onPress={onRefresh} />
      </Appbar.Header>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>Loading messages...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <MaterialCommunityIcons name="cloud-alert-outline" size={52} color={theme.colors.onSurfaceVariant} />
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: 10 }}>
            {error}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
            Pull down or tap refresh to try again.
          </Text>
        </View>
      ) : emptyState ? (
        <View style={styles.centerState}>
          <MaterialCommunityIcons name="message-text-outline" size={52} color={theme.colors.onSurfaceVariant} />
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: 10 }}>
            No messages yet
          </Text>
        </View>
      ) : (
        <FlashList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          estimatedItemSize={118}
          contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 120 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  chip: {
    borderRadius: 14,
  },
  title: {
    fontWeight: '700',
    lineHeight: 24,
  },
});
