import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, ActivityIndicator, Button, ProgressBar, Surface, Text, useTheme } from 'react-native-paper';
import Constants from 'expo-constants';
import { checkForAppUpdate, downloadAndInstallUpdate, type UpdateConfig, UPDATE_RELEASES_URL } from '../utils/updater';

interface UpdateScreenProps {
  route?: {
    params?: {
      prefetchedUpdate?: UpdateConfig;
      autoOpened?: boolean;
    };
  };
  navigation: any;
}

const getCurrentVersion = () =>
  Constants.expoConfig?.version ||
  (Constants.manifest2 as { extra?: { expoClient?: { version?: string } } } | null)?.extra?.expoClient?.version ||
  '0.0.0';

export default function UpdateScreen({ route, navigation }: UpdateScreenProps) {
  const theme = useTheme();
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateConfig | null>(null);
  const prefetchedUpdate = route?.params?.prefetchedUpdate || null;

  const currentVersion = useMemo(() => getCurrentVersion(), []);

  const runCheck = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setStatus('Updater is available only on Android.');
      return;
    }
    setIsChecking(true);
    setError(null);
    setStatus(null);
    try {
      const next = await checkForAppUpdate(currentVersion);
      if (!next) {
        setUpdate(null);
        setStatus('You are already on the latest version.');
      } else {
        setUpdate(next);
        setStatus('Update available.');
      }
    } catch {
      setError('Failed to check for updates.');
    } finally {
      setIsChecking(false);
    }
  }, [currentVersion]);

  useEffect(() => {
    if (prefetchedUpdate) {
      setUpdate(prefetchedUpdate);
      setStatus('New update available.');
      return;
    }
    void runCheck();
  }, [prefetchedUpdate, runCheck]);

  const handleUpdateNow = useCallback(async () => {
    if (!update || isDownloading) return;
    setError(null);
    setStatus(null);
    setProgress(0);
    setIsDownloading(true);
    try {
      await downloadAndInstallUpdate(update, setProgress);
      setStatus('Installer opened. Complete installation from system prompt.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to install update.';
      setError(message);
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, update]);

  const openReleases = useCallback(async () => {
    try {
      await Linking.openURL(UPDATE_RELEASES_URL);
    } catch {
      setError('Unable to open releases page.');
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Update" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
            Current version: {currentVersion}
          </Text>
          {!!update && (
            <Text variant="titleMedium" style={[styles.subtitle, { color: theme.colors.primary }]}>
              New version: {update.latestVersion}
            </Text>
          )}

          {isChecking && (
            <View style={styles.row}>
              <ActivityIndicator />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Checking for updates...
              </Text>
            </View>
          )}

          {update && (
            <View style={styles.updateBlock}>
              <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                What's new
              </Text>
              {!!update.notes.length && (
                <View style={styles.notes}>
                  {update.notes.map((note, index) => (
                    <Text key={`${index}-${note.slice(0, 12)}`} variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                      - {note}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {isDownloading && (
            <View style={styles.progressWrap}>
              <ProgressBar progress={progress} />
              <Text variant="bodySmall" style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>
                Downloading {Math.round(progress * 100)}%
              </Text>
            </View>
          )}

          {!!status && (
            <Text variant="bodyMedium" style={[styles.status, { color: theme.colors.primary }]}>
              {status}
            </Text>
          )}

          {!!error && (
            <Text variant="bodyMedium" style={[styles.status, { color: theme.colors.error }]}>
              {error}
            </Text>
          )}

          <View style={styles.actions}>
            <Button mode="outlined" onPress={openReleases} disabled={isDownloading}>
              Open Releases
            </Button>
            <Button mode="contained" onPress={() => void handleUpdateNow()} disabled={!update || isDownloading}>
              Update Now
            </Button>
          </View>
        </Surface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  card: { borderRadius: 16, padding: 16, gap: 10 },
  subtitle: { marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  updateBlock: { marginTop: 6, gap: 8 },
  notes: { gap: 6 },
  progressWrap: { marginTop: 4 },
  progressText: { marginTop: 6 },
  status: { marginTop: 2 },
  actions: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
