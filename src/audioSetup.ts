import { AudioPro, AudioProContentType, AudioProEventType } from 'react-native-audio-pro';

type AudioHandlers = {
  onProgress?: (positionMs: number, durationMs: number) => void;
  onStateChanged?: (state?: string) => void;
  onTrackEnded?: () => void;
  onRemoteNext?: () => void;
  onRemotePrev?: () => void;
  onPlaybackError?: (error?: string) => void;
};

let configured = false;
let handlers: AudioHandlers = {};
let lastTrackEndedAt = 0;

export function registerAudioHandlers(next: AudioHandlers) {
  handlers = { ...handlers, ...next };
}

export function setupAudioPro() {
  if (configured) return;
  configured = true;

  AudioPro.configure({
    contentType: AudioProContentType.MUSIC,
    showNextPrevControls: true,
    showSkipControls: false,
    debug: false,
  });

  AudioPro.addEventListener((event) => {
    const type = String(event.type);

    switch (type) {
      case AudioProEventType.PROGRESS: {
        handlers.onProgress?.(event.payload?.position ?? 0, event.payload?.duration ?? 0);
        break;
      }
      case AudioProEventType.STATE_CHANGED: {
        handlers.onStateChanged?.(event.payload?.state);
        break;
      }
      case AudioProEventType.TRACK_ENDED:
      case 'PLAYBACK_TRACK_ENDED': {
        const now = Date.now();
        if (now - lastTrackEndedAt < 600) {
          break;
        }
        lastTrackEndedAt = now;
        handlers.onTrackEnded?.();
        break;
      }
      case AudioProEventType.REMOTE_NEXT: {
        handlers.onRemoteNext?.();
        break;
      }
      case AudioProEventType.REMOTE_PREV: {
        handlers.onRemotePrev?.();
        break;
      }
      case AudioProEventType.PLAYBACK_ERROR: {
        handlers.onPlaybackError?.(event.payload?.error);
        break;
      }
      default:
        break;
    }
  });
}
