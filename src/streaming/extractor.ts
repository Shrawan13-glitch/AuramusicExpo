import { STREAM_CLIENTS } from './clients';
import { PlayerFormat, PlayerResponse, StreamUrlOptions, StreamUrlResult, YouTubeClientConfig } from './types';

const API_URL = 'https://music.youtube.com/youtubei/v1/player?prettyPrint=false';
const VISITOR_URL = 'https://music.youtube.com/youtubei/v1/browse?prettyPrint=false';
const VISITOR_HTML_URL = 'https://music.youtube.com/';
const VISITOR_SW_URL = 'https://music.youtube.com/sw.js_data';

let cachedVisitorData: string | null = null;
let visitorRequest: Promise<string | null> | null = null;

const isAudioFormat = (format: PlayerFormat) =>
  typeof format.mimeType === 'string' && format.mimeType.startsWith('audio/');

const hasCipher = (format: PlayerFormat) =>
  Boolean(format.signatureCipher || format.cipher);

const formatScore = (format: PlayerFormat, preferOpus: boolean) => {
  const bitrate = format.bitrate ?? format.averageBitrate ?? 0;
  const isOpus = Boolean(format.mimeType?.startsWith('audio/webm'));
  return bitrate + (preferOpus && isOpus ? 10240 : 0);
};

const pickBestFormat = (formats: PlayerFormat[], preferOpus: boolean, maxBitrate?: number) => {
  const candidates = formats.filter((format) => isAudioFormat(format) && !hasCipher(format) && format.url);
  if (!candidates.length) return null;
  const filtered = typeof maxBitrate === 'number'
    ? candidates.filter((format) => (format.bitrate ?? format.averageBitrate ?? 0) <= maxBitrate)
    : candidates;
  const rankedPool = filtered.length ? filtered : candidates;
  return rankedPool.reduce((best, current) =>
    formatScore(current, preferOpus) > formatScore(best, preferOpus) ? current : best
  );
};

const extractArtistFromPlayer = (response: PlayerResponse | null) => {
  const artistName = response?.videoDetails?.author?.trim();
  const artistId = response?.videoDetails?.channelId?.trim();

  return {
    artistName: artistName || undefined,
    artistId: artistId || undefined,
  };
};

const buildContext = (client: YouTubeClientConfig, options: StreamUrlOptions) => ({
  client: {
    clientName: client.clientName,
    clientVersion: client.clientVersion,
    osName: client.osName,
    osVersion: client.osVersion,
    deviceMake: client.deviceMake,
    deviceModel: client.deviceModel,
    androidSdkVersion: client.androidSdkVersion,
    hl: options.language ?? 'en',
    gl: options.region ?? 'US',
    visitorData: options.visitorData ?? null,
  },
  request: {
    internalExperimentFlags: [],
    useSsl: true,
  },
  user: {
    lockedSafetyMode: false,
  },
});

const buildHeaders = (client: YouTubeClientConfig, options: StreamUrlOptions) => ({
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Content-Type': 'application/json',
  'X-Goog-Api-Format-Version': '1',
  'X-YouTube-Client-Name': client.clientId,
  'X-YouTube-Client-Version': client.clientVersion,
  'X-Origin': 'https://music.youtube.com',
  Referer: 'https://music.youtube.com/',
  'User-Agent': client.userAgent,
  ...(options.visitorData ? { 'X-Goog-Visitor-Id': options.visitorData } : {}),
  ...(client.loginSupported && options.cookie ? { Cookie: options.cookie } : {}),
  ...(client.loginSupported && options.authorization ? { Authorization: options.authorization } : {}),
});

const fetchPlayerResponse = async (
  videoId: string,
  client: YouTubeClientConfig,
  options: StreamUrlOptions
): Promise<PlayerResponse | null> => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: buildHeaders(client, options),
      body: JSON.stringify({
        context: buildContext(client, options),
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      }),
    });

    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as PlayerResponse;
    return data;
  } catch (error) {
    return null;
  }
};

const VISITOR_DATA_REGEX = /^Cg[t|s]/;

const extractVisitorDataFromHtml = (html: string): string | null => {
  const liveMatch = html.match(/"VISITOR_INFO1_LIVE":"([^"]+)"/);
  if (liveMatch?.[1]) return liveMatch[1];
  const ytcfgMatch = html.match(/"VISITOR_DATA":"([^"]+)"/);
  if (ytcfgMatch?.[1]) return ytcfgMatch[1];
  const visitorMatch = html.match(/"visitorData":"([^"]+)"/);
  if (visitorMatch?.[1]) return visitorMatch[1];
  return null;
};

const extractVisitorDataFromSw = (text: string): string | null => {
  const trimmed = text.startsWith(")]}'") ? text.slice(5) : text;
  try {
    const data = JSON.parse(trimmed);
    const candidates: unknown[] = Array.isArray(data?.[0]?.[2]) ? data[0][2] : [];
    const match = candidates.find((value) =>
      typeof value === 'string' && VISITOR_DATA_REGEX.test(value)
    );
    return typeof match === 'string' ? match : null;
  } catch {
    return null;
  }
};

const buildHtmlHeaders = () => ({
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
});

const fetchVisitorData = async (options: StreamUrlOptions): Promise<string | null> => {
  if (cachedVisitorData) return cachedVisitorData;
  if (visitorRequest) return visitorRequest;

  visitorRequest = (async () => {
    try {
      const swResponse = await fetch(VISITOR_SW_URL, {
        method: 'GET',
        headers: buildHtmlHeaders(),
      });
      if (swResponse.ok) {
        const text = await swResponse.text();
        const swVisitor = extractVisitorDataFromSw(text);
        if (swVisitor) {
          cachedVisitorData = swVisitor;
          return cachedVisitorData;
        }
      }

      const htmlResponse = await fetch(VISITOR_HTML_URL, {
        method: 'GET',
        headers: buildHtmlHeaders(),
      });
      if (htmlResponse.ok) {
        const html = await htmlResponse.text();
        const htmlVisitor = extractVisitorDataFromHtml(html);
        if (htmlVisitor) {
          cachedVisitorData = htmlVisitor;
          return cachedVisitorData;
        }
      }

      const client = STREAM_CLIENTS[0];
      const response = await fetch(VISITOR_URL, {
        method: 'POST',
        headers: buildHeaders(client, options),
        body: JSON.stringify({
          context: buildContext(client, options),
          browseId: 'FEmusic_home',
        }),
      });

      if (!response.ok) return null;
      const data = (await response.json()) as PlayerResponse;
      cachedVisitorData = data.responseContext?.visitorData ?? null;
      return cachedVisitorData;
    } catch (error) {
      return null;
    } finally {
      visitorRequest = null;
    }
  })();

  return visitorRequest;
};

export const getStreamUrl = async (
  videoId: string,
  options: StreamUrlOptions = {}
): Promise<StreamUrlResult> => {
  if (!videoId) {
    return { ok: false, error: 'Missing videoId', triedClients: [] };
  }

  const triedClients: string[] = [];
  const preferOpus = options.preferOpus ?? true;
  const visitorData = options.visitorData ?? (await fetchVisitorData(options));
  const cookieWithVisitor =
    visitorData
      ? `${options.cookie ? `${options.cookie}; ` : ''}VISITOR_INFO1_LIVE=${visitorData}`
      : options.cookie;
  const resolvedOptions: StreamUrlOptions = {
    ...options,
    visitorData: visitorData ?? options.visitorData,
    cookie: cookieWithVisitor,
  };
  let cipherOnlyDetected = false;
  let anyFormats = false;

  for (const client of STREAM_CLIENTS) {
    triedClients.push(client.friendlyName ?? client.clientName);
    const playerResponse = await fetchPlayerResponse(videoId, client, resolvedOptions);
    const formats = playerResponse?.streamingData?.adaptiveFormats ?? [];
    if (formats.length) {
      anyFormats = true;
    }
    if (formats.length && formats.every((format) => hasCipher(format))) {
      cipherOnlyDetected = true;
    }
    const format = pickBestFormat(formats, preferOpus, options.maxBitrate);
    const url = format?.url;
    const expiresRaw = playerResponse?.streamingData?.expiresInSeconds;

    if (url && expiresRaw) {
      const expiresInSeconds = Number(expiresRaw) || 0;
      const { artistName, artistId } = extractArtistFromPlayer(playerResponse);
      return {
        ok: true,
        url,
        expiresInSeconds,
        clientName: client.friendlyName ?? client.clientName,
        format,
        artistName,
        artistId,
      };
    }
  }

  const lastResponse = await fetchPlayerResponse(videoId, STREAM_CLIENTS[0], resolvedOptions);
  return {
    ok: false,
    error: cipherOnlyDetected
      ? 'Only ciphered formats returned (signatureCipher). Cipherless streams not available.'
      : 'No cipherless stream URL found for any Android VR client.',
    triedClients,
    playabilityStatus: lastResponse?.playabilityStatus?.status,
    playabilityReason: lastResponse?.playabilityStatus?.reason,
  };
};
