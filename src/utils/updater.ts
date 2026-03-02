import { PermissionsAndroid, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import RNApkInstaller from '@dominicvonk/react-native-apk-installer';

export const UPDATE_CONFIG_URL =
  'https://github.com/Shrawan13-glitch/AuraMusic-updates/blob/main/version.json';
export const UPDATE_RELEASES_URL =
  'https://github.com/Shrawan13-glitch/AuramusicExpo/releases';

export interface UpdateConfig {
  latestVersion: string;
  downloadUrl: string;
  notes: string[];
  isStrict: boolean;
}

const toRawGitHubUrl = (url: string) => {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i);
  if (!match) return url;
  const [, owner, repo, path] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${path}`;
};

const parseBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return false;
};

const normalizeVersionParts = (version: string) =>
  version
    .split('.')
    .map((part) => Number.parseInt(part.replace(/[^\d]/g, ''), 10))
    .map((num) => (Number.isFinite(num) ? num : 0));

export const isVersionNewer = (currentVersion: string, remoteVersion: string) => {
  const current = normalizeVersionParts(currentVersion);
  const remote = normalizeVersionParts(remoteVersion);
  const len = Math.max(current.length, remote.length);
  for (let i = 0; i < len; i += 1) {
    const a = current[i] ?? 0;
    const b = remote[i] ?? 0;
    if (b > a) return true;
    if (b < a) return false;
  }
  return false;
};

export const checkForAppUpdate = async (currentVersion: string): Promise<UpdateConfig | null> => {
  const baseUrl = toRawGitHubUrl(UPDATE_CONFIG_URL);
  const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) {
    throw new Error(`Update check failed with status ${response.status}`);
  }

  const json = await response.json();
  const update = json?.update;
  const latestVersion =
    typeof update?.latestVersion === 'string'
      ? update.latestVersion.trim()
      : typeof update?.latestVersion === 'number'
        ? String(update.latestVersion)
        : '';
  const downloadUrl = typeof update?.downloadUrl === 'string' ? update.downloadUrl.trim() : '';
  const notes = Array.isArray(update?.notes)
    ? update.notes.map((note: unknown) => String(note)).filter(Boolean)
    : [];
  const isStrict = parseBoolean(update?.isStrict);

  if (!latestVersion || !downloadUrl) return null;
  if (!isVersionNewer(currentVersion, latestVersion)) return null;

  return {
    latestVersion,
    downloadUrl,
    notes,
    isStrict,
  };
};

const hasUnknownSourcesPermission = async () => {
  try {
    const value = await RNApkInstaller.haveUnknownAppSourcesPermission();
    return parseBoolean(value);
  } catch {
    return true;
  }
};

const ensureInstallPermission = async () => {
  if (await hasUnknownSourcesPermission()) return true;
  try {
    await RNApkInstaller.showUnknownAppSourcesPermission();
  } catch {
    // no-op
  }
  return false;
};

const ANDROID_PUBLIC_DOWNLOAD_DIR = 'file:///storage/emulated/0/Download';

const requestAndroidStoragePermission = async () => {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 33) return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message: 'Mediyo needs storage access to download update APK to your Downloads folder.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

export const downloadAndInstallUpdate = async (
  config: UpdateConfig,
  onProgress?: (progress: number) => void
): Promise<'apk-installer'> => {
  if (Platform.OS !== 'android') {
    throw new Error('APK updates are supported only on Android.');
  }

  const hasStorage = await requestAndroidStoragePermission();
  if (!hasStorage) {
    throw new Error('Storage permission denied.');
  }

  await FileSystem.makeDirectoryAsync(ANDROID_PUBLIC_DOWNLOAD_DIR, { intermediates: true }).catch(() => {});
  const targetPath = `${ANDROID_PUBLIC_DOWNLOAD_DIR}/Mediyo-${config.latestVersion}.apk`;

  const downloader = FileSystem.createDownloadResumable(
    config.downloadUrl,
    targetPath,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (!onProgress) return;
      if (!totalBytesExpectedToWrite || totalBytesExpectedToWrite <= 0) {
        onProgress(0);
        return;
      }
      onProgress(Math.max(0, Math.min(1, totalBytesWritten / totalBytesExpectedToWrite)));
    }
  );

  const result = await downloader.downloadAsync();
  const status = (result as any)?.status;
  const uri = result?.uri;
  if (!uri || (typeof status === 'number' && status >= 400)) {
    throw new Error('Failed to download update APK.');
  }

  const canInstall = await ensureInstallPermission();
  if (!canInstall) {
    throw new Error('Please allow install from unknown sources and try again.');
  }

  const normalizedPath = uri.startsWith('file://') ? uri.replace('file://', '') : uri;
  await RNApkInstaller.install(normalizedPath);
  return 'apk-installer';
};
