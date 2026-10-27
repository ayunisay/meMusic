import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  addMediaItem,
  deleteMediaItem,
  updateMediaItem,
  generateSampleAudioBlob,
  getStorageBreakdown,
  checkIsDuplicate
} from '../db/db';
import { usePlayer } from '../context/PlayerContext';
import {
  extractAndCompressAudio,
  isCompressibleAudio,
  formatBytes,
  MEDIA_ACCEPT_ATTRIBUTE,
  filterValidMediaFiles
} from '../utils/mediaOptimizer';
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
  HardDrive,
  Zap,
  ChevronDown,
  ChevronUp,
  PieChart,
  Layers
} from 'lucide-react';

export default function MediaLibrary() {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'audio' | 'video'
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'title' | 'duration'
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  // Storage Optimizer states
  const [storageData, setStorageData] = useState(null);
  const [showOptimizerSettings, setShowOptimizerSettings] = useState(false);
  const [optimizeVideoMode, setOptimizeVideoMode] = useState('keep'); // 'keep' (keep full video intact) | 'audio' (extract audio)
  const [compressLargeAudio, setCompressLargeAudio] = useState(true);
  const [preventDuplicates, setPreventDuplicates] = useState(false);
  const [convertingItemId, setConvertingItemId] = useState(null);

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

  // Helper to extract duration and metadata from a file blob safely
  const getFileDuration = (file, mediaType) => {
    return new Promise((resolve) => {
      let isSettled = false;
      const url = URL.createObjectURL(file);
      const element = document.createElement(mediaType === 'video' ? 'video' : 'audio');
      element.preload = 'metadata';
      if (mediaType === 'video') {
        element.muted = true;
        element.playsInline = true;
      }
      element.src = url;

      const finish = (dur) => {
        if (!isSettled) {
          isSettled = true;
          URL.revokeObjectURL(url);
          resolve(dur || 0);
        }
      };

      element.onloadedmetadata = () => finish(element.duration || 0);
      element.onerror = () => finish(0);
      setTimeout(() => finish(0), 1500);
    });
  };

  // Refresh storage breakdown on mediaItems changes
  useEffect(() => {
    getStorageBreakdown().then(setStorageData);
  }, [mediaItems]);

  // Clean up any procedural/synthetic demo tracks from database
  useEffect(() => {
    db.mediaLibrary.where('artist').equals('Xdinary Heroes').delete().catch(() => {});
  }, []);

  // Core handler: Strictly validate and process media files (audio & video only)
  const processMediaFiles = async (rawFiles) => {
    if (!rawFiles || rawFiles.length === 0) return;

    // Filter strictly for video and audio/song files only!
    const { validFiles, invalidFiles } = filterValidMediaFiles(rawFiles);

    // If any non-media files were selected/dropped (e.g. .pdf, .exe, .zip, .png, .docx), reject them!
    if (invalidFiles.length > 0) {
      const invalidNames = invalidFiles.map(item => item.file.name).slice(0, 3).join(', ');
      const extraCount = invalidFiles.length > 3 ? ` dan ${invalidFiles.length - 3} file lainnya` : '';

      if (validFiles.length === 0) {
        alert(
          `Format file tidak didukung!\n\nHanya file Video (.mp4, .webm, .mkv, .mov) dan Lagu/Audio (.mp3, .wav, .m4a, .flac, .ogg, .aac) yang diperbolehkan diunggah.\n\nFile yang ditolak:\n${invalidNames}${extraCount}`
        );
        return;
      } else {
        alert(
          `Perhatian: ${invalidFiles.length} file diabaikan karena bukan file lagu atau video:\n${invalidNames}${extraCount}\n\nHanya file video & lagu yang diproses.`
        );
      }
    }

    setIsImporting(true);
    let totalOriginal = 0;
    let totalSaved = 0;
    let skippedCount = 0;

    for (let i = 0; i < validFiles.length; i++) {
      const { file, isVideo, isAudio } = validFiles[i];
      setImportStatus(`Memproses ${i + 1} dari ${validFiles.length}: ${file.name}...`);

      // 1. Check duplicate if preventDuplicates is true
      if (preventDuplicates) {
        const isDup = await checkIsDuplicate(file.name, file.size);
        if (isDup) {
          skippedCount++;
          continue;
        }
      }

      // Parse title and artist from filename
      let title = file.name.replace(/\.[^/.]+$/, '');
      let artist = 'Offline Artist';

      if (title.includes(' - ')) {
        const parts = title.split(' - ');
        artist = parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      }

      try {
        if (isVideo) {
          // If user specifically enabled extract audio mode in settings, try extracting; otherwise save full video directly!
          if (optimizeVideoMode === 'audio') {
            try {
              setImportStatus(`Mengoptimalkan (${i + 1}/${validFiles.length}): Mengekstrak audio jernih dari video "${file.name}"...`);
              const res = await extractAndCompressAudio(file, (pct) => {
                setImportStatus(`Mengekstrak audio ${pct}%: ${file.name}...`);
              });

              await addMediaItem({
                title,
                artist,
                mediaType: 'audio',
                fileBlob: res.blob,
                duration: res.duration,
                originalSize: res.originalSize,
                fileSize: res.newSize,
                isOptimized: true,
                savingsPercent: res.savingsPercent,
                convertedFromVideo: true
              });
              totalOriginal += res.originalSize;
              totalSaved += (res.originalSize - res.newSize);
              continue;
            } catch (extErr) {
              console.warn('Video audio extraction failed, saving full video instead:', extErr);
            }
          }

          // Direct Video Save (Saves original video file so user can watch video!)
          setImportStatus(`Menyimpan video (${i + 1}/${validFiles.length}): ${file.name}...`);
          const duration = await getFileDuration(file, 'video');
          await addMediaItem({
            title,
            artist,
            mediaType: 'video',
            fileBlob: file,
            duration,
            originalSize: file.size,
            fileSize: file.size,
            isOptimized: false,
            savingsPercent: 0,
            convertedFromVideo: false
          });
        } else if (isAudio && compressLargeAudio && isCompressibleAudio(file)) {
          // Compress large audio / WAV to 128kbps MP3 (saves 80-90% space!)
          setImportStatus(`Mengoptimalkan (${i + 1}/${validFiles.length}): Mengompres audio "${file.name}" ke MP3 hemat ruang...`);
          const res = await extractAndCompressAudio(file, (pct) => {
            setImportStatus(`Mengompres audio ${pct}%: ${file.name}...`);
          });

          await addMediaItem({
            title,
            artist,
            mediaType: 'audio',
            fileBlob: res.blob,
            duration: res.duration,
            originalSize: res.originalSize,
            fileSize: res.newSize,
            isOptimized: true,
            savingsPercent: res.savingsPercent,
            convertedFromVideo: false
          });
          totalOriginal += res.originalSize;
          totalSaved += (res.originalSize - res.newSize);
        } else {
          // Store original audio
          const duration = await getFileDuration(file, 'audio');
          await addMediaItem({
            title,
            artist,
            mediaType: 'audio',
            fileBlob: file,
            duration,
            originalSize: file.size,
            fileSize: file.size,
            isOptimized: false,
            savingsPercent: 0,
            convertedFromVideo: false
          });
        }
      } catch (err) {
        console.error('Error adding file to Dexie:', err);
        // Fallback: save original if error occurred
        try {
          const duration = await getFileDuration(file, isVideo ? 'video' : 'audio');
          await addMediaItem({
            title,
            artist,
            mediaType: isVideo ? 'video' : 'audio',
            fileBlob: file,
            duration,
            originalSize: file.size,
            fileSize: file.size
          });
        } catch (fallbackErr) {
          console.error('Fallback error:', fallbackErr);
        }
      }
    }

    setIsImporting(false);
    if (totalSaved > 0) {
      setImportStatus(`Selesai! Berhasil menghemat ${formatBytes(totalSaved)} ruang penyimpanan.`);
      setTimeout(() => setImportStatus(''), 4500);
    } else if (skippedCount > 0 && validFiles.length === skippedCount) {
      setImportStatus(`File sudah ada di perpustakaan (${skippedCount} file duplikat dilewati).`);
      setTimeout(() => setImportStatus(''), 3500);
    } else if (validFiles.length > 0) {
      setImportStatus(`Selesai! Berhasil menambahkan ${validFiles.length - skippedCount} media ke perpustakaan offline.`);
      setTimeout(() => setImportStatus(''), 4500);
    } else {
      setImportStatus('');
    }
    getStorageBreakdown().then(setStorageData);
  };

  // Handle file input selection (multiple files supported with storage saver)
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    await processMediaFiles(files);
    event.target.value = '';
  };

  // Drag and drop event handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      await processMediaFiles(files);
    }
  };

  // Convert an existing video item into lightweight audio
  const handleConvertVideoToAudio = async (e, item) => {
    e.stopPropagation();
    if (!item.fileBlob) return;
    if (!confirm(`Ekstrak audio dari video "${item.title}"? Video akan diubah menjadi MP3 audio jernih dan menghemat ruang hingga 90%.`)) {
      return;
    }

    setConvertingItemId(item.id);
    setIsImporting(true);
    setImportStatus(`Mengonversi video "${item.title}" menjadi audio hemat ruang...`);

    try {
      const res = await extractAndCompressAudio(item.fileBlob, (pct) => {
        setImportStatus(`Mengekstrak audio ${pct}%: ${item.title}...`);
      });

      await updateMediaItem(item.id, {
        fileBlob: res.blob,
        mediaType: 'audio',
        originalSize: item.fileSize || item.fileBlob.size,
        fileSize: res.newSize,
        isOptimized: true,
        savingsPercent: res.savingsPercent,
        convertedFromVideo: true
      });

      setImportStatus(`Sukses! Menghemat ${formatBytes((item.fileSize || item.fileBlob.size) - res.newSize)} ruang memori.`);
      setTimeout(() => setImportStatus(''), 4000);
      getStorageBreakdown().then(setStorageData);
    } catch (err) {
      console.error('Error converting video to audio:', err);
      alert('Gagal mengonversi video: ' + (err.message || 'Format tidak didukung'));
    } finally {
      setIsImporting(false);
      setConvertingItemId(null);
    }
  };

  // Batch convert all existing video files in the library to audio
  const handleBatchConvertAllVideos = async () => {
    const videoItems = (mediaItems || []).filter(item => item.mediaType === 'video');
    if (videoItems.length === 0) return;

    if (!confirm(`Ekstrak audio dari SEMUA ${videoItems.length} video di koleksi? Anda bisa menghemat banyak sekali ruang memori IndexedDB.`)) {
      return;
    }

    setIsImporting(true);
    let converted = 0;
    let savedTotal = 0;

    for (let i = 0; i < videoItems.length; i++) {
      const item = videoItems[i];
      setImportStatus(`Mengonversi (${i + 1}/${videoItems.length}): ${item.title}...`);
      try {
        const res = await extractAndCompressAudio(item.fileBlob);
        const original = item.fileSize || item.fileBlob.size;
        await updateMediaItem(item.id, {
          fileBlob: res.blob,
          mediaType: 'audio',
          originalSize: original,
          fileSize: res.newSize,
          isOptimized: true,
          savingsPercent: res.savingsPercent,
          convertedFromVideo: true
        });
        converted++;
        savedTotal += (original - res.newSize);
      } catch (err) {
        console.error('Failed to convert', item.title, err);
      }
    }

    setIsImporting(false);
    setImportStatus(`Selesai! ${converted} video berhasil dikonversi ke audio. Berhasil menghemat ${formatBytes(savedTotal)}!`);
    setTimeout(() => setImportStatus(''), 5000);
    getStorageBreakdown().then(setStorageData);
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
    if (confirm(`Hapus "${title}" dari penyimpanan offline?`)) {
      await deleteMediaItem(id);
      getStorageBreakdown().then(setStorageData);
    }
  };

  const videoCount = (mediaItems || []).filter(item => item.mediaType === 'video').length;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative w-full px-4 md:px-8 py-6 space-y-6 min-h-[calc(100vh-80px)]"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 border-4 border-dashed border-indigo-500 m-4 rounded-3xl pointer-events-none animate-in fade-in duration-200">
          <div className="w-20 h-20 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center mb-4 border border-indigo-500/50 animate-bounce">
            <Upload className="w-10 h-10" />
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white text-center">Lepaskan File di Sini</h2>
          <p className="text-sm md:text-base text-indigo-300 font-medium text-center mt-2 max-w-md">
            Hanya file <strong className="text-white">Lagu/Audio</strong> (.mp3, .wav, .m4a, .flac, .ogg) & <strong className="text-white">Video</strong> (.mp4, .webm, .mkv, .mov) yang dapat di-upload.
          </p>
        </div>
      )}
      {/* Header & Upload Action */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <HardDrive className="w-7 h-7 text-indigo-500" />
            <span>Offline Media Vault</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Media player offline mandiri dengan optimasi penyimpanan cerdas di IndexedDB.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Storage Saver Toggle Button */}
          <button
            onClick={() => setShowOptimizerSettings(!showOptimizerSettings)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition active:scale-95 shadow-sm ${
              optimizeVideoMode === 'audio' || compressLargeAudio
                ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-400 hover:bg-emerald-900/30'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title="Buka pengaturan optimasi & penghematan ruang"
          >
            <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400/30" />
            <span>Mode Hemat Ruang: {optimizeVideoMode === 'audio' ? 'Ekstrak Audio' : 'Video Penuh'}</span>
            {showOptimizerSettings ? <ChevronUp className="w-4 h-4 ml-0.5" /> : <ChevronDown className="w-4 h-4 ml-0.5" />}
          </button>


          {/* File Upload Button */}
          <label className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-xs sm:text-sm cursor-pointer shadow-lg shadow-indigo-600/20 active:scale-95 transition">
            <Upload className="w-4 h-4" />
            <span>Import Musik / Video</span>
            <input
              type="file"
              multiple
              accept={MEDIA_ACCEPT_ATTRIBUTE}
              onChange={handleFileUpload}
              className="hidden"
              disabled={isImporting}
            />
          </label>

          {/* Quick Demo Synthesizer */}
          <button
            onClick={handleGenerateSample}
            disabled={isImporting}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs sm:text-sm font-medium transition active:scale-95"
            title="Generate sample audio beat"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline">Demo Beat</span>
          </button>
        </div>
      </div>

      {/* Storage Saver Settings Drawer */}
      {showOptimizerSettings && (
        <div className="bg-zinc-900/90 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Pengaturan Optimasi Penyimpanan (Hemat Memori)</h3>
                <p className="text-xs text-zinc-400">Atur bagaimana file musik dan video diproses saat diunggah agar tidak boros ruang.</p>
              </div>
            </div>
            <button
              onClick={() => setShowOptimizerSettings(false)}
              className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-lg bg-zinc-800"
            >
              Tutup
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            {/* Setting 1: Video Handling */}
            <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
                <Film className="w-4 h-4 text-indigo-400" />
                <span>Saat Unggah Video (MP4/WebM)</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <label className="flex items-start gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer hover:border-emerald-500/40 transition">
                  <input
                    type="radio"
                    name="videoMode"
                    value="audio"
                    checked={optimizeVideoMode === 'audio'}
                    onChange={() => setOptimizeVideoMode('audio')}
                    className="mt-0.5 text-emerald-500 focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold text-emerald-400">Ekstrak Audio Saja (Rekomendasi)</span>
                    <p className="text-[11px] text-zinc-400">Mengambil audio jernih dan membuang beban video. <strong>Hemat ~90% memori!</strong> (100MB jadi ~3MB).</p>
                  </div>
                </label>

                <label className="flex items-start gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition">
                  <input
                    type="radio"
                    name="videoMode"
                    value="keep"
                    checked={optimizeVideoMode === 'keep'}
                    onChange={() => setOptimizeVideoMode('keep')}
                    className="mt-0.5 text-indigo-500 focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold text-zinc-300">Simpan Video Utuh</span>
                    <p className="text-[11px] text-zinc-400">Menyimpan file visual video original apa adanya (memakan memori lebih besar).</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Setting 2: Large Audio / WAV Compression */}
            <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
                <Music2 className="w-4 h-4 text-purple-400" />
                <span>Kompresi Audio Besar / WAV</span>
              </div>
              <label className="flex items-start gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer hover:border-emerald-500/40 transition text-xs">
                <input
                  type="checkbox"
                  checked={compressLargeAudio}
                  onChange={(e) => setCompressLargeAudio(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-500 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-zinc-200">Otomatis Kompres Format Berat</span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    File WAV/FLAC uncompressed (30-60 MB) otomatis dikompresi ke format MP3 128kbps jernih, menghemat <strong>85-90% memori</strong> tanpa mengurangi kualitas suara.
                  </p>
                </div>
              </label>
            </div>

            {/* Setting 3: Smart Deduplication */}
            <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Pencegahan File Duplikat</span>
              </div>
              <label className="flex items-start gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer hover:border-emerald-500/40 transition text-xs">
                <input
                  type="checkbox"
                  checked={preventDuplicates}
                  onChange={(e) => setPreventDuplicates(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-500 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-zinc-200">Lewati File yang Sudah Ada</span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Mencegah penyimpanan ganda jika Anda tidak sengaja mengunggah lagu yang sama dua kali.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Storage Breakdown & Optimization Dashboard */}
      {storageData && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
              <PieChart className="w-4 h-4 text-indigo-400" />
              <span>Penggunaan Ruang Penyimpanan IndexedDB:</span>
              <strong className="text-white font-mono">{storageData.totalMB} MB Terpakai</strong>
            </div>

            {storageData.totalSavedBytes > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/50 border border-emerald-600/40 text-emerald-400 text-xs font-semibold">
                <Zap className="w-3.5 h-3.5" />
                <span>Berhasil Menghemat {storageData.totalSavedMB} MB Ruang!</span>
              </div>
            )}
          </div>

          {/* Color Breakdown Bar */}
          <div className="w-full h-2.5 rounded-full bg-zinc-800 overflow-hidden flex">
            {storageData.totalBytes > 0 ? (
              <>
                <div
                  style={{ width: `${(storageData.audioBytes / storageData.totalBytes) * 100}%` }}
                  className="bg-indigo-500 h-full transition-all duration-300"
                  title={`Musik Audio: ${storageData.audioMB} MB`}
                />
                <div
                  style={{ width: `${(storageData.videoBytes / storageData.totalBytes) * 100}%` }}
                  className="bg-cyan-500 h-full transition-all duration-300"
                  title={`Video: ${storageData.videoMB} MB`}
                />
                <div
                  style={{ width: `${(storageData.melodyBytes / storageData.totalBytes) * 100}%` }}
                  className="bg-amber-500 h-full transition-all duration-300"
                  title={`Melody Vault: ${storageData.melodyMB} MB`}
                />
              </>
            ) : (
              <div className="w-full h-full bg-zinc-800" />
            )}
          </div>

          {/* Legend and Batch Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
            <div className="flex flex-wrap items-center gap-4 text-zinc-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span>Musik: <strong className="text-zinc-200 font-mono">{storageData.audioMB} MB</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                <span>Video: <strong className="text-zinc-200 font-mono">{storageData.videoMB} MB</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Rekaman Ide: <strong className="text-zinc-200 font-mono">{storageData.melodyMB} MB</strong></span>
              </div>
            </div>

            {videoCount > 0 && (
              <button
                onClick={handleBatchConvertAllVideos}
                disabled={isImporting}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition"
                title="Ekstrak audio dari semua video yang ada di koleksi untuk menghemat banyak ruang"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Ekstrak {videoCount} Video ke Audio (Hemat Ruang)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Import Status Banner */}
      {isImporting && (
        <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-700/50 flex items-center gap-3 text-indigo-200 text-sm animate-pulse">
          <FileAudio className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />
          <span className="truncate">{importStatus || 'Memproses & mengoptimalkan media ke IndexedDB...'}</span>
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
              Import file lagu/musik (.mp3, .wav, .m4a, .flac) atau video (.mp4, .webm, .mkv) ke penyimpanan offline perangkat Anda.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm cursor-pointer shadow-md transition">
                <Upload className="w-4 h-4" />
                <span>Upload Dari Perangkat</span>
                <input
                  type="file"
                  multiple
                  accept={MEDIA_ACCEPT_ATTRIBUTE}
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
              const isConverting = convertingItemId === item.id;
              const itemSize = item.fileSize || (item.fileBlob ? item.fileBlob.size : 0);

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

                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                          {item.mediaType}
                        </span>

                        <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-500">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(item.duration)}</span>
                        </span>

                        <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/40">
                          {formatBytes(itemSize)}
                        </span>

                        {item.isOptimized && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5 fill-emerald-400" />
                            <span>Hemat {item.savingsPercent}%</span>
                          </span>
                        )}

                        {item.convertedFromVideo && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                            Audio Video
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Convert Video to Audio Button if it's still video */}
                    {item.mediaType === 'video' && (
                      <button
                        onClick={(e) => handleConvertVideoToAudio(e, item)}
                        disabled={isImporting || isConverting}
                        className="p-1.5 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 transition active:scale-95 shadow-sm"
                        title="Ekstrak audio dari video ini untuk menghemat hingga 90% memori"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span className="hidden xl:inline text-[11px]">Ekstrak Audio</span>
                      </button>
                    )}

                    <button
                      onClick={(e) => handleDelete(e, item.id, item.title)}
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 rounded-xl transition"
                      title="Hapus dari Offline Vault"
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
