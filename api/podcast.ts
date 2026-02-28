import { AuthenticatedHttpClient } from '../src/utils/authenticatedHttpClient';

export interface PodcastEpisode {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail?: string;
  duration?: string;
  videoId?: string;
}

export interface PodcastDetails {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  thumbnail?: string;
  episodes: PodcastEpisode[];
}

export class PodcastAPI {
  private static readonly BASE_URL = '/youtubei/v1/browse';
  private static readonly BASE_HEADERS = {
    Accept: '*/*',
    'X-Youtube-Client-Name': '67',
    'X-Youtube-Client-Version': '1.20260128.03.00',
    'X-Youtube-Bootstrap-Logged-In': 'true',
  };

  private static buildPayload(podcastId: string, params?: string) {
    return {
      context: {
        client: {
          hl: 'en-GB',
          gl: 'IN',
          clientName: 'WEB_REMIX',
          clientVersion: '1.20260128.03.00',
          osName: 'X11',
          platform: 'DESKTOP',
          userAgent:
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36,gzip(gfe)',
          browserName: 'Chrome',
          browserVersion: '143.0.0.0',
          userInterfaceTheme: 'USER_INTERFACE_THEME_DARK',
          timeZone: 'UTC',
        },
        user: {
          lockedSafetyMode: false,
        },
      },
      browseId: podcastId,
      ...(params ? { params } : {}),
    };
  }

  private static async fetchBrowseData(podcastId: string, params?: string): Promise<any> {
    const response = await AuthenticatedHttpClient.makeRequest(`${this.BASE_URL}?prettyPrint=false`, {
      method: 'POST',
      headers: this.BASE_HEADERS,
      body: JSON.stringify(this.buildPayload(podcastId, params)),
    });

    if (!response.ok) {
      throw new Error(`Podcast fetch failed: ${response.status}`);
    }

    return response.json();
  }

  private static extractEpisodesTabParams(data: any): string | undefined {
    const tabs =
      data?.contents?.singleColumnBrowseResultsRenderer?.tabs ||
      data?.contents?.twoColumnBrowseResultsRenderer?.tabs ||
      [];
    for (const tab of tabs) {
      const tabRenderer = tab?.tabRenderer;
      const title = (tabRenderer?.title || this.getRunsText(tabRenderer?.title?.runs) || '').toLowerCase();
      if (!title.includes('episode')) continue;
      const params = tabRenderer?.endpoint?.browseEndpoint?.params;
      if (typeof params === 'string' && params) return params;
    }
    return undefined;
  }

  private static mergeEpisodes(base: PodcastEpisode[], extra: PodcastEpisode[]): PodcastEpisode[] {
    const seen = new Set<string>();
    const merged: PodcastEpisode[] = [];
    [...base, ...extra].forEach((episode) => {
      if (!episode?.id || seen.has(episode.id)) return;
      seen.add(episode.id);
      merged.push(episode);
    });
    return merged;
  }

  private static extractShelfContinuationToken(data: any): string | undefined {
    const shelfCandidates: any[] = [
      data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents?.[0]
        ?.musicShelfRenderer,
      data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer
        ?.contents?.[0]?.musicShelfRenderer,
      data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer
        ?.contents?.[0]?.musicShelfRenderer,
    ].filter(Boolean);

    for (const shelf of shelfCandidates) {
      const token =
        shelf?.continuations?.[0]?.nextContinuationData?.continuation ||
        shelf?.contents?.find((item: any) => item?.continuationItemRenderer)?.continuationItemRenderer
          ?.continuationEndpoint?.continuationCommand?.token;
      if (typeof token === 'string' && token) return token;
    }
    return undefined;
  }

