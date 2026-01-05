import RNFS from 'react-native-fs';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import RNApkInstaller from '@dominicvonk/react-native-apk-installer';

export interface DownloadProgress {
  bytesWritten: number;
  contentLength: number;
  progress: number;
}

export class APKDownloader {
  private downloadPath: string;
  private isDownloading: boolean = false;

  constructor() {
    this.downloadPath = `${RNFS.DownloadDirectoryPath}/AuraMusic_update.apk`;
  }

  // Request storage permission for Android
  private async requestStoragePermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'App needs storage permission to download updates',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.log('Permission error:', err);
      return false;
    }
  }

  // Download APK with progress tracking
  async downloadAPK(
    downloadUrl: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<boolean> {
    if (this.isDownloading) {
      Alert.alert('Download in Progress', 'Please wait for the current download to complete.');
      return false;
    }

    const hasPermission = await this.requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Storage permission is required to download updates.');
      return false;
    }

    this.isDownloading = true;

    try {
      // Remove existing APK if exists
      if (await RNFS.exists(this.downloadPath)) {
        await RNFS.unlink(this.downloadPath);
      }

      const downloadResult = RNFS.downloadFile({
        fromUrl: downloadUrl,
        toFile: this.downloadPath,
        progress: (res) => {
          const progress: DownloadProgress = {
            bytesWritten: res.bytesWritten,
            contentLength: res.contentLength,
            progress: res.bytesWritten / res.contentLength,
          };
          onProgress?.(progress);
        },
        progressDivider: 1,
        begin: (res) => {
          console.log('Download started:', res);
        },
      });

      const result = await downloadResult.promise;
      this.isDownloading = false;

      if (result.statusCode === 200) {
        console.log('APK downloaded successfully');
        return true;
      } else {
        console.log('Download failed with status:', result.statusCode);
        return false;
      }
    } catch (error) {
      this.isDownloading = false;
      console.log('Download error:', error);
      return false;
    }
  }

  // Install APK
  async installAPK(): Promise<boolean> {
    try {
      if (!(await RNFS.exists(this.downloadPath))) {
        Alert.alert('Error', 'APK file not found. Please download again.');
        return false;
      }

      if (Platform.OS === 'android') {
        // Check if we can install unknown apps
        const canInstall = await this.checkInstallPermission();
        if (!canInstall) {
          Alert.alert(
            'Installation Permission Required',
            'Please allow installation from unknown sources in settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => this.openInstallSettings() }
            ]
          );
          return false;
        }

        // Install APK
        await RNApkInstaller.install(this.downloadPath);
        return true;
      }
      return false;
    } catch (error) {
      console.log('Installation error:', error);
      Alert.alert('Installation Failed', 'Could not install the update. Please try again.');
      return false;
    }
  }

  // Check if app can install unknown apps (Android 8+)
  private async checkInstallPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    
    try {
      // For Android 8+ we need to check if we can install unknown apps
      if (Platform.Version >= 26) {
        const canInstall = await RNApkInstaller.canRequestPackageInstalls();
        return canInstall;
      }
      return true;
    } catch (error) {
      console.log('Permission check error:', error);
      return false;
    }
  }

  // Open settings to allow installation from unknown sources
  private openInstallSettings(): void {
    if (Platform.OS === 'android') {
      Linking.openSettings();
    }
  }

  // Download and install APK
  async downloadAndInstall(
    downloadUrl: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<boolean> {
    try {
      const downloaded = await this.downloadAPK(downloadUrl, onProgress);
      if (downloaded) {
        Alert.alert(
          'Download Complete',
          'Update downloaded successfully. Install now?',
          [
            { text: 'Later', style: 'cancel' },
            { 
              text: 'Install', 
              onPress: async () => {
                const installed = await this.installAPK();
                if (installed) {
                  Alert.alert('Success', 'Update will be installed. The app will restart.');
                }
              }
            }
          ]
        );
        return true;
      }
      return false;
    } catch (error) {
      console.log('Download and install error:', error);
      return false;
    }
  }

  // Clean up downloaded APK
  async cleanup(): Promise<void> {
    try {
      if (await RNFS.exists(this.downloadPath)) {
        await RNFS.unlink(this.downloadPath);
      }
    } catch (error) {
      console.log('Cleanup error:', error);
    }
  }

  // Get download progress
  getDownloadPath(): string {
    return this.downloadPath;
  }

  // Check if currently downloading
  isCurrentlyDownloading(): boolean {
    return this.isDownloading;
  }
}

export const apkDownloader = new APKDownloader();