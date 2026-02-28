import type { TimedLyricLine } from '../types/lyrics';

const LRC_TIME_RE = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

const parseLrcTimestamp = (minute: string, second: string, fractional?: string): number => {
  const mins = Number.parseInt(minute, 10) || 0;
  const secs = Number.parseInt(second, 10) || 0;
  const ms = fractional ? Number.parseInt(fractional.padEnd(3, '0').slice(0, 3), 10) || 0 : 0;
  return mins * 60 + secs + ms / 1000;
};

export const parseLrcText = (lrc: string): TimedLyricLine[] => {
  if (!lrc?.trim()) return [];

  const lines: TimedLyricLine[] = [];
  const rawLines = lrc.split(/\r?\n/);

  for (const raw of rawLines) {
    if (!raw.trim()) continue;
    const timestamps = Array.from(raw.matchAll(LRC_TIME_RE));
    if (!timestamps.length) continue;

    const text = raw.replace(LRC_TIME_RE, '').trim();
    if (!text) continue;

    for (const match of timestamps) {
      const [, m, s, f] = match;
      lines.push({
        timeSec: parseLrcTimestamp(m, s, f),
        text,
      });
    }
  }

  lines.sort((a, b) => a.timeSec - b.timeSec);
  const deduped: TimedLyricLine[] = [];
  for (const line of lines) {
    const prev = deduped[deduped.length - 1];
    if (prev && Math.abs(prev.timeSec - line.timeSec) < 0.015 && prev.text === line.text) continue;
    deduped.push(line);
  }

  return deduped;
};

export const parsePlainLyrics = (text: string): TimedLyricLine[] => {
  if (!text?.trim()) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      timeSec: index * 4,
      text: line,
    }));
};

export const findActiveLyricIndex = (lines: TimedLyricLine[], positionSec: number): number => {
  if (!lines.length) return -1;
  if (positionSec <= lines[0].timeSec) return 0;

  let lo = 0;
  let hi = lines.length - 1;
  let ans = 0;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].timeSec <= positionSec) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return ans;
};
