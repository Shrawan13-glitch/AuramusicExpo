import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LibraryItem, LibrarySection } from './libraryParser';

const LIBRARY_CACHE_KEY = 'library_cache_v2';
const CACHE_VERSION = 2;

interface LibraryCachePayload {
  version: number;
  updatedAt: number;
  sections: LibrarySection[];
}

const optimizeThumbnailForLibrary = (url?: string) => {
  if (!url) return '';
  const clean = url.trim();
  if (!clean) return '';

  // YouTube image hosts: keep low-quality thumbnails for fast offline-first rendering.
  if (clean.includes('ytimg.com')) {
    return clean.replace(/(maxresdefault|hq720|sddefault|hqdefault|mqdefault)\.jpg.*/i, 'mqdefault.jpg');
  }

  // Googleusercontent style images.
  if (clean.includes('googleusercontent.com')) {
    const base = clean.split('=')[0];
    return `${base}=s180-c-k-c0x00ffffff-no-rj`;
  }

  return clean;
};

const sanitizeItem = (item: LibraryItem): LibraryItem => ({
  id: item.id,
  title: item.title,
  subtitle: item.subtitle,
  type: item.type,
  thumbnail: optimizeThumbnailForLibrary(item.thumbnail),
});

const sanitizeSections = (sections: LibrarySection[]): LibrarySection[] =>
  sections
    .map((section) => ({
      title: section.title,
      items: section.items.map(sanitizeItem),
    }))
    .filter((section) => section.items.length > 0);

const isValidPayload = (payload: any): payload is LibraryCachePayload =>
  payload &&
  typeof payload === 'object' &&
  Array.isArray(payload.sections) &&
  typeof payload.updatedAt === 'number';

export const readCachedLibrary = async (): Promise<LibrarySection[]> => {
  try {
    const raw = await AsyncStorage.getItem(LIBRARY_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!isValidPayload(parsed)) return [];
    return sanitizeSections(parsed.sections);
  } catch {
    return [];
  }
};

export const writeCachedLibrary = async (sections: LibrarySection[]) => {
  try {
    const payload: LibraryCachePayload = {
      version: CACHE_VERSION,
      updatedAt: Date.now(),
      sections: sanitizeSections(sections),
    };
    await AsyncStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // no-op
  }
};

