import { CookieManager } from '../utils/cookieManager';
import CryptoJS from 'crypto-js';

const ORIGIN = 'https://music.youtube.com';

const getCookieValue = (cookies: { name: string; value: string }[], name: string) =>
  cookies.find((cookie) => cookie.name === name)?.value || '';

const buildSapisidHash = (cookies: { name: string; value: string }[]) => {
  const sapisid = getCookieValue(cookies, 'SAPISID');
  const sapisid1p = getCookieValue(cookies, '__Secure-1PAPISID');
  const sapisid3p = getCookieValue(cookies, '__Secure-3PAPISID');

  const timestamp = Math.floor(Date.now() / 1000);
  const parts: string[] = [];

  if (sapisid) {
    const input = `${timestamp} ${sapisid} ${ORIGIN}`;
    const hash = CryptoJS.SHA1(input).toString();
    parts.push(`SAPISIDHASH ${timestamp}_${hash}`);
  }

  if (sapisid1p) {
    const input = `${timestamp} ${sapisid1p} ${ORIGIN}`;
    const hash = CryptoJS.SHA1(input).toString();
    parts.push(`SAPISID1PHASH ${timestamp}_${hash}`);
  }

  if (sapisid3p) {
    const input = `${timestamp} ${sapisid3p} ${ORIGIN}`;
    const hash = CryptoJS.SHA1(input).toString();
    parts.push(`SAPISID3PHASH ${timestamp}_${hash}`);
  }

  return parts.join(' ');
};

export class AuthenticatedHttpClient {
  private static baseURL = 'https://music.youtube.com';
  private static clientContext = {
    hl: 'en-GB',
    gl: 'IN',
    clientName: 'WEB_REMIX',
    clientVersion: '1.20260128.03.00',
    osName: 'X11',
    platform: 'DESKTOP',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36,gzip(gfe)',
    browserName: 'Chrome',
    browserVersion: '143.0.0.0',
    userInterfaceTheme: 'USER_INTERFACE_THEME_DARK',
    timeZone: 'UTC',
  };
  
