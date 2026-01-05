export interface Song {
  id: string;
  title: string;
  artists: Artist[];
  duration: number;
  thumbnailUrl?: string;
  album?: Album;
  explicit?: boolean;
  liked?: boolean;
}

export interface PlayHistory {
  id: string;
  song: Song;
  playedAt: number;
  duration: number;
  genre?: string;
}

export interface AuraStats {
  totalListeningTime: number;
  genreBreakdown: { [genre: string]: number };
  topGenres: { genre: string; time: number; percentage: number }[];
  topArtists: { id: string; name: string; playCount: number; time: number; thumbnail?: string }[];
  topSongs: { song: Song; playCount: number; time: number }[];
  auraScore: number;
  auraLevel: string;
  nextRank: { name: string; pointsNeeded: number; emoji: string } | null;
}

export interface Artist {
  id: string;
  name: string;
}

export interface Album {
  id: string;
  title: string;
  thumbnailUrl?: string;
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  songCount?: number;
  author?: string;
  isLocal?: boolean;
  privacy?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  songs?: Song[];
}

export interface PlayerState {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  position: number;
  duration: number;
}
