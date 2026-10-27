import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addMediaItem, deleteMediaItem, generateSampleAudioBlob } from '../db/db';
import { usePlayer } from '../context/PlayerContext';
import {
  Upload,
  Search,
  Filter,
  Trash2,
  Play,
  Film,
  Music2,
  Clock,
  Sparkles,
  FileAudio,
  HardDrive
} from 'lucide-react';

export default function MediaLibrary() {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'audio' | 'video'
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'title' | 'duration'
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  // Live query from Dexie IndexedDB
  const mediaItems = useLiveQuery(
    async () => {
      let collection = db.mediaLibrary.toCollection();

      const items = await collection.toArray();

      // Filter by type
      let filtered = items;
      if (filterType !== 'all') {
        filtered = filtered.filter(item => item.mediaType === filterType);
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          item =>
            item.title.toLowerCase().includes(query) ||
            item.artist.toLowerCase().includes(query)
        );
      }

      // Sort
      if (sortBy === 'newest') {
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else if (sortBy === 'title') {
        filtered.sort((a, b) => a.title.localeCompare(b.title));
      } else if (sortBy === 'duration') {
        filtered.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      }

      return filtered;
    },
    [filterType, searchQuery, sortBy]
  );

  // Time format helper: mm:ss
  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Helper to extract duration and metadata from a file blob
  const getFileDuration = (file, mediaType) => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const element = document.createElement(mediaType === 'video' ? 'video' : 'audio');
      element.preload = 'metadata';
      element.src = url;

      element.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(element.duration || 0);
      };

      element.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };

      // Fallback timeout in case metadata event stalls
      setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve(0);
      }, 4000);
    });
  };

  // Handle file input selection (multiple files supported)
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsImporting(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setImportStatus(`Importing ${i + 1} of ${files.length}: ${file.name}`);

      const isVideo = file.type.startsWith('video') || /\.(mp4|webm|mkv|mov)$/i.test(file.name);
      const mediaType = isVideo ? 'video' : 'audio';

      // Parse title and artist from filename
      let title = file.name.replace(/\.[^/.]+$/, '');
      let artist = 'Offline Artist';

      if (title.includes(' - ')) {
        const parts = title.split(' - ');
        artist = parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      }

      try {
        const duration = await getFileDuration(file, mediaType);
        await addMediaItem({
          title,
          artist,
          mediaType,
          fileBlob: file,
          duration
        });
      } catch (err) {
        console.error('Error adding file to Dexie:', err);
      }
    }

    setIsImporting(false);
    setImportStatus('');
    event.target.value = '';
  };

  // Quick generate a sample lo-fi track for instant testing
  const handleGenerateSample = async () => {
    setIsImporting(true);
    setImportStatus('Synthesizing demo audio track with Web Audio API...');
    try {
      const blob = await generateSampleAudioBlob(85, 20);
      await addMediaItem({
        title: `Ambient Chill Loop #${Math.floor(Math.random() * 900 + 100)}`,
        artist: 'TuneVault Synthesizer',
        mediaType: 'audio',
        fileBlob: blob,
        duration: 20
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsImporting(false);
      setImportStatus('');
    }
  };

  // Delete media item
  const handleDelete = async (e, id, title) => {
    e.stopPropagation();
    if (confirm(`Remove "${title}" from your offline library?`)) {
      await deleteMediaItem(id);
    }
  };

  return (
    <div className="w-full px-4 md:px-8 py-6">
      {/* Header & Upload Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <HardDrive className="w-7 h-7 text-indigo-500" />
            <span>Offline Media Vault</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Zero-cloud, 100% offline local storage in IndexedDB (Dexie.js).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* File Upload Button */}
          <label className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-sm cursor-pointer shadow-lg shadow-indigo-600/20 active:scale-95 transition">
            <Upload className="w-4 h-4" />
            <span>Import Audio/Video</span>
            <input
              type="file"
              multiple
              accept="audio/*,video/*,.mp3,.wav,.ogg,.mp4,.webm"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isImporting}
            />
          </label>

          {/* Quick Demo Synthesizer */}
          <button
            onClick={handleGenerateSample}
            disabled={isImporting}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-200 text-sm font-medium transition active:scale-95"
            title="Synthesize demo audio loop"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline">Add Demo Loop</span>
          </button>
        </div>
      </div>

      {/* Import Status Banner */}
      {isImporting && (
        <div className="mt-4 p-3 rounded-xl bg-indigo-950/60 border border-indigo-700/50 flex items-center gap-3 text-indigo-200 text-sm animate-pulse">
          <FileAudio className="w-5 h-5 text-indigo-400 animate-spin" />
          <span>{importStatus || 'Processing media into IndexedDB...'}</span>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-6">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search offline tracks or artists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Filter Type Pills */}
        <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/80 shrink-0 self-start sm:self-auto">
          {[
            { id: 'all', label: 'All Files' },
            { id: 'audio', label: 'Audio', icon: Music2 },
            { id: 'video', label: 'Video', icon: Film }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setFilterType(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterType === id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-zinc-400">
          <Filter className="w-3.5 h-3.5" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-zinc-300 py-1.5 px-2.5 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="newest">Newest Added</option>
            <option value="title">Alphabetical (A-Z)</option>
            <option value="duration">Longest Duration</option>
          </select>
        </div>
      </div>

      {/* Media Items Grid / List */}
      <div className="mt-6">
        {!mediaItems ? (
          <div className="text-center py-16 text-zinc-500 text-sm">Loading library...</div>
        ) : mediaItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border-2 border-dashed border-zinc-800/80 bg-zinc-900/20">
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-4 shadow-inner">
              <HardDrive className="w-8 h-8 text-indigo-400/60" />
            </div>
            <h3 className="text-lg font-bold text-zinc-200">No media found in your vault</h3>
            <p className="text-sm text-zinc-400 max-w-sm mt-1 mb-5">
              Import your favorite music or video files (`.mp3`, `.mp4`, `.wav`, `.webm`) to store them directly on this device.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm cursor-pointer shadow-md transition">
                <Upload className="w-4 h-4" />
                <span>Upload From Device</span>
                <input
                  type="file"
                  multiple
                  accept="audio/*,video/*,.mp3,.wav,.ogg,.mp4,.webm"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <button
                onClick={handleGenerateSample}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium border border-zinc-700 transition"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Generate Demo Beat</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5">
            {mediaItems.map((item) => {
              const isCurrent = currentTrack?.id === item.id;
              const isThisPlaying = isCurrent && isPlaying;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isCurrent) {
                      togglePlay();
                    } else {
                      playTrack(item, mediaItems);
                    }
                  }}
                  className={`group relative flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                    isCurrent
                      ? 'bg-indigo-950/40 border-indigo-500/50 shadow-lg shadow-indigo-900/20'
                      : 'bg-zinc-900/50 hover:bg-zinc-900 border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Media Type Icon & Play Overlay */}
                    <div className="relative w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700/60 overflow-hidden shrink-0 flex items-center justify-center shadow-md">
                      {item.mediaType === 'video' ? (
                        <Film className="w-6 h-6 text-indigo-400" />
                      ) : (
                        <Music2 className="w-6 h-6 text-purple-400" />
                      )}

                      {/* Play Hover Overlay */}
                      <div
                        className={`absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center transition-opacity ${
                          isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {isThisPlaying ? (
                          <div className="flex items-end gap-0.5 h-4">
                            <span className="w-1 bg-indigo-400 rounded-full eq-bar-1" />
                            <span className="w-1 bg-indigo-400 rounded-full eq-bar-2" />
                            <span className="w-1 bg-indigo-400 rounded-full eq-bar-3" />
                          </div>
                        ) : (
                          <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                        )}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 flex-1 pr-2">
                      <h4
                        className={`text-sm font-semibold truncate ${
                          isCurrent ? 'text-indigo-300' : 'text-zinc-100 group-hover:text-white'
                        }`}
                      >
                        {item.title}
                      </h4>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{item.artist}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                          {item.mediaType}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-500">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(item.duration)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => handleDelete(e, item.id, item.title)}
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 rounded-xl transition"
                      title="Delete from Offline Vault"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
