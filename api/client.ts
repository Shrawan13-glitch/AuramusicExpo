import { ApiResponse } from './types';
import { AuthenticatedHttpClient } from '../src/utils/authenticatedHttpClient';

export class HttpClient {
  private static readonly SEARCH_URL = '/youtubei/v1/search';
  private static readonly SEARCH_SUGGESTIONS_URL = '/youtubei/v1/music/get_search_suggestions';
  private static readonly BROWSE_URL = '/youtubei/v1/browse';

  private static getBaseContext() {
    return {
      client: {
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
        timeZone: 'UTC'
      },
      user: {
        lockedSafetyMode: false
      },
      request: {
        useSsl: true,
        internalExperimentFlags: [],
        consistencyTokenJars: []
      }
    };
  }

  static async search(query: string, params?: string): Promise<ApiResponse> {
    const payload = {
      context: this.getBaseContext(),
      query,
      ...(params && { params }),
      inlineSettingStatus: 'INLINE_SETTING_STATUS_ON'
    };

    const response = await AuthenticatedHttpClient.makeRequest(`${this.SEARCH_URL}?prettyPrint=false`, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'X-Youtube-Client-Name': '67',
        'X-Youtube-Client-Version': '1.20260128.03.00',
        'X-Youtube-Bootstrap-Logged-In': 'true',
        Referer: 'https://music.youtube.com/search',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    return await response.json();
  }

  static async searchSuggestions(query: string): Promise<any> {
    const payload = {
      context: this.getBaseContext(),
      input: query,
    };

    const response = await AuthenticatedHttpClient.makeRequest(
      `${this.SEARCH_SUGGESTIONS_URL}?prettyPrint=false`,
      {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'X-Youtube-Client-Name': '67',
          'X-Youtube-Client-Version': '1.20260128.03.00',
          'X-Youtube-Bootstrap-Logged-In': 'true',
          Referer: 'https://music.youtube.com/search',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(`Search suggestions failed: ${response.status}`);
    }

    return await response.json();
  }

  static async browse(browseId: string, params?: string): Promise<any> {
    const payload: any = {
      context: this.getBaseContext(),
      browseId
    };
    
    if (params) {
      payload.params = params;
    }

    const response = await AuthenticatedHttpClient.makeRequest(`${this.BROWSE_URL}?prettyPrint=false`, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'X-Youtube-Client-Name': '67',
        'X-Youtube-Client-Version': '1.20260128.03.00',
        'X-Youtube-Bootstrap-Logged-In': 'true',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Browse failed: ${response.status}`);
    }

    return await response.json();
  }
}
