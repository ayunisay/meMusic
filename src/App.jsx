import React, { useState, useEffect } from 'react';
import { PlayerProvider } from './context/PlayerContext';
import { seedInitialDemoIfEmpty } from './db/db';
import Navbar from './components/Navbar';
import Navigation from './components/Navigation';
import MediaLibrary from './components/MediaLibrary';
import MelodyVault from './components/MelodyVault';
import AboutView from './components/AboutView';
import MediaPlayer from './components/MediaPlayer';

export default function App() {
  const [activeTab, setActiveTab] = useState('library');

  // Seed sample tracks into IndexedDB on first load if empty
  useEffect(() => {
    seedInitialDemoIfEmpty();
  }, []);

  return (
    <PlayerProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
        {/* Top Navbar */}
        <Navbar />

        {/* Main Content Layout with Sidebar on Desktop */}
        <div className="flex-1 flex flex-col md:flex-row w-full min-h-0">
          {/* Sidebar Navigation (Desktop) */}
          <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

          {/* Active Tab Content Area */}
          <main className="flex-1 min-w-0 pb-36 md:pb-28">
            {activeTab === 'library' && <MediaLibrary />}
            {activeTab === 'melody' && <MelodyVault />}
            {activeTab === 'about' && <AboutView />}
          </main>
        </div>

        {/* Persistent Unified Media Player (Handles video & audio without unmounting HTML5 video) */}
        <MediaPlayer />
      </div>
    </PlayerProvider>
  );
}