  static async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const cookies = await CookieManager.getCookies();
    const cookieString = CookieManager.formatCookiesForRequest(cookies);
    const authHeader = buildSapisidHash(cookies);
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Content-Type': 'application/json',
      'Cookie': cookieString,
      'Referer': `${ORIGIN}/`,
      'Origin': ORIGIN,
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...options.headers,
    };

    return fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  }

  static async searchWithAuth(query: string, params?: string): Promise<any> {
    try {
      const searchParams = new URLSearchParams({
        query,
        ...(params && { params }),
      });

      const response = await this.makeRequest(`/youtubei/v1/search?${searchParams}`, {
        method: 'POST',
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB_REMIX',
              clientVersion: '1.0',
            },
          },
          query,
        }),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Authenticated search error:', error);
      throw error;
    }
  }

  static async getPlaylistWithAuth(playlistId: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/youtubei/v1/browse`, {
        method: 'POST',
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB_REMIX',
              clientVersion: '1.0',
            },
          },
          browseId: `VL${playlistId}`,
        }),
      });

      if (!response.ok) {
        throw new Error(`Playlist fetch failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Authenticated playlist error:', error);
      throw error;
    }
  }

  static async getUserLibrary(): Promise<any> {
    try {
      const response = await this.makeRequest(`/youtubei/v1/browse?prettyPrint=false`, {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'X-Youtube-Client-Name': '67',
          'X-Youtube-Client-Version': '1.20260128.03.00',
          'X-Youtube-Bootstrap-Logged-In': 'true',
        },
        body: JSON.stringify({
          context: {
            client: {
              ...this.clientContext,
            },
            user: {
              lockedSafetyMode: false,
            },
          },
          browseId: 'FEmusic_library_landing',
        }),
      });

      if (!response.ok) {
        throw new Error(`Library fetch failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Authenticated library error:', error);
      throw error;
    }
  }

  static async getRecommendations(): Promise<any> {
    try {
      const requestBody = {
        context: {
          client: {
            ...this.clientContext,
          },
          user: {
            lockedSafetyMode: false,
          },
          request: {
            useSsl: true,
            internalExperimentFlags: [],
            consistencyTokenJars: [],
          },
        },
      };

      const endpoint = `/youtubei/v1/browse?prettyPrint=false`;
      const headers = {
        Accept: '*/*',
        'X-Youtube-Client-Name': '67',
        'X-Youtube-Client-Version': '1.20260128.03.00',
        'X-Youtube-Bootstrap-Logged-In': 'true',
      };
      const browseIds = ['FEmusic_home', 'FEmusic_explore', 'FEmusic_charts'];

      let lastStatus: number | undefined;
      for (const browseId of browseIds) {
        const response = await this.makeRequest(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...requestBody,
            browseId,
          }),
        });
        lastStatus = response.status;
        if (!response.ok) continue;
        const data = await response.json();
        const hasSections = Array.isArray(
          data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer
            ?.contents
        );
        if (hasSections) return data;
      }

      throw new Error(`Recommendations fetch failed: ${lastStatus ?? 'unknown'}`);
    } catch (error) {
      console.error('Authenticated recommendations error:', error);
      throw error;
    }
  }

  static async getRecommendationsContinuation(continuationToken: string): Promise<any> {
    const endpoint = `/youtubei/v1/browse?prettyPrint=false&ctoken=${encodeURIComponent(
      continuationToken
    )}&continuation=${encodeURIComponent(continuationToken)}`;
    const headers = {
      Accept: '*/*',
      'X-Youtube-Client-Name': '67',
      'X-Youtube-Client-Version': '1.20260128.03.00',
      'X-Youtube-Bootstrap-Logged-In': 'true',
    };
    const body = JSON.stringify({
      context: {
        client: {
          ...this.clientContext,
        },
        user: {
          lockedSafetyMode: false,
        },
        request: {
          useSsl: true,
          internalExperimentFlags: [],
          consistencyTokenJars: [],
        },
      },
      continuation: continuationToken,
    });

    const response = await this.makeRequest(endpoint, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`Recommendations continuation failed: ${response.status}`);
    }

    return response.json();
  }

  static async createPlaylist(options: {
    title: string;
    description?: string;
    privacyStatus: 'PUBLIC' | 'UNLISTED' | 'PRIVATE';
    allowCollaborators?: boolean;
  }): Promise<{ playlistId: string }> {
    try {
      const response = await this.makeRequest(`/youtubei/v1/playlist/create?prettyPrint=false`, {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'X-Youtube-Client-Name': '67',
          'X-Youtube-Client-Version': '1.20260128.03.00',
          'X-Youtube-Bootstrap-Logged-In': 'true',
        },
        body: JSON.stringify({
          context: {
            client: {
              ...this.clientContext,
            },
            user: {
              lockedSafetyMode: false,
            },
          },
          title: options.title,
          privacyStatus: options.privacyStatus,
          description: options.description || '',
          params: 'KAA%3D',
        }),
      });

      if (!response.ok) {
        throw new Error(`Playlist create failed: ${response.status}`);
      }

      const data = await response.json();
      const playlistId = data?.playlistId;

      if (!playlistId) {
        throw new Error('Playlist create response missing playlistId');
      }

      if (options.allowCollaborators) {
        await this.editPlaylist(playlistId, [
          {
            action: 'ACTION_SET_ALLOW_ITEM_VOTE',
            itemVotePermission: 3,
          },
        ]);
      }

      return { playlistId };
    } catch (error) {
      console.error('Authenticated create playlist error:', error);
      throw error;
    }
  }

  static async editPlaylist(
    playlistId: string,
    actions: Array<Record<string, unknown>>,
  ): Promise<any> {
    const normalizedPlaylistId = playlistId.startsWith('VL') ? playlistId.slice(2) : playlistId;
    const cookies = await CookieManager.getCookies();
    const visitorId = getCookieValue(cookies, 'VISITOR_INFO1_LIVE');

    const response = await this.makeRequest(`/youtubei/v1/browse/edit_playlist?prettyPrint=false`, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'X-Youtube-Client-Name': '67',
        'X-Youtube-Client-Version': '1.20260128.03.00',
        'X-Youtube-Bootstrap-Logged-In': 'true',
        ...(visitorId ? { 'X-Goog-Visitor-Id': visitorId } : {}),
        'X-Goog-Authuser': '0',
      },
      body: JSON.stringify({
        context: {
          client: {
            ...this.clientContext,
          },
          user: {
            lockedSafetyMode: false,
          },
        },
        actions,
        playlistId: normalizedPlaylistId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Playlist edit failed response:', errorText);
      throw new Error(`Playlist edit failed: ${response.status}`);
    }

    return response.json();
  }

  static async likeSong(videoId: string, params: string = 'OAI%3D'): Promise<any> {
    const cookies = await CookieManager.getCookies();
    const visitorId = getCookieValue(cookies, 'VISITOR_INFO1_LIVE');

    const response = await this.makeRequest(`/youtubei/v1/like/like?prettyPrint=false`, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'X-Youtube-Client-Name': '67',
        'X-Youtube-Client-Version': '1.20260128.03.00',
        'X-Youtube-Bootstrap-Logged-In': 'true',
        ...(visitorId ? { 'X-Goog-Visitor-Id': visitorId } : {}),
        'X-Goog-Authuser': '0',
      },
      body: JSON.stringify({
        context: {
          client: {
            ...this.clientContext,
          },
          user: {
            lockedSafetyMode: false,
          },
          request: {
            useSsl: true,
            internalExperimentFlags: [],
            consistencyTokenJars: [],
          },
        },
        target: {
          videoId,
        },
        params,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Like song failed response:', errorText);
      throw new Error(`Like song failed: ${response.status}`);
    }

    return response.json();
  }

  static async removeLikeSong(videoId: string): Promise<any> {
    const cookies = await CookieManager.getCookies();
    const visitorId = getCookieValue(cookies, 'VISITOR_INFO1_LIVE');

    const response = await this.makeRequest(`/youtubei/v1/like/removelike?prettyPrint=false`, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'X-Youtube-Client-Name': '67',
        'X-Youtube-Client-Version': '1.20260128.03.00',
        'X-Youtube-Bootstrap-Logged-In': 'true',
        ...(visitorId ? { 'X-Goog-Visitor-Id': visitorId } : {}),
        'X-Goog-Authuser': '0',
      },
      body: JSON.stringify({
        context: {
          client: {
            ...this.clientContext,
          },
          user: {
            lockedSafetyMode: false,
          },
          request: {
            useSsl: true,
            internalExperimentFlags: [],
            consistencyTokenJars: [],
          },
        },
        target: {
          videoId,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Remove like failed response:', errorText);
      throw new Error(`Remove like failed: ${response.status}`);
    }

    return response.json();
  }

  static async addToPlaylist(playlistId: string, videoId: string): Promise<any> {
    return this.editPlaylist(playlistId, [
      {
        action: 'ACTION_ADD_VIDEO',
        addedVideoId: videoId,
        dedupeOption: 'DEDUPE_OPTION_CHECK',
      },
    ]);
  }

  static async getWatchNextQueue(
    videoId: string,
    options?: { playlistId?: string; params?: string },
  ): Promise<any> {
    const cookies = await CookieManager.getCookies();
    const visitorId = getCookieValue(cookies, 'VISITOR_INFO1_LIVE');

    const response = await this.makeRequest(`/youtubei/v1/next?prettyPrint=false`, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'X-Youtube-Client-Name': '67',
        'X-Youtube-Client-Version': '1.20260128.03.00',
        'X-Youtube-Bootstrap-Logged-In': 'true',
        ...(visitorId ? { 'X-Goog-Visitor-Id': visitorId } : {}),
        'X-Goog-Authuser': '0',
      },
      body: JSON.stringify({
        context: {
          client: {
            ...this.clientContext,
          },
          user: {
            lockedSafetyMode: false,
          },
          request: {
            useSsl: true,
            internalExperimentFlags: [],
            consistencyTokenJars: [],
          },
        },
        videoId,
        ...(options?.playlistId ? { playlistId: options.playlistId } : {}),
        ...(options?.params ? { params: options.params } : {}),
        isAudioOnly: true,
        enablePersistentPlaylistPanel: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Watch next queue failed response:', errorText);
      throw new Error(`Watch next queue failed: ${response.status}`);
    }

    return response.json();
  }

  static async followArtist(channelIds: string[], params?: string): Promise<any> {
    if (!channelIds.length) {
      throw new Error('followArtist requires at least one channelId');
    }

    const cookies = await CookieManager.getCookies();
    const visitorId = getCookieValue(cookies, 'VISITOR_INFO1_LIVE');

    const response = await this.makeRequest(`/youtubei/v1/subscription/subscribe?prettyPrint=false`, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'X-Youtube-Client-Name': '67',
        'X-Youtube-Client-Version': '1.20260128.03.00',
        'X-Youtube-Bootstrap-Logged-In': 'true',
        ...(visitorId ? { 'X-Goog-Visitor-Id': visitorId } : {}),
        'X-Goog-Authuser': '0',
      },
      body: JSON.stringify({
        context: {
          client: {
            ...this.clientContext,
          },
          user: {
            lockedSafetyMode: false,
          },
          request: {
            useSsl: true,
            internalExperimentFlags: [],
            consistencyTokenJars: [],
          },
        },
        channelIds,
        ...(params ? { params } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Follow artist failed response:', errorText);
      throw new Error(`Follow artist failed: ${response.status}`);
    }

    return response.json();
  }

  static async unfollowArtist(channelIds: string[], params?: string): Promise<any> {
    if (!channelIds.length) {
      throw new Error('unfollowArtist requires at least one channelId');
    }

    const cookies = await CookieManager.getCookies();
    const visitorId = getCookieValue(cookies, 'VISITOR_INFO1_LIVE');

    const response = await this.makeRequest(`/youtubei/v1/subscription/unsubscribe?prettyPrint=false`, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'X-Youtube-Client-Name': '67',
        'X-Youtube-Client-Version': '1.20260128.03.00',
        'X-Youtube-Bootstrap-Logged-In': 'true',
        ...(visitorId ? { 'X-Goog-Visitor-Id': visitorId } : {}),
        'X-Goog-Authuser': '0',
      },
      body: JSON.stringify({
        context: {
          client: {
            ...this.clientContext,
          },
          user: {
            lockedSafetyMode: false,
          },
          request: {
            useSsl: true,
            internalExperimentFlags: [],
            consistencyTokenJars: [],
          },
        },
        channelIds,
        ...(params ? { params } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Unfollow artist failed response:', errorText);
      throw new Error(`Unfollow artist failed: ${response.status}`);
    }

    return response.json();
  }
}
