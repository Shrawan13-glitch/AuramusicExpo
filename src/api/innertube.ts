import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Song, Artist } from '../types';

// Configure axios defaults for better performance
axios.defaults.timeout = 8000; // Reduced timeout for faster failures
axios.defaults.headers.common['Accept-Encoding'] = 'gzip, deflate';

// Simple cache for API responses with LRU-like behavior
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 3 * 60 * 1000; // Reduced to 3 minutes for fresher data
const MAX_CACHE_SIZE = 50; // Reduced cache size

const getCachedData = (key: string) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    // Move to end (LRU)
    cache.delete(key);
    cache.set(key, cached);
    return cached.data;
  }
  cache.delete(key); // Remove expired
  return null;
};

const setCachedData = (key: string, data: any) => {
  // Clean old cache entries more aggressively
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { data, timestamp: Date.now() });
};

// Optimize thumbnail URLs for better performance
const optimizeThumbnail = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  // Use smaller thumbnail size for better performance
  return url.replace(/=w\d+-h\d+/, '=w300-h300').replace(/=s\d+/, '=s300');
};

// Request deduplication to prevent duplicate API calls
const pendingRequests = new Map<string, Promise<any>>();

const deduplicateRequest = async <T>(key: string, requestFn: () => Promise<T>): Promise<T> => {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }
  
  const promise = requestFn().finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
};

const API_KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30';
const BASE_URL = 'https://music.youtube.com/youtubei/v1';

const CLIENTS = {
  WEB_REMIX: {
    clientName: 'WEB_REMIX',
    clientVersion: '1.20231122.01.00',
    clientId: 67,
  },
  ANDROID: {
    clientName: 'ANDROID',
    clientVersion: '19.09.37',
    clientId: 3,
  },
  IOS: {
    clientName: 'IOS',
    clientVersion: '19.09.3',
    clientId: 5,
  },
};

const createContext = (client = CLIENTS.WEB_REMIX) => ({
  client: {
    ...client,
    hl: 'en',
    gl: 'US',
  },
});

const parseCookies = (cookieString: string): Record<string, string> => {
  const cookies: Record<string, string> = {};
  cookieString.split(';').forEach(cookie => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) cookies[key] = value;
  });
  return cookies;
};

const sha1 = async (str: string): Promise<string> => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA1,
    str
  );
};

const getHeaders = async (setLogin: boolean = false) => {
  const headers: Record<string, string> = {
    'X-Goog-Api-Format-Version': '1',
    'X-YouTube-Client-Name': '67',
    'X-YouTube-Client-Version': '1.20231122.01.00',
    'X-Origin': 'https://music.youtube.com',
    'Referer': 'https://music.youtube.com/',
  };

  if (setLogin) {
    const cookies = await AsyncStorage.getItem('ytm_cookies');
    if (cookies) {
      headers['Cookie'] = cookies;
      const cookieMap = parseCookies(cookies);
      if (cookieMap['SAPISID']) {
        const currentTime = Math.floor(Date.now() / 1000);
        const sapisidHash = await sha1(`${currentTime} ${cookieMap['SAPISID']} https://music.youtube.com`);
        headers['Authorization'] = `SAPISIDHASH ${currentTime}_${sapisidHash}`;
      }
    }
  }

  return headers;
};

const parseThumbnail = (thumbnails: any[]): string | undefined => {
  if (!thumbnails || thumbnails.length === 0) return undefined;
  const url = thumbnails[thumbnails.length - 1]?.url;
  return optimizeThumbnail(url?.split('=')[0]);
};

