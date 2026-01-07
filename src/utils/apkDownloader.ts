import RNFS from 'react-native-fs';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import RNApkInstaller from '@dominicvonk/react-native-apk-installer';

export interface DownloadProgress {
  bytesWritten: number;
  contentLength: number;
  progress: number;
  speed: number;
  timeRemaining: number;
}

export interface DownloadError {
  type: 'network' | 'storage' | 'permission' | 'unknown';
  message: string;
  retryable: boolean;
}

export class APKDownloader {
  private downloadPath: string;
  private isDownloading: boolean = false;
  private isPaused: boolean = false;
  private downloadJob: any = null;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private lastProgressUpdate: number = 0;
  private startTime: number = 0;
  private pausedBytes: number = 0;

  constructor() {
    // Use proper Downloads folder that's accessible and temporary
    this.downloadPath = Platform.OS === 'android' 
      ? `${RNFS.DownloadDirectoryPath}/AuraMusic_update_${Date.now()}.apk`
      : `${RNFS.DocumentDirectoryPath}/AuraMusic_update_${Date.now()}.apk`;
  }

  // Request storage permission for Android
  private async requestStoragePermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      // For Android 13+ (API 33+), we need different permissions
      if (Platform.Version >= 33) {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
        ];
        
        const results = await PermissionsAndroid.requestMultiple(permissions);
        return Object.values(results).every(result => result === PermissionsAndroid.RESULTS.GRANTED);
      }
      // For Android 10-12 (API 29-32), use READ_EXTERNAL_STORAGE
      else if (Platform.Version >= 29) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission Required',
            message: 'AuraMusic needs storage access to download app updates',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'Allow',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      // For older Android versions, use WRITE_EXTERNAL_STORAGE
      else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission Required',
            message: 'AuraMusic needs storage access to download app updates',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'Allow',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.log('Permission error:', err);
      Alert.alert(
        'Permission Error',
        'Unable to request storage permission. Please enable it manually in app settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return false;
    }
  }

  // Check network connectivity
  private async checkNetworkConnection(): Promise<boolean> {
    try {
      // Simple fetch test instead of NetInfo
      const response = await fetch('https://www.google.com', { 
        method: 'HEAD',
        timeout: 5000 
      });
      return response.ok;
    } catch {
      return true; // Assume connected if can't check
    }
  }

  // Check available storage space
  private async checkStorageSpace(requiredSize: number): Promise<boolean> {
    try {
      const freeSpace = await RNFS.getFSInfo();
      return freeSpace.freeSpace > requiredSize * 1.1; // 10% buffer
    } catch {
      return true; // Assume OK if can't check
    }
  }

  // Get file size from URL
  async getFileSize(url: string): Promise<number> {
    try {
      const response = await fetch(url, { method: 'HEAD', timeout: 10000 });
      if (!response.ok) {
        console.log('File size check failed:', response.status);
        return 0;
      }
      const contentLength = response.headers.get('content-length');
      return contentLength ? parseInt(contentLength, 10) : 0;
    } catch (error) {
      console.log('File size check error:', error);
      return 0;
    }
  }

  // Check if APK already exists and is valid
  async isAPKCached(): Promise<boolean> {
    try {
      return await RNFS.exists(this.downloadPath);
    } catch {
      return false;
    }
  }

  // Download APK with progress tracking
  async downloadAPK(
    downloadUrl: string,
    onProgress?: (progress: DownloadProgress) => void,
    onError?: (error: DownloadError) => void
  ): Promise<boolean> {
    if (this.isDownloading) {
      onError?.({ type: 'unknown', message: 'Download already in progress', retryable: false });
      return false;
    }

    // Validate URL first
    if (!downloadUrl || !downloadUrl.startsWith('http')) {
      onError?.({ type: 'network', message: 'Invalid download URL', retryable: false });
      return false;
    }

    // Check if URL is accessible
    try {
      const testResponse = await fetch(downloadUrl, { method: 'HEAD', timeout: 10000 });
      if (!testResponse.ok) {
        onError?.({ type: 'network', message: `Server error: ${testResponse.status}`, retryable: true });
        return false;
      }
    } catch (error) {
      onError?.({ type: 'network', message: 'Cannot reach download server', retryable: true });
      return false;
    }

    // Check network connectivity
    const isConnected = await this.checkNetworkConnection();
    if (!isConnected) {
      onError?.({ type: 'network', message: 'No internet connection', retryable: true });
      return false;
    }

    // Get file size and check storage
    const fileSize = await this.getFileSize(downloadUrl);
    if (fileSize > 0) {
      const hasSpace = await this.checkStorageSpace(fileSize);
      if (!hasSpace) {
        onError?.({ type: 'storage', message: 'Insufficient storage space', retryable: false });
        return false;
      }
    }

    const hasPermission = await this.requestStoragePermission();
    if (!hasPermission) {
      onError?.({ type: 'permission', message: 'Storage permission denied', retryable: true });
      return false;
    }

    this.isDownloading = true;
    this.startTime = Date.now();
    this.retryCount = 0;

    return this.attemptDownload(downloadUrl, onProgress, onError);
  }

  private async attemptDownload(
    downloadUrl: string,
    onProgress?: (progress: DownloadProgress) => void,
    onError?: (error: DownloadError) => void
  ): Promise<boolean> {
    try {
      // Remove existing APK if exists
      if (await RNFS.exists(this.downloadPath)) {
        await RNFS.unlink(this.downloadPath);
      }

      this.downloadJob = RNFS.downloadFile({
        fromUrl: downloadUrl,
        toFile: this.downloadPath,
        progress: (res) => {
          const now = Date.now();
          if (now - this.lastProgressUpdate < 100) return; // Throttle to 100ms
          this.lastProgressUpdate = now;

          const elapsed = (now - this.startTime) / 1000;
          const speed = res.bytesWritten / (1024 * 1024) / elapsed;
          const remaining = (res.contentLength - res.bytesWritten) / (speed * 1024 * 1024);

          const progress: DownloadProgress = {
            bytesWritten: res.bytesWritten,
            contentLength: res.contentLength,
            progress: res.bytesWritten / res.contentLength,
            speed,
            timeRemaining: remaining
          };
          onProgress?.(progress);
        },
        progressDivider: 1,
        begin: (res) => {
          console.log('Download started:', res);
        },
      });

      const result = await this.downloadJob.promise;
      this.isDownloading = false;

      if (result.statusCode === 200) {
        console.log('APK downloaded successfully');
        return true;
      } else {
        throw new Error(`Download failed with status: ${result.statusCode}`);
      }
    } catch (error: any) {
      this.isDownloading = false;
      console.log('Download error:', error);
      
      // Handle specific error types
      let errorMessage = 'Download failed';
      let retryable = true;
      
      if (error?.message?.includes('404')) {
        errorMessage = 'File not found on server';
        retryable = false;
      } else if (error?.message?.includes('403')) {
        errorMessage = 'Access denied by server';
        retryable = false;
      } else if (error?.message?.includes('500')) {
        errorMessage = 'Server error, please try again later';
        retryable = true;
      } else if (error?.message?.includes('timeout')) {
        errorMessage = 'Download timeout, check your connection';
        retryable = true;
      } else if (error?.message?.includes('Network')) {
        errorMessage = 'Network error, check your connection';
        retryable = true;
      }
      
      // Retry logic with exponential backoff
      if (this.retryCount < this.maxRetries && retryable) {
        this.retryCount++;
        const delay = Math.pow(2, this.retryCount) * 1000; // Exponential backoff
        
        setTimeout(() => {
          this.attemptDownload(downloadUrl, onProgress, onError);
        }, delay);
        
        onError?.({ 
          type: 'network', 
          message: `${errorMessage}. Retrying in ${delay/1000}s... (${this.retryCount}/${this.maxRetries})`, 
          retryable: true 
        });
        return false;
      }
      
      onError?.({ type: 'network', message: errorMessage, retryable: false });
      return false;
    }
  }

  // Pause download
  pauseDownload(): void {
    if (this.downloadJob && this.isDownloading) {
      this.isPaused = true;
      this.downloadJob.stop();
    }
  }

  // Resume download
  resumeDownload(): void {
    if (this.isPaused) {
      this.isPaused = false;
      // Note: RNFS doesn't support true resume, would need range requests
    }
  }

  // Clean up downloaded APK
  async cleanup(): Promise<void> {
    try {
      if (await RNFS.exists(this.downloadPath)) {
        await RNFS.unlink(this.downloadPath);
        console.log('APK file cleaned up successfully');
      }
    } catch (error) {
      console.log('Cleanup error:', error);
    }
  }

  // Auto cleanup after installation
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
        
        // Auto cleanup after installation
        setTimeout(() => {
          this.cleanup();
        }, 5000); // Clean up after 5 seconds
        
        return true;
      }
      return false;
    } catch (error) {
      console.log('Installation error:', error);
      Alert.alert('Installation Failed', 'Could not install the update. Please try again.');
      return false;
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

  // Check if app can install unknown apps (Android 8+)
  private async checkInstallPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    
    try {
      if (Platform.Version >= 26) {
        return true; // We'll handle permission in install method
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
      Linking.openURL('android.settings.MANAGE_UNKNOWN_APP_SOURCES');
    }
  }

  // Download and install APK
  async downloadAndInstall(
    downloadUrl: string,
    onProgress?: (progress: DownloadProgress) => void,
    onDownloadComplete?: () => void,
    onError?: (error: DownloadError) => void
  ): Promise<boolean> {
    try {
      const downloaded = await this.downloadAPK(downloadUrl, onProgress, onError);
      if (downloaded) {
        onDownloadComplete?.();
        return true;
      }
      return false;
    } catch (error) {
      console.log('Download and install error:', error);
      onError?.({ type: 'unknown', message: 'Download failed', retryable: true });
      return false;
    }
  }

  // Get current status
  getStatus() {
    return {
      isDownloading: this.isDownloading,
      isPaused: this.isPaused,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries
    };
  }
}

export const apkDownloader = new APKDownloader();