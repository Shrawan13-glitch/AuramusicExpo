export interface YouTubeClientConfig {
  clientName: string;
  clientVersion: string;
  clientId: string;
  userAgent: string;
  osName?: string;
  osVersion?: string;
  deviceMake?: string;
  deviceModel?: string;
  androidSdkVersion?: string;
  buildId?: string;
  cronetVersion?: string;
  packageName?: string;
  friendlyName?: string;
  loginSupported?: boolean;
}

export interface PlayerResponse {
  streamingData?: {
    adaptiveFormats?: PlayerFormat[];
    expiresInSeconds?: string;
  };
  responseContext?: {
    visitorData?: string;
  };
  playabilityStatus?: {
    status?: string;
    reason?: string;
  };
  videoDetails?: {
    title?: string;
    videoId?: string;
  };
}

export interface PlayerFormat {
  itag?: number;
  bitrate?: number;
  mimeType?: string;
  url?: string;
  signatureCipher?: string;
  cipher?: string;
  averageBitrate?: number;
}

export interface StreamUrlSuccess {
  ok: true;
  url: string;
  expiresInSeconds: number;
  clientName: string;
  format: PlayerFormat;
  artistName?: string;
  artistId?: string;
}

export interface StreamUrlFailure {
  ok: false;
  error: string;
  triedClients: string[];
  playabilityStatus?: string;
  playabilityReason?: string;
}

export type StreamUrlResult = StreamUrlSuccess | StreamUrlFailure;

export interface StreamUrlOptions {
  region?: string;
  language?: string;
  preferOpus?: boolean;
  maxBitrate?: number;
  visitorData?: string;
  cookie?: string;
  authorization?: string;
}
