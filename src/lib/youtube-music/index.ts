interface SearchResult {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  type: 'song' | 'video' | 'album' | 'artist' | 'playlist';
}

export { SearchResult };