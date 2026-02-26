import { SearchResult, ApiResponse } from './types';

export class ResponseParser {
  static parseSearchResults(data: ApiResponse): SearchResult[] {
    const results: SearchResult[] = [];
    
    try {
      const contents = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
      
      if (!contents) return results;

      for (const section of contents) {
        if (section.musicShelfRenderer) {
          const items = section.musicShelfRenderer.contents || [];
          
          for (const item of items) {
            const parsed = this.parseItem(item.musicResponsiveListItemRenderer);
            if (parsed) results.push(parsed);
          }
        }
        
        if (section.musicCardShelfRenderer) {
          const parsed = this.parseCardItem(section.musicCardShelfRenderer);
          if (parsed) results.push(parsed);
        }
      }
    } catch (error) {
      console.error('Parse error:', error);
    }

    return results;
  }

  private static parseItem(renderer: any): SearchResult | null {
    if (!renderer) return null;
    
    try {
      const flexColumns = renderer.flexColumns || [];
      if (flexColumns.length < 1) return null;

      const titleColumn = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer;
      const detailsColumn = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer;

      const titleRuns = titleColumn?.text?.runs || [];
      const detailsRuns = detailsColumn?.text?.runs || [];

      const title = titleRuns[0]?.text || 'Unknown Title';
      
      // Extract ID and determine type
      let id = renderer.playlistItemData?.videoId;
      let type: 'song' | 'video' | 'album' | 'artist' | 'playlist' | 'episode' | 'profile' | 'podcast' = 'song';
      let watchPlaylistId = '';
      let watchParams = '';
      
      // Check navigation endpoint in title first
      const titleNavEndpoint = titleRuns[0]?.navigationEndpoint;
      
      if (titleNavEndpoint?.watchEndpoint?.videoId) {
        id = titleNavEndpoint.watchEndpoint.videoId;
        type = titleNavEndpoint.watchEndpoint.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType === 'MUSIC_VIDEO_TYPE_OMV' ? 'video' : 'song';
        watchPlaylistId = titleNavEndpoint.watchEndpoint.playlistId || '';
        watchParams = titleNavEndpoint.watchEndpoint.params || '';
      } else if (titleNavEndpoint?.browseEndpoint?.browseId) {
        id = titleNavEndpoint.browseEndpoint.browseId;
        const pageType = titleNavEndpoint.browseEndpoint.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
        if (pageType === 'MUSIC_PAGE_TYPE_ALBUM') type = 'album';
        else if (pageType === 'MUSIC_PAGE_TYPE_ARTIST') type = 'artist';
        else if (pageType === 'MUSIC_PAGE_TYPE_PLAYLIST') type = 'playlist';
        else if (pageType === 'MUSIC_PAGE_TYPE_PODCAST_SHOW_DETAIL_PAGE') type = 'podcast';
        else if (pageType === 'MUSIC_PAGE_TYPE_USER_CHANNEL') type = 'profile';
        else if (pageType === 'MUSIC_PAGE_TYPE_PODCAST_EPISODE_DETAIL_PAGE') type = 'episode';
      }
      
      // Fallback to navigationEndpoint in renderer if no ID found
      if (!id && renderer.navigationEndpoint?.browseEndpoint?.browseId) {
        id = renderer.navigationEndpoint.browseEndpoint.browseId;
        const pageType = renderer.navigationEndpoint.browseEndpoint.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
        if (pageType === 'MUSIC_PAGE_TYPE_ALBUM') type = 'album';
        else if (pageType === 'MUSIC_PAGE_TYPE_ARTIST') type = 'artist';
        else if (pageType === 'MUSIC_PAGE_TYPE_PLAYLIST') type = 'playlist';
        else if (pageType === 'MUSIC_PAGE_TYPE_PODCAST_SHOW_DETAIL_PAGE') type = 'podcast';
        else if (pageType === 'MUSIC_PAGE_TYPE_USER_CHANNEL') type = 'profile';
        else if (pageType === 'MUSIC_PAGE_TYPE_PODCAST_EPISODE_DETAIL_PAGE') type = 'episode';
      }
      if (!watchPlaylistId && renderer.navigationEndpoint?.watchEndpoint?.playlistId) {
        watchPlaylistId = renderer.navigationEndpoint.watchEndpoint.playlistId;
      }
      if (!watchParams && renderer.navigationEndpoint?.watchEndpoint?.params) {
        watchParams = renderer.navigationEndpoint.watchEndpoint.params;
      }

      if (!id) return null;

      // Extract thumbnail
      const thumbnails = renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
      const thumbnail = thumbnails[thumbnails.length - 1]?.url || '';

      // Parse details and override type if detected from text
      const { artist, detectedType, subscribers, artistIds } = this.parseDetails(detailsRuns);
      if (detectedType) type = detectedType;

      return {
        id,
        title,
        artist,
        artistIds,
        watchPlaylistId,
        watchParams,
        thumbnail,
        type,
        subscribers
      };
    } catch (error) {
      console.error('Item parse error:', error);
      return null;
    }
  }

  private static parseCardItem(renderer: any): SearchResult | null {
    if (!renderer) return null;
    
    try {
      const title = renderer.title?.runs?.[0]?.text || 'Unknown Title';
      const subtitle = renderer.subtitle?.runs || [];
      
      let id = renderer.onTap?.browseEndpoint?.browseId;
      if (!id) return null;

      const thumbnails = renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
      const thumbnail = thumbnails[thumbnails.length - 1]?.url || '';

      const artist = subtitle.filter(run => run.navigationEndpoint?.browseEndpoint?.browseId)
                            .map(run => run.text)
                            .join(', ') || 'Unknown Artist';

      return {
        id,
        title,
        artist,
        thumbnail,
        type: 'playlist'
      };
    } catch (error) {
      console.error('Card item parse error:', error);
      return null;
    }
  }

  private static parseDetails(runs: any[]) {
    let artist = 'Unknown Artist';
    let detectedType: 'song' | 'video' | 'album' | 'artist' | 'playlist' | 'episode' | 'profile' | 'podcast' | null = null;
    let subscribers = '';
    const artistIds: string[] = [];

    // Extract artist names from navigation endpoints
    const artistRuns = runs.filter(run => 
      run.navigationEndpoint?.browseEndpoint?.browseId && 
      run.navigationEndpoint.browseEndpoint.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ARTIST'
    );
    
    if (artistRuns.length > 0) {
      artist = artistRuns.map(run => run.text).join(', ');
      artistRuns.forEach((run) => {
        const browseId = run.navigationEndpoint?.browseEndpoint?.browseId;
        if (browseId && !artistIds.includes(browseId)) {
          artistIds.push(browseId);
        }
      });
    }

    // Parse text content for type and metadata
    for (const run of runs) {
      const text = run.text?.toLowerCase() || '';
      
      if (text === 'song') detectedType = 'song';
      else if (text === 'video') detectedType = 'video';
      else if (text === 'album') detectedType = 'album';
      else if (text === 'artist') detectedType = 'artist';
      else if (text === 'playlist') detectedType = 'playlist';
      else if (text === 'episode') detectedType = 'episode';
      else if (text === 'profile') detectedType = 'profile';
      else if (text === 'podcast') detectedType = 'podcast';
      else if (text.includes('subscribers')) subscribers = run.text;
    }

    return { artist, detectedType, subscribers, artistIds };
  }
}
