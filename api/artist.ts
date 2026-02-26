import { HttpClient } from './client';

export interface ArtistData {
  id: string;
  name: string;
  thumbnail: string;
  subscribers?: string;
  description?: string;
  isSubscribed?: boolean;
  subscriptionChannelIds?: string[];
  subscriptionParams?: string;
  sections: ArtistSection[];
}

export interface ArtistSection {
  title: string;
  type: 'songs' | 'albums' | 'videos' | 'playlists' | 'artists';
  items: ArtistItem[];
  continuationToken?: string;
  browseId?: string;
}

export interface ArtistItem {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail: string;
  duration?: string;
  views?: string;
  type: string;
  browseId?: string;
  videoId?: string;
  playlistId?: string;
}

export class ArtistAPI {
  private static extractSubscriptionMeta(
    subscribeButton: any,
    browseId: string,
  ): { channelIds: string[]; params?: string } {
    const endpointCandidates: any[] = [
      subscribeButton?.subscribeEndpoint,
      subscribeButton?.unsubscribeEndpoint,
      ...(subscribeButton?.serviceEndpoints || []).flatMap((endpoint: any) => [
        endpoint?.subscribeEndpoint,
        endpoint?.unsubscribeEndpoint,
      ]),
      ...(subscribeButton?.onSubscribeEndpoints || []).flatMap((endpoint: any) => [
        endpoint?.subscribeEndpoint,
        endpoint?.unsubscribeEndpoint,
      ]),
      ...(subscribeButton?.onUnsubscribeEndpoints || []).flatMap((endpoint: any) => [
        endpoint?.subscribeEndpoint,
        endpoint?.unsubscribeEndpoint,
      ]),
    ].filter(Boolean);

    const channelIds: string[] = [];
    let params: string | undefined;

    endpointCandidates.forEach((endpoint) => {
      const ids = endpoint?.channelIds;
      if (Array.isArray(ids)) {
        ids.forEach((id) => {
          if (typeof id === 'string' && id.startsWith('UC') && !channelIds.includes(id)) {
            channelIds.push(id);
          }
        });
      }
      if (!params && typeof endpoint?.params === 'string') {
        params = endpoint.params;
      }
    });

    if (!channelIds.length && browseId.startsWith('UC')) {
      channelIds.push(browseId);
    }

    return { channelIds, params };
  }

  static async getArtistSection(browseId: string, params?: string): Promise<ArtistItem[]> {
    try {
      const response = await HttpClient.browse(browseId, params);
      return this.parseArtistSectionItems(response);
    } catch (error) {
      console.error('Error fetching artist section:', error);
      return [];
    }
  }

  static async getArtistData(browseId: string): Promise<ArtistData | null> {
    try {
      const response = await HttpClient.browse(browseId);
      return this.parseArtistData(response, browseId);
    } catch (error) {
      console.error('Error fetching artist data:', error);
      return null;
    }
  }

  private static parseArtistSectionItems(response: any): ArtistItem[] {
    const items: ArtistItem[] = [];
    
    // Handle playlist shelf (Top songs section)
    const playlistShelf = response?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer;
    if (playlistShelf?.contents) {
      playlistShelf.contents.forEach((content: any) => {
        if (content.musicResponsiveListItemRenderer) {
          const item = this.parseResponsiveListItem(content.musicResponsiveListItemRenderer);
          if (item) items.push(item);
        }
      });
      return items;
    }
    
    // Handle regular section list
    const contents = response?.contents?.sectionListRenderer?.contents || 
                    response?.contents?.musicShelfRenderer?.contents ||
                    [];
    
    contents.forEach((content: any) => {
      if (content.musicResponsiveListItemRenderer) {
        const item = this.parseResponsiveListItem(content.musicResponsiveListItemRenderer);
        if (item) items.push(item);
      } else if (content.musicTwoRowItemRenderer) {
        const item = this.parseTwoRowItem(content.musicTwoRowItemRenderer);
        if (item) items.push(item);
      }
    });
    
    return items;
  }

  private static parseArtistData(response: any, browseId: string): ArtistData {
    const header = response?.header?.musicImmersiveHeaderRenderer || response?.header?.musicVisualHeaderRenderer;
    const contents = response?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

    // Extract artist info
    const artistName = header?.title?.runs?.[0]?.text || 'Unknown Artist';
    const thumbnail = header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url || '';
    const subscribers = header?.subscriptionButton?.subscribeButtonRenderer?.subscriberCountText?.runs?.[0]?.text || '';
    const description = header?.description?.runs?.[0]?.text || '';
    const subscribeButton =
      header?.subscriptionButton?.subscribeButtonRenderer ||
      header?.buttons?.find((button: any) => button?.subscribeButtonRenderer)?.subscribeButtonRenderer;
    const isSubscribed = !!subscribeButton?.subscribed;
    const subscriptionMeta = this.extractSubscriptionMeta(subscribeButton, browseId);

    // Parse sections
    const sections: ArtistSection[] = [];

    contents.forEach((content: any) => {
      if (content.musicCarouselShelfRenderer) {
        const shelf = content.musicCarouselShelfRenderer;
        const sectionTitle = shelf.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text || '';
        
        if (sectionTitle) {
          const items = this.parseShelfItems(shelf.contents || []);
          const sectionType = this.determineSectionType(sectionTitle);
          
          // Extract continuation token and browse endpoint for "Show all"
          const moreButton = shelf.header?.musicCarouselShelfBasicHeaderRenderer?.moreContentButton;
          const continuationToken = moreButton?.buttonRenderer?.navigationEndpoint?.continuationCommand?.token;
          const browseEndpoint = moreButton?.buttonRenderer?.navigationEndpoint?.browseEndpoint?.browseId;
          
          sections.push({
            title: sectionTitle,
            type: sectionType,
            items: items,
            continuationToken: continuationToken,
            browseId: browseEndpoint
          });
        }
      } else if (content.musicShelfRenderer) {
        const shelf = content.musicShelfRenderer;
        const sectionTitle = shelf.header?.musicShelfHeaderRenderer?.title?.runs?.[0]?.text || '';
        
        if (sectionTitle) {
          const items = this.parseShelfItems(shelf.contents || []);
          const sectionType = this.determineSectionType(sectionTitle);
          
          // Extract continuation token for "Show all"
          const continuationToken = shelf.continuations?.[0]?.nextContinuationData?.continuation;
          
          sections.push({
            title: sectionTitle,
            type: sectionType,
            items: items,
            continuationToken: continuationToken
          });
        }
      }
    });

    return {
      id: browseId,
      name: artistName,
      thumbnail: thumbnail,
      subscribers: subscribers,
      description: description,
      isSubscribed,
      subscriptionChannelIds: subscriptionMeta.channelIds,
      subscriptionParams: subscriptionMeta.params,
      sections: sections
    };
  }

