import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Song, Artist } from '../types';

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
  return url?.split('=')[0];
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
    const videoId = renderer.playlistItemData?.videoId || 
                    renderer.navigationEndpoint?.watchEndpoint?.videoId;
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
    try {
      const headers = await getHeaders(false);
      const response = await axios.post(
        `${BASE_URL}/music/get_search_suggestions?key=${API_KEY}`,
        {
          context: createContext(),
          input: query,
        },
        { headers }
      );

      const suggestions = response.data?.contents?.[0]?.searchSuggestionsSectionRenderer?.contents
        ?.map((item: any) => {
          const runs = item.searchSuggestionRenderer?.suggestion?.runs;
          if (!runs) return null;
          return runs.map((run: any) => run.text).join('');
        })
        ?.filter((text: string | null) => text) || [];

      console.log(`Suggestions for "${query}": ${suggestions.length} results`);
      return suggestions;
    } catch (error) {
      console.error('Search suggestions error:', error);
      return [];
    }
  },

  async next(videoId: string, continuation?: string): Promise<{ songs: Song[]; continuation: string | null }> {
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
        payload
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
        console.log('No playlistPanelRenderer found');
        console.log('Response structure:', JSON.stringify(response.data, null, 2).substring(0, 500));
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

      console.log(`Next API: ${songs.length} songs, continuation: ${!!nextContinuation}`);
      return { songs, continuation: nextContinuation };
    } catch (error) {
      console.error('Next endpoint error:', error);
      return { songs: [], continuation: null };
    }
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
        console.log('No contents in continuation response');
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

      console.log(`Continuation: ${sections.length} sections, next: ${!!nextContinuation}`);
      return { sections, continuation: nextContinuation };
    } catch (error) {
      console.error('Home continuation error:', error);
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

      console.log('Search summary contents:', contents?.length || 0);
      let topResult = null;
      const sections: any[] = [];

      contents?.forEach((section: any) => {
        // Top result (musicCardShelfRenderer)
        if (section.musicCardShelfRenderer) {
          const card = section.musicCardShelfRenderer;
          const title = card.header?.musicCardShelfHeaderBasicRenderer?.title?.runs?.[0]?.text || 'Top result';
          console.log('Parsing musicCardShelfRenderer, contents:', card.contents?.length || 0);
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

          console.log('Card items parsed:', items.length);
          if (items.length > 0) {
            topResult = items[0];
            sections.push({ title, items });
          }
        }
        // Regular sections (musicShelfRenderer)
        else if (section.musicShelfRenderer) {
          const shelf = section.musicShelfRenderer;
          const title = shelf.title?.runs?.[0]?.text || 'Results';
          console.log('Parsing musicShelfRenderer, title:', title, 'contents:', shelf.contents?.length || 0);

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

          console.log('Shelf items parsed:', items.length);
          if (items.length > 0) {
            sections.push({ title, items });
          }
        }
      });

      console.log(`Search summary final: ${sections.length} sections, top result: ${!!topResult}`);
      if (sections.length === 0 && contents) {
        console.log('Contents structure:', JSON.stringify(contents.map((c: any) => Object.keys(c)), null, 2));
      }
      return { topResult, sections };
    } catch (error) {
      console.error('Search summary error:', error);
      return { topResult: null, sections: [] };
    }
  },

  async search(query: string, filter?: string): Promise<{ items: any[]; continuation: string | null }> {
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
        { headers }
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

      console.log(`Search filtered: ${items.length} items, continuation: ${!!continuation}`);
      return { items, continuation };
    } catch (error) {
      console.error('Search error:', error);
      return { songs: [], albums: [], artists: [], playlists: [] };
    }
  },

  async getHome(): Promise<{ quickPicks: Song[]; sections: any[]; continuation: string | null }> {
    try {
      const headers = await getHeaders(true);
      const response = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          browseId: 'FEmusic_home',
        },
        { headers }
      );

      const contents = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.contents;

      if (!contents) {
        console.log('No contents found');
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
          if (title.toLowerCase().includes('quick')) {
            quickPicks.push(...items.filter(i => i.type === 'song'));
          }
          sections.push({ title, items });
        }
      });

      const continuation = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.continuations?.[0]
        ?.nextContinuationData?.continuation;

      console.log(`Home loaded: ${quickPicks.length} quick picks, ${sections.length} sections`);
      return { quickPicks, sections, continuation };
    } catch (error) {
      console.error('Home error:', error);
      return { quickPicks: [], sections: [], continuation: null };
    }
  },

  async getArtist(browseId: string): Promise<any> {
    try {
      const response = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          browseId,
        }
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

      console.log(`Artist loaded: ${sections.length} sections`);
      sections.forEach(s => console.log(`  ${s.title}: ${s.items.length} ${s.items[0]?.type}s`));
      return { artist, sections };
    } catch (error) {
      console.error('Artist error:', error);
      return null;
    }
  },

  async getAlbum(browseId: string): Promise<any> {
    try {
      // First browse with the browseId directly (includes MPRE prefix)
      const response = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          browseId,
        }
      );

      const header = response.data?.header?.musicDetailHeaderRenderer;
      
      // Extract playlistId from canonical URL
      const playlistId = response.data?.microformat?.microformatDataRenderer?.urlCanonical?.split('=').pop();
      if (!playlistId) {
        console.error('No playlistId found in album response');
        return null;
      }

      const album = {
        id: browseId,
        title: header?.title?.runs?.[0]?.text,
        thumbnail: parseThumbnail(header?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails),
        artist: header?.subtitle?.runs?.[2]?.text,
        year: header?.subtitle?.runs?.[4]?.text,
        type: header?.subtitle?.runs?.[0]?.text, // Album, EP, Single
      };

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
          }
        );

        const contContents = contResponse.data?.continuationContents?.musicPlaylistShelfContinuation?.contents || 
                            contResponse.data?.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems || [];

        contContents.forEach((item: any) => {
          const song = parseSongFromRenderer(item.musicResponsiveListItemRenderer);
          if (song) songs.push(song);
        });

        nextContinuation = contResponse.data?.continuationContents?.musicPlaylistShelfContinuation?.continuations?.[0]?.nextContinuationData?.continuation;
      }

      console.log(`Album loaded: ${songs.length} songs`);
      return { album, songs };
    } catch (error) {
      console.error('Album error:', error);
      return null;
    }
  },

  async getPlaylist(playlistId: string, videoId?: string): Promise<any> {
    try {
      // If it's a mix (has videoId), use next endpoint
      if (videoId) {
        const result = await this.next(videoId);
        // Use first song's thumbnail for mix
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
      const response = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          browseId,
        }
      );

      const header = response.data?.header?.musicDetailHeaderRenderer || 
                     response.data?.header?.musicEditablePlaylistDetailHeaderRenderer?.header?.musicResponsiveHeaderRenderer ||
                     response.data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicResponsiveHeaderRenderer;
      
      const secondaryContents = response.data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents;
      const singleColumnContents = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
      const contents = secondaryContents || singleColumnContents;

      const playlist = {
        id: playlistId,
        title: header?.title?.runs?.[0]?.text,
        thumbnail: parseThumbnail(header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || header?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails),
        author: header?.straplineTextOne?.runs?.[0]?.text || header?.subtitle?.runs?.[0]?.text,
        songCount: header?.secondSubtitle?.runs?.[0]?.text,
      };

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

      console.log(`Playlist loaded: ${songs.length} songs, continuation: ${!!continuation}`);
      return { playlist, songs, continuation };
    } catch (error) {
      console.error('Playlist error:', error);
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

      console.log(`Playlist continuation: ${songs.length} more songs, continuation: ${!!nextContinuation}`);
      return { songs, continuation: nextContinuation };
    } catch (error) {
      console.error('Playlist continuation error:', error);
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

      console.log(`Artist items loaded: ${items.length} items`);
      return { title, items };
    } catch (error) {
      console.error('Artist items error:', error);
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
      console.error('Explore error:', error);
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
      console.error('New releases error:', error);
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
      console.error('Mood and genres error:', error);
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
      console.error('Browse error:', error);
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
      console.error('Account info error:', error);
      return null;
    }
  },

  async getLibrary(browseId: string = 'FEmusic_liked_videos'): Promise<any> {
    try {
      const headers = await getHeaders(true);
      const response = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          browseId,
        },
        { headers }
      );

      const tabs = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs;
      const contents = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0];
      const items: any[] = [];

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
            // Artist
            items.push({ id: browseId, name, thumbnailUrl: thumbnail, type: 'artist' });
          } else if (browseId && title) {
            // Playlist/Album
            const id = browseId.replace('VL', '');
            items.push({ id, title, thumbnailUrl: thumbnail, type: 'playlist' });
          } else if (videoId && title) {
            // Song
            items.push({ id: videoId, title, thumbnailUrl: thumbnail, type: 'song' });
          }
        });
      } else if (contents?.musicShelfRenderer) {
        contents.musicShelfRenderer.contents?.forEach((item: any) => {
          const renderer = item.musicResponsiveListItemRenderer;
          if (!renderer) return;
          
          // Check if it's an artist
          const browseId = renderer.navigationEndpoint?.browseEndpoint?.browseId;
          if (browseId?.startsWith('UC')) {
            const name = renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
            const thumbnail = parseThumbnail(renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails);
            if (name) items.push({ id: browseId, name, thumbnailUrl: thumbnail, type: 'artist' });
          } else {
            const song = parseSongFromRenderer(renderer);
            if (song) items.push({ ...song, type: 'song' });
          }
        });
      } else if (contents?.musicPlaylistShelfRenderer) {
        contents.musicPlaylistShelfRenderer.contents?.forEach((item: any) => {
          const song = parseSongFromRenderer(item.musicResponsiveListItemRenderer);
          if (song) items.push({ ...song, type: 'song' });
        });
      }

      console.log(`Library loaded: ${items.length} items from ${browseId}`);
      return { items };
    } catch (error) {
      console.error('Library error:', error);
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
      console.log(`${like ? 'Liked' : 'Unliked'} song ${videoId} on YouTube Music`);
      return response.status === 200;
    } catch (error) {
      console.error('Like song error:', error);
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
      console.log(`${subscribe ? 'Subscribed to' : 'Unsubscribed from'} artist ${channelId}`);
      return response.status === 200;
    } catch (error) {
      console.error('Subscribe artist error:', error);
      return false;
    }
  },

  async getStreamUrl(videoId: string): Promise<string | null> {
    const clients = [CLIENTS.ANDROID, CLIENTS.IOS, CLIENTS.WEB_REMIX];
    
    for (const client of clients) {
      try {
        const response = await axios.post(
          `${BASE_URL}/player?key=${API_KEY}`,
          {
            context: createContext(client),
            videoId,
          }
        );

        const formats = response.data?.streamingData?.adaptiveFormats || [];
        const audioFormat = formats.find((f: any) => 
          f.mimeType?.includes('audio') && f.url
        );
        
        if (audioFormat?.url) {
          console.log(`Stream URL found with ${client.clientName}`);
          return audioFormat.url;
        }
      } catch (error) {
        console.error(`Failed with ${client.clientName}:`, error);
      }
    }

    console.error('No stream URL found with any client');
    return null;
  },
};
