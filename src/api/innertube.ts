import axios from 'axios';
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
      const response = await axios.post(
        `${BASE_URL}/music/get_search_suggestions?key=${API_KEY}`,
        {
          context: createContext(),
          input: query,
        }
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
      const response = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          continuation,
        }
      );

      // Continuation returns full browse response, not continuationContents
      const contents = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.contents;
      
      const nextContinuation = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.continuations?.[0]
        ?.nextContinuationData?.continuation;

      if (!contents) {
        console.log('No contents in continuation response');
        return { sections: [], continuation: null };
      }

      console.log(`Found ${contents.length} continuation content items`);

      const sections: any[] = [];

      contents.forEach((content: any, idx: number) => {
        const carousel = content.musicCarouselShelfRenderer;
        if (!carousel) {
          console.log(`Continuation item ${idx}: No carousel`);
          return;
        }

        const title = carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text;
        if (!title) return;

        const items: Song[] = [];

        carousel.contents?.forEach((item: any) => {
          let song: Song | null = null;
          
          if (item.musicResponsiveListItemRenderer) {
            song = parseSongFromRenderer(item.musicResponsiveListItemRenderer);
          } else if (item.musicTwoRowItemRenderer) {
            song = parseSongFromTwoRow(item.musicTwoRowItemRenderer);
          }
          
          if (song) items.push(song);
        });

        if (items.length > 0) {
          sections.push({ title, items });
        }
      });

      console.log(`Parsed ${sections.length} sections from continuation`);
      return { sections, continuation: nextContinuation };
    } catch (error) {
      console.error('Home continuation error:', error);
      return { sections: [], continuation: null };
    }
  },

  async search(query: string): Promise<{ songs: Song[]; albums: any[]; artists: any[]; playlists: any[] }> {
    try {
      const response = await axios.post(
        `${BASE_URL}/search?key=${API_KEY}`,
        {
          context: createContext(),
          query,
        }
      );

      const contents = response.data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.contents;

      const songs: Song[] = [];
      const albums: any[] = [];
      const artists: any[] = [];
      const playlists: any[] = [];
      
      contents?.forEach((section: any) => {
        const items = section.musicShelfRenderer?.contents || [];
        items.forEach((item: any) => {
          const renderer = item.musicResponsiveListItemRenderer;
          if (!renderer) return;

          const flexColumns = renderer.flexColumns || [];
          const navigationEndpoint = renderer.navigationEndpoint;
          const thumbnail = parseThumbnail(renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails);
          const overlay = renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer;

          // Songs have playNavigationEndpoint in overlay
          if (overlay?.playNavigationEndpoint?.watchEndpoint) {
            const videoId = overlay.playNavigationEndpoint.watchEndpoint.videoId;
            const title = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
            const artistRuns = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
            const artists = parseArtists(artistRuns);
            
            if (videoId && title) {
              songs.push({
                id: videoId,
                title,
                artists,
                duration: -1,
                thumbnailUrl: thumbnail,
                type: 'song',
              });
            }
            return;
          }

          // Determine type by navigation endpoint
          if (navigationEndpoint?.browseEndpoint) {
            const browseId = navigationEndpoint.browseEndpoint.browseId;
            const title = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
            
            if (browseId?.startsWith('UC')) {
              // Artist
              artists.push({
                id: browseId,
                name: title,
                thumbnailUrl: thumbnail,
                type: 'artist',
              });
            } else if (browseId?.startsWith('VL') || browseId?.startsWith('PL') || browseId?.startsWith('RDCLAK')) {
              // Playlist
              const subtitle = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
              const playlistId = browseId.startsWith('VL') ? browseId.substring(2) : browseId;
              playlists.push({
                id: playlistId,
                title,
                thumbnailUrl: thumbnail,
                description: subtitle,
                type: 'playlist',
              });
            } else {
              // Album
              const artistRuns = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
              albums.push({
                id: browseId,
                title,
                thumbnailUrl: thumbnail,
                artists: parseArtists(artistRuns),
                type: 'album',
              });
            }
          } else if (navigationEndpoint?.watchEndpoint) {
            // Song
            const song = parseSongFromRenderer(renderer);
            if (song) {
              songs.push({ ...song, type: 'song' });
            }
          }
        });
      });

      console.log(`Search results: ${songs.length} songs, ${albums.length} albums, ${artists.length} artists, ${playlists.length} playlists`);
      return { songs, albums, artists, playlists };
    } catch (error) {
      console.error('Search error:', error);
      return { songs: [], albums: [], artists: [], playlists: [] };
    }
  },

  async getHome(): Promise<{ quickPicks: Song[]; sections: any[]; continuation: string | null }> {
    try {
      const response = await axios.post(
        `${BASE_URL}/browse?key=${API_KEY}`,
        {
          context: createContext(),
          browseId: 'FEmusic_home',
        }
      );

      const contents = response.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.contents;

      if (!contents) {
        console.log('No contents found');
        console.log('Response keys:', Object.keys(response.data || {}));
        return { quickPicks: [], sections: [] };
      }

      console.log(`Found ${contents.length} content items`);

      const quickPicks: Song[] = [];
      const sections: any[] = [];

      contents.forEach((content: any, idx: number) => {
        const carousel = content.musicCarouselShelfRenderer;
        if (!carousel) return;

        const title = carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text;
        if (!title) return;

        const items: Song[] = [];

        carousel.contents?.forEach((item: any) => {
          let song: Song | null = null;
          
          if (item.musicResponsiveListItemRenderer) {
            song = parseSongFromRenderer(item.musicResponsiveListItemRenderer);
          } else if (item.musicTwoRowItemRenderer) {
            song = parseSongFromTwoRow(item.musicTwoRowItemRenderer);
          }
          
          if (song) items.push(song);
        });

        if (items.length > 0) {
          if (title.toLowerCase().includes('quick')) {
            quickPicks.push(...items);
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

  async getPlaylist(playlistId: string): Promise<any> {
    try {
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
