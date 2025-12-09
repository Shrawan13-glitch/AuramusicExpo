import axios from 'axios';
import { Linking } from 'react-native';

const UPDATE_URL = 'https://shrawan13-glitch.github.io/AuraMusic-updates/version.json';
const CURRENT_VERSION = '1.0.0';

export interface UpdateInfo {
  latestVersion: string;
  downloadUrl: string;
  notes: string[];
  isStrict: string;
}

export const checkForUpdates = async (): Promise<{ hasUpdate: boolean; updateInfo?: UpdateInfo }> => {
  try {
    const response = await axios.get(UPDATE_URL, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      params: {
        _t: Date.now(), // Cache buster
      },
    });
    let data = response.data;
    if (typeof data === 'string') {
      // Remove trailing commas before parsing
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
    return { hasUpdate: false };
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
