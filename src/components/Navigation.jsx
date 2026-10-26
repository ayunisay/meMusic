import React from 'react';
import { HardDrive, Radio, Info } from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'library', label: 'Media Vault', icon: HardDrive },
    { id: 'melody', label: 'Melody Vault', icon: Radio },
    { id: 'about', label: 'About & PWA', icon: Info }
  ];

  return (
    <>
      {/* 1. Desktop Sidebar Navigation */}
      <aside className="hidden md:flex flex-col w-64 bg-zinc-950 border-r border-zinc-850 p-4 shrink-0 space-y-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-3">
            Navigation
          </span>
          <nav className="mt-2 space-y-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === id
                    ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`}
              >
                <Icon className={`w-5 h-5 ${activeTab === id ? 'text-indigo-400' : 'text-zinc-500'}`} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Feature Highlights Card */}
        <div className="mt-auto bg-gradient-to-br from-indigo-950/40 via-zinc-900/40 to-purple-950/40 border border-indigo-500/20 rounded-2xl p-4 text-xs space-y-2">
          <p className="font-bold text-zinc-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            100% Offline PWA
          </p>
          <p className="text-zinc-400 text-[11px] leading-relaxed">
            All audio, video, and melody notes stay right on your device inside IndexedDB. Works on airplanes, subways, and off-grid.
          </p>
        </div>
      </aside>

      {/* 2. Mobile Bottom Navigation Bar (fixed above bottom edge) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-800/80 px-2 py-1 safe-bottom flex items-center justify-around">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 transition-all ${
                isActive ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <div className={`p-1 rounded-xl transition ${isActive ? 'bg-indigo-500/10' : ''}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
