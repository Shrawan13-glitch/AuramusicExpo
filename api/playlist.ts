import { AuthenticatedHttpClient } from '../src/utils/authenticatedHttpClient';

export interface PlaylistTrack {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration?: string;
  playlistSetVideoId?: string;
}

export interface PlaylistDetails {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  subtitle: string;
  secondSubtitle: string;
  tracks: PlaylistTrack[];
  continuationToken?: string;
}

export class PlaylistAPI {
  private static readonly BASE_URL = '/youtubei/v1/browse';

  static async getPlaylistDetails(playlistId: string): Promise<PlaylistDetails | null> {
    try {
      const candidateIds: string[] = [];
      if (playlistId.startsWith('VLPL')) {
        candidateIds.push(playlistId);
        candidateIds.push(playlistId.slice(2));
      } else if (playlistId.startsWith('VL') || playlistId.startsWith('MPLA')) {
        candidateIds.push(playlistId);
      } else {
        candidateIds.push(`VL${playlistId}`);
        candidateIds.push(playlistId);
      }

      for (const browseId of candidateIds) {
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
          browseId
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
          continue;
        }

        const data = await response.json();
        const parsed = this.parsePlaylistDetails(data, playlistId);
        if (parsed) {
          return parsed;
        }
      }

      throw new Error('Playlist fetch failed: no valid browseId');
    } catch (error) {
      console.error('Playlist API error:', error);
      return null;
    }
  }

  private static parsePlaylistDetails(data: any, playlistId: string): PlaylistDetails | null {
    try {
      const twoColumn = data?.contents?.twoColumnBrowseResultsRenderer;
      if (twoColumn) {
        const headerContent = twoColumn.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0];
        const headerRenderer = headerContent?.musicResponsiveHeaderRenderer;
        const editableHeader = headerContent?.musicEditablePlaylistDetailHeaderRenderer;
        const editHeader = editableHeader?.editHeader?.musicPlaylistEditHeaderRenderer;
        const resolvedHeader = headerRenderer || editableHeader?.header?.musicResponsiveHeaderRenderer;

        if (!resolvedHeader && !editHeader) return null;


        const title =
          resolvedHeader?.title?.runs?.[0]?.text ||
          editHeader?.title?.runs?.[0]?.text ||
          'Unknown Playlist';
        const subtitle =
          resolvedHeader?.subtitle?.runs?.map((run: any) => run.text).join('') ||
          editHeader?.subtitle?.runs?.map((run: any) => run.text).join('') ||
          '';
        const secondSubtitle =
          resolvedHeader?.secondSubtitle?.runs?.map((run: any) => run.text).join('') ||
          editHeader?.secondSubtitle?.runs?.map((run: any) => run.text).join('') ||
          '';
        const description =
          resolvedHeader?.description?.musicDescriptionShelfRenderer?.description?.runs?.[0]?.text ||
          editHeader?.description?.runs?.map((run: any) => run.text).join('') ||
          '';
        
        const thumbnails =
          resolvedHeader?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
          editableHeader?.header?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
          [];
        const thumbnail = thumbnails[thumbnails.length - 1]?.url || '';

        const tracks: PlaylistTrack[] = [];
        let continuationToken: string | undefined;

        const playlistShelf = twoColumn.secondaryContents?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer;
        if (playlistShelf) {
          for (const item of playlistShelf.contents || []) {
            if (item.musicResponsiveListItemRenderer) {
              const track = this.parseTrack(item.musicResponsiveListItemRenderer);
              if (track) tracks.push(track);
            } else if (item.continuationItemRenderer) {
              continuationToken = item.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token;
            }
          }
        }

        return {
          id: playlistId,
          title,
          description,
          thumbnail,
          subtitle,
          secondSubtitle,
          tracks,
          continuationToken
        };
      }
      
      return null;
    } catch (error) {
      console.error('Parse error:', error);
      return null;
    }
  }

  private static parseTrack(renderer: any): PlaylistTrack | null {
    try {
      const flexColumns = renderer.flexColumns || [];
      if (flexColumns.length < 2) return null;

      const titleColumn = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer;
      const artistColumn = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer;

      const title = titleColumn?.text?.runs?.[0]?.text || 'Unknown Title';
      const videoId = renderer.playlistItemData?.videoId;
      const playlistSetVideoId = renderer.playlistItemData?.playlistSetVideoId;

      if (!videoId) return null;

      // Extract artist
      const artistRuns = artistColumn?.text?.runs || [];
      const artistFromBrowse = artistRuns
        .filter((run: any) => run.navigationEndpoint?.browseEndpoint?.browseId)
        .map((run: any) => run.text)
        .join(', ');
      const artistFromRuns = artistRuns.map((run: any) => run.text).join('').trim();
      const artistFromLabel =
        artistColumn?.text?.accessibility?.accessibilityData?.label?.trim() || '';
      const artist = artistFromBrowse || artistFromRuns || artistFromLabel || 'Unknown Artist';

      // Extract thumbnail
      const thumbnails = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
      const thumbnail = thumbnails[0]?.url || ''; // Use low quality for playlist view

      // Extract duration
      const fixedColumns = renderer.fixedColumns || [];
      const duration = fixedColumns[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.simpleText || '';

      return {
        id: videoId,
        title,
        artist,
        thumbnail,
        duration,
        playlistSetVideoId
      };
    } catch (error) {
      console.error('Track parse error:', error);
      return null;
    }
  }

  static async loadMoreTracks(continuationToken: string): Promise<{ tracks: PlaylistTrack[], continuationToken?: string } | null> {
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
        continuation: continuationToken
      };

      const response = await AuthenticatedHttpClient.makeRequest(
        `${this.BASE_URL}?prettyPrint=false&ctoken=${continuationToken}&continuation=${continuationToken}`,
        {
          method: 'POST',
          headers: {
            Accept: '*/*',
            'X-Youtube-Client-Name': '67',
            'X-Youtube-Client-Version': '1.20260128.03.00',
            'X-Youtube-Bootstrap-Logged-In': 'true',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Playlist continuation failed: ${response.status}`);
      }

      const data = await response.json();
      return this.parseContinuationResponse(data);
    } catch (error) {
      console.error('Load more tracks error:', error);
      return null;
    }
  }

  private static parseContinuationResponse(data: any): { tracks: PlaylistTrack[], continuationToken?: string } | null {
    try {
      const tracks: PlaylistTrack[] = [];
      let continuationToken: string | undefined;

      const actions = data?.onResponseReceivedActions;
      if (actions && actions.length > 0) {
        for (const action of actions) {
          const appendItems = action?.appendContinuationItemsAction?.continuationItems;
          if (appendItems) {
            for (const item of appendItems) {
              if (item.musicResponsiveListItemRenderer) {
                const track = this.parseTrack(item.musicResponsiveListItemRenderer);
                if (track) tracks.push(track);
              } else if (item.continuationItemRenderer) {
                continuationToken = item.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token;
              }
            }
          }
        }
      } else {
        const continuationContents = data?.continuationContents?.musicPlaylistShelfContinuation?.contents;
        if (continuationContents) {
          for (const item of continuationContents) {
            if (item.musicResponsiveListItemRenderer) {
              const track = this.parseTrack(item.musicResponsiveListItemRenderer);
              if (track) tracks.push(track);
            } else if (item.continuationItemRenderer) {
              continuationToken = item.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token;
            }
          }
        }
      }

      return { tracks, continuationToken };
    } catch (error) {
      console.error('Parse continuation error:', error);
      return null;
    }
  }
}
