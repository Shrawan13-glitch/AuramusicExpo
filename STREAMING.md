# Streaming Overview

This document explains how streaming works in the app after the Android VR (cipher‑less) integration.

## High‑Level Flow
1. UI calls `playTrack(...)` from `PlayerContext`.
2. `PlayerContext` requests a stream URL via `getStreamUrl(...)`.
3. The streaming module builds a YouTube Music `player` request using **Android VR clients** and **visitor data**.
4. The module returns a cipher‑less audio URL.
5. `PlayerContext` hands the URL to `react-native-audio-pro` to begin playback.

## Key Files
- `src/contexts/PlayerContext.tsx`
  - Entry point for playback.
  - Calls `getStreamUrl(...)` on track selection.
  - Uses `AudioPro.play(...)` once the URL is ready.
  - Keeps playback state in sync via AudioPro events (progress, state changes, next/prev, errors).

- `src/streaming/index.ts`
  - Public export for the streaming module.

- `src/streaming/extractor.ts`
  - Core stream URL extraction logic.
  - Fetches visitor data and calls the `player` endpoint.
  - Filters for cipher‑less audio formats and returns the best match.

- `src/streaming/clients.ts`
  - Android VR client definitions and fallback order.
  - All Android VR clients are `loginSupported: false`.

- `src/streaming/types.ts`
  - Types for clients, player response, and stream result.

## Visitor Data (Critical)
Android VR player requests require **visitor data** to succeed.

We match Metrolist’s approach:
1. Fetch `https://music.youtube.com/sw.js_data`
2. Parse the response for a `visitorData` string matching the regex `^Cg[t|s]`
3. Cache it for reuse

This visitor data is used in two places:
- `context.client.visitorData` (request body)
- `X-Goog-Visitor-Id` (request header)

The module will attempt HTML/browse fallbacks if `sw.js_data` fails, but `sw.js_data` is the primary and most reliable source.

## Player Request Shape
We send a Metrolist‑style payload:
```json
{
  "context": {
    "client": {
      "clientName": "ANDROID_VR",
      "clientVersion": "...",
      "hl": "en",
      "gl": "US",
      "visitorData": "Cg..."
    },
    "request": {
      "internalExperimentFlags": [],
      "useSsl": true
    },
    "user": {
      "lockedSafetyMode": false
    }
  },
  "videoId": "...",
  "contentCheckOk": true,
  "racyCheckOk": true
}
```

## Android VR Clients (Cipher‑less)
We only use Android VR clients that do **not** require signature ciphering.
Fallback order is defined in `src/streaming/clients.ts`.

Important rule:
- **No auth cookies or SAPISID headers** are sent with Android VR requests.
- Sending auth headers to Android VR caused `400 invalid argument`.

## Stream Selection
From `streamingData.adaptiveFormats`:
1. Keep only **audio** formats.
2. Discard formats with `cipher` / `signatureCipher`.
3. Prefer Opus (`audio/webm`) and higher bitrate.

If no cipher‑less format exists, we return a failure result.

## Error Handling
`getStreamUrl(...)` never throws.
It returns:
```ts
{ ok: false, error: string, triedClients: string[] }
```
`PlayerContext` sets:
- `streamStatus` = `"error"`
- `streamError` = message

## Debug Logs (DEV only)
These logs help verify what happened:
- visitor data source and usage
- whether any formats were returned
- HTTP 400 body from player requests

If playback stops working, check logs first.

## Extending Later
If cipher‑less Android VR stops working:
1. Add a cipher handler (last resort).
2. Add a server‑side resolver.
3. Only then consider additional clients that require signature decryption.

Keep `src/streaming/` isolated to avoid breaking the app’s auth and API calls.