  private static parseShelfItems(contents: any[]): ArtistItem[] {
    const items: ArtistItem[] = [];

    contents.forEach((content: any) => {
      let item: ArtistItem | null = null;

      if (content.musicTwoRowItemRenderer) {
        item = this.parseTwoRowItem(content.musicTwoRowItemRenderer);
      } else if (content.musicResponsiveListItemRenderer) {
        item = this.parseResponsiveListItem(content.musicResponsiveListItemRenderer);
      }

      if (item) {
        items.push(item);
      }
    });

    return items;
  }

  private static parseTwoRowItem(renderer: any): ArtistItem | null {
    const title = renderer.title?.runs?.[0]?.text || '';
    const subtitle = renderer.subtitle?.runs?.map((run: any) => run.text).join('') || '';
    const thumbnail = renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url || '';
    
    const navigationEndpoint = renderer.navigationEndpoint;
    let id = '';
    let type = 'unknown';

    if (navigationEndpoint?.browseEndpoint) {
      id = navigationEndpoint.browseEndpoint.browseId;
      const pageType = navigationEndpoint.browseEndpoint.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
      
      switch (pageType) {
        case 'MUSIC_PAGE_TYPE_ARTIST':
          type = 'artist';
          break;
        case 'MUSIC_PAGE_TYPE_ALBUM':
          type = 'album';
          break;
        case 'MUSIC_PAGE_TYPE_PLAYLIST':
          type = 'playlist';
          break;
        default:
          type = 'unknown';
      }
    } else if (navigationEndpoint?.watchEndpoint) {
      id = navigationEndpoint.watchEndpoint.videoId;
      type = 'song';
    }

    if (!title || !id) return null;

    return {
      id,
      title,
      subtitle,
      thumbnail,
      type,
      browseId: navigationEndpoint?.browseEndpoint?.browseId,
      videoId: navigationEndpoint?.watchEndpoint?.videoId,
      playlistId: navigationEndpoint?.watchEndpoint?.playlistId
    };
  }

  private static parseResponsiveListItem(renderer: any): ArtistItem | null {
    const flexColumns = renderer.flexColumns || [];
    if (flexColumns.length === 0) return null;

    const title = flexColumns[0]?.text?.runs?.[0]?.text || '';
    const subtitle = flexColumns[1]?.text?.runs?.map((run: any) => run.text).join('') || '';
    const thumbnail = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url || '';
    
    const navigationEndpoint = renderer.navigationEndpoint || flexColumns[0]?.text?.runs?.[0]?.navigationEndpoint;
    let id = '';
    let type = 'song';

    if (navigationEndpoint?.watchEndpoint) {
      id = navigationEndpoint.watchEndpoint.videoId;
      type = 'song';
    } else if (navigationEndpoint?.browseEndpoint) {
      id = navigationEndpoint.browseEndpoint.browseId;
      type = 'album';
    }

    // Extract duration if available
    const duration = flexColumns[flexColumns.length - 1]?.text?.simpleText || '';

    if (!title || !id) return null;

    return {
      id,
      title,
      subtitle,
      thumbnail,
      duration: duration.match(/^\d+:\d+$/) ? duration : undefined,
      type,
      browseId: navigationEndpoint?.browseEndpoint?.browseId,
      videoId: navigationEndpoint?.watchEndpoint?.videoId,
      playlistId: navigationEndpoint?.watchEndpoint?.playlistId
    };
  }

  private static determineSectionType(title: string): ArtistSection['type'] {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('song') || lowerTitle.includes('track')) {
      return 'songs';
    } else if (lowerTitle.includes('album') || lowerTitle.includes('ep')) {
      return 'albums';
    } else if (lowerTitle.includes('video') || lowerTitle.includes('live') || lowerTitle.includes('performance')) {
      return 'videos';
    } else if (lowerTitle.includes('playlist')) {
      return 'playlists';
    } else if (lowerTitle.includes('artist') || lowerTitle.includes('like') || lowerTitle.includes('similar')) {
      return 'artists';
    }
    
    return 'songs'; // default
  }
}
