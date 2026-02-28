export const SPLASH_MIN_DURATION_KEY = 'splash_min_duration_ms';
export const DEFAULT_SPLASH_MIN_DURATION_MS = 1500;
export const SPLASH_DURATION_OPTIONS_MS = [1000, 1500, 2000, 3000] as const;

export const normalizeSplashMinDurationMs = (raw: string | null): number => {
  if (!raw) return DEFAULT_SPLASH_MIN_DURATION_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SPLASH_MIN_DURATION_MS;
  return Math.min(10000, Math.max(500, parsed));
};

export const splashDurationLabel = (ms: number): string => `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
