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
  thumbnailUrl?: string;
  songCount?: number;
}

export interface PlayerState {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  position: number;
  duration: number;
}
