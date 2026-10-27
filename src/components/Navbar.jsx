import React, { useState, useEffect } from 'react';
import { getStorageEstimate } from '../db/db';
import {
  DownloadCloud,
  Wifi,
  WifiOff,
  HardDrive,
  Smartphone,
  Laptop,
  X
} from 'lucide-react';

export default function Navbar() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [storageInfo, setStorageInfo] = useState(null);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed PWA)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsInstalled(true);
    }

    // Capture beforeinstallprompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // App installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    // Online / Offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial storage check
    getStorageEstimate().then(setStorageInfo);
    const storageInterval = setInterval(() => {
      getStorageEstimate().then(setStorageInfo);
    }, 10000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(storageInterval);
    };
  }, []);

  const [showDesktopGuide, setShowDesktopGuide] = useState(false);

  const handleInstallClick = async () => {
    // Detect iOS
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      setIsInstallable(false);
    } else if (isIos) {
      setShowIosGuide(true);
    } else {
      setShowDesktopGuide(true);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 w-full bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80 px-2 md:px-4 py-3">
        <div className="w-full px-2 md:px-4 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-lg shadow-indigo-600/30 flex items-center justify-center border border-indigo-500/40">
              <img src="/pwa-192x192.png" alt="TuneVault Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-white">TuneVault</span>
                <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  PWA
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 hidden sm:block">Offline Media & Melody Vault</p>
            </div>
          </div>

          {/* Center / Right: Online Status, Storage, Install Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Storage Quota Indicator */}
            {storageInfo && (
              <div
                className="hidden md:flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full text-xs text-zinc-400"
                title={`IndexedDB Storage: ${storageInfo.usageMB} MB used of ${storageInfo.quotaMB} MB quota`}
              >
                <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                <span className="font-mono">{storageInfo.usageMB} MB</span>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-500">{storageInfo.quotaMB} MB</span>
              </div>
            )}

            {/* Offline Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isOnline
                  ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-400'
                  : 'bg-amber-950/40 border-amber-700/50 text-amber-400'
              }`}
              title={isOnline ? 'Online (IndexedDB syncs locally)' : 'Offline (Working 100% locally)'}
            >
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span className="hidden sm:inline">{isOnline ? 'Offline Ready' : 'Offline Mode'}</span>
            </div>

            {/* Install PWA Button - Only show if browser natively supports 1-click prompt */}
            {isInstallable && !isInstalled && (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition active:scale-95"
                title="Install TuneVault ke desktop"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>Install App</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* iOS Safari Install Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <Smartphone className="w-6 h-6 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Install on iOS / iPhone</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Safari on iOS does not support one-click install, but you can install it in 2 simple steps:
            </p>
            <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <li>Tap the <strong>Share button (⎋)</strong> at the bottom of Safari.</li>
              <li>Scroll down and tap <strong>"Add to Home Screen (⊞)"</strong>.</li>
            </ol>
            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Desktop (Chrome / Edge) Install Guide Modal */}
      {showDesktopGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowDesktopGuide(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Laptop className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Install TuneVault ke Laptop</h3>
                <p className="text-xs text-zinc-400">Jalankan offline sebagai aplikasi desktop mandiri</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-zinc-300 bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800/80">
              <p className="text-zinc-400">
                Browser Anda (Edge/Chrome) sudah menyiapkan tombol install langsung di browser bar:
              </p>
              <div className="flex items-start gap-2.5 pt-1">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[11px]">1</span>
                <div>
                  Lihat ke <strong>Address Bar</strong> (kolom URL paling atas, sebelah icon bintang ⭐).
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[11px]">2</span>
                <div>
                  Klik icon <strong>Install App</strong> (gambar monitor dengan panah ke bawah atau icon komputer).
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[11px]">3</span>
                <div>
                  Atau klik menu titik tiga <strong>( ⋮ )</strong> di browser &gt; pilih <strong>Apps</strong> &gt; <strong>Install TuneVault</strong>.
                </div>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed">
              *Setelah di-install, aplikasi akan ada di Start Menu & Desktop Anda dan bisa dibuka full offline tanpa membuka browser lagi.
            </p>

            <button
              onClick={() => setShowDesktopGuide(false)}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition active:scale-95"
            >
              Oke, Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