const parseArtists = (runs: any[]): Artist[] => {
  if (!runs) return [];
  return runs
    .filter(run => run.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC'))
    .map(run => ({
      id: run.navigationEndpoint.browseEndpoint.browseId,
      name: run.text,
    }));
};

const parseSongFromRenderer = (renderer: any): Song | null => {
  try {
    // Primary path: playlistItemData.videoId (for playlist items)
    const videoId = renderer.playlistItemData?.videoId || 
                    renderer.navigationEndpoint?.watchEndpoint?.videoId ||
                    renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
    
    if (!videoId) return null;

    const title = renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
    if (!title) return null;

    const artistRuns = renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
    const artists = parseArtists(artistRuns);
    const thumbnail = parseThumbnail(renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails);

    return {
      id: videoId,
      title,
      artists,
      duration: -1,
      thumbnailUrl: thumbnail,
    };
  } catch (e) {
    return null;
  }
};

const parseSongFromTwoRow = (renderer: any): Song | null => {
  try {
    const videoId = renderer.navigationEndpoint?.watchEndpoint?.videoId ||
                    renderer.navigationEndpoint?.browseEndpoint?.browseId;
    if (!videoId) return null;

    const title = renderer.title?.runs?.[0]?.text;
    if (!title) return null;

    const artists = parseArtists(renderer.subtitle?.runs || []);
    const thumbnail = parseThumbnail(renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails);

    return {
      id: videoId,
      title,
      artists,
      duration: -1,
      thumbnailUrl: thumbnail,
    };
  } catch (e) {
    return null;
  }
};

export const InnerTube = {
  async searchSuggestions(query: string): Promise<string[]> {
    const cacheKey = `suggestions_${query}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;
    
    return deduplicateRequest(cacheKey, async () => {
      try {
        const headers = await getHeaders(false);
        const response = await axios.post(
          `${BASE_URL}/music/get_search_suggestions?key=${API_KEY}`,
          {
            context: createContext(),
            input: query,
          },
          { headers, timeout: 3000 }
        );

      const suggestions = response.data?.contents?.[0]?.searchSuggestionsSectionRenderer?.contents
        ?.map((item: any) => {
          const runs = item.searchSuggestionRenderer?.suggestion?.runs;
          if (!runs) return null;
          return runs.map((run: any) => run.text).join('');
        })
        ?.filter((text: string | null) => text) || [];

        setCachedData(cacheKey, suggestions);
        return suggestions;
      } catch (error) {
        return [];
      }
    });
  },

  async next(videoId: string, continuation?: string): Promise<{ songs: Song[]; continuation: string | null }> {
    const cacheKey = continuation ? `next_cont_${continuation}` : `next_${videoId}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;
    
    return deduplicateRequest(cacheKey, async () => {
      try {
        const payload: any = {
          context: createContext(),
        };

        if (continuation) {
          payload.continuation = continuation;
        } else {
          payload.videoId = videoId;
          payload.playlistId = `RDAMVM${videoId}`;
        }

        const response = await axios.post(
          `${BASE_URL}/next?key=${API_KEY}`,
          payload,
          { timeout: 4000 }
        );

      let playlistPanelRenderer;
      
      if (continuation) {
        playlistPanelRenderer = response.data?.continuationContents?.playlistPanelContinuation;
      } else {
        playlistPanelRenderer = response.data?.contents?.singleColumnMusicWatchNextResultsRenderer
          ?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content
          ?.musicQueueRenderer?.content?.playlistPanelRenderer;
      }

      if (!playlistPanelRenderer) {
        return { songs: [], continuation: null };
      }

      const songs: Song[] = [];
      playlistPanelRenderer.contents?.forEach((content: any) => {
        const renderer = content.playlistPanelVideoRenderer;
        if (!renderer) return;

        const videoId = renderer.videoId;
        const title = renderer.title?.runs?.[0]?.text;
        if (!videoId || !title) return;

        const artistRuns = renderer.longBylineText?.runs || [];
        const artists = parseArtists(artistRuns);
        const thumbnail = parseThumbnail(renderer.thumbnail?.thumbnails);

        songs.push({
          id: videoId,
          title,
          artists,
          duration: -1,
          thumbnailUrl: thumbnail,
        });
      });

        const nextContinuation = playlistPanelRenderer.continuations?.[0]?.nextRadioContinuationData?.continuation;

        const result = { songs, continuation: nextContinuation };
        setCachedData(cacheKey, result);
        return result;
      } catch (error) {
        return { songs: [], continuation: null };
      }
    });
  },

  async getHomeContinuation(continuation: string): Promise<{ sections: any[]; continuation: string | null }> {
    try {
      const headers = await getHeaders(true);
      const response = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          continuation,
        },
        { headers }
      );

      const contents = response.data?.continuationContents?.sectionListContinuation?.contents ||
                       response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
                         ?.tabRenderer?.content?.sectionListRenderer?.contents;
      
      const nextContinuation = response.data?.continuationContents?.sectionListContinuation?.continuations?.[0]?.nextContinuationData?.continuation ||
                               response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
                                 ?.tabRenderer?.content?.sectionListRenderer?.continuations?.[0]?.nextContinuationData?.continuation;

      if (!contents) {
        return { sections: [], continuation: null };
      }

      const sections: any[] = [];

      contents.forEach((content: any) => {
        const carousel = content.musicCarouselShelfRenderer;
        if (!carousel) return;

        const title = carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text;
        if (!title) return;

        const items: any[] = [];

        carousel.contents?.forEach((item: any) => {
          if (item.musicTwoRowItemRenderer) {
            const renderer = item.musicTwoRowItemRenderer;
            const browseId = renderer.navigationEndpoint?.browseEndpoint?.browseId;
            const videoId = renderer.navigationEndpoint?.watchEndpoint?.videoId;
            const playlistId = renderer.navigationEndpoint?.watchEndpoint?.playlistId;
            const itemTitle = renderer.title?.runs?.[0]?.text;
            const subtitle = renderer.subtitle?.runs?.map((r: any) => r.text).join('') || '';
            const thumbnail = parseThumbnail(renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails);
            
            // Mix (has both videoId and playlistId)
            if (videoId && playlistId && itemTitle) {
              items.push({ id: playlistId, videoId, title: itemTitle, subtitle, thumbnailUrl: thumbnail, type: 'playlist' });
            }
            // Regular Playlist
            else if (playlistId && itemTitle) {
              items.push({ id: playlistId, title: itemTitle, subtitle, thumbnailUrl: thumbnail, type: 'playlist' });
            }
            // Video/Song
            else if (videoId && itemTitle) {
              const artists = parseArtists(renderer.subtitle?.runs || []);
              items.push({ id: videoId, title: itemTitle, artists, thumbnailUrl: thumbnail, duration: -1, type: 'song' });
            }
            // Artist
            else if (browseId?.startsWith('UC') && itemTitle) {
              items.push({ id: browseId, name: itemTitle, thumbnailUrl: thumbnail, type: 'artist' });
            }
            // Album/Playlist
            else if (browseId && itemTitle) {
              const isAlbum = browseId.startsWith('MPRE') || subtitle.toLowerCase().includes('album') || subtitle.toLowerCase().includes('ep') || subtitle.toLowerCase().includes('single');
              items.push({ id: browseId, title: itemTitle, subtitle, thumbnailUrl: thumbnail, type: isAlbum ? 'album' : 'playlist' });
            }
          } else if (item.musicResponsiveListItemRenderer) {
            const song = parseSongFromRenderer(item.musicResponsiveListItemRenderer);
            if (song) items.push({ ...song, type: 'song' });
          }
        });

        if (items.length > 0) {
          sections.push({ title, items });
        }
      });

      return { sections, continuation: nextContinuation };
    } catch (error) {
      return { sections: [], continuation: null };
    }
  },

  async searchSummary(query: string): Promise<{ topResult: any | null; sections: any[] }> {
    try {
      const headers = await getHeaders(true);
      const response = await axios.post(
        `${BASE_URL}/search?key=${API_KEY}`,
        {
          context: createContext(),
          query,
        },
        { headers }
      );

      const contents = response.data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.contents;

      let topResult = null;
      const sections: any[] = [];

      contents?.forEach((section: any) => {
        // Top result (musicCardShelfRenderer)
        if (section.musicCardShelfRenderer) {
          const card = section.musicCardShelfRenderer;
          const title = card.header?.musicCardShelfHeaderBasicRenderer?.title?.runs?.[0]?.text || 'Top result';
          const items: any[] = [];

          // Parse card content
          card.contents?.forEach((item: any) => {
            const renderer = item.musicResponsiveListItemRenderer;
            if (!renderer) return;

            const browseId = renderer.navigationEndpoint?.browseEndpoint?.browseId;
            const videoId = renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
            const itemTitle = renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
            const thumbnail = parseThumbnail(renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails);

            if (videoId && itemTitle) {
              const artists = parseArtists(renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []);
              items.push({ id: videoId, title: itemTitle, artists, thumbnailUrl: thumbnail, duration: -1, type: 'song' });
            } else if (browseId?.startsWith('UC') && itemTitle) {
              items.push({ id: browseId, name: itemTitle, thumbnailUrl: thumbnail, type: 'artist' });
            } else if (browseId && itemTitle) {
              const isAlbum = browseId.startsWith('MPRE');
              items.push({ id: browseId, title: itemTitle, thumbnailUrl: thumbnail, type: isAlbum ? 'album' : 'playlist' });
            }
          });

          if (items.length > 0) {
            topResult = items[0];
            sections.push({ title, items });
          }
        }
        // Regular sections (musicShelfRenderer)
        else if (section.musicShelfRenderer) {
          const shelf = section.musicShelfRenderer;
          const title = shelf.title?.runs?.[0]?.text || 'Results';

          const items: any[] = [];
          shelf.contents?.forEach((item: any) => {
            const renderer = item.musicResponsiveListItemRenderer;
            if (!renderer) return;

            const flexColumns = renderer.flexColumns || [];
            const navigationEndpoint = renderer.navigationEndpoint;
            const thumbnail = parseThumbnail(renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails);
            const overlay = renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer;

            if (overlay?.playNavigationEndpoint?.watchEndpoint) {
              const videoId = overlay.playNavigationEndpoint.watchEndpoint.videoId;
              const itemTitle = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
              const artists = parseArtists(flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []);
              if (videoId && itemTitle) {
                items.push({ id: videoId, title: itemTitle, artists, thumbnailUrl: thumbnail, duration: -1, type: 'song' });
              }
            } else if (navigationEndpoint?.browseEndpoint) {
              const browseId = navigationEndpoint.browseEndpoint.browseId;
              const itemTitle = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
              
              if (browseId?.startsWith('UC')) {
                items.push({ id: browseId, name: itemTitle, thumbnailUrl: thumbnail, type: 'artist' });
              } else if (browseId?.startsWith('VL') || browseId?.startsWith('PL') || browseId?.startsWith('RDCLAK')) {
                const playlistId = browseId.startsWith('VL') ? browseId.substring(2) : browseId;
                items.push({ id: playlistId, title: itemTitle, thumbnailUrl: thumbnail, type: 'playlist' });
              } else if (browseId) {
                items.push({ id: browseId, title: itemTitle, thumbnailUrl: thumbnail, type: 'album' });
              }
            }
          });

          if (items.length > 0) {
            sections.push({ title, items });
          }
        }
      });

      if (sections.length === 0 && contents) {
      }
      return { topResult, sections };
    } catch (error) {
      return { topResult: null, sections: [] };
    }
  },

  async search(query: string, filter?: string): Promise<{ items: any[]; continuation: string | null }> {
    const cacheKey = `search_${query}_${filter || 'all'}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;
    
    return deduplicateRequest(cacheKey, async () => {
      try {
        const payload: any = {
          context: createContext(),
          query,
        };

        if (filter) {
          payload.params = filter;
        }

        const headers = await getHeaders(true);
        const response = await axios.post(
          `${BASE_URL}/search?key=${API_KEY}`,
          payload,
          { headers, timeout: 4000 }
        );

      const shelf = response.data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.contents?.find((c: any) => c.musicShelfRenderer)?.musicShelfRenderer;

      const items: any[] = [];
      shelf?.contents?.forEach((item: any) => {
        const renderer = item.musicResponsiveListItemRenderer;
        if (!renderer) return;

        const flexColumns = renderer.flexColumns || [];
        const navigationEndpoint = renderer.navigationEndpoint;
        const thumbnail = parseThumbnail(renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails);
        const overlay = renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer;

        if (overlay?.playNavigationEndpoint?.watchEndpoint) {
          const videoId = overlay.playNavigationEndpoint.watchEndpoint.videoId;
          const title = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
          const artists = parseArtists(flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []);
          if (videoId && title) {
            items.push({ id: videoId, title, artists, thumbnailUrl: thumbnail, duration: -1, type: 'song' });
          }
        } else if (navigationEndpoint?.browseEndpoint) {
          const browseId = navigationEndpoint.browseEndpoint.browseId;
          const title = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
          
          if (browseId?.startsWith('UC')) {
            items.push({ id: browseId, name: title, thumbnailUrl: thumbnail, type: 'artist' });
          } else if (browseId?.startsWith('VL') || browseId?.startsWith('PL') || browseId?.startsWith('RDCLAK')) {
            const playlistId = browseId.startsWith('VL') ? browseId.substring(2) : browseId;
            items.push({ id: playlistId, title, thumbnailUrl: thumbnail, type: 'playlist' });
          } else {
            items.push({ id: browseId, title, thumbnailUrl: thumbnail, type: 'album' });
          }
        }
      });

        const continuation = shelf?.continuations?.[0]?.nextContinuationData?.continuation;

        const result = { items, continuation };
        setCachedData(cacheKey, result);
        return result;
      } catch (error) {
        return { items: [], continuation: null };
      }
    });
  },

  async getHome(): Promise<{ quickPicks: Song[]; sections: any[]; continuation: string | null }> {
    const cacheKey = 'home_data';
    const cached = getCachedData(cacheKey);
    if (cached) return cached;
    
    return deduplicateRequest(cacheKey, async () => {
      try {
        const headers = await getHeaders(true);
        const response = await axios.post(
          `${BASE_URL}/browse?key=${API_KEY}`,
          {
            context: createContext(),
            browseId: 'FEmusic_home',
          },
          { headers, timeout: 6000 }
        );

      const contents = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.contents;

      if (!contents) {
        return { quickPicks: [], sections: [], continuation: null };
      }

      const quickPicks: Song[] = [];
      const sections: any[] = [];

      contents.forEach((content: any) => {
        const carousel = content.musicCarouselShelfRenderer;
        if (!carousel) return;

        const title = carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text;
        if (!title) return;

        const items: any[] = [];

        carousel.contents?.forEach((item: any) => {
          if (item.musicTwoRowItemRenderer) {
            const renderer = item.musicTwoRowItemRenderer;
            const browseId = renderer.navigationEndpoint?.browseEndpoint?.browseId;
            const videoId = renderer.navigationEndpoint?.watchEndpoint?.videoId;
            const playlistId = renderer.navigationEndpoint?.watchEndpoint?.playlistId;
            const itemTitle = renderer.title?.runs?.[0]?.text;
            const subtitle = renderer.subtitle?.runs?.map((r: any) => r.text).join('') || '';
            const thumbnails = renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails;
            const thumbnail = thumbnails?.[thumbnails.length - 1]?.url;
            
            // Mix (has both videoId and playlistId)
            if (videoId && playlistId && itemTitle) {
              items.push({ id: playlistId, videoId, title: itemTitle, subtitle, thumbnailUrl: thumbnail, type: 'playlist' });
            }
            // Regular Playlist
            else if (playlistId && itemTitle) {
              items.push({ id: playlistId, title: itemTitle, subtitle, thumbnailUrl: thumbnail, type: 'playlist' });
            }
            // Video/Song
            else if (videoId && itemTitle) {
              const artists = parseArtists(renderer.subtitle?.runs || []);
              items.push({ id: videoId, title: itemTitle, artists, thumbnailUrl: thumbnail, duration: -1, type: 'song' });
            }
            // Artist
            else if (browseId?.startsWith('UC') && itemTitle) {
              items.push({ id: browseId, name: itemTitle, thumbnailUrl: thumbnail, type: 'artist' });
            }
            // Album/Playlist
            else if (browseId && itemTitle) {
              const isAlbum = browseId.startsWith('MPRE') || subtitle.toLowerCase().includes('album') || subtitle.toLowerCase().includes('ep') || subtitle.toLowerCase().includes('single');
              items.push({ id: browseId, title: itemTitle, subtitle, thumbnailUrl: thumbnail, type: isAlbum ? 'album' : 'playlist' });
            }
          } else if (item.musicResponsiveListItemRenderer) {
            const song = parseSongFromRenderer(item.musicResponsiveListItemRenderer);
            if (song) items.push({ ...song, type: 'song' });
          }
        });

        if (items.length > 0) {
          // Always add to sections, don't extract as separate quickPicks
          sections.push({ title, items });
        }
      });

      const continuation = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.continuations?.[0]
        ?.nextContinuationData?.continuation;

        const result = { quickPicks, sections, continuation };
        setCachedData(cacheKey, result);
        return result;
      } catch (error) {
        return { quickPicks: [], sections: [], continuation: null };
      }
    });
  },

  async getArtist(browseId: string): Promise<any> {
    const cacheKey = `artist_${browseId}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;
    
    return deduplicateRequest(cacheKey, async () => {
      try {
        const response = await axios.post(
          `${BASE_URL}/browse?key=${API_KEY}`,
          {
            context: createContext(),
            browseId,
          },
          { timeout: 5000 }
        );

      const header = response.data?.header?.musicImmersiveHeaderRenderer || response.data?.header?.musicVisualHeaderRenderer;
      const contents = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;

      const artist = {
        id: browseId,
        name: header?.title?.runs?.[0]?.text,
        thumbnail: parseThumbnail(header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails),
        shuffleEndpoint: header?.playButton?.buttonRenderer?.navigationEndpoint?.watchEndpoint,
        radioEndpoint: header?.startRadioButton?.buttonRenderer?.navigationEndpoint?.watchEndpoint,
      };

      const sections: any[] = [];
      contents?.forEach((content: any) => {
        // Handle musicShelfRenderer (songs)
        if (content.musicShelfRenderer) {
          const shelf = content.musicShelfRenderer;
          const title = shelf.title?.runs?.[0]?.text;
          if (!title) return;

          const items: any[] = [];
          shelf.contents?.forEach((item: any) => {
            const song = parseSongFromRenderer(item.musicResponsiveListItemRenderer);
            if (song) items.push({ ...song, type: 'song' });
          });

          const moreEndpoint = shelf.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint;

          if (items.length > 0) {
            sections.push({ title, items, moreEndpoint });
          }
        }
        // Handle musicCarouselShelfRenderer (albums, playlists, videos, artists)
        else if (content.musicCarouselShelfRenderer) {
          const shelf = content.musicCarouselShelfRenderer;
          const title = shelf.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text;
          if (!title) return;

          const items: any[] = [];
          shelf.contents?.forEach((item: any) => {
            if (item.musicTwoRowItemRenderer) {
              const renderer = item.musicTwoRowItemRenderer;
              const browseId = renderer.navigationEndpoint?.browseEndpoint?.browseId;
              const videoId = renderer.navigationEndpoint?.watchEndpoint?.videoId;
              const itemTitle = renderer.title?.runs?.[0]?.text;
              const subtitle = renderer.subtitle?.runs?.[0]?.text;
              const thumbnail = parseThumbnail(renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails);
              
              // Video
              if (videoId && itemTitle) {
                items.push({
                  id: videoId,
                  title: itemTitle,
                  subtitle,
                  thumbnailUrl: thumbnail,
                  type: 'video',
                });
              }
              // Artist/Album/Playlist
              else if (browseId && itemTitle) {
                if (browseId.startsWith('UC')) {
                  // Artist
                  items.push({
                    id: browseId,
                    name: itemTitle,
                    thumbnailUrl: thumbnail,
                    type: 'artist',
                  });
                } else {
                  const isAlbum = browseId.startsWith('MPRE') || 
                                 subtitle?.toLowerCase().includes('album') || 
                                 subtitle?.toLowerCase().includes('ep') ||
                                 subtitle?.toLowerCase().includes('single');
                  
                  items.push({
                    id: browseId,
                    title: itemTitle,
                    subtitle,
                    thumbnailUrl: thumbnail,
                    type: isAlbum ? 'album' : 'playlist',
                  });
                }
              }
            }
          });

          const moreEndpoint = shelf.header?.musicCarouselShelfBasicHeaderRenderer?.moreContentButton?.buttonRenderer?.navigationEndpoint?.browseEndpoint;

          if (items.length > 0) {
            sections.push({ title, items, moreEndpoint });
          }
        }
      });

        const result = { artist, sections };
        setCachedData(cacheKey, result);
        return result;
      } catch (error) {
        return null;
      }
    });
  },

  async getAlbum(browseId: string): Promise<any> {
    const cacheKey = `album_${browseId}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;
    
    return deduplicateRequest(cacheKey, async () => {
      try {
        // First browse with the browseId directly (includes MPRE prefix)
        const response = await axios.post(
          `${BASE_URL}/browse?key=${API_KEY}`,
          {
            context: createContext(),
            browseId,
          },
          { timeout: 5000 }
        );

      // Extract playlistId from canonical URL
      const playlistId = response.data?.microformat?.microformatDataRenderer?.urlCanonical?.split('=').pop();
      if (!playlistId) {
        return null;
      }

      // Now load songs using VL{playlistId}
      const songsResponse = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          browseId: `VL${playlistId}`,
        }
      );

      const songs: Song[] = [];
      const secondaryContents = songsResponse.data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents;
      let continuation = null;

      secondaryContents?.forEach((content: any) => {
        const shelf = content.musicPlaylistShelfRenderer || content.musicShelfRenderer;
        if (!shelf) return;

        shelf.contents?.forEach((item: any) => {
          const song = parseSongFromRenderer(item.musicResponsiveListItemRenderer);
          if (song) songs.push(song);
        });

        continuation = shelf.continuations?.[0]?.nextContinuationData?.continuation;
      });

      // Load all songs with continuation
      let nextContinuation = continuation;
      while (nextContinuation) {
        const contResponse = await axios.post(
          `${BASE_URL}/browse?key=${API_KEY}`,
          {
            context: createContext(),
            continuation: nextContinuation,
          },
          { headers }
        );

        const contContents = contResponse.data?.continuationContents?.musicPlaylistShelfContinuation?.contents || [];

        contContents.forEach((item: any) => {
          const song = parseSongFromRenderer(item.musicResponsiveListItemRenderer);
          if (song) songs.push(song);
        });

        nextContinuation = contResponse.data?.continuationContents?.musicPlaylistShelfContinuation?.continuations?.[0]?.nextContinuationData?.continuation;
      }

      // Get album info from first song's response
      const firstTab = songsResponse.data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0];
      const headerRenderer = firstTab?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicResponsiveHeaderRenderer;
      
      const album = {
        id: browseId,
        title: headerRenderer?.title?.runs?.[0]?.text || songs[0]?.title || 'Unknown Album',
        thumbnail: parseThumbnail(headerRenderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails) || songs[0]?.thumbnailUrl,
        artist: headerRenderer?.straplineTextOne?.runs?.[0]?.text || songs[0]?.artists?.[0]?.name || 'Unknown Artist',
        year: headerRenderer?.subtitle?.runs?.find((r: any) => /^\d{4}$/.test(r.text))?.text,
        type: 'Album',
      };

        const result = { album, songs };
        setCachedData(cacheKey, result);
        return result;
      } catch (error) {
        return null;
      }
    });
  },

  async getPlaylist(playlistId: string, videoId?: string): Promise<any> {
    // Always fetch fresh data - no caching for playlists
    try {
      // If it's a mix (has videoId), use next endpoint
      if (videoId) {
        const result = await this.next(videoId);
        const mixThumbnail = result.songs[0]?.thumbnailUrl;
        return {
          playlist: {
            id: playlistId,
            title: 'Mix',
            thumbnail: mixThumbnail,
            author: 'YouTube Music',
            songCount: `${result.songs.length}+ songs`,
          },
          songs: result.songs,
          continuation: result.continuation,
          isMix: true,
        };
      }

      const browseId = playlistId.startsWith('VL') ? playlistId : `VL${playlistId}`;
      const headers = await getHeaders(true);
      
      const response = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          browseId,
        },
        { headers, timeout: 5000 }
      );

      // Handle empty playlists with musicEditablePlaylistDetailHeaderRenderer
      const editableHeader = response.data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicEditablePlaylistDetailHeaderRenderer;
      
      if (editableHeader && !response.data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents) {
        const header = editableHeader.header?.musicResponsiveHeaderRenderer;
        return {
          playlist: {
            id: playlistId,
            title: header?.title?.runs?.[0]?.text || 'Playlist',
            thumbnail: parseThumbnail(header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails) || 'https://via.placeholder.com/200',
            author: header?.subtitle?.runs?.[0]?.text || 'Unknown',
            songCount: header?.secondSubtitle?.runs?.[0]?.text || '0 tracks',
          },
          songs: []
        };
      }

      const header = response.data?.header?.musicDetailHeaderRenderer || 
                     response.data?.header?.musicEditablePlaylistDetailHeaderRenderer?.header?.musicResponsiveHeaderRenderer ||
                     response.data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicResponsiveHeaderRenderer;
      
      // Try multiple paths for playlist contents
      const secondaryContents = response.data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents;
      const singleColumnContents = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
      const tabContents = response.data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
      const contents = secondaryContents || singleColumnContents || tabContents;

      const songs: Song[] = [];
      let continuation = null;

      contents?.forEach((content: any) => {
        const shelf = content.musicPlaylistShelfRenderer || content.musicShelfRenderer;
        if (!shelf) return;

        shelf.contents?.forEach((item: any) => {
          const song = parseSongFromRenderer(item.musicResponsiveListItemRenderer);
          if (song) songs.push(song);
        });

        continuation = shelf.continuations?.[0]?.nextContinuationData?.continuation;
      });

      const playlist = {
        id: playlistId,
        title: header?.title?.runs?.[0]?.text || editableHeader?.header?.musicResponsiveHeaderRenderer?.title?.runs?.[0]?.text || 'Playlist',
        thumbnail: parseThumbnail(header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || header?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails || editableHeader?.header?.musicResponsiveHeaderRenderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails) || songs[0]?.thumbnailUrl || 'https://via.placeholder.com/200',
        author: header?.straplineTextOne?.runs?.[0]?.text || header?.subtitle?.runs?.[0]?.text || editableHeader?.header?.musicResponsiveHeaderRenderer?.subtitle?.runs?.[0]?.text || 'Unknown',
        songCount: `${songs.length} songs`,
      };

      return { playlist, songs, continuation };
    } catch (error) {
      return null;
    }
  },

  async getPlaylistContinuation(continuation: string): Promise<{ songs: Song[]; continuation: string | null }> {
    try {
      const response = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          continuation,
        }
      );

      const songs: Song[] = [];
      const contents = response.data?.continuationContents?.musicPlaylistShelfContinuation?.contents || [];

      contents.forEach((item: any) => {
        const song = parseSongFromRenderer(item.musicResponsiveListItemRenderer);
        if (song) songs.push(song);
      });

      const nextContinuation = response.data?.continuationContents?.musicPlaylistShelfContinuation?.continuations?.[0]?.nextContinuationData?.continuation;

      return { songs, continuation: nextContinuation };
    } catch (error) {
      return { songs: [], continuation: null };
    }
  },

  async getArtistItems(browseId: string, params?: string): Promise<any> {
    try {
      const response = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          browseId,
          params,
        }
      );

      const singleColumn = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0];
      const title = response.data?.header?.musicHeaderRenderer?.title?.runs?.[0]?.text || singleColumn?.gridRenderer?.header?.gridHeaderRenderer?.title?.runs?.[0]?.text || '';
      
      const items: any[] = [];
      
      // Grid layout (albums, playlists)
      if (singleColumn?.gridRenderer) {
        singleColumn.gridRenderer.items?.forEach((item: any) => {
          if (item.musicTwoRowItemRenderer) {
            const renderer = item.musicTwoRowItemRenderer;
            const browseId = renderer.navigationEndpoint?.browseEndpoint?.browseId;
            const videoId = renderer.navigationEndpoint?.watchEndpoint?.videoId;
            const itemTitle = renderer.title?.runs?.[0]?.text;
            const subtitle = renderer.subtitle?.runs?.[0]?.text;
            const thumbnail = parseThumbnail(renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails);
            
            if (videoId) {
              items.push({ id: videoId, title: itemTitle, subtitle, thumbnailUrl: thumbnail, type: 'video' });
            } else if (browseId?.startsWith('UC')) {
              items.push({ id: browseId, name: itemTitle, thumbnailUrl: thumbnail, type: 'artist' });
            } else if (browseId) {
              const isAlbum = browseId.startsWith('MPRE') || subtitle?.toLowerCase().includes('album') || subtitle?.toLowerCase().includes('ep') || subtitle?.toLowerCase().includes('single');
              items.push({ id: browseId, title: itemTitle, subtitle, thumbnailUrl: thumbnail, type: isAlbum ? 'album' : 'playlist' });
            }
          }
        });
      }
      // List layout (songs)
      else if (singleColumn?.musicPlaylistShelfRenderer) {
        singleColumn.musicPlaylistShelfRenderer.contents?.forEach((item: any) => {
          const song = parseSongFromRenderer(item.musicResponsiveListItemRenderer);
          if (song) items.push({ ...song, type: 'song' });
        });
      }

      return { title, items };
    } catch (error) {
      return null;
    }
  },

  async explore(): Promise<any> {
    try {
      const headers = await getHeaders();
      const response = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          browseId: 'FEmusic_explore',
        },
        { headers }
      );

      const contents = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
      
      const newReleases: any[] = [];
      const moodAndGenres: any[] = [];

      contents.forEach((content: any) => {
        const carousel = content.musicCarouselShelfRenderer;
        if (!carousel) return;

        const browseId = carousel.header?.musicCarouselShelfBasicHeaderRenderer?.moreContentButton?.buttonRenderer?.navigationEndpoint?.browseEndpoint?.browseId;
        
        if (browseId === 'FEmusic_new_releases_albums') {
          carousel.contents?.forEach((item: any) => {
            const renderer = item.musicTwoRowItemRenderer;
            if (renderer) {
              const id = renderer.navigationEndpoint?.browseEndpoint?.browseId;
              const title = renderer.title?.runs?.[0]?.text;
              const subtitle = renderer.subtitle?.runs?.[0]?.text;
              const thumbnail = parseThumbnail(renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails);
              if (id && title) {
                newReleases.push({ id, title, subtitle, thumbnailUrl: thumbnail, type: 'album' });
              }
            }
          });
        } else if (browseId === 'FEmusic_moods_and_genres') {
          carousel.contents?.forEach((item: any) => {
            const renderer = item.musicNavigationButtonRenderer;
            if (renderer) {
              const params = renderer.clickCommand?.browseEndpoint?.params;
              const title = renderer.buttonText?.runs?.[0]?.text;
              if (params && title) {
                moodAndGenres.push({ params, title });
              }
            }
          });
        }
      });

      return { newReleases, moodAndGenres };
    } catch (error) {
      return { newReleases: [], moodAndGenres: [] };
    }
  },

  async newReleaseAlbums(): Promise<any[]> {
    try {
      const headers = await getHeaders();
      const response = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          browseId: 'FEmusic_new_releases_albums',
        },
        { headers }
      );

      const items = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.gridRenderer?.items || [];
      
      return items.map((item: any) => {
        const renderer = item.musicTwoRowItemRenderer;
        if (!renderer) return null;
        const id = renderer.navigationEndpoint?.browseEndpoint?.browseId;
        const title = renderer.title?.runs?.[0]?.text;
        const subtitle = renderer.subtitle?.runs?.[0]?.text;
        const thumbnail = parseThumbnail(renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails);
        return id && title ? { id, title, subtitle, thumbnailUrl: thumbnail, type: 'album' } : null;
      }).filter(Boolean);
    } catch (error) {
      return [];
    }
  },

  async moodAndGenres(): Promise<any[]> {
    try {
      const headers = await getHeaders();
      const response = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          browseId: 'FEmusic_moods_and_genres',
        },
        { headers }
      );

      const contents = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
      const genres: any[] = [];

      contents.forEach((content: any) => {
        const grid = content.gridRenderer;
        if (grid) {
          const title = grid.header?.gridHeaderRenderer?.title?.runs?.[0]?.text;
          const items = grid.items?.map((item: any) => {
            const renderer = item.musicNavigationButtonRenderer;
            const params = renderer?.clickCommand?.browseEndpoint?.params;
            const buttonText = renderer?.buttonText?.runs?.[0]?.text;
            return params && buttonText ? { params, title: buttonText } : null;
          }).filter(Boolean) || [];
          
          if (title && items.length > 0) {
            genres.push({ title, items });
          }
        }
      });

      return genres;
    } catch (error) {
      return [];
    }
  },

  async browse(browseId: string, params?: string): Promise<any> {
    try {
      const headers = await getHeaders();
      const response = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          browseId,
          params,
        },
        { headers }
      );

      const contents = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
      const title = response.data?.header?.musicHeaderRenderer?.title?.runs?.[0]?.text || '';
      const items: any[] = [];

      contents.forEach((content: any) => {
        if (content.musicCarouselShelfRenderer) {
          content.musicCarouselShelfRenderer.contents?.forEach((item: any) => {
            if (item.musicTwoRowItemRenderer) {
              const renderer = item.musicTwoRowItemRenderer;
              const id = renderer.navigationEndpoint?.browseEndpoint?.browseId?.replace('VL', '') || renderer.navigationEndpoint?.watchEndpoint?.playlistId;
              const itemTitle = renderer.title?.runs?.[0]?.text;
              const thumbnail = parseThumbnail(renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails);
              if (id && itemTitle) {
                items.push({ id, title: itemTitle, thumbnailUrl: thumbnail, type: 'playlist' });
              }
            }
          });
        }
      });

      return { title, items };
    } catch (error) {
      return { title: '', items: [] };
    }
  },

  async getAccountInfo(): Promise<any> {
    try {
      const headers = await getHeaders(true);
      const response = await axios.post(
        `${BASE_URL}/account/account_menu?key=${API_KEY}`,
        {
          context: createContext(),
        },
        { headers }
      );

      const accountHeader = response.data?.actions?.[0]?.openPopupAction?.popup?.multiPageMenuRenderer?.header?.activeAccountHeaderRenderer;
      if (!accountHeader) return null;

      return {
        name: accountHeader.accountName?.runs?.[0]?.text,
        email: accountHeader.accountEmail,
        channelHandle: accountHeader.channelHandle?.runs?.[0]?.text,
        thumbnail: parseThumbnail(accountHeader.accountPhoto?.thumbnails),
      };
    } catch (error) {
      return null;
    }
  },

  async getLibrary(browseId: string = 'VLLM'): Promise<any> {
    try {
      const headers = await getHeaders(true);
      const response = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          browseId,
          params: browseId === 'FEmusic_library_corpus_artists' ? 'ggMCCAU%3D' : undefined,
        },
        { headers }
      );

      const items: any[] = [];
      let continuation = null;

      // Handle subscribed artists (browseId: 'FEmusic_library_corpus_artists')
      if (browseId === 'FEmusic_library_corpus_artists') {
        const contents = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicShelfRenderer?.contents || [];
        
        contents.forEach((item: any) => {
          const renderer = item.musicResponsiveListItemRenderer;
          if (!renderer) return;
          
          const browseId = renderer.navigationEndpoint?.browseEndpoint?.browseId;
          const name = renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
          const thumbnail = parseThumbnail(renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails);
          
          if (browseId?.startsWith('UC') && name) {
            items.push({
              id: browseId,
              name,
              title: name,
              thumbnailUrl: thumbnail,
              type: 'artist'
            });
          }
        });
      }
      // Handle library landing page (browseId: 'FEmusic_library_landing')
      else if (browseId === 'FEmusic_library_landing') {
        const contents = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.gridRenderer?.items || [];
        
        contents.forEach((item: any) => {
          const renderer = item.musicTwoRowItemRenderer;
          if (!renderer) return;
          
          const navigationEndpoint = renderer.navigationEndpoint;
          const title = renderer.title?.runs?.[0]?.text;
          const subtitle = renderer.subtitle?.runs?.map((r: any) => r.text).join('') || '';
          const thumbnail = parseThumbnail(renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails);
          
          if (navigationEndpoint?.browseEndpoint) {
            const browseId = navigationEndpoint.browseEndpoint.browseId;
            
            if (browseId === 'VLLM') {
              // Liked Music
              items.push({
                id: 'VLLM',
                title: 'Liked music',
                subtitle: 'Auto playlist',
                thumbnailUrl: thumbnail,
                type: 'liked'
              });
            } else if (browseId?.startsWith('VL')) {
              // Playlist
              const playlistId = browseId.substring(2);
              items.push({
                id: playlistId,
                title,
                subtitle,
                thumbnailUrl: thumbnail,
                type: 'playlist'
              });
            } else if (browseId?.startsWith('UC')) {
              // Artist
              items.push({
                id: browseId,
                name: title,
                thumbnailUrl: thumbnail,
                type: 'artist'
              });
            } else if (browseId) {
              // Album or other content
              const isAlbum = browseId.startsWith('MPRE') || subtitle.toLowerCase().includes('album');
              items.push({
                id: browseId,
                title,
                subtitle,
                thumbnailUrl: thumbnail,
                type: isAlbum ? 'album' : 'playlist'
              });
            }
          }
        });
      }
      // Handle liked songs (browseId: 'VLLM')
      else if (browseId === 'VLLM') {
        const playlistShelf = response.data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer;
        
        if (playlistShelf) {
          playlistShelf.contents?.forEach((item: any) => {
            const renderer = item.musicResponsiveListItemRenderer;
            if (!renderer) return;
            
            const videoId = renderer.playlistItemData?.videoId;
            const title = renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
            
            if (videoId && title) {
              const artistRuns = renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
              const artists = parseArtists(artistRuns);
              const thumbnail = parseThumbnail(renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails);
              
              items.push({
                id: videoId,
                title,
                artists,
                thumbnailUrl: thumbnail,
                duration: -1,
                type: 'song'
              });
            }
          });
          
          continuation = playlistShelf.continuations?.[0]?.nextContinuationData?.continuation;
        }
      } else {
        // Handle other library sections (artists, playlists, etc.)
        const tabs = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs;
        const contents = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0];

        if (contents?.gridRenderer) {
          contents.gridRenderer.items?.forEach((item: any) => {
            const renderer = item.musicTwoRowItemRenderer;
            if (!renderer) return;
            const browseId = renderer.navigationEndpoint?.browseEndpoint?.browseId;
            const videoId = renderer.navigationEndpoint?.watchEndpoint?.videoId;
            const title = renderer.title?.runs?.[0]?.text;
            const name = title;
            const thumbnail = parseThumbnail(renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails);
            
            if (browseId?.startsWith('UC') && name) {
              items.push({ id: browseId, name, thumbnailUrl: thumbnail, type: 'artist' });
            } else if (browseId && title) {
              const id = browseId.replace('VL', '');
              items.push({ id, title, thumbnailUrl: thumbnail, type: 'playlist' });
            } else if (videoId && title) {
              const artists = parseArtists(renderer.subtitle?.runs || []);
              items.push({ id: videoId, title, artists, thumbnailUrl: thumbnail, duration: -1, type: 'song' });
            }
          });
        }
      }

      // Load continuation for liked songs
      if (browseId === 'VLLM' && continuation) {
        let nextContinuation = continuation;
        while (nextContinuation) {
          try {
            const contResponse = await axios.post(
              `${BASE_URL}/browse?key=${API_KEY}`,
              {
                context: createContext(),
                continuation: nextContinuation,
              },
              { headers }
            );

            const contPlaylistShelf = contResponse.data?.continuationContents?.musicPlaylistShelfContinuation;
            if (!contPlaylistShelf) break;

            contPlaylistShelf.contents?.forEach((item: any) => {
              const renderer = item.musicResponsiveListItemRenderer;
              if (!renderer) return;
              
              const videoId = renderer.playlistItemData?.videoId;
              const title = renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
              
              if (videoId && title) {
                const artistRuns = renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
                const artists = parseArtists(artistRuns);
                const thumbnail = parseThumbnail(renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails);
                
                items.push({
                  id: videoId,
                  title,
                  artists,
                  thumbnailUrl: thumbnail,
                  duration: -1,
                  type: 'song'
                });
              }
            });

            nextContinuation = contPlaylistShelf.continuations?.[0]?.nextContinuationData?.continuation;
          } catch (error) {
            break;
          }
        }
      }

      return { items };
    } catch (error) {
      return { items: [] };
    }
  },

  async likeSong(videoId: string, like: boolean = true): Promise<boolean> {
    try {
      const headers = await getHeaders(true);
      const visitorData = await AsyncStorage.getItem('ytm_visitor_data');
      const dataSyncId = await AsyncStorage.getItem('ytm_datasync_id');
      
      const endpoint = like ? 'like/like' : 'like/removelike';
      const response = await axios.post(
        `${BASE_URL}/${endpoint}?key=${API_KEY}`,
        {
          context: {
            ...createContext(),
            user: {
              onBehalfOfUser: dataSyncId || undefined,
            },
          },
          target: { videoId },
        },
        { headers }
      );
      return response.status === 200;
    } catch (error) {
      return false;
    }
  },

  async subscribeArtist(channelId: string, subscribe: boolean = true): Promise<boolean> {
    try {
      const headers = await getHeaders(true);
      const endpoint = subscribe ? 'subscription/subscribe' : 'subscription/unsubscribe';
      const response = await axios.post(
        `${BASE_URL}/${endpoint}?key=${API_KEY}`,
        {
          context: createContext(),
          channelIds: [channelId],
        },
        { headers }
      );
      return response.status === 200;
    } catch (error) {
      return false;
    }
  },

  async getStreamUrl(videoId: string, quality: string = 'high'): Promise<string | null> {
    const cacheKey = `stream_${videoId}_${quality}`;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;
    
    console.log('Fetching stream URL for videoId:', videoId);
    
    const clients = [CLIENTS.ANDROID, CLIENTS.IOS, CLIENTS.WEB_REMIX];
    
    for (const client of clients) {
      try {
        console.log('Trying client:', client.clientName);
        const response = await axios.post(
          `${BASE_URL}/player?key=${API_KEY}`,
          {
            context: createContext(client),
            videoId,
          },
          { timeout: 3000 }
        );

        console.log('Response status:', response.data?.playabilityStatus?.status);
        
        const formats = response.data?.streamingData?.adaptiveFormats || [];
        const audioFormats = formats.filter((f: any) => f.mimeType?.includes('audio') && f.url);
        
        console.log('Found audio formats:', audioFormats.length);
        
        if (audioFormats.length === 0) continue;
        
        // Sort by bitrate and select based on quality
        audioFormats.sort((a: any, b: any) => (a.bitrate || 0) - (b.bitrate || 0));
        
        let selectedFormat;
        if (quality === 'low') {
          selectedFormat = audioFormats[0];
        } else if (quality === 'medium') {
          selectedFormat = audioFormats[Math.floor(audioFormats.length / 2)];
        } else {
          selectedFormat = audioFormats[audioFormats.length - 1];
        }
        
        if (selectedFormat?.url) {
          console.log('Stream URL found:', selectedFormat.url.substring(0, 50) + '...');
          cache.set(cacheKey, { data: selectedFormat.url, timestamp: Date.now() - (CACHE_DURATION - 30000) });
          return selectedFormat.url;
        }
      } catch (error) {
        console.log('Client error:', client.clientName, error.message);
      }
    }

    console.log('No stream URL found for videoId:', videoId);
    return null;
  },

  async getLyrics(videoId: string): Promise<{ lines: Array<{ text: string; startTime?: number }> } | null> {
    try {
      // Get song info first
      const nextResponse = await axios.post(
        `${BASE_URL}/next?key=${API_KEY}`,
        {
          context: createContext(),
          videoId,
        }
      );

      const tabs = nextResponse.data?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs;
      const queueTab = tabs?.[0];
      const videoRenderer = queueTab?.tabRenderer?.content?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents?.[0]?.playlistPanelVideoRenderer;
      
      const title = videoRenderer?.title?.runs?.[0]?.text;
      const artistRuns = videoRenderer?.longBylineText?.runs || [];
      const artist = artistRuns.filter((r: any) => r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC'))
        .map((r: any) => r.text).join(', ');

      if (!title || !artist) return null;

      // Search LRCLIB
      const response = await axios.get('https://lrclib.net/api/search', {
        params: {
          track_name: title,
          artist_name: artist,
        },
      });

      if (!response.data || response.data.length === 0) return null;

      const result = response.data[0];
      const syncedLyrics = result.syncedLyrics;

      if (!syncedLyrics) {
        // Fallback to plain lyrics
        const plainLyrics = result.plainLyrics;
        if (!plainLyrics) return null;
        const lines = plainLyrics.split('\n').map((text: string) => ({ text }));
        return { lines };
      }

      // Parse synced lyrics (LRC format)
      const lines = syncedLyrics.split('\n')
        .map((line: string) => {
          const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
          if (!match) return null;
          const minutes = parseInt(match[1]);
          const seconds = parseFloat(match[2]);
          const text = match[3].trim();
          return {
            text,
            startTime: (minutes * 60 + seconds) * 1000,
          };
        })
        .filter((line: any) => line && line.text);

      return lines.length > 0 ? { lines } : null;
    } catch (error) {
      return null;
    }
  },

  async createPlaylist(title: string, description: string = '', privacy: string = 'PRIVATE'): Promise<string | null> {
    try {
      const headers = await getHeaders(true);
      const response = await axios.post(
        `${BASE_URL}/playlist/create?key=${API_KEY}`,
        {
          context: createContext(),
          title,
          description,
          privacyStatus: privacy,
        },
        { headers }
      );
      return response.data?.playlistId || null;
    } catch (error) {
      return null;
    }
  },

  async addToPlaylist(playlistId: string, videoId: string): Promise<boolean> {
    try {
      const headers = await getHeaders(true);
      const response = await axios.post(
        `${BASE_URL}/browse/edit_playlist?key=${API_KEY}`,
        {
          context: createContext(),
          playlistId,
          actions: [{
            action: 'ACTION_ADD_VIDEO',
            addedVideoId: videoId,
          }],
        },
        { headers }
      );
      return response.status === 200;
    } catch (error) {
      return false;
    }
  },

  async removeFromPlaylist(playlistId: string, videoId: string, setVideoId?: string): Promise<boolean> {
    try {
      const headers = await getHeaders(true);
      const response = await axios.post(
        `${BASE_URL}/browse/edit_playlist?key=${API_KEY}`,
        {
          context: createContext(),
          playlistId,
          actions: [{
            action: 'ACTION_REMOVE_VIDEO',
            removedVideoId: videoId,
            setVideoId: setVideoId,
          }],
        },
        { headers }
      );
      return response.status === 200;
    } catch (error) {
      return false;
    }
  },
};
