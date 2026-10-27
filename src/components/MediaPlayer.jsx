import React, { useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import AudioVisualizer from './AudioVisualizer';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
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
  ListMusic
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
    ensureAudioContext
  } = usePlayer();

  const [showQueue, setShowQueue] = useState(false);
  const progressBarRef = useRef(null);

  // Time formatting helper: mm:ss
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === null) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Handle direct scrubbing on the progress bar
  const handleSeek = (e) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const fraction = Math.max(0, Math.min(1, clickX / width));
    seekTo(fraction * duration);
  };

  if (!currentTrack) {
    return (
      // Hidden persistent video element even before first track is selected
      <video
        ref={videoRef}
        playsInline
        webkit-playsinline="true"
        className="hidden"
      />
    );
  }

  return (
    <>
      {/* 
        CRITICAL ARCHITECTURAL REQUIREMENT:
        The single persistent <video> element MUST stay mounted in the DOM at all times.
        Never unmount it, replace it, or conditional-render it with if/else.
        Switching between Video and Audio Saja mode changes only its CSS visibility and container.
      */}
      <div className={isExpanded ? 'block' : 'hidden'}>
        <div
          className={`w-full max-w-2xl mx-auto rounded-2xl overflow-hidden aspect-video bg-black flex items-center justify-center relative shadow-2xl transition-all duration-300 ${
            isAudioOnly ? 'hidden' : 'block'
          }`}
        >
          <video
            ref={videoRef}
            src={blobUrl || undefined}
            playsInline
            webkit-playsinline="true"
            crossOrigin="anonymous"
            className="w-full h-full object-contain"
            onTimeUpdate={() => {
              if (videoRef.current) {
                setCurrentTime(videoRef.current.currentTime);
              }
            }}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setDuration(videoRef.current.duration);
              }
            }}
            onPlay={() => {
              setIsPlaying(true);
              ensureAudioContext();
            }}
            onPause={() => setIsPlaying(false)}
            onEnded={handleTrackEnded}
            onClick={togglePlay}
          />
        </div>
      </div>

      {/* If collapsed, keep the video element attached in DOM but visually hidden */}
      {!isExpanded && (
        <video
          ref={!isExpanded ? videoRef : null}
          src={blobUrl || undefined}
          playsInline
          webkit-playsinline="true"
          crossOrigin="anonymous"
          className="hidden"
          onTimeUpdate={() => {
            if (videoRef.current) {
              setCurrentTime(videoRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
            }
          }}
          onPlay={() => {
            setIsPlaying(true);
            ensureAudioContext();
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={handleTrackEnded}
        />
      )}

      {/* ======================================================== */}
      {/* 1. EXPANDED FULL PLAYER VIEW (Full Screen Overlay / Modal) */}
      {/* ======================================================== */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-2xl flex flex-col justify-between overflow-y-auto safe-bottom">
          {/* Top Bar: Collapse, Switcher Pill, PiP */}
          <div className="flex items-center justify-between px-4 py-4 max-w-4xl w-full mx-auto">
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition"
              title="Minimize Player"
            >
              <ChevronDown className="w-7 h-7" />
            </button>

            {/* YouTube Music-Style Video vs Audio Saja Switcher */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-full shadow-inner">
              <button
                onClick={() => setIsAudioOnly(false)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  !isAudioOnly
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Switch to Video View"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Mode Video</span>
              </button>

              <button
                onClick={() => setIsAudioOnly(true)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  isAudioOnly
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Switch to Audio-Only Mode with Visualizer"
              >
                <Music2 className="w-3.5 h-3.5" />
                <span>Audio Saja</span>
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
                onClick={() => setShowQueue(!showQueue)}
                className={`p-2 rounded-full transition ${
                  showQueue ? 'text-indigo-400 bg-zinc-800' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
                title="Queue / Playlist"
              >
                <ListMusic className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Center Stage: Video Screen OR Audio Saja Vinyl/Visualizer */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 max-w-2xl w-full mx-auto">
            {showQueue ? (
              // Queue Overlay
              <div className="w-full h-80 overflow-y-auto bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 backdrop-blur-md">
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
                        t.id === currentTrack.id ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300' : 'hover:bg-zinc-800/50 text-zinc-400'
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
              <AudioVisualizer className="max-h-[380px]" />
            ) : (
              // Video Mode: The video element placeholder indicator
              <div className="text-center text-xs text-zinc-500 my-2">
                Playing Offline Video • Tap video to pause/play
              </div>
            )}

            {/* Track Info */}
            <div className="w-full flex items-center justify-between mt-4">
              <div className="truncate pr-4">
                <h2 className="text-xl md:text-2xl font-bold text-white truncate tracking-tight">
                  {currentTrack.title}
                </h2>
                <p className="text-sm md:text-base text-zinc-400 truncate mt-0.5">
                  {currentTrack.artist}
                </p>
              </div>
              <span className="text-xs uppercase tracking-wider px-2.5 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-indigo-400 font-semibold shrink-0">
                {currentTrack.mediaType}
              </span>
            </div>

            {/* Seekable Progress Bar */}
            <div className="w-full mt-4 select-none">
              <div
                ref={progressBarRef}
                onClick={handleSeek}
                className="group relative w-full h-2 bg-zinc-800 hover:h-3 rounded-full cursor-pointer transition-all duration-150 flex items-center"
              >
                {/* Active progress fill */}
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full relative"
                  style={{ width: `${progressPercent}%` }}
                >
                  {/* Thumb handle */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform duration-150" />
                </div>
              </div>
              <div className="flex justify-between items-center text-xs font-mono text-zinc-400 mt-2">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Primary Transport Controls */}
            <div className="flex items-center justify-between w-full mt-4 px-2">
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
                className="p-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-full transition"
                title="Previous Track"
              >
                <SkipBack className="w-6 h-6" />
              </button>

              {/* 10s Rewind */}
              <button
                onClick={() => seekRelative(-10)}
                className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800/50 transition relative group"
                title="Rewind 10s"
              >
                <RotateCcw className="w-5 h-5" />
                <span className="absolute text-[8px] font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 group-hover:text-white text-zinc-400">10</span>
              </button>

              {/* Giant Play / Pause Button with Pulsing Glow */}
              <button
                onClick={togglePlay}
                className="p-4 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-xl shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all duration-150"
                title={isPlaying ? 'Pause' : 'Play'}
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
                className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800/50 transition relative group"
                title="Forward 10s"
              >
                <RotateCw className="w-5 h-5" />
                <span className="absolute text-[8px] font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 group-hover:text-white text-zinc-400">10</span>
              </button>

              {/* Skip Next */}
              <button
                onClick={nextTrack}
                className="p-2.5 text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-full transition"
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

            {/* Bottom Accessories: Volume & Speed */}
            <div className="w-full flex items-center justify-between mt-6 pt-4 border-t border-zinc-800/60 pb-2">
              {/* Volume Slider */}
              <div className="flex items-center gap-2 max-w-[160px] w-full">
                <button
                  onClick={toggleMute}
                  className="p-1.5 text-zinc-400 hover:text-zinc-200"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Playback Rate Selector */}
              <div className="flex items-center gap-1">
                {[0.75, 1, 1.25, 1.5].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => handlePlaybackRateChange(rate)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                      playbackRate === rate ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. DOCKED MINI-PLAYER BAR (Bottom of Screen)            */}
      {/* ======================================================== */}
      {!isExpanded && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-800/80 px-4 py-2.5 transition-all duration-200 shadow-2xl">
          {/* Thin progress line over the mini bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
              style={{ width: `${progressPercent}%` }}
            />
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

            {/* Right: Quick Controls (Play/Pause, Next, Expand) */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button
                onClick={togglePlay}
                className="p-2 sm:p-2.5 rounded-full bg-zinc-100 text-zinc-900 hover:bg-white hover:scale-105 active:scale-95 transition shadow-md"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <button
                onClick={nextTrack}
                className="p-2 text-zinc-400 hover:text-white rounded-full transition hidden xs:flex"
                title="Next"
              >
                <SkipForward className="w-5 h-5" />
              </button>

              <button
                onClick={() => setIsExpanded(true)}
                className="p-2 text-zinc-400 hover:text-white rounded-full transition"
                title="Expand Full Player"
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
