import { AuthenticatedHttpClient } from '../src/utils/authenticatedHttpClient';

export interface AlbumTrack {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration?: string;
}

export interface AlbumDetails {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  subtitle: string;
  secondSubtitle: string;
  tracks: AlbumTrack[];
  suggestions?: AlbumSuggestion[];
}

export interface AlbumSuggestion {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  type: string;
}

export class AlbumAPI {
  private static readonly BASE_URL = '/youtubei/v1/browse';

  private static extractTrackArtist(renderer: any): string {
    const flexColumns = renderer?.flexColumns || [];
    const artistRuns = flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
    const fromRuns = artistRuns
      .filter((run: any) => {
        const text = run?.text?.trim();
        if (!text || text === '•') return false;
        const browseId = run?.navigationEndpoint?.browseEndpoint?.browseId;
        return !browseId || browseId.startsWith('UC');
      })
      .map((run: any) => run.text.trim())
      .join(', ');
    if (fromRuns) return fromRuns;

    const fromSimple =
      flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.simpleText?.trim() || '';
    if (fromSimple) return fromSimple;

    const fromA11y =
      flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.accessibility?.accessibilityData?.label?.trim() ||
      '';
    if (fromA11y) {
      // Typical label patterns: "Song by Artist", "Artist • 3:21", etc.
      const cleaned = fromA11y
        .replace(/^[^a-zA-Z0-9]*by\s+/i, '')
        .replace(/\s*•\s*\d+:\d+.*$/i, '')
        .trim();
      if (cleaned) return cleaned;
    }

    return '';
  }

  static async getAlbumDetails(albumId: string): Promise<AlbumDetails | null> {
    try {
      const payload = {
        context: {
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
          }
        },
        browseId: albumId
      };

      const response = await AuthenticatedHttpClient.makeRequest(`${this.BASE_URL}?prettyPrint=false`, {
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
        throw new Error(`Album fetch failed: ${response.status}`);
      }

      const data = await response.json();
      return this.parseAlbumDetails(data, albumId);
    } catch (error) {
      console.error('Album API error:', error);
      return null;
    }
  }

  private static parseAlbumDetails(data: any, albumId: string): AlbumDetails | null {
    try {
      const twoColumn = data?.contents?.twoColumnBrowseResultsRenderer;
      if (!twoColumn) return null;

      const headerRenderer = twoColumn.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicResponsiveHeaderRenderer;
      if (!headerRenderer) return null;

      const title = headerRenderer.title?.runs?.[0]?.text || 'Unknown Album';
      const artist = headerRenderer.straplineTextOne?.runs?.[0]?.text || 'Unknown Artist';
      const subtitle = headerRenderer.subtitle?.runs?.map((run: any) => run.text).join('') || '';
      const secondSubtitle = headerRenderer.secondSubtitle?.runs?.map((run: any) => run.text).join('') || '';
      
      const thumbnails = headerRenderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
      const thumbnail = thumbnails[thumbnails.length - 1]?.url || '';

      const tracks: AlbumTrack[] = [];
      const suggestions: AlbumSuggestion[] = [];

      // Parse tracks from musicShelfRenderer in secondaryContents
      const shelfRenderer = twoColumn.secondaryContents?.sectionListRenderer?.contents?.[0]?.musicShelfRenderer;
      if (shelfRenderer) {
        for (const item of shelfRenderer.contents || []) {
          if (item.musicResponsiveListItemRenderer) {
            const track = this.parseTrack(item.musicResponsiveListItemRenderer);
            if (track) tracks.push(track);
          }
        }
      }
      
      // Parse suggestions from musicCarouselShelfRenderer in tabs content
      const tabSections = twoColumn.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
      for (const section of tabSections) {
        if (section.musicCarouselShelfRenderer?.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text === 'Releases for you') {
          for (const item of section.musicCarouselShelfRenderer.contents || []) {
            if (item.musicTwoRowItemRenderer) {
              const suggestion = this.parseSuggestion(item.musicTwoRowItemRenderer);
              if (suggestion) suggestions.push(suggestion);
            }
          }
        }
      }

      return {
        id: albumId,
        title,
        artist,
        thumbnail,
        subtitle,
        secondSubtitle,
        tracks,
        suggestions
      };
    } catch (error) {
      console.error('Parse error:', error);
      return null;
    }
  }

  private static parseTrack(renderer: any): AlbumTrack | null {
    try {
      const flexColumns = renderer.flexColumns || [];
      if (flexColumns.length < 2) return null;

      const titleColumn = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer;
      const title = titleColumn?.text?.runs?.[0]?.text || 'Unknown Title';
      const videoId = renderer.playlistItemData?.videoId;

      if (!videoId) return null;

      const artist = this.extractTrackArtist(renderer) || 'Unknown Artist';

      const fixedColumns = renderer.fixedColumns || [];
      const duration = fixedColumns[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]?.text || '';

      return {
        id: videoId,
        title,
        artist,
        thumbnail: '',
        duration
      };
    } catch (error) {
      console.error('Track parse error:', error);
      return null;
    }
  }

  private static parseSuggestion(renderer: any): AlbumSuggestion | null {
    try {
      const title = renderer.title?.runs?.[0]?.text || 'Unknown';
      const subtitle = renderer.subtitle?.runs?.[0]?.text || '';
      const browseId = renderer.navigationEndpoint?.browseEndpoint?.browseId;
      
      if (!browseId) return null;

      const thumbnails = renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
      const thumbnail = thumbnails[thumbnails.length - 1]?.url || '';

      return {
        id: browseId,
        title,
        artist: subtitle,
        thumbnail,
        type: 'album'
      };
    } catch (error) {
      console.error('Suggestion parse error:', error);
      return null;
    }
  }
}
