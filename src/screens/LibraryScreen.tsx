import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  Text,
  useTheme,
  ActivityIndicator,
  Surface,
  AnimatedFAB,
  Portal,
  Modal,
  TextInput,
  Button,
  RadioButton,
  Switch,
  HelperText,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthenticatedHttpClient } from '../utils/authenticatedHttpClient';
import { usePlayer } from '../contexts/PlayerContext';
import { parseLibraryData, LibraryItem, LibrarySection } from '../utils/libraryParser';
import { readCachedLibrary, writeCachedLibrary } from '../utils/libraryCache';

export default function LibraryScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { currentTrack } = usePlayer();
  const [sections, setSections] = useState<LibrarySection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPrivacy, setCreatePrivacy] = useState<'PUBLIC' | 'UNLISTED' | 'PRIVATE'>('PRIVATE');
  const [allowCollaborators, setAllowCollaborators] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [fabExtended, setFabExtended] = useState(true);

  const loadLibrary = useCallback(async ({ preserveOnError = false }: { preserveOnError?: boolean } = {}) => {
    try {
      const response = await AuthenticatedHttpClient.getUserLibrary();
      const parsedSections = parseLibraryData(response);
      setSections(parsedSections);
      setError(null);
      await writeCachedLibrary(parsedSections);
    } catch (err) {
      console.error('Failed to load library', err);
      if (!preserveOnError) {
        setError('Unable to load your library right now.');
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrapLibrary = async () => {
      setLoading(true);
      const cachedSections = await readCachedLibrary();

      if (!isMounted) return;

      if (cachedSections.length) {
        setSections(cachedSections);
        setError(null);
        setLoading(false);
        await loadLibrary({ preserveOnError: true });
        return;
      }

      await loadLibrary();
      if (isMounted) {
        setLoading(false);
      }
    };

    bootstrapLibrary();
    return () => {
      isMounted = false;
    };
  }, [loadLibrary, readCachedLibrary]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLibrary({ preserveOnError: sections.length > 0 });
    setRefreshing(false);
  }, [loadLibrary, sections.length]);

  const openCreateModal = useCallback(() => {
    setCreateError(null);
    setCreateModalVisible(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    if (creating) return;
    setCreateModalVisible(false);
  }, [creating]);

  const resetCreateForm = useCallback(() => {
    setCreateTitle('');
    setCreateDescription('');
    setCreatePrivacy('PRIVATE');
    setAllowCollaborators(false);
  }, []);

  const handleCreatePlaylist = useCallback(async () => {
    if (!createTitle.trim()) {
      setCreateError('Please enter a playlist name.');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      await AuthenticatedHttpClient.createPlaylist({
        title: createTitle.trim(),
        description: createDescription.trim(),
        privacyStatus: createPrivacy,
        allowCollaborators,
      });
      setCreateModalVisible(false);
      resetCreateForm();
      await loadLibrary();
    } catch (err) {
      console.error('Failed to create playlist', err);
      setCreateError('Unable to create the playlist right now.');
    } finally {
      setCreating(false);
    }
  }, [allowCollaborators, createDescription, createPrivacy, createTitle, loadLibrary, resetCreateForm]);

  const handleItemPress = useCallback((item: LibraryItem) => {
    switch (item.type) {
      case 'album':
        navigation.navigate('Album', { albumId: item.id });
        break;
      case 'artist':
        navigation.navigate('Artist', { artistId: item.id, artistName: item.title });
        break;
      case 'playlist':
        navigation.navigate('Playlist', { playlistId: item.id });
        break;
      default:
        break;
    }
  }, [navigation]);

  const renderSection = useCallback(({ item }: { item: LibrarySection }) => (
    <View style={styles.section}>
      <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
        {item.title}
      </Text>
      <FlashList
        data={item.items}
        renderItem={({ item: libraryItem }) => (
          <LibraryItemCard
            item={libraryItem}
            onPress={() => handleItemPress(libraryItem)}
          />
        )}
        keyExtractor={(libraryItem) => libraryItem.id}
        numColumns={2}
        scrollEnabled={false}
        contentContainerStyle={styles.sectionGrid}
        columnWrapperStyle={styles.sectionRow}
        estimatedItemSize={220}
      />
    </View>
  ), [handleItemPress, theme.colors.onBackground]);

  const listEmpty = useMemo(
    () => !loading && !error && sections.length === 0,
    [error, loading, sections.length]
  );

  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset?.y ?? 0;
    setFabExtended(offsetY <= 8);
  }, []);

  const miniPlayerHeight = 0;
  const bottomBarHeight = 88;
  const extraBottomPadding = 24;
  const baseFabBottom = 10;
  const miniPlayerOffset = insets.bottom + bottomBarHeight;
  const contentBottomPadding = Math.max(
    100,
    insets.bottom + bottomBarHeight + (currentTrack ? miniPlayerHeight : 0) + extraBottomPadding
  );
  const fabBottom = currentTrack ? miniPlayerOffset + miniPlayerHeight + 12 : baseFabBottom;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
            Loading your library...
          </Text>
        </View>
      ) : error ? (
        <ScrollView
          style={styles.refreshScroll}
          contentContainerStyle={[styles.emptyState, styles.refreshContent]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          alwaysBounceVertical
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <MaterialCommunityIcons
            name="cloud-alert"
            size={56}
            color={theme.colors.onSurfaceVariant}
          />
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: 12 }}>
            {error}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
            Pull down to try again.
          </Text>
        </ScrollView>
      ) : listEmpty ? (
        <ScrollView
          style={styles.refreshScroll}
          contentContainerStyle={[styles.emptyState, styles.refreshContent]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          alwaysBounceVertical
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <MaterialCommunityIcons
            name="music-box-multiple-outline"
            size={56}
            color={theme.colors.onSurfaceVariant}
          />
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: 12 }}>
            Your library is empty
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
            Save music to see it here.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: contentBottomPadding }]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
        >
          {sections.map((section, index) => (
            <View key={`${section.title}-${index}`}>
              {renderSection({ item: section })}
            </View>
          ))}
        </ScrollView>
      )}

      <AnimatedFAB
        icon="plus"
        label="New"
        extended={fabExtended}
        animateFrom="right"
        style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: fabBottom }]}
        color={theme.colors.onPrimary}
        onPress={openCreateModal}
        visible
      />

      <Portal>
        <Modal
          visible={createModalVisible}
          onDismiss={closeCreateModal}
          contentContainerStyle={[styles.createModal, { backgroundColor: theme.colors.surface }]}
        >
          <ScrollView contentContainerStyle={styles.createModalContent}>
            <Text variant="titleLarge" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Create playlist
            </Text>

            <TextInput
              label="Playlist name"
              mode="outlined"
              value={createTitle}
              onChangeText={setCreateTitle}
              autoCapitalize="sentences"
              autoCorrect={false}
              style={styles.modalInput}
            />

            <TextInput
              label="Description"
              mode="outlined"
              value={createDescription}
              onChangeText={setCreateDescription}
              multiline
              numberOfLines={3}
              style={styles.modalInput}
            />

            <Text variant="titleSmall" style={[styles.modalSectionTitle, { color: theme.colors.onSurface }]}>
              Privacy
            </Text>
            <RadioButton.Group
              onValueChange={(value) => setCreatePrivacy(value as 'PUBLIC' | 'UNLISTED' | 'PRIVATE')}
              value={createPrivacy}
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

            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                  Allow collaborators to add songs
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Let others add to this playlist once it is created.
                </Text>
              </View>
              <Switch value={allowCollaborators} onValueChange={setAllowCollaborators} />
            </View>

            <HelperText type="error" visible={!!createError}>
              {createError}
            </HelperText>

            <View style={styles.modalActions}>
              <Button
                mode="text"
                onPress={closeCreateModal}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleCreatePlaylist}
                loading={creating}
                disabled={creating}
              >
                Create
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

