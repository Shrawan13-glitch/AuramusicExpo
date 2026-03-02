import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, ActivityIndicator, Button, ProgressBar, Surface, Text, useTheme } from 'react-native-paper';
import Constants from 'expo-constants';
import { checkForAppUpdate, downloadAndInstallUpdate, type UpdateConfig, UPDATE_RELEASES_URL } from '../utils/updater';
import { applyOtaUpdateNow, checkAndFetchOtaUpdate } from '../utils/otaUpdater';

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
  const [isCheckingOta, setIsCheckingOta] = useState(false);
  const [isApplyingOta, setIsApplyingOta] = useState(false);
  const [otaPending, setOtaPending] = useState(false);
  const [otaStatus, setOtaStatus] = useState<string | null>(null);
  const [otaError, setOtaError] = useState<string | null>(null);
  const [isCheckingApk, setIsCheckingApk] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [apkError, setApkError] = useState<string | null>(null);
  const [apkStatus, setApkStatus] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateConfig | null>(null);
  const prefetchedUpdate = route?.params?.prefetchedUpdate || null;

  const currentVersion = useMemo(() => getCurrentVersion(), []);

  const runOtaCheck = useCallback(async () => {
    setIsCheckingOta(true);
    setOtaError(null);
    setOtaStatus(null);
    try {
      const result = await checkAndFetchOtaUpdate();
      setOtaPending(result.isPending);
      if (result.message) {
        setOtaStatus(result.message);
      } else if (!result.isAvailable) {
        setOtaStatus('No OTA update is available.');
      }
    } catch {
      setOtaError('Failed to check OTA updates.');
    } finally {
      setIsCheckingOta(false);
    }
  }, []);

  const runApkCheck = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setApkStatus('APK updater is available only on Android.');
      return;
    }
    setIsCheckingApk(true);
    setApkError(null);
    setApkStatus(null);
    try {
      const next = await checkForAppUpdate(currentVersion);
      if (!next) {
        setUpdate(null);
        setApkStatus('No APK update is available.');
      } else {
        setUpdate(next);
        setApkStatus('APK update available.');
      }
    } catch {
      setApkError('Failed to check APK updates.');
    } finally {
      setIsCheckingApk(false);
    }
  }, [currentVersion]);

  useEffect(() => {
    void runOtaCheck();
    if (prefetchedUpdate) {
      setUpdate(prefetchedUpdate);
      setApkStatus('New strict APK update available.');
      return;
    }
    void runApkCheck();
  }, [prefetchedUpdate, runApkCheck, runOtaCheck]);

  const handleApplyOta = useCallback(async () => {
    if (!otaPending || isApplyingOta) return;
    setOtaError(null);
    setIsApplyingOta(true);
    try {
      await applyOtaUpdateNow();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to restart app for OTA update.';
      setOtaError(message);
      setIsApplyingOta(false);
    }
  }, [isApplyingOta, otaPending]);

  const handleUpdateNow = useCallback(async () => {
    if (!update || isDownloading) return;
    setApkError(null);
    setApkStatus(null);
    setProgress(0);
    setIsDownloading(true);
    try {
      await downloadAndInstallUpdate(update, setProgress);
      setApkStatus('Installer opened. Complete installation from system prompt.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to install update.';
      setApkError(message);
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, update]);

  const openReleases = useCallback(async () => {
    try {
      await Linking.openURL(UPDATE_RELEASES_URL);
    } catch {
      setApkError('Unable to open releases page.');
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
            Over-the-air updates
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Installs JavaScript and asset updates without downloading a new APK.
          </Text>
          {isCheckingOta && (
            <View style={styles.row}>
              <ActivityIndicator />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Checking OTA updates...
              </Text>
            </View>
          )}
          {!!otaStatus && (
            <Text variant="bodyMedium" style={[styles.status, { color: theme.colors.primary }]}>
              {otaStatus}
            </Text>
          )}
          {!!otaError && (
            <Text variant="bodyMedium" style={[styles.status, { color: theme.colors.error }]}>
              {otaError}
            </Text>
          )}
          <View style={styles.actions}>
            <Button mode="outlined" onPress={() => void runOtaCheck()} disabled={isCheckingOta || isApplyingOta}>
              Check OTA
            </Button>
            <Button mode="contained" onPress={() => void handleApplyOta()} disabled={!otaPending || isApplyingOta}>
              Restart to Apply
            </Button>
          </View>
        </Surface>

        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
            APK updates
          </Text>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
            Current version: {currentVersion}
          </Text>
          {!!update && (
            <Text variant="titleMedium" style={[styles.subtitle, { color: theme.colors.primary }]}>
              New version: {update.latestVersion}
            </Text>
          )}

          {isCheckingApk && (
            <View style={styles.row}>
              <ActivityIndicator />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Checking APK updates...
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

          {!!apkStatus && (
            <Text variant="bodyMedium" style={[styles.status, { color: theme.colors.primary }]}>
              {apkStatus}
            </Text>
          )}

          {!!apkError && (
            <Text variant="bodyMedium" style={[styles.status, { color: theme.colors.error }]}>
              {apkError}
            </Text>
          )}

          <View style={styles.actions}>
            <Button mode="outlined" onPress={openReleases} disabled={isDownloading}>
              Open Releases
            </Button>
            <Button mode="outlined" onPress={() => void runApkCheck()} disabled={isDownloading || isCheckingApk}>
              Check APK
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
