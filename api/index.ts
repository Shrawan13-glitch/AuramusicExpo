import { SearchResult, SearchFilter } from './types';
import { SEARCH_FILTERS } from './constants';
import { HttpClient } from './client';
import { ResponseParser } from './parser';
import { ArtistAPI, ArtistData } from './artist';
import { fetchProfile } from './profile';

export class YouTubeMusicAPI {
  static async search(query: string, filter?: SearchFilter): Promise<SearchResult[]> {
    try {
      const params = filter?.params || '';
      const response = await HttpClient.search(query, params);
      return ResponseParser.parseSearchResults(response);
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  static async searchSuggestions(query: string): Promise<string[]> {
    try {
      if (!query.trim()) return [];
      const response = await HttpClient.searchSuggestions(query);
      const sections =
        response?.contents?.find((item: any) => item?.searchSuggestionsSectionRenderer)
          ?.searchSuggestionsSectionRenderer?.contents || [];
      const suggestions = sections
        .map((entry: any) => {
          const runs = entry?.searchSuggestionRenderer?.suggestion?.runs;
          if (!Array.isArray(runs)) return null;
          return runs.map((run: any) => run?.text ?? '').join('').trim();
        })
        .filter((value: string | null) => !!value) as string[];
      return suggestions.slice(0, 12);
    } catch {
      return [];
    }
  }

  static async getArtist(browseId: string): Promise<ArtistData | null> {
    return ArtistAPI.getArtistData(browseId);
  }

  static async getArtistSection(browseId: string, params?: string): Promise<ArtistItem[]> {
    return ArtistAPI.getArtistSection(browseId, params);
  }

  static async getProfile(channelId: string) {
    return fetchProfile(channelId);
  }

  static getFilters(): SearchFilter[] {
    return SEARCH_FILTERS;
  }

  static getFilterByValue(value: string): SearchFilter | undefined {
    return SEARCH_FILTERS.find(filter => filter.value === value);
  }
}

export * from './types';
export * from './constants';
export * from './artist';
