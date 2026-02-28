import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HomeFeedSection } from './homeFeedParser';

const HOME_FEED_CACHE_KEY = 'home_feed_cache_v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

interface HomeFeedCachePayload {
  updatedAt: number;
  sections: HomeFeedSection[];
  continuationToken?: string;
}

const optimizeThumb = (url?: string) => {
  if (!url) return '';
  if (url.includes('ytimg.com')) {
    return url.replace(/(maxresdefault|hq720|sddefault|hqdefault|mqdefault)\.jpg.*/i, 'mqdefault.jpg');
  }
  if (url.includes('googleusercontent.com')) {
    const base = url.split('=')[0];
    return `${base}=s180-c-k-c0x00ffffff-no-rj`;
  }
  return url;
};

const sanitize = (sections: HomeFeedSection[]): HomeFeedSection[] =>
  sections
    .map((section) => ({
      title: section.title,
      items: section.items.map((item) => ({
        ...item,
        thumbnail: optimizeThumb(item.thumbnail),
      })),
    }))
    .filter((section) => section.items.length > 0);

export const readCachedHomeFeed = async (): Promise<{ sections: HomeFeedSection[]; continuationToken?: string; isStale: boolean }> => {
  try {
    const raw = await AsyncStorage.getItem(HOME_FEED_CACHE_KEY);
    if (!raw) return { sections: [], continuationToken: undefined, isStale: true };
    const parsed = JSON.parse(raw) as HomeFeedCachePayload;
    const updatedAt = typeof parsed?.updatedAt === 'number' ? parsed.updatedAt : 0;
    const sections = Array.isArray(parsed?.sections) ? sanitize(parsed.sections) : [];
    const isStale = Date.now() - updatedAt > CACHE_TTL_MS;
    const continuationToken = typeof parsed?.continuationToken === 'string' ? parsed.continuationToken : undefined;
    return { sections, continuationToken, isStale };
  } catch {
    return { sections: [], continuationToken: undefined, isStale: true };
  }
};

export const writeCachedHomeFeed = async (sections: HomeFeedSection[], continuationToken?: string) => {
  try {
    const payload: HomeFeedCachePayload = {
      updatedAt: Date.now(),
      sections: sanitize(sections),
      continuationToken,
    };
    await AsyncStorage.setItem(HOME_FEED_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // no-op
  }
};
