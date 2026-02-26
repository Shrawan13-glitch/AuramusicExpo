export interface SearchFilter {
  value: string;
  label: string;
  params: string;
}

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  artistIds?: string[];
  watchPlaylistId?: string;
  watchParams?: string;
  duration?: string;
  thumbnail: string;
  type: 'song' | 'video' | 'album' | 'artist' | 'playlist' | 'episode' | 'profile' | 'podcast';
  plays?: string;
  year?: string;
  subscribers?: string;
}

export interface ApiResponse {
  contents: {
    tabbedSearchResultsRenderer: {
      tabs: Array<{
        tabRenderer: {
          content: {
            sectionListRenderer: {
              contents: any[];
            };
          };
        };
      }>;
    };
  };
}
