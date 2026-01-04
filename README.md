# 🎧 AuraMusic

A modern YouTube Music client built with React Native and Expo (Development Build),
focused on reliable background playback, playback notifications, and a smooth
listening experience.

AuraMusic is designed as a performant, native-first music application rather than
a limited Expo Go demo.

---

## ✨ Features

- YouTube Music streaming via InnerTube API
- Search songs, albums, artists, and playlists
- Music player with proper queue management
- Playback notifications (lock screen & notification controls)
- Reliable background and foreground audio playback
- Library management
- Dark theme UI optimized for long listening sessions

---

## 🔊 Audio & Playback

AuraMusic uses a custom Expo development build with native audio capabilities.

- Native-backed audio playback
- Media session integration
- Stable background playback
- Notification controls (play / pause / next / previous)

This setup removes Expo Go limitations and enables advanced audio features.

---

## 🧱 Tech Stack

- React Native
- Expo (Development Build)
- TypeScript
- React Navigation
- react-native-audio-pro
- Axios
- InnerTube API (YouTube Music)

---

## 📦 Installation

    npm install

---

## ▶️ Running the App

    # Start Metro
    npm start

    # Run on Android (Development Build)
    npm run android

Expo Go is not supported.
A custom development client is required for native audio and notifications.

---

## 📱 Platform Support

- Android (primary and fully supported)
- iOS (experimental / not fully tested)

---

## ⚠️ Disclaimer

AuraMusic is an open-source, experimental YouTube Music client.
All content is fetched from publicly available endpoints.
No media is hosted or redistributed by the application.

---

## 👤 Author

Team AuraMusic

---

## 📌 Notes

- Uses native audio via development build
- Designed for performance and reliability
- Not intended as a Play Store release (currently)