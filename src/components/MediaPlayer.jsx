import React, { useRef, useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import AudioVisualizer from './AudioVisualizer';
import LyricsViewer from './LyricsViewer';
import { parseLyrics, findCurrentLyricIndex } from '../utils/lyricsParser';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  ChevronDown,
  Maximize2,
  PictureInPicture,
  Film,
  Music2,
  ListMusic,
  Sparkles
} from 'lucide-react';

export default function MediaPlayer() {
  const {
    currentTrack,
    playlist,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackRate,
    repeatMode,
    isShuffle,
    isAudioOnly,
    isExpanded,
    blobUrl,
    videoRef,
    // Actions
    playTrack,
    togglePlay,
    nextTrack,
    previousTrack,
    seekTo,
    seekRelative,
    handleVolumeChange,
    toggleMute,
    cycleRepeat,
    setIsShuffle,
    setIsAudioOnly,
    setIsExpanded,
    togglePictureInPicture,
    handlePlaybackRateChange,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    handleTrackEnded,
    ensureAudioContext,
    updateCurrentTrackLyrics
  } = usePlayer();

  // Active view in expanded player: 'split' (video + lyrics side-by-side) | 'media' (theater full video) | 'lyrics' | 'queue'
  const [activeTab, setActiveTab] = useState('split');
  const progressBarRef = useRef(null);

  // Live subtitle calculation for video screen
  const parsedLyrics = parseLyrics(currentTrack?.lyrics || '');
  const activeLyricIndex = parsedLyrics.isSynced ? findCurrentLyricIndex(parsedLyrics.lines, currentTime) : -1;
  const currentLyricSubtitle = activeLyricIndex >= 0 ? parsedLyrics.lines[activeLyricIndex]?.text : '';

  // Scrubbing drag state
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);

  // Keyboard shortcuts (Space, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, L, N, P, M)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in text inputs or within Virtual Synth / Piano
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.target.closest('[data-virtual-synth]')) return;

      // When player is collapsed (mini player), NEVER intercept letter keys like 'l', 'n', 'p', or space
      // so it never interferes with piano or other components!
      if (!isExpanded) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekRelative(5);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        handleVolumeChange(Math.min(1, (volume || 0) + 0.05));
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        handleVolumeChange(Math.max(0, (volume || 0) - 0.05));
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        seekRelative(-10);
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        nextTrack();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        previousTrack();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        setActiveTab(prev => prev === 'split' ? 'media' : 'split');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume, isMuted, isPlaying, isExpanded, duration, currentTime]);

  // Time formatting helper: mm:ss
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === null || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const displayDuration = duration > 0 ? duration : (currentTrack?.duration || 0);
  const displayCurrentTime = isScrubbing ? scrubTime : currentTime;
  const progressPercent = displayDuration > 0 ? (displayCurrentTime / displayDuration) * 100 : 0;

  // Calculate seek time from clientX
  const calculateSeekTime = (clientX, targetRect) => {
    if (!targetRect) return 0;
    const clickX = clientX - targetRect.left;
    const fraction = Math.max(0, Math.min(1, clickX / targetRect.width));
    return fraction * (displayDuration || 0);
  };

  // Direct click seek
  const handleSeek = (e) => {
    if (!progressBarRef.current || !displayDuration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const target = calculateSeekTime(e.clientX, rect);
    seekTo(target);
  };

  // Drag scrubber with mouse
  const handleMouseDown = (e) => {
    if (!progressBarRef.current || !displayDuration) return;
    e.preventDefault();
    setIsScrubbing(true);
    const rect = progressBarRef.current.getBoundingClientRect();
    const initialTime = calculateSeekTime(e.clientX, rect);
    setScrubTime(initialTime);

    const onMouseMove = (moveEvent) => {
      const newTime = calculateSeekTime(moveEvent.clientX, rect);
      setScrubTime(newTime);
    };

    const onMouseUp = (upEvent) => {
      const finalTime = calculateSeekTime(upEvent.clientX, rect);
      seekTo(finalTime);
      setIsScrubbing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Drag scrubber with touch
  const handleTouchStart = (e) => {
    if (!progressBarRef.current || !displayDuration || !e.touches[0]) return;
    setIsScrubbing(true);
    const rect = progressBarRef.current.getBoundingClientRect();
    const initialTime = calculateSeekTime(e.touches[0].clientX, rect);
    setScrubTime(initialTime);

    let latestTime = initialTime;
    const onTouchMove = (moveEvent) => {
      if (!moveEvent.touches[0]) return;
      latestTime = calculateSeekTime(moveEvent.touches[0].clientX, rect);
      setScrubTime(latestTime);
    };

    const onTouchEnd = () => {
      seekTo(latestTime);
      setIsScrubbing(false);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  };

  // Mini player seek
  const handleMiniSeek = (e) => {
    e.stopPropagation();
    if (!displayDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    seekTo(fraction * displayDuration);
  };

  // Keep HTML5 video element synchronized with React isPlaying state at all times
  useEffect(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(err => {
          console.warn('Playback play synchronization note:', err);
        });
      }
    } else {
      if (!videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, activeTab, isAudioOnly, isExpanded, blobUrl]);

  return (
    <>
      {/* ======================================================== */}
      {/* 1. EXPANDED FULL PLAYER VIEW (Full Screen Overlay / Modal) */}
      {/* ======================================================== */}
      <div
        className={`fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-2xl flex flex-col justify-between overflow-y-auto safe-bottom transition-all duration-300 ${
          isExpanded && currentTrack
            ? 'opacity-100 pointer-events-auto visible scale-100'
            : 'opacity-0 pointer-events-none invisible scale-95'
        }`}
      >
        {/* Top Bar: Collapse, Switcher Pill, PiP - ALWAYS STICKY & VISIBLE */}
        <header className="sticky top-0 z-40 w-full bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-800/80 shadow-lg shrink-0">
          <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 py-2.5 max-w-[1440px] w-full mx-auto">
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition"
              title="Minimize Player"
            >
              <ChevronDown className="w-7 h-7" />
            </button>

            {/* View Mode Switcher Pill */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-full shadow-inner gap-1">
              {currentTrack?.mediaType === 'video' ? (
                <>
                  <button
                    onClick={() => {
                      setIsAudioOnly(false);
                      setActiveTab('split');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                      !isAudioOnly && activeTab === 'split'
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Mode Video + Lirik (Tampil Berdampingan / Subtitle)"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Video + Lirik</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsAudioOnly(false);
                      setActiveTab('media');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                      !isAudioOnly && activeTab === 'media'
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Mode Video Layar Penuh (Cinema)"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Video Saja</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setActiveTab('split');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                    activeTab === 'split'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Mode Visualizer + Lirik"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Audio + Lirik</span>
                </button>
              )}

              <button
                onClick={() => {
                  setIsAudioOnly(true);
                  setActiveTab('media');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  isAudioOnly && activeTab === 'media'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Switch to Audio Visualizer"
              >
                <Music2 className="w-3.5 h-3.5" />
                <span>Visualizer</span>
              </button>

            </div>

            {/* Right actions: PiP & Queue */}
            <div className="flex items-center gap-1">
              {currentTrack?.mediaType === 'video' && !isAudioOnly && (
                <button
                  onClick={togglePictureInPicture}
                  className="p-2 text-zinc-400 hover:text-indigo-400 rounded-full hover:bg-zinc-800 transition"
                  title="Picture in Picture"
                >
                  <PictureInPicture className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => setActiveTab(activeTab === 'queue' ? 'split' : 'queue')}
                className={`p-2 rounded-full transition ${
                  activeTab === 'queue' ? 'text-indigo-400 bg-zinc-800' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
                title="Antrean / Playlist"
              >
                <ListMusic className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Center Stage: Video Screen OR Audio Visualizer OR Synced Lyrics OR Split OR Queue */}
        <div className="flex-1 flex flex-col items-center justify-center px-2 sm:px-6 md:px-8 max-w-[1440px] w-full mx-auto my-auto min-h-0 relative">
          <div className={`w-full flex-1 flex items-center justify-center min-h-0 ${
            activeTab === 'split' ? 'gap-4 lg:gap-6 grid grid-cols-1 lg:grid-cols-12 py-2 w-full' : ''
          }`}>
            {/* The Single Persistent Video Element */}
            <div
              className={`transition-all duration-300 ${
                activeTab === 'split' && !isAudioOnly && currentTrack?.mediaType === 'video'
                  ? 'lg:col-span-7 xl:col-span-7 w-full rounded-2xl md:rounded-3xl overflow-hidden aspect-video bg-black flex items-center justify-center shadow-2xl border border-zinc-800 relative z-10 max-h-[70vh]'
                  : isExpanded && currentTrack && !isAudioOnly && activeTab === 'media'
                  ? 'w-full max-w-6xl mx-auto rounded-3xl overflow-hidden aspect-video bg-black flex items-center justify-center shadow-2xl border border-zinc-800 relative z-10 max-h-[76vh]'
                  : 'absolute inset-0 w-full h-full opacity-10 blur-xl pointer-events-none -z-10 overflow-hidden'
              }`}
            >
              <video
                ref={videoRef}
                src={blobUrl || undefined}
                autoPlay={isPlaying}
                playsInline
                webkit-playsinline="true"
                controls={false}
                className="w-full h-full object-contain cursor-pointer"
                onTimeUpdate={() => {
                  if (videoRef.current && !isScrubbing) {
                    setCurrentTime(videoRef.current.currentTime);
                  }
                }}
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    if (isFinite(videoRef.current.duration) && videoRef.current.duration > 0) {
                      setDuration(videoRef.current.duration);
                    }
                    videoRef.current.volume = isMuted ? 0 : volume;
                    videoRef.current.muted = isMuted;
                    videoRef.current.playbackRate = playbackRate;
                    if (isPlaying && videoRef.current.paused) {
                      videoRef.current.play().catch(() => {});
                    }
                  }
                }}
                onDurationChange={() => {
                  if (videoRef.current && isFinite(videoRef.current.duration) && videoRef.current.duration > 0) {
                    setDuration(videoRef.current.duration);
                  }
                }}
                onCanPlay={() => {
                  if (isPlaying && videoRef.current && videoRef.current.paused) {
                    videoRef.current.play().catch(() => {});
                  }
                }}
                onSeeking={() => {
                  if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                }}
                onSeeked={() => {
                  if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                }}
                onPlay={() => {
                  setIsPlaying(true);
                }}
                onPlaying={() => {
                  setIsPlaying(true);
                }}
                onEnded={handleTrackEnded}
                onClick={togglePlay}
              />

              {/* Floating Live Subtitle / Karaoke Line Overlay directly on the video (in Theater Mode) */}
              {currentLyricSubtitle && !isAudioOnly && activeTab === 'media' && (
                <div className="absolute bottom-3 sm:bottom-5 left-4 right-4 sm:left-8 sm:right-8 text-center pointer-events-none z-20 transition-all duration-200">
                  <span className="inline-block max-w-[95%] px-4 py-2 rounded-2xl bg-black/85 backdrop-blur-md text-white font-bold text-xs sm:text-sm md:text-base border border-white/20 shadow-2xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] tracking-wide animate-in fade-in zoom-in-95">
                    {currentLyricSubtitle}
                  </span>
                </div>
              )}

              {/* Tap to play indicator overlay when paused on video */}
              {!isPlaying && currentTrack?.mediaType === 'video' && (activeTab === 'media' || activeTab === 'split') && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center cursor-pointer transition hover:bg-black/30 z-30"
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-2xl hover:scale-105 transition active:scale-95">
                    <Play className="w-8 h-8 md:w-10 md:h-10 fill-current ml-1" />
                  </div>
                </div>
              )}
            </div>

            {/* Complementary / Alternative views in Center Stage */}
            {activeTab === 'split' ? (
              // Split Mode:
              // If video: Left is video, Right is Lyrics
              // If audio: Left is Visualizer, Right is Lyrics
              <>
                {(isAudioOnly || currentTrack?.mediaType !== 'video') && (
                  <div className="lg:col-span-6 w-full flex items-center justify-center z-10">
                    <AudioVisualizer className="max-h-[380px] lg:max-h-[440px]" />
                  </div>
                )}
                <div className={`${isAudioOnly || currentTrack?.mediaType !== 'video' ? 'lg:col-span-6' : 'lg:col-span-5 xl:col-span-5'} w-full h-[440px] sm:h-[500px] lg:h-[65vh] z-10`}>
                  <LyricsViewer
                    track={currentTrack}
                    currentTime={currentTime}
                    duration={displayDuration}
                    seekTo={seekTo}
                    onUpdateLyrics={updateCurrentTrackLyrics}
                    className="w-full h-full shadow-2xl"
                  />
                </div>
              </>
            ) : activeTab === 'queue' ? (
              // Queue Overlay
              <div className="w-full max-w-4xl h-80 md:h-[460px] overflow-y-auto bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 backdrop-blur-md z-10">
                <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center justify-between">
                  <span>Up Next ({playlist.length})</span>
                  <span className="text-xs text-zinc-500">{isShuffle ? '🔀 Shuffled' : 'Sequential'}</span>
                </h4>
                <div className="space-y-2">
                  {playlist.map((t, idx) => (
                    <div
                      key={t.id || idx}
                      onClick={() => {
                        seekTo(0);
                        playTrack(t);
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                        t.id === currentTrack?.id ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300' : 'hover:bg-zinc-800/50 text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className="text-xs font-mono text-zinc-500 w-4">{idx + 1}</span>
                        <div className="truncate">
                          <p className="text-sm font-medium text-zinc-200 truncate">{t.title}</p>
                          <p className="text-xs text-zinc-500 truncate">{t.artist}</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-zinc-500">{formatTime(t.duration)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : isAudioOnly ? (
              // Audio Saja: Animated Vinyl & HTML5 Canvas Frequency Equalizer
              <div className="w-full max-w-3xl flex items-center justify-center z-10">
                <AudioVisualizer className="max-h-[440px]" />
              </div>
            ) : null}
          </div>
        </div>

        {/* Bottom Area: Track Info, Seekbar, Transport, Volume & Speed (Spacious Widescreen matching center stage) */}
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 pb-4 shrink-0">
          {/* Track Info */}
          <div className="w-full flex items-center justify-between mt-2">
            <div className="truncate pr-4">
              <h2 className="text-2xl md:text-3xl font-extrabold text-white truncate tracking-tight">
                {currentTrack?.title || 'No Track Selected'}
              </h2>
              <p className="text-sm md:text-base text-zinc-400 truncate mt-0.5">
                {currentTrack?.artist || 'Offline Media'}
              </p>
            </div>
            {currentTrack?.mediaType && (
              <span className="text-xs uppercase tracking-wider px-3 py-1 rounded-full bg-zinc-800/90 border border-zinc-700/60 text-indigo-400 font-semibold shrink-0">
                {currentTrack.mediaType}
              </span>
            )}
          </div>

          {/* Seekable Progress Bar with Drag Scrubber */}
          <div className="w-full mt-3 select-none">
            <div
              ref={progressBarRef}
              onClick={handleSeek}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              className="group relative w-full py-2 cursor-pointer flex items-center"
              title="Klik atau geser untuk memajukan / memundurkan lagu"
            >
              {/* Track background */}
              <div className="w-full h-2 group-hover:h-2.5 bg-zinc-800 rounded-full overflow-hidden transition-all duration-150 relative">
                {/* Active progress fill */}
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-violet-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />
              </div>
              {/* Scrubbing thumb handle */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-indigo-500 transition-transform ${
                  isScrubbing ? 'scale-125' : 'scale-0 group-hover:scale-100'
                } pointer-events-none`}
                style={{ left: `calc(${Math.min(100, Math.max(0, progressPercent))}% - 8px)` }}
              />
            </div>
            <div className="flex justify-between items-center text-xs font-mono text-zinc-400 mt-0.5">
              <span className={isScrubbing ? 'text-indigo-400 font-bold' : ''}>{formatTime(displayCurrentTime)}</span>
              <span>{formatTime(displayDuration)}</span>
            </div>
          </div>

          {/* Primary Transport Controls */}
          <div className="flex items-center justify-between w-full mt-3 px-2">
            {/* Shuffle Button */}
            <button
              onClick={() => setIsShuffle(!isShuffle)}
              className={`p-2.5 rounded-full transition ${
                isShuffle ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-500 hover:text-zinc-200'
              }`}
              title="Shuffle"
            >
              <Shuffle className="w-5 h-5" />
            </button>

            {/* Skip Back */}
            <button
              onClick={previousTrack}
              className="p-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-full transition active:scale-95"
              title="Previous Track"
            >
              <SkipBack className="w-6 h-6" />
            </button>

            {/* 10s Rewind */}
            <button
              onClick={() => seekRelative(-10)}
              className="p-2.5 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800/50 transition relative group active:scale-95"
              title="Rewind 10s (← / J)"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="absolute text-[8px] font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 group-hover:text-white text-zinc-400">10</span>
            </button>

            {/* Giant Play / Pause Button with Pulsing Glow */}
            <button
              onClick={togglePlay}
              className="p-4 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-xl shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all duration-150"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 fill-current" />
              ) : (
                <Play className="w-8 h-8 fill-current ml-0.5" />
              )}
            </button>

            {/* 10s Forward */}
            <button
              onClick={() => seekRelative(10)}
              className="p-2.5 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800/50 transition relative group active:scale-95"
              title="Forward 10s (→)"
            >
              <RotateCw className="w-5 h-5" />
              <span className="absolute text-[8px] font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 group-hover:text-white text-zinc-400">10</span>
            </button>

            {/* Skip Next */}
            <button
              onClick={nextTrack}
              className="p-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-full transition active:scale-95"
              title="Next Track"
            >
              <SkipForward className="w-6 h-6" />
            </button>

            {/* Repeat Button */}
            <button
              onClick={cycleRepeat}
              className={`p-2.5 rounded-full transition ${
                repeatMode !== 'none' ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-500 hover:text-zinc-200'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            </button>
          </div>

          {/* Bottom Accessories: Volume Control & Playback Speed */}
          <div className="w-full flex flex-wrap items-center justify-between gap-4 mt-5 pt-3.5 border-t border-zinc-800/60 pb-1">
            {/* Comprehensive Volume Slider with Mute, Percentage & Presets */}
            <div className="flex items-center gap-2.5 max-w-xs w-full bg-zinc-900/60 px-3 py-2 rounded-xl border border-zinc-800/80">
              <button
                onClick={toggleMute}
                className="p-1 text-zinc-400 hover:text-white transition"
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-4 h-4 text-zinc-300" />
                ) : (
                  <Volume2 className="w-4 h-4 text-indigo-400" />
                )}
              </button>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="text-[11px] font-mono text-zinc-400 w-9 text-right shrink-0">
                  {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono border-l border-zinc-800 pl-2">
                <button
                  onClick={() => handleVolumeChange(0.5)}
                  className="px-1.5 py-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                  title="Volume 50%"
                >
                  50%
                </button>
                <button
                  onClick={() => handleVolumeChange(1.0)}
                  className="px-1.5 py-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                  title="Volume 100%"
                >
                  100%
                </button>
              </div>
            </div>

            {/* Playback Rate Selector */}
            <div className="flex items-center gap-1 bg-zinc-900/60 px-2.5 py-1.5 rounded-xl border border-zinc-800/80">
              <span className="text-[11px] text-zinc-500 font-medium mr-1 hidden sm:inline">Speed:</span>
              {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handlePlaybackRateChange(rate)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                    playbackRate === rate ? 'bg-indigo-600 text-white font-bold shadow' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. DOCKED MINI-PLAYER BAR (Bottom of Screen)            */}
      {/* ======================================================== */}
      {currentTrack && !isExpanded && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-800/80 px-4 py-2.5 transition-all duration-200 shadow-2xl">
          {/* Seekable thin progress line over the mini bar */}
          <div
            onClick={handleMiniSeek}
            className="absolute -top-1 left-0 right-0 h-3 py-1 cursor-pointer group z-10"
            title="Klik untuk memajukan / memundurkan lagu"
          >
            <div className="w-full h-1 group-hover:h-2 bg-zinc-800 transition-all">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
          </div>

          <div className="w-full px-2 md:px-6 flex items-center justify-between gap-3">
            {/* Left: Thumbnail & Info (Clickable to Expand) */}
            <div
              onClick={() => setIsExpanded(true)}
              className="flex items-center gap-3 cursor-pointer min-w-0 flex-1 group"
            >
              <div className="w-11 h-11 rounded-lg bg-zinc-800 border border-zinc-700/60 overflow-hidden shrink-0 flex items-center justify-center relative shadow-md">
                {currentTrack.mediaType === 'video' ? (
                  <Film className="w-5 h-5 text-indigo-400" />
                ) : (
                  <Music2 className="w-5 h-5 text-indigo-400" />
                )}
                {isPlaying && (
                  <div className="absolute inset-0 bg-indigo-950/40 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-100 truncate group-hover:text-indigo-300 transition">
                  {currentTrack.title}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 truncate">{currentTrack.artist}</span>
                  <span className="text-[10px] text-zinc-500 hidden sm:inline">•</span>
                  <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
              </div>
            </div>

            {/* Center / Right: Quick Video / Audio Switcher chip */}
            <div className="hidden sm:flex items-center bg-zinc-950/60 p-0.5 rounded-full border border-zinc-800 text-xs">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAudioOnly(!isAudioOnly);
                }}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium text-zinc-300 hover:text-white flex items-center gap-1"
                title="Toggle Audio/Video mode"
              >
                {isAudioOnly ? (
                  <>
                    <Music2 className="w-3 h-3 text-indigo-400" />
                    <span>Audio Saja</span>
                  </>
                ) : (
                  <>
                    <Film className="w-3 h-3 text-indigo-400" />
                    <span>Mode Video</span>
                  </>
                )}
              </button>
            </div>

            {/* Desktop Volume Slider in Mini-Player */}
            <div className="hidden md:flex items-center gap-2 w-32 lg:w-44 bg-zinc-950/60 px-2.5 py-1.5 rounded-xl border border-zinc-800/80">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                className="p-1 text-zinc-400 hover:text-white transition"
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-4 h-4 text-zinc-300" />
                ) : (
                  <Volume2 className="w-4 h-4 text-zinc-300" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  e.stopPropagation();
                  handleVolumeChange(parseFloat(e.target.value));
                }}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="text-[10px] font-mono text-zinc-400 w-7 text-right shrink-0">
                {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
              </span>
            </div>

            {/* Quick Lyrics Button in Mini-Player */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('lyrics');
                setIsExpanded(true);
              }}
              className={`p-2 rounded-full transition ${
                currentTrack?.lyrics
                  ? 'text-indigo-400 hover:text-indigo-300 hover:bg-zinc-800'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Lihat / Edit Lirik Lagu (L)"
            >
              <FileText className="w-4 h-4" />
            </button>

            {/* Right: Quick Transport Controls (Previous, Play/Pause, Next, Expand) */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* Previous Track */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  previousTrack();
                }}
                className="p-1.5 sm:p-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-full transition active:scale-95"
                title="Lagu Sebelumnya (P)"
              >
                <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              </button>

              {/* Play / Pause */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="p-2 sm:p-2.5 rounded-full bg-zinc-100 text-zinc-900 hover:bg-white hover:scale-105 active:scale-95 transition shadow-md"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />}
              </button>

              {/* Next Track */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextTrack();
                }}
                className="p-1.5 sm:p-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-full transition active:scale-95"
                title="Lagu Berikutnya (N)"
              >
                <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              </button>

              {/* Expand to Full Player */}
              <button
                onClick={() => setIsExpanded(true)}
                className="p-1.5 sm:p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition ml-0.5 sm:ml-1"
                title="Buka Pemutar Penuh"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
