# TuneVault 🎵🔒
### Offline-First Progressive Web App (PWA) Media & Melody Vault

**TuneVault** is an offline-first Progressive Web App (PWA) built with **React 19**, **Vite**, **Tailwind CSS**, **Lucide React**, and **Dexie.js (IndexedDB wrapper)**. It is designed to run seamlessly on both desktop (Windows/Mac) and mobile devices (Android/iOS) with 100% offline capabilities and zero cloud backend requirements.

---

## 🚀 Key Features

### 1. Offline Media Storage (IndexedDB via Dexie.js)
- Stores large binary media files (`Blob` / `File`) directly in the device's local browser database.
- Imports `.mp3`, `.wav`, `.ogg`, `.mp4`, and `.webm` files.
- Real-time search, filtering (**All / Audio / Video**), duration metadata extraction, and storage quota estimation (`navigator.storage.estimate`).
- Includes an automatic demo synthesizer generator powered by the Web Audio API for immediate zero-setup testing.

### 2. YouTube Music-Style Video/Audio Switcher
- Persistent HTML5 `<video playsInline webkit-playsinline>` element that **never unmounts or re-creates the DOM node** when toggling playback modes, preventing playback pauses.
- **[Mode Video]**: Crisp video player container with Picture-in-Picture (PiP) support.
- **[Audio Saja]**: Smoothly hides the video display via CSS and reveals an aesthetic, rotating vinyl disc with real-time HTML5 `<canvas>` Web Audio API frequency visualizer (Bars, Waveform, and Radial Pulse modes).

### 3. Uninterrupted Background Playback & OS Media Session API
- Audio continues playing uninterrupted when the app is minimized, screen is locked, or another app is opened.
- Full `navigator.mediaSession` integration:
  - Synchronizes track title, artist, album, and app artwork.
  - OS-level action handlers for `play`, `pause`, `previoustrack`, `nexttrack`, `seekbackward` (10s), `seekforward` (10s), and `seekto`.
  - Controllable from mobile lock screens, notification center, and desktop keyboard media keys.

### 4. Melody Vault (Voice & Instrument Idea Recorder)
- Spontaneous idea recorder using the `MediaRecorder API` (`navigator.mediaDevices.getUserMedia`).
- Real-time microphone input visualizer and duration timer.
- Integrated **1-octave Virtual Synth / Piano Pad** (playable via touch, click, or laptop keyboard keys `A S D F G H J K` & `W E T Y U`).
- Preset sound envelopes: *Warm Piano, Synth Lead, Drawbar Organ, Ambient Pad*.
- Chord quick-test buttons (`C maj`, `Am`, `F maj`, `G maj`, `Em`, `Dm`) with instant insertion into chord memo notes.
- Saved ideas can be tagged (e.g., `#Chord`, `#Acoustic`, `#Pop`), previewed, downloaded as audio files, or promoted straight into the main Media Library.

### 5. Installable PWA Configuration
- Configured with `vite-plugin-pwa` and Workbox offline caching.
- Custom **"Install App"** header button listening to `beforeinstallprompt` (with special guide modal for iOS Safari).
- Standalone display mode with dark theme palette (`#09090b`).

---

## 🛠 Project Structure

```
meMusic/
├── public/
│   ├── pwa-192x192.png        # Generated PWA App Icon
│   ├── pwa-512x512.png        # High-res Maskable PWA Icon
│   └── apple-touch-icon.png   # iOS Touch Icon
├── src/
│   ├── context/
│   │   └── PlayerContext.jsx  # Global playback state & Media Session API
│   ├── db/
│   │   └── db.js              # Dexie.js IndexedDB schema & helpers
│   ├── components/
│   │   ├── AudioVisualizer.jsx # Vinyl disc & HTML5 Canvas visualizer
│   │   ├── MediaPlayer.jsx    # Persistent video/audio player & mini bar
│   │   ├── MediaLibrary.jsx   # Offline media files library & uploader
│   │   ├── MelodyVault.jsx    # Mic recorder & idea memos
│   │   ├── VirtualSynth.jsx   # Interactive 1-octave keyboard & synth
│   │   ├── Navbar.jsx         # Header with PWA installer & storage meter
│   │   ├── Navigation.jsx     # Desktop sidebar & mobile bottom bar
│   │   └── AboutView.jsx      # Architecture documentation
│   ├── App.jsx                # Application root
│   ├── index.css              # Tailwind CSS & custom dark theme styling
│   └── main.jsx               # React entrypoint
├── index.html                 # HTML shell with PWA meta tags
├── vite.config.js             # Vite + Tailwind + PWA Workbox config
└── package.json               # Dependencies & build scripts
```

---

## 💻 How to Run Locally

### 1. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your web browser (Chrome, Edge, Brave, or Safari).

### 2. Build for Production & Offline PWA
```bash
npm run build
```
This generates the service worker (`dist/sw.js`), manifest (`dist/manifest.webmanifest`), and precached assets in the `dist/` directory.

### 3. Preview Production PWA
```bash
npm run preview
```
Open [http://localhost:4173](http://localhost:4173) to test the fully cached offline PWA build.
