import { YouTubeClientConfig } from './types';

export const ANDROID_VR_1_43_32: YouTubeClientConfig = {
  clientName: 'ANDROID_VR',
  clientVersion: '1.43.32',
  clientId: '28',
  userAgent:
    'com.google.android.apps.youtube.vr.oculus/1.43.32 (Linux; U; Android 12; en_US; Quest 3; Build/SQ3A.220605.009.A1; Cronet/107.0.5284.2)',
  osName: 'Android',
  osVersion: '12',
  deviceMake: 'Oculus',
  deviceModel: 'Quest 3',
  androidSdkVersion: '32',
  buildId: 'SQ3A.220605.009.A1',
  cronetVersion: '107.0.5284.2',
  packageName: 'com.google.android.apps.youtube.vr.oculus',
  friendlyName: 'Android VR 1.43',
  loginSupported: false,
};

export const ANDROID_VR_1_61_48: YouTubeClientConfig = {
  clientName: 'ANDROID_VR',
  clientVersion: '1.61.48',
  clientId: '28',
  userAgent:
    'com.google.android.apps.youtube.vr.oculus/1.61.48 (Linux; U; Android 12; en_US; Quest 3; Build/SQ3A.220605.009.A1; Cronet/132.0.6808.3)',
  osName: 'Android',
  osVersion: '12',
  deviceMake: 'Oculus',
  deviceModel: 'Quest 3',
  androidSdkVersion: '32',
  buildId: 'SQ3A.220605.009.A1',
  cronetVersion: '132.0.6808.3',
  packageName: 'com.google.android.apps.youtube.vr.oculus',
  friendlyName: 'Android VR 1.61',
  loginSupported: false,
};

export const ANDROID_VR_NO_AUTH: YouTubeClientConfig = {
  clientName: 'ANDROID_VR',
  clientVersion: '1.61.48',
  clientId: '28',
  userAgent:
    'com.google.android.apps.youtube.vr.oculus/1.61.48 (Linux; U; Android 12; en_US; Oculus Quest 3; Build/SQ3A.220605.009.A1; Cronet/132.0.6808.3)',
  friendlyName: 'Android VR (No Auth)',
  loginSupported: false,
};

export const STREAM_CLIENTS: YouTubeClientConfig[] = [
  ANDROID_VR_1_43_32,
  ANDROID_VR_1_61_48,
  ANDROID_VR_NO_AUTH,
];