interface LibraryItemCardProps {
  item: LibraryItem;
  onPress: () => void;
}

const LibraryItemCard = React.memo(({ item, onPress }: LibraryItemCardProps) => {
  const theme = useTheme();

  const iconName = useMemo(() => {
    switch (item.type) {
      case 'album':
        return 'album';
      case 'artist':
        return 'account-music';
      case 'playlist':
        return 'playlist-music';
      case 'song':
        return 'music-note';
      case 'video':
        return 'play-circle';
      default:
        return 'music';
    }
  }, [item.type]);

  const isArtist = item.type === 'artist';
  const imageStyle = isArtist ? [styles.itemImage, styles.artistImage] : styles.itemImage;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.itemWrapper}>
      <Surface style={[styles.itemCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={imageStyle} />
        ) : (
          <View style={[imageStyle, styles.itemPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
            <MaterialCommunityIcons name={iconName} size={28} color={theme.colors.onSurfaceVariant} />
          </View>
        )}
        <Text
          variant="titleSmall"
          numberOfLines={2}
          style={[styles.itemTitle, { color: theme.colors.onSurface }]}
        >
          {item.title || 'Untitled'}
        </Text>
        {!!item.subtitle && (
          <Text
            variant="bodySmall"
            numberOfLines={2}
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {item.subtitle}
          </Text>
        )}
      </Surface>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100,
  },
  refreshScroll: {
    flex: 1,
  },
  refreshContent: {
    flexGrow: 1,
  },
  section: {
    paddingTop: 16,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    marginBottom: 12,
    fontWeight: '600',
  },
  sectionGrid: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  sectionRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemWrapper: {
    flex: 1,
    marginHorizontal: 6,
  },
  itemCard: {
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  itemImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  artistImage: {
    borderRadius: 999,
  },
  itemPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    marginTop: 6,
    lineHeight: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 10,
  },
  createModal: {
    margin: 20,
    borderRadius: 16,
    maxHeight: '80%',
  },
  createModalContent: {
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  switchText: {
    flex: 1,
    gap: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
});
