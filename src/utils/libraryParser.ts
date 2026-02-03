export type LibraryItemType = 'song' | 'video' | 'album' | 'artist' | 'playlist' | 'unknown';

export interface LibraryItem {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail?: string;
  type: LibraryItemType;
}

export interface LibrarySection {
  title: string;
  items: LibraryItem[];
}

const getRunsText = (runs?: Array<{ text: string }>) =>
  runs?.map((run) => run.text).join('') ?? '';

const getThumbnail = (renderer: any) => {
  const thumbnails =
    renderer?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
    renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
    renderer?.thumbnail?.thumbnails ||
    [];

  if (!thumbnails.length) return '';
  return thumbnails[thumbnails.length - 1].url || '';
};

const getTypeAndId = (endpoint?: any): { type: LibraryItemType; id: string } => {
  const browseId = endpoint?.browseEndpoint?.browseId;
  if (browseId) {
    if (browseId.startsWith('MPLA') || browseId.startsWith('VL')) {
      return { type: 'playlist', id: browseId };
    }
    if (browseId.startsWith('MPREb_')) {
      return { type: 'album', id: browseId };
    }
    if (browseId.startsWith('UC')) {
      return { type: 'artist', id: browseId };
    }
    return { type: 'unknown', id: browseId };
  }

  const watchId = endpoint?.watchEndpoint?.videoId;
  if (watchId) {
    return { type: 'song', id: watchId };
  }

  return { type: 'unknown', id: '' };
};

const parseTwoRowItem = (item: any, index: number): LibraryItem | null => {
  const renderer = item?.musicTwoRowItemRenderer;
  if (!renderer) return null;

  const title = getRunsText(renderer.title?.runs);
  const subtitle = getRunsText(renderer.subtitle?.runs);
  const thumbnail = getThumbnail(renderer);
  const navEndpoint = renderer.navigationEndpoint;
  const { type, id } = getTypeAndId(navEndpoint);

  return {
    id: id || `${title}-${index}`,
    title,
    subtitle,
    thumbnail,
    type,
  };
};

const parseResponsiveListItem = (item: any, index: number): LibraryItem | null => {
  const renderer = item?.musicResponsiveListItemRenderer;
  if (!renderer) return null;

  const flexColumns = renderer.flexColumns || [];
  const title = getRunsText(
    flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
  );
  const subtitle = getRunsText(
    flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
  );
  const thumbnail = getThumbnail(renderer);

  const navEndpoint =
    renderer.navigationEndpoint ||
    renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
      ?.playNavigationEndpoint;
  const { type, id } = getTypeAndId(navEndpoint);

  return {
    id: id || `${title}-${index}`,
    title,
    subtitle,
    thumbnail,
    type,
  };
};

const extractSectionItems = (section: any): LibraryItem[] => {
  const grid = section?.gridRenderer;
  if (grid?.items?.length) {
    return grid.items
      .map((item: any, index: number) => parseTwoRowItem(item, index))
      .filter(Boolean) as LibraryItem[];
  }

  const carousel = section?.musicCarouselShelfRenderer;
  if (carousel?.contents?.length) {
    return carousel.contents
      .map((item: any, index: number) => parseTwoRowItem(item, index))
      .filter(Boolean) as LibraryItem[];
  }

  const shelf = section?.musicShelfRenderer;
  if (shelf?.contents?.length) {
    return shelf.contents
      .map((item: any, index: number) => parseResponsiveListItem(item, index))
      .filter(Boolean) as LibraryItem[];
  }

  return [];
};

const getSectionTitle = (section: any) => {
  const gridTitle = getRunsText(section?.gridRenderer?.header?.gridHeaderRenderer?.title?.runs);
  if (gridTitle) return gridTitle;

  const carouselTitle = getRunsText(
    section?.musicCarouselShelfRenderer?.header?.musicCarouselShelfBasicHeaderRenderer?.title
      ?.runs
  );
  if (carouselTitle) return carouselTitle;

  const shelfTitle = getRunsText(
    section?.musicShelfRenderer?.title?.runs
  );
  if (shelfTitle) return shelfTitle;

  return 'Library';
};

export const parseLibraryData = (response: any): LibrarySection[] => {
  const contents =
    response?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents || [];

  const sections: LibrarySection[] = [];

  const flattenSections = (section: any): any[] => {
    const itemSection = section?.itemSectionRenderer;
    if (itemSection?.contents?.length) {
      return itemSection.contents.flatMap((entry: any) => flattenSections(entry));
    }
    return [section];
  };

  contents
    .flatMap((section: any) => flattenSections(section))
    .forEach((section: any) => {
      const items = extractSectionItems(section);
      if (!items.length) return;

      sections.push({
        title: getSectionTitle(section),
        items,
      });
    });

  return sections;
};
