import axios from 'axios';
import { Linking, Platform } from 'react-native';
import * as Device from 'expo-device';

const UPDATE_URL = 'https://shrawan13-glitch.github.io/AuraMusic-updates/v2/version.json';
const CURRENT_VERSION = '2.0.1';

export interface UpdateInfoV2 {
  latestVersion: string;
  releaseDate: string;
  isStrict: string;
  notes: string[];
  downloads: {
    universal: string;
    arm64: string;
    arm32: string;
    x86_64: string;
  };
}

export interface SelectedDownload {
  url: string;
  architecture: string;
}

// Detect device architecture
const getDeviceArchitecture = (): string => {
  if (Platform.OS !== 'android') return 'universal';
  
  // Get CPU architecture from device info
  const supportedAbis = Device.supportedCpuArchitectures || [];
  
  if (supportedAbis.includes('arm64-v8a')) return 'arm64';
  if (supportedAbis.includes('armeabi-v7a')) return 'arm32';
  if (supportedAbis.includes('x86_64')) return 'x86_64';
  
  return 'universal'; // Fallback
};

// Select best APK for device
const selectOptimalDownload = (downloads: UpdateInfoV2['downloads']): SelectedDownload => {
  const architecture = getDeviceArchitecture();
  
  // Get architecture-specific URL or fallback to universal
  let url = downloads[architecture as keyof typeof downloads] || downloads.universal;
  
  // Validate URL
  if (!url || !url.startsWith('http')) {
    console.warn(`Invalid URL for ${architecture}, falling back to universal`);
    url = downloads.universal;
  }
  
  // If universal is also invalid, use a placeholder
  if (!url || !url.startsWith('http')) {
    console.error('All download URLs are invalid');
    url = 'https://invalid-url.com/placeholder.apk';
  }
  
  return {
    url,
    architecture
  };
};

export const checkForUpdatesV2 = async (): Promise<{ hasUpdate: boolean; updateInfo?: UpdateInfoV2; selectedDownload?: SelectedDownload }> => {
  // Retry mechanism with timeout
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios.get(UPDATE_URL, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
        params: {
          _t: Date.now(),
        },
        timeout: 8000,
      });
      
      const updateInfo: UpdateInfoV2 = response.data;
      
      if (!updateInfo || !updateInfo.latestVersion) {
        console.log('Invalid update response: missing version info');
        return { hasUpdate: false };
      }
      
      // Validate downloads object
      if (!updateInfo.downloads || !updateInfo.downloads.universal) {
        console.log('Invalid update response: missing download URLs');
        return { hasUpdate: false };
      }
      
      const hasUpdate = compareVersions(updateInfo.latestVersion, CURRENT_VERSION) > 0;
      
      if (hasUpdate) {
        const selectedDownload = selectOptimalDownload(updateInfo.downloads);
        return { 
          hasUpdate, 
          updateInfo, 
          selectedDownload 
        };
      }
      
      return { hasUpdate: false };
      
    } catch (error: any) {
      console.log(`Update check attempt ${attempt} failed:`, error?.message || error);
      if (attempt === 3) {
        return { hasUpdate: false };
      }
      // Exponential backoff: wait 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }
  }
  return { hasUpdate: false };
};

const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }
  return 0;
};

export const openUpdateUrl = (url: string) => {
  Linking.openURL(url);
};

export const getCurrentVersion = () => CURRENT_VERSION;

export const getDeviceInfo = () => ({
  architecture: getDeviceArchitecture(),
  supportedAbis: Device.supportedCpuArchitectures || [],
  platform: Platform.OS
});