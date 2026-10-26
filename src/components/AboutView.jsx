import React from 'react';
import { db, seedInitialDemoIfEmpty } from '../db/db';
import {
  ShieldCheck,
  HardDrive,
  Radio,
  Sliders,
  Sparkles,
  Smartphone,
  Laptop,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export default function AboutView() {
  const handleResetDemo = async () => {
    if (confirm('Re-seed demo tracks into your offline library?')) {
      await seedInitialDemoIfEmpty();
      alert('Demo tracks loaded!');
    }
  };

  const handleClearAll = async () => {
    if (confirm('Clear all offline media and melodies? This will permanently delete local IndexedDB data on this device.')) {
      await db.mediaLibrary.clear();
      await db.melodyVault.clear();
      alert('Local storage cleared.');
      window.location.reload();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Progressive Web App Architecture</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          TuneVault Engineering Guide
        </h1>
        <p className="text-sm md:text-base text-zinc-400 max-w-xl mx-auto">
          An offline-first media powerhouse built with modern web standards, direct browser hardware access, and zero backend dependencies.
        </p>
      </div>

      {/* Core Architectural Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">IndexedDB (Dexie.js) Local Vault</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Media files (`.mp3`, `.mp4`, `.wav`, `.webm`) are converted into raw Blobs and stored directly in your browser's IndexedDB. They persist across sessions and require 0kb internet bandwidth once added.
          </p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-2.5">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
            <Sliders className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">Seamless Video & Audio Switcher</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Inspired by YouTube Music, a single persistent HTML5 <code>&lt;video playsInline&gt;</code> element handles both formats. Switching to <em>Audio Saja</em> hides the video stream without destroying the DOM node, preserving real-time playback and powering the Web Audio API frequency visualizer.
          </p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-2.5">
          <div className="w-10 h-10 rounded-xl bg-pink-600/20 text-pink-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">Background Playback & Media Session API</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Integrated with <code>navigator.mediaSession</code>. Controls track metadata, lock-screen notifications, Bluetooth steering wheel controls, and desktop media buttons even when the screen is locked or the browser is minimized.
          </p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">Melody Vault & Virtual Synth</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Combines the <code>MediaRecorder API</code> for spontaneous microphone capture with a real-time Web Audio API polyphonic synthesizer (OscillatorNode + ADSR envelope) so songwriters can test chords and log chord memos offline.
          </p>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Laptop className="w-5 h-5 text-indigo-400" />
          <span>Synthesizer Keyboard Shortcuts</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80">
            <span className="font-mono text-indigo-400 font-bold">A S D F G H J K</span>
            <p className="text-zinc-400 mt-1">White keys: C4 to C5</p>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80">
            <span className="font-mono text-purple-400 font-bold">W E T Y U</span>
            <p className="text-zinc-400 mt-1">Black keys: C#, D#, F#, G#, A#</p>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80">
            <span className="font-mono text-emerald-400 font-bold">Space / Media Keys</span>
            <p className="text-zinc-400 mt-1">Play / Pause media</p>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80">
            <span className="font-mono text-amber-400 font-bold">Arrow Keys</span>
            <p className="text-zinc-400 mt-1">Prev / Next / Seek 10s</p>
          </div>
        </div>
      </div>

      {/* Database Management Tools */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white">Local Storage & Demo Management</h3>
        <p className="text-xs text-zinc-400">
          Manage your offline IndexedDB instances or reload built-in synthesizer test tracks.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleResetDemo}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 rounded-xl text-xs font-semibold border border-zinc-750 transition"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Load Demo Loops</span>
          </button>
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-4 py-2 bg-red-950/40 hover:bg-red-900/50 text-red-300 rounded-xl text-xs font-semibold border border-red-800/50 transition"
          >
            <RefreshCw className="w-4 h-4 text-red-400" />
            <span>Clear Offline Data</span>
          </button>
        </div>
      </div>
    </div>
  );
}
