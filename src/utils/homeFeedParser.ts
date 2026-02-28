export type HomeFeedItemType =
  | 'song'
  | 'video'
  | 'album'
  | 'artist'
  | 'playlist'
  | 'podcast'
  | 'episode'
  | 'profile'
  | 'unknown';

export interface HomeFeedItem {
  id: string;
  title: string;
  subtitle?: string;
  artist?: string;
  artistIds?: string[];
  thumbnail?: string;
  type: HomeFeedItemType;
  watchPlaylistId?: string;
  watchParams?: string;
}

export interface HomeFeedSection {
  title: string;
  items: HomeFeedItem[];
  layout: 'artist' | 'square' | 'landscape' | 'song' | 'community' | 'speed-dial' | 'discover';
}

export interface HomeFeedParseResult {
  sections: HomeFeedSection[];
  continuationToken?: string;
}

const getRunsText = (runs?: Array<{ text?: string }>) =>
  (runs || []).map((run) => run?.text || '').join('').trim();

const getThumbnail = (renderer: any) => {
  const thumbnails =
    renderer?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
    renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
    renderer?.thumbnail?.thumbnails ||
    [];
  if (!thumbnails.length) return '';
  return thumbnails[thumbnails.length - 1]?.url || '';
};

const parseTypeAndId = (endpoint?: any): { type: HomeFeedItemType; id?: string; watchPlaylistId?: string; watchParams?: string } => {
  const watchId = endpoint?.watchEndpoint?.videoId;
  if (watchId) {
    const musicType =
      endpoint?.watchEndpoint?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType;
    return {
      type: musicType === 'MUSIC_VIDEO_TYPE_OMV' ? 'video' : 'song',
      id: watchId,
      watchPlaylistId: endpoint?.watchEndpoint?.playlistId || '',
      watchParams: endpoint?.watchEndpoint?.params || '',
    };
  }

  const browseId = endpoint?.browseEndpoint?.browseId;
  if (browseId) {
    const pageType =
      endpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
    if (pageType === 'MUSIC_PAGE_TYPE_ALBUM') return { type: 'album', id: browseId };
    if (pageType === 'MUSIC_PAGE_TYPE_ARTIST') return { type: 'artist', id: browseId };
    if (pageType === 'MUSIC_PAGE_TYPE_PLAYLIST' || browseId.startsWith('VL') || browseId.startsWith('MPLA')) {
      return { type: 'playlist', id: browseId };
    }
    if (pageType === 'MUSIC_PAGE_TYPE_PODCAST_SHOW_DETAIL_PAGE') return { type: 'podcast', id: browseId };
    if (pageType === 'MUSIC_PAGE_TYPE_PODCAST_EPISODE_DETAIL_PAGE') return { type: 'episode', id: browseId };
    if (pageType === 'MUSIC_PAGE_TYPE_USER_CHANNEL') return { type: 'profile', id: browseId };
    if (browseId.startsWith('UC')) return { type: 'artist', id: browseId };
    return { type: 'unknown', id: browseId };
  }

  return { type: 'unknown' };
};

const extractArtistsFromRuns = (runs: any[]) => {
  const artistIds: string[] = [];
  const artistNames: string[] = [];
  runs.forEach((run) => {
    const browseId = run?.navigationEndpoint?.browseEndpoint?.browseId;
    const pageType =
      run?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
    const name = run?.text?.trim();
    if (!name) return;
    if (pageType === 'MUSIC_PAGE_TYPE_ARTIST' || browseId?.startsWith('UC')) {
      artistNames.push(name);
      if (browseId && !artistIds.includes(browseId)) artistIds.push(browseId);
    }
  });
  return { artistIds, artistNames };
};

const parseTwoRowItem = (renderer: any): HomeFeedItem | null => {
  if (!renderer) return null;
  const title = getRunsText(renderer?.title?.runs);
  if (!title) return null;

  const subtitleRuns = renderer?.subtitle?.runs || [];
  const subtitle = getRunsText(subtitleRuns);
  const { artistIds, artistNames } = extractArtistsFromRuns(subtitleRuns);
  const endpoint = renderer?.navigationEndpoint;
  const parsed = parseTypeAndId(endpoint);
  if (!parsed.id) return null;

  return {
    id: parsed.id,
    title,
    subtitle,
    artist: artistNames.length ? artistNames.join(', ') : subtitle,
    artistIds,
    thumbnail: getThumbnail(renderer),
    type: parsed.type,
    watchPlaylistId: parsed.watchPlaylistId,
    watchParams: parsed.watchParams,
  };
};

const parseResponsiveItem = (renderer: any): HomeFeedItem | null => {
  if (!renderer) return null;
  const titleRuns = renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const detailsRuns = renderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const title = getRunsText(titleRuns);
  if (!title) return null;
  const subtitle = getRunsText(detailsRuns);
  const { artistIds, artistNames } = extractArtistsFromRuns(detailsRuns);
  const endpoint =
    titleRuns?.[0]?.navigationEndpoint ||
    renderer?.navigationEndpoint ||
    renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint;
  const parsed = parseTypeAndId(endpoint);
  if (!parsed.id) return null;

  return {
    id: parsed.id,
    title,
    subtitle,
    artist: artistNames.length ? artistNames.join(', ') : subtitle,
    artistIds,
    thumbnail: getThumbnail(renderer),
    type: parsed.type,
    watchPlaylistId: parsed.watchPlaylistId,
    watchParams: parsed.watchParams,
  };
};

const parseShelfItems = (contents: any[]): HomeFeedItem[] => {
  const items: HomeFeedItem[] = [];
  contents.forEach((content) => {
    const twoRow = content?.musicTwoRowItemRenderer;
    const responsive = content?.musicResponsiveListItemRenderer;
    const parsed = twoRow ? parseTwoRowItem(twoRow) : responsive ? parseResponsiveItem(responsive) : null;
    if (parsed) items.push(parsed);
  });
  return items;
};

const sectionTitle = (section: any) =>
  getRunsText(section?.musicCarouselShelfRenderer?.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs) ||
  getRunsText(section?.musicShelfRenderer?.title?.runs) ||
  getRunsText(section?.musicShelfRenderer?.header?.musicShelfHeaderRenderer?.title?.runs) ||
  getRunsText(section?.musicShelfRenderer?.header?.musicResponsiveHeaderRenderer?.title?.runs) ||
  getRunsText(section?.itemSectionRenderer?.header?.sectionHeaderRenderer?.title?.runs) ||
  '';

const inferLayout = (title: string, items: HomeFeedItem[]): HomeFeedSection['layout'] => {
  const lower = title.toLowerCase();
  const firstType = items[0]?.type;
  if (lower.includes('daily discover')) return 'discover';
  if (lower.includes('speed dial') || lower.includes('quick picks')) return 'speed-dial';
  if (lower.includes('community')) return 'community';
  if (lower.includes('artist') || firstType === 'artist') return 'artist';
  if (lower.includes('video') || firstType === 'video' || firstType === 'episode' || firstType === 'podcast') {
    return 'landscape';
  }
  if (lower.includes('song') || firstType === 'song') return 'song';
  return 'square';
};

const parseSections = (sectionsRaw: any[]): HomeFeedSection[] => {
  const flattenSections = (section: any): any[] => {
    const itemSectionContents = section?.itemSectionRenderer?.contents;
    if (Array.isArray(itemSectionContents) && itemSectionContents.length) {
      return itemSectionContents.flatMap((entry: any) => flattenSections(entry));
    }
    return [section];
  };

  const sections: HomeFeedSection[] = [];

  sectionsRaw.flatMap((section: any) => flattenSections(section)).forEach((section: any) => {
    const carousel = section?.musicCarouselShelfRenderer;
    const shelf = section?.musicShelfRenderer;
    const title = sectionTitle(section);

    const items = carousel
      ? parseShelfItems(carousel?.contents || [])
      : shelf
        ? parseShelfItems(shelf?.contents || [])
        : [];

    if (!items.length) return;
    const inferredLayout = inferLayout(title, items);

    // Some clients return quick-picks style blocks without explicit titles.
    const fallbackTitle =
      title ||
      (inferredLayout === 'speed-dial'
        ? 'Speed Dial'
        : inferredLayout === 'song'
          ? 'Songs for you'
          : '');
    if (!fallbackTitle) return;

    sections.push({ title: fallbackTitle, items, layout: inferredLayout });
  });

  return sections;
};

export const parseHomeFeed = (response: any): HomeFeedParseResult => {
  const sectionList =
    response?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer;
  const sectionsRaw = sectionList?.contents || [];
  const continuationToken =
    sectionList?.continuations?.[0]?.nextContinuationData?.continuation ||
    response?.continuationContents?.sectionListContinuation?.continuations?.[0]?.nextContinuationData?.continuation;
  return {
    sections: parseSections(sectionsRaw),
    continuationToken: continuationToken || undefined,
  };
};

export const parseHomeFeedContinuation = (response: any): HomeFeedParseResult => {
  const continuation = response?.continuationContents?.sectionListContinuation;
  const sectionsRaw = continuation?.contents || [];
  const continuationToken = continuation?.continuations?.[0]?.nextContinuationData?.continuation;
  return {
    sections: parseSections(sectionsRaw),
    continuationToken: continuationToken || undefined,
  };
};