  private static async fetchContinuationData(continuationToken: string): Promise<any> {
    const response = await AuthenticatedHttpClient.makeRequest(
      `${this.BASE_URL}?prettyPrint=false&ctoken=${encodeURIComponent(continuationToken)}&continuation=${encodeURIComponent(continuationToken)}`,
      {
        method: 'POST',
        headers: this.BASE_HEADERS,
        body: JSON.stringify({
          context: this.buildPayload('unused').context,
          continuation: continuationToken,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Podcast continuation fetch failed: ${response.status}`);
    }
    return response.json();
  }

  private static getRunsText(runs?: any[]): string {
    if (!Array.isArray(runs)) return '';
    return runs.map((run) => run?.text || '').join('').trim();
  }

  private static logBrowseDebug(tag: string, data: any) {
    try {
      const contents = data?.contents || {};
      const tabs =
        contents?.singleColumnBrowseResultsRenderer?.tabs ||
        contents?.twoColumnBrowseResultsRenderer?.tabs ||
        [];

      const tabMeta = tabs
        .map((tab: any) => tab?.tabRenderer)
        .filter(Boolean)
        .map((tab: any) => ({
          title: tab?.title || this.getRunsText(tab?.title?.runs) || 'untitled',
          hasContent: !!tab?.content,
          hasEndpoint: !!tab?.endpoint?.browseEndpoint,
          params: tab?.endpoint?.browseEndpoint?.params || '',
        }));

      const singleSectionCount =
        contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents
          ?.length || 0;
      const twoColumnTabSectionCount =
        contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents
          ?.length || 0;
      const twoColumnSecondarySectionCount =
        contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents?.length || 0;
      const secondaryShelf =
        contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents?.[0]
          ?.musicShelfRenderer;
      const firstSecondaryShelfItem = secondaryShelf?.contents?.[0] || null;
      const firstTabSection =
        contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0] ||
        contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0] ||
        null;
      const firstSecondarySection =
        contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents?.[0] || null;

      console.log('[PodcastAPI][debug]', tag, {
        topKeys: Object.keys(data || {}),
        contentsKeys: Object.keys(contents || {}),
        tabsCount: tabs.length,
        tabs: tabMeta,
        singleSectionCount,
        twoColumnTabSectionCount,
        twoColumnSecondarySectionCount,
        firstTabSectionKeys: firstTabSection ? Object.keys(firstTabSection) : [],
        firstSecondarySectionKeys: firstSecondarySection ? Object.keys(firstSecondarySection) : [],
        secondaryShelfContentsCount: secondaryShelf?.contents?.length || 0,
        secondaryShelfContinuation:
          secondaryShelf?.continuations?.[0]?.nextContinuationData?.continuation || null,
        firstSecondaryShelfItemKeys: firstSecondaryShelfItem ? Object.keys(firstSecondaryShelfItem) : [],
      });
    } catch (error) {
      console.log('[PodcastAPI][debug] logBrowseDebug error', error);
    }
  }

  static async getPodcastDetails(podcastId: string): Promise<PodcastDetails | null> {
    try {
      const data = await this.fetchBrowseData(podcastId);
      this.logBrowseDebug('base browse response', data);
      const details = this.parsePodcastDetails(data, podcastId);
      console.log('[PodcastAPI][debug] base parse result', {
        podcastId,
        title: details.title,
        episodes: details.episodes.length,
      });
      if (details.episodes.length > 0) return details;

      const continuationToken = this.extractShelfContinuationToken(data);
      console.log('[PodcastAPI][debug] extracted shelf continuation', {
        podcastId,
        continuationToken: continuationToken || null,
      });
      if (continuationToken) {
        const continuationData = await this.fetchContinuationData(continuationToken);
        this.logBrowseDebug('shelf continuation response', continuationData);
        const continuationDetails = this.parsePodcastDetails(continuationData, podcastId);
        console.log('[PodcastAPI][debug] continuation parse result', {
          podcastId,
          episodes: continuationDetails.episodes.length,
        });
        const mergedWithContinuation = this.mergeEpisodes(details.episodes, continuationDetails.episodes);
        if (mergedWithContinuation.length > 0) {
          return {
            ...details,
            episodes: mergedWithContinuation,
          };
        }
      }

      const episodesTabParams = this.extractEpisodesTabParams(data);
      console.log('[PodcastAPI][debug] extracted episodes tab params', {
        podcastId,
        episodesTabParams: episodesTabParams || null,
      });
      if (!episodesTabParams) return details;

      const episodesTabData = await this.fetchBrowseData(podcastId, episodesTabParams);
      this.logBrowseDebug('episodes tab response', episodesTabData);
      const episodesDetails = this.parsePodcastDetails(episodesTabData, podcastId);
      console.log('[PodcastAPI][debug] episodes tab parse result', {
        podcastId,
        episodes: episodesDetails.episodes.length,
      });
      return {
        ...details,
        episodes: this.mergeEpisodes(details.episodes, episodesDetails.episodes),
      };
    } catch (error) {
      console.error('Podcast API error:', error);
      return null;
    }
  }

  private static parsePodcastDetails(data: any, podcastId: string): PodcastDetails {
    const singleTabSectionList =
      data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer;
    const twoColumnTabSectionList =
      data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer;
    const twoColumnSecondarySectionList =
      data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer;

    const headerCandidates = [
      data?.header?.musicDetailHeaderRenderer,
      data?.header?.musicResponsiveHeaderRenderer,
      singleTabSectionList?.contents?.[0]?.musicResponsiveHeaderRenderer,
      singleTabSectionList?.contents?.[0]?.musicDetailHeaderRenderer,
      twoColumnTabSectionList?.contents?.[0]?.musicResponsiveHeaderRenderer,
      twoColumnTabSectionList?.contents?.[0]?.musicDetailHeaderRenderer,
      data?.header?.musicVisualHeaderRenderer,
    ].filter(Boolean);
    const header = headerCandidates[0] || {};

    const title =
      header?.title?.runs?.[0]?.text ||
      header?.title?.simpleText ||
      'Podcast';
    const subtitle =
      header?.subtitle?.runs?.map((run: any) => run?.text || '').join('') ||
      header?.straplineTextOne?.runs?.map((run: any) => run?.text || '').join('') ||
      '';
    const description =
      header?.description?.runs?.map((run: any) => run?.text || '').join('') ||
      header?.description?.musicDescriptionShelfRenderer?.description?.runs?.map((run: any) => run?.text || '').join('') ||
      '';
    const thumbnail =
      header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
      header?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
      '';

    const episodes: PodcastEpisode[] = [];
    const episodeIds = new Set<string>();

    const parseEpisode = (renderer: any) => {
      if (!renderer) return null;
      const primaryNode =
        renderer?.musicMultiRowListItemRenderer ||
        renderer?.musicResponsiveListItemRenderer ||
        renderer?.playlistPanelVideoRenderer ||
        renderer?.compactVideoRenderer ||
        renderer?.videoRenderer ||
        renderer;
      const flexColumns = renderer?.flexColumns || [];
      const title =
        primaryNode?.title?.simpleText ||
        this.getRunsText(primaryNode?.title?.runs) ||
        this.getRunsText(primaryNode?.headline?.runs) ||
        this.getRunsText(primaryNode?.displayTitle?.runs) ||
        flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ||
        this.getRunsText(flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs) ||
        renderer?.title?.simpleText ||
        this.getRunsText(renderer?.headline?.runs) ||
        this.getRunsText(renderer?.title?.runs) ||
        renderer?.title?.runs?.[0]?.text ||
        '';
      if (!title) return null;

      const subtitle =
        this.getRunsText(primaryNode?.subtitle?.runs) ||
        this.getRunsText(primaryNode?.description?.runs) ||
        this.getRunsText(primaryNode?.longBylineText?.runs) ||
        this.getRunsText(primaryNode?.shortBylineText?.runs) ||
        primaryNode?.shortBylineText?.simpleText ||
        flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((run: any) => run?.text || '').join('') ||
        this.getRunsText(renderer?.subtitle?.runs) ||
        this.getRunsText(renderer?.byline?.runs) ||
        this.getRunsText(renderer?.longBylineText?.runs) ||
        renderer?.subtitle?.runs?.map((run: any) => run?.text || '').join('') ||
        '';
      const videoId =
        primaryNode?.videoId ||
        primaryNode?.navigationEndpoint?.watchEndpoint?.videoId ||
        primaryNode?.onTap?.watchEndpoint?.videoId ||
        primaryNode?.onTap?.navigationEndpoint?.watchEndpoint?.videoId ||
        primaryNode?.watchEndpoint?.videoId ||
        renderer?.videoId ||
        renderer?.playlistItemData?.videoId ||
        renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
        renderer?.thumbnailOverlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
        renderer?.navigationEndpoint?.watchEndpoint?.videoId ||
        undefined;
      const browseId = renderer?.navigationEndpoint?.browseEndpoint?.browseId;
      const id = videoId || browseId;
      if (!id) return null;
      const thumb =
        primaryNode?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
        primaryNode?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
        primaryNode?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
        renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
        renderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
        '';
      const duration =
        primaryNode?.lengthText?.simpleText ||
        this.getRunsText(primaryNode?.lengthText?.runs) ||
        renderer?.lengthText?.simpleText ||
        this.getRunsText(renderer?.lengthText?.runs) ||
        renderer?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]?.text ||
        renderer?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.simpleText ||
        '';

      return {
        id,
        title,
        subtitle,
        thumbnail: thumb,
        duration,
        videoId,
      } as PodcastEpisode;
    };

    const pushEpisode = (episode: PodcastEpisode | null) => {
      if (!episode || !episode.id || episodeIds.has(episode.id)) return;
      episodeIds.add(episode.id);
      episodes.push(episode);
    };

    const collectCandidateRenderers = (node: any, results: any[] = []) => {
      if (!node || typeof node !== 'object') return results;
      if (node.musicMultiRowListItemRenderer) results.push(node.musicMultiRowListItemRenderer);
      if (node.musicResponsiveListItemRenderer) results.push(node.musicResponsiveListItemRenderer);
      if (node.musicTwoRowItemRenderer) results.push(node.musicTwoRowItemRenderer);
      if (node.playlistPanelVideoRenderer) results.push(node.playlistPanelVideoRenderer);
      if (node.compactVideoRenderer) results.push(node.compactVideoRenderer);
      if (node.videoRenderer) results.push(node.videoRenderer);
      Object.values(node).forEach((value) => {
        if (Array.isArray(value)) {
          value.forEach((entry) => collectCandidateRenderers(entry, results));
        } else if (value && typeof value === 'object') {
          collectCandidateRenderers(value, results);
        }
      });
      return results;
    };

    const parseSectionContents = (sectionContents: any[]) => {
      sectionContents.forEach((section: any) => {
        const playlistShelf = section?.musicPlaylistShelfRenderer;
        if (playlistShelf?.contents?.length) {
          playlistShelf.contents.forEach((content: any) => {
            const episode = parseEpisode(content);
            pushEpisode(episode);
          });
        }

        const shelf = section?.musicShelfRenderer;
        if (shelf?.contents?.length) {
          shelf.contents.forEach((content: any) => {
            const episode = parseEpisode(content);
            pushEpisode(episode);
          });
        }

        const carousel = section?.musicCarouselShelfRenderer;
        if (carousel?.contents?.length) {
          carousel.contents.forEach((content: any) => {
            const responsive = content?.musicResponsiveListItemRenderer;
            const twoRow = content?.musicTwoRowItemRenderer;
            const episode = parseEpisode(responsive || twoRow);
            pushEpisode(episode);
          });
        }

        // Parse nested containers like itemSectionRenderer / playlist panels.
        const candidates = collectCandidateRenderers(section);
        candidates.forEach((renderer) => {
          const episode = parseEpisode(renderer);
          pushEpisode(episode);
        });
      });
    };

    parseSectionContents(singleTabSectionList?.contents || []);
    parseSectionContents(twoColumnTabSectionList?.contents || []);
    parseSectionContents(twoColumnSecondarySectionList?.contents || []);

    // Fallback parser for uncommon response shapes.
    if (!episodes.length) {
      const candidates = collectCandidateRenderers(data);
      candidates.forEach((renderer) => {
        const episode = parseEpisode(renderer);
        pushEpisode(episode);
      });
    }

    // Last-resort fallback: gather any watchEndpoint video entries from the payload.
    if (!episodes.length) {
      const seenNodes = new Set<any>();
      const walk = (node: any) => {
        if (!node || typeof node !== 'object' || seenNodes.has(node)) return;
        seenNodes.add(node);

        const videoId =
          node?.videoId ||
          node?.navigationEndpoint?.watchEndpoint?.videoId ||
          node?.watchEndpoint?.videoId ||
          node?.playlistItemData?.videoId;
        if (typeof videoId === 'string' && videoId) {
          const title =
            node?.title?.simpleText ||
            this.getRunsText(node?.title?.runs) ||
            this.getRunsText(node?.headline?.runs) ||
            this.getRunsText(node?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs) ||
            '';
          if (title) {
            pushEpisode({
              id: videoId,
              videoId,
              title,
              subtitle:
                this.getRunsText(node?.subtitle?.runs) ||
                this.getRunsText(node?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs) ||
                '',
              thumbnail:
                node?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
                node?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
                '',
              duration:
                this.getRunsText(node?.lengthText?.runs) ||
                this.getRunsText(node?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs) ||
                '',
            });
          }
        }

        Object.values(node).forEach((value) => {
          if (Array.isArray(value)) {
            value.forEach((entry) => walk(entry));
          } else if (value && typeof value === 'object') {
            walk(value);
          }
        });
      };
      walk(data);
    }

    return {
      id: podcastId,
      title,
      subtitle,
      description,
      thumbnail,
      episodes,
    };
  }
}
