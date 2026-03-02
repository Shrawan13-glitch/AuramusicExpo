import * as Updates from 'expo-updates';

export interface OtaCheckResult {
  isAvailable: boolean;
  isPending: boolean;
  message?: string;
}

const isOtaUsable = () => {
  if (__DEV__) return false;
  return Updates.isEnabled;
};

export const checkAndFetchOtaUpdate = async (): Promise<OtaCheckResult> => {
  if (!isOtaUsable()) {
    return {
      isAvailable: false,
      isPending: false,
      message: 'OTA is disabled in this build.',
    };
  }

  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) {
      return { isAvailable: false, isPending: false };
    }

    const fetched = await Updates.fetchUpdateAsync();
    if (fetched.isNew) {
      return { isAvailable: true, isPending: true, message: 'Update downloaded and ready to apply.' };
    }

    return { isAvailable: true, isPending: false, message: 'Update available but could not be downloaded yet.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check OTA updates.';
    return { isAvailable: false, isPending: false, message };
  }
};

export const applyOtaUpdateNow = async () => {
  if (!isOtaUsable()) {
    throw new Error('OTA is disabled in this build.');
  }
  await Updates.reloadAsync();
};
