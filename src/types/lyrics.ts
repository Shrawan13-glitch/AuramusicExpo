export interface TimedLyricLine {
  timeSec: number;
  text: string;
}

export interface LyricsPayload {
  source: string;
  timed: boolean;
  lines: TimedLyricLine[];
}

export type LyricsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
