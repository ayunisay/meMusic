import React, { useState, useEffect, useRef } from 'react';
import {
  parseLyrics,
  findCurrentLyricIndex,
  formatTimeTag,
  autoDistributeTimestamps,
  shiftTimestamps,
  getCuratedLyrics
} from '../utils/lyricsParser';
import {
  Edit3,
  Check,
  Upload,
  Clock,
  Sparkles,
  Music2,
  Trash2,
  HelpCircle,
  Play,
  Sliders,
  RotateCcw,
  ArrowDownCircle
} from 'lucide-react';

export default function LyricsViewer({
  track,
  currentTime = 0,
  duration = 0,
  seekTo,
  onUpdateLyrics,
  className = ''
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(track?.lyrics || '');
  // Auto-scroll is ON by default so lyrics follow the video/music out of the box.
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [lyricsOffset, setLyricsOffset] = useState(0);
  const [showOffsetControls, setShowOffsetControls] = useState(false);

  const containerRef = useRef(null);
  const activeLineRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // User manual scroll detection to prevent auto-scroll from fighting / jumping
  const isUserScrollingRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const userScrollTimeoutRef = useRef(null);
  const [userInteractedScroll, setUserInteractedScroll] = useState(false);

  const handleUserScroll = () => {
    // Ignore wheel/touch events fired by our own programmatic auto-scroll
    if (programmaticScrollRef.current) return;
    isUserScrollingRef.current = true;
    setUserInteractedScroll(true);
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
      setUserInteractedScroll(false);
    }, 3500);
  };

  const resumeAutoScroll = () => {
    isUserScrollingRef.current = false;
    programmaticScrollRef.current = false;
    setUserInteractedScroll(false);
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeEl = activeLineRef.current;
      const containerHeight = container.clientHeight;
      const containerRect = container.getBoundingClientRect();
      const elRect = activeEl.getBoundingClientRect();
      const elTopWithinContainer = (elRect.top - containerRect.top) + container.scrollTop;
      const targetScrollTop = Math.max(0, elTopWithinContainer - (containerHeight / 2) + (elRect.height / 2));
      programmaticScrollRef.current = true;
      container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      userScrollTimeoutRef.current = setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 700);
    }
  };

  // Sync edit text when track changes
  useEffect(() => {
    setEditText(track?.lyrics || '');
    setIsEditing(false);
    setLyricsOffset(0);
    setShowOffsetControls(false);
    isUserScrollingRef.current = false;
    programmaticScrollRef.current = false;
    setUserInteractedScroll(false);
  }, [track?.id, track?.lyrics]);

  // Parse current lyrics with offset
  const parsed = parseLyrics(track?.lyrics || '');
  const activeIndex = parsed.isSynced ? findCurrentLyricIndex(parsed.lines, currentTime, lyricsOffset) : -1;
  const curatedLyrics = getCuratedLyrics(track?.title || '');

  // Auto-scroll active lyric into view safely inside container only
  useEffect(() => {
    if (!isAutoScrollEnabled || !parsed.isSynced || !containerRef.current || isUserScrollingRef.current) return;

    const container = containerRef.current;
    let targetScrollTop = 0;

    // If still in instrumental intro, scroll smoothly to the top
    if (activeIndex < 0) {
      targetScrollTop = 0;
    } else if (activeLineRef.current) {
      const activeEl = activeLineRef.current;
      const containerHeight = container.clientHeight;
      // Compute the line's offset relative to the scroll container in a layout-safe way
      // (offsetTop can point to a different positioned ancestor and cause misalignment)
      const containerRect = container.getBoundingClientRect();
      const elRect = activeEl.getBoundingClientRect();
      const elTopWithinContainer = (elRect.top - containerRect.top) + container.scrollTop;
      targetScrollTop = Math.max(0, elTopWithinContainer - (containerHeight / 2) + (elRect.height / 2));
    }

    // Only scroll if we're meaningfully off target (avoids fighting/jitter every tick)
    if (Math.abs(container.scrollTop - targetScrollTop) > 4) {
      programmaticScrollRef.current = true;
      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
      if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
      userScrollTimeoutRef.current = setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 700);
    }
  }, [activeIndex, isAutoScrollEnabled, parsed.isSynced, parsed.rawText, track?.id]);

  // Format seconds to mm:ss display
  const formatTimeDisplay = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Handle saving edited lyrics
  const handleSave = async () => {
    if (onUpdateLyrics) {
      await onUpdateLyrics(editText.trim());
    }
    setIsEditing(false);
  };

  // Handle importing a .lrc or .txt file
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setEditText(content);
        setIsEditing(true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Insert current timestamp [mm:ss.xx] at cursor in textarea
  const handleInsertTimestamp = () => {
    if (!textareaRef.current) return;
    const tag = formatTimeTag(currentTime);
    const start = textareaRef.current.selectionStart || 0;
    const end = textareaRef.current.selectionEnd || 0;
    const text = editText;
    const before = text.substring(0, start);
    const after = text.substring(end);

    // If start of line, just tag + space, otherwise newline + tag + space
    const insert = (start === 0 || before.endsWith('\n')) ? `${tag} ` : `\n${tag} `;
    const newText = before + insert + after;
    setEditText(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + insert.length, start + insert.length);
      }
    }, 10);
  };

  // Handle clearing lyrics
  const handleClear = async () => {
    if (confirm('Hapus lirik dari lagu ini?')) {
      setEditText('');
      if (onUpdateLyrics) {
        await onUpdateLyrics('');
      }
      setIsEditing(false);
    }
  };

  return (
    <div className={`relative flex flex-col h-full bg-black/60 border border-zinc-800/60 rounded-2xl overflow-hidden backdrop-blur-md ${className}`}>
      {/* Hidden file input for .lrc/.txt */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".lrc,.txt,text/plain"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Header bar (YouTube Music inspired clean tab bar) */}
      <div className="flex items-center justify-between px-6 pt-3.5 pb-2.5 border-b border-zinc-800/60 bg-zinc-950/70 select-none shrink-0">
        <div className="flex items-center gap-6">
          <div className="text-sm font-bold text-white tracking-wider uppercase border-b-2 border-white pb-2 -mb-2.5 cursor-default">
            Lirik
          </div>
          {parsed.isSynced && (
            <span className="text-[11px] text-zinc-500 font-medium hidden sm:inline">
              (Sinkron Musik)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {parsed.isSynced && !isEditing && (
            <>
              <button
                onClick={() => setShowOffsetControls(!showOffsetControls)}
                className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border transition ${
                  lyricsOffset !== 0 || showOffsetControls
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
                title="Atur delay lirik"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>{lyricsOffset !== 0 ? `${lyricsOffset > 0 ? '+' : ''}${lyricsOffset.toFixed(1)}s` : 'Delay'}</span>
              </button>

              <button
                onClick={() => setIsAutoScrollEnabled(!isAutoScrollEnabled)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                  isAutoScrollEnabled
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
                title="Auto-scroll lirik"
              >
                Auto-Scroll: {isAutoScrollEnabled ? 'ON' : 'OFF'}
              </button>
            </>
          )}

          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition"
              title="Edit / Tempel Lirik"
            >
              <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Edit</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200"
                title="Panduan format lirik"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs px-2.5 py-1 rounded-lg text-zinc-400 hover:text-white bg-zinc-800 transition"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sync Timing Offset Bar (Kalibrasi Lirik) */}
      {!isEditing && showOffsetControls && parsed.isSynced && (
        <div className="px-4 py-2 bg-zinc-900/90 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Sliders className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold text-white">Kalibrasi Delay Lirik:</span>
            <span className="text-[11px] text-zinc-400 hidden sm:inline">(Klik "+" jika lirik mulai sebelum vokal)</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setLyricsOffset(prev => +(prev - 1).toFixed(1))}
              className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 active:scale-95 transition"
              title="Percepat 1 detik"
            >
              -1s
            </button>
            <button
              onClick={() => setLyricsOffset(prev => +(prev - 0.5).toFixed(1))}
              className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 active:scale-95 transition"
              title="Percepat 0.5 detik"
            >
              -0.5s
            </button>
            <span className="px-2.5 py-0.5 font-mono font-bold rounded bg-zinc-950 border border-zinc-700 text-amber-400 min-w-16 text-center">
              {lyricsOffset > 0 ? `+${lyricsOffset.toFixed(1)}` : `${lyricsOffset.toFixed(1)}`}s
            </span>
            <button
              onClick={() => setLyricsOffset(prev => +(prev + 0.5).toFixed(1))}
              className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 active:scale-95 transition"
              title="Tunda 0.5 detik (Mulai lebih lambat)"
            >
              +0.5s
            </button>
            <button
              onClick={() => setLyricsOffset(prev => +(prev + 1).toFixed(1))}
              className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 active:scale-95 transition"
              title="Tunda 1 detik (Mulai lebih lambat)"
            >
              +1s
            </button>
            {lyricsOffset !== 0 && (
              <>
                <button
                  onClick={() => setLyricsOffset(0)}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px]"
                  title="Reset delay ke 0"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
                <button
                  onClick={async () => {
                    const shifted = shiftTimestamps(track?.lyrics || '', lyricsOffset);
                    if (onUpdateLyrics && shifted) {
                      await onUpdateLyrics(shifted);
                      setLyricsOffset(0);
                      setShowOffsetControls(false);
                    }
                  }}
                  className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shadow transition active:scale-95 ml-1"
                  title="Simpan pergeseran waktu ini secara permanen ke file lirik"
                >
                  Simpan Permanen
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {isEditing ? (
        /* Edit Mode */
        <div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden bg-zinc-950/80">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-800 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleInsertTimestamp}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-medium transition active:scale-95"
                title="Sisipkan penanda waktu pemutaran saat ini"
              >
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>+ Waktu ({formatTimeTag(currentTime)})</span>
              </button>

              <button
                onClick={() => {
                  const vocalStart = currentTime > 2 ? Math.round(currentTime) : 14;
                  const synced = autoDistributeTimestamps(editText, duration || track?.duration, vocalStart);
                  if (synced) setEditText(synced);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-medium transition active:scale-95"
                title="Ratakan waktu baris lirik otomatis sesuai durasi lagu agar langsung berjalan mengikuti musik"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Auto-Sync (Mulai {currentTime > 2 ? formatTimeDisplay(currentTime) : '0:14'})</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-medium transition active:scale-95"
                title="Impor file .lrc atau .txt dari komputer"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>Impor .LRC / .TXT</span>
              </button>
            </div>

            {editText && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition"
                title="Hapus semua lirik"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            )}
          </div>

          {/* Quick Help Guide if opened */}
          {showHelp && (
            <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 space-y-1 animate-in fade-in">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Format Lirik yang Didukung:
              </p>
              <p className="text-zinc-300">
                1. <strong>Synced LRC</strong>: Gunakan tag waktu <code className="bg-zinc-900 px-1 py-0.5 rounded text-amber-300">[mm:ss.xx]</code> sebelum kalimat lirik agar teks otomatis menyala & bernyanyi secara realtime.
              </p>
              <p className="text-zinc-300">
                2. <strong>Teks Biasa</strong>: Tempelkan teks lirik lagu biasa tanpa tag waktu.
              </p>
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder={`Tempel lirik lagu di sini...\n\nContoh format tersinkronisasi (LRC):\n[00:12.50] Baris lirik pertama\n[00:18.20] Baris lirik kedua\n\nAtau tempel teks lirik biasa tanpa penanda waktu.`}
            className="flex-1 w-full bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 text-xs sm:text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
          />
        </div>
      ) : parsed.lines.length === 0 ? (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3 shadow-inner">
            <Music2 className="w-7 h-7 text-indigo-400/50" />
          </div>
          <h4 className="text-base font-bold text-zinc-200">Belum Ada Lirik</h4>
          <p className="text-xs text-zinc-400 max-w-xs mt-1 mb-5">
            Tambahkan lirik untuk lagu "{track?.title || 'ini'}" agar Anda bisa bernyanyi bersama secara realtime.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {curatedLyrics && (
              <button
                onClick={async () => {
                  if (onUpdateLyrics) {
                    await onUpdateLyrics(curatedLyrics);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md transition active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Gunakan Lirik Resmi Xdinary Heroes (Presisi 100%)</span>
              </button>
            )}
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-xs shadow-md transition active:scale-95"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Tambah / Tempel Lirik</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-medium text-xs transition active:scale-95"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>Impor .LRC / .TXT</span>
            </button>
          </div>
        </div>
      ) : parsed.isSynced ? (
        /* Synchronized Karaoke / LRC View */
        <div className="relative flex-1 overflow-hidden flex flex-col">
          {/* Banner if Curated LRC is available but current text does not match */}
          {curatedLyrics && track?.lyrics !== curatedLyrics && (
            <div className="mx-4 my-2 p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/80 via-teal-950/80 to-zinc-900 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs z-20 shrink-0">
              <div className="flex items-center gap-2 text-emerald-300 min-w-0">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate font-medium">Tersedia Lirik Resmi Xdinary Heroes (Pas 100% dengan Lagu & Video Ini)</span>
              </div>
              <button
                onClick={async () => {
                  if (onUpdateLyrics) {
                    await onUpdateLyrics(curatedLyrics);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition active:scale-95 shrink-0 flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Terapkan Lirik Presisi</span>
              </button>
            </div>
          )}

          <div
            ref={containerRef}
            onWheel={handleUserScroll}
            onTouchMove={handleUserScroll}
            className="flex-1 overflow-y-auto px-6 py-6 scroll-smooth text-left select-text custom-lyrics-scrollbar"
          >
            {/* Flat Text Lyrics - YouTube Music Style */}
            {parsed.lines.map((item, idx) => {
              const isActive = idx === activeIndex;
              const isStanzaGap = item.isSpacerBefore || (idx > 0 && item.time - parsed.lines[idx - 1].time > 5.5);

              return (
                <div
                  key={item.id || idx}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => seekTo && seekTo(item.time)}
                  className={`group cursor-pointer transition-all duration-150 text-left select-text ${
                    isStanzaGap ? 'mt-7 sm:mt-8' : 'mt-1.5 sm:mt-2'
                  }`}
                  title={`Klik untuk melompat ke menit ${formatTimeDisplay(item.time)}`}
                >
                  <p
                    className={`leading-relaxed sm:leading-loose transition-all duration-150 ${
                      isActive
                        ? 'text-white font-bold text-lg sm:text-xl md:text-2xl drop-shadow-[0_2px_8px_rgba(255,255,255,0.25)]'
                        : 'text-zinc-400 group-hover:text-zinc-100 font-medium text-base sm:text-lg md:text-xl opacity-90 group-hover:opacity-100'
                    }`}
                  >
                    {item.text}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Floating Resume Auto-Scroll Button when user interacted */}
          {userInteractedScroll && isAutoScrollEnabled && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto animate-in fade-in slide-in-from-bottom-2">
              <button
                onClick={resumeAutoScroll}
                className="px-4 py-2 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-semibold shadow-2xl backdrop-blur-md border border-indigo-400/50 flex items-center gap-1.5 transition active:scale-95 animate-bounce"
              >
                <ArrowDownCircle className="w-4 h-4" />
                <span>Lanjutkan Auto-Scroll</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Plain Text Lyrics View */
        <div className="flex-1 flex flex-col overflow-hidden">
          {curatedLyrics && (
            <div className="mx-4 my-2 p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/80 via-teal-950/80 to-zinc-900 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs z-20 shrink-0">
              <div className="flex items-center gap-2 text-emerald-300 min-w-0">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate font-medium">Tersedia Lirik Resmi Xdinary Heroes (Pas 100% dengan Lagu Ini)</span>
              </div>
              <button
                onClick={async () => {
                  if (onUpdateLyrics) {
                    await onUpdateLyrics(curatedLyrics);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition active:scale-95 shrink-0 flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Terapkan Lirik Presisi</span>
              </button>
            </div>
          )}

          {/* Smart banner to auto-sync plain lyrics so they follow the music */}
          <div className="mx-4 my-2 p-2.5 rounded-xl bg-gradient-to-r from-indigo-950/70 via-purple-950/70 to-zinc-900 border border-indigo-500/40 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 text-zinc-300 min-w-0">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="truncate">Lirik belum ada penanda waktu. Ingin lirik jalan otomatis mengikuti lagu?</span>
            </div>
            <button
              onClick={async () => {
                const vocalStart = currentTime > 2 ? Math.round(currentTime) : 14;
                const synced = autoDistributeTimestamps(track?.lyrics || '', duration || track?.duration, vocalStart);
                if (synced && onUpdateLyrics) {
                  await onUpdateLyrics(synced);
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-md transition active:scale-95 shrink-0"
              title="Otomatis ratakan penanda waktu lirik agar jalan dan menyala mengikuti musik"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Auto-Sync (Mulai {currentTime > 2 ? formatTimeDisplay(currentTime) : '0:14'})</span>
            </button>
          </div>

          <div
            ref={containerRef}
            className="flex-1 overflow-y-auto px-6 py-6 scroll-smooth text-left select-text custom-lyrics-scrollbar"
          >
            {parsed.lines.map((line, idx) => {
              const isStanzaGap = line.isSpacerBefore;
              return (
                <div
                  key={idx}
                  className={`text-left ${isStanzaGap ? 'mt-7 sm:mt-8' : 'mt-1.5 sm:mt-2'}`}
                >
                  <p className="text-base sm:text-lg md:text-xl font-medium text-zinc-300 leading-relaxed sm:leading-loose hover:text-white transition">
                    {line.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
