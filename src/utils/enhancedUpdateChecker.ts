import * as Updates from 'expo-updates';
import axios from 'axios';
import { Linking, Platform } from 'react-native';

const UPDATE_URL = 'https://shrawan13-glitch.github.io/AuraMusic-updates/version.json';
const CURRENT_VERSION = '2.0.1';

export interface UpdateInfo {
  latestVersion: string;
  downloadUrl: string;
  notes: string[];
  isStrict: string;
  hasOTAUpdate?: boolean;
}

export const checkForUpdates = async (): Promise<{ hasUpdate: boolean; updateInfo?: UpdateInfo }> => {
  try {
    // Check for OTA updates first (Expo Updates)
    if (!__DEV__ && Updates.isEnabled) {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        return {
          hasUpdate: true,
          updateInfo: {
            latestVersion: 'OTA Update',
            downloadUrl: '',
            notes: ['Performance improvements and bug fixes'],
            isStrict: 'false',
            hasOTAUpdate: true
          }
        };
      }
    }

    // Check for store updates
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await axios.get(UPDATE_URL, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
          params: { _t: Date.now() },
          timeout: 8000,
        });

        let data = response.data;
        if (typeof data === 'string') {
          data = data.replace(/,\s*(\]|\})/g, '$1');
          data = JSON.parse(data);
        }

        const updateInfo: UpdateInfo = data?.update;
        if (!updateInfo || !updateInfo.latestVersion) {
          return { hasUpdate: false };
        }

        const hasUpdate = compareVersions(updateInfo.latestVersion, CURRENT_VERSION) > 0;
        return { hasUpdate, updateInfo: hasUpdate ? updateInfo : undefined };

      } catch (error) {
        if (attempt === 3) {
          return { hasUpdate: false };
        }
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
      }
    }
  } catch (error) {
    console.log('Update check failed:', error);
  }

  return { hasUpdate: false };
};

export const applyUpdate = async (updateInfo: UpdateInfo): Promise<boolean> => {
  try {
    if (updateInfo.hasOTAUpdate && !__DEV__ && Updates.isEnabled) {
      // Apply OTA update
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
      return true;
    } else {
      // Open store for manual update
      openUpdateUrl(updateInfo.downloadUrl);
      return false;
    }
  } catch (error) {
    console.log('Update failed:', error);
    return false;
  }
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