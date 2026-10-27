import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { updateTrackLyrics } from '../db/db';
import { getCuratedLyrics } from '../utils/lyricsParser';

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  // Current media state
  const [currentTrack, setCurrentTrack] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('meMusic_volume');
    return saved !== null ? parseFloat(saved) : 0.85;
  });
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('meMusic_muted') === 'true';
  });
  const [playbackRate, setPlaybackRate] = useState(1);
  const [repeatMode, setRepeatMode] = useState('none'); // 'none' | 'one' | 'all'
  const [isShuffle, setIsShuffle] = useState(false);

  // Mode Video vs Audio Saja (CRITICAL: single persistent HTML5 video element)
  const [isAudioOnly, setIsAudioOnly] = useState(false);

  // Player UI state
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);

  // Current Blob URL object for the active track
  const [blobUrl, setBlobUrl] = useState(null);

  // DOM ref to the persistent HTML5 video element
  const videoRef = useRef(null);

  // Web Audio API refs for frequency analyzer
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const trackId = currentTrack?.id;
  const fileBlob = currentTrack?.fileBlob;

  // Manage Blob URL creation and cleanup - ONLY recreate when track ID actually changes!
  useEffect(() => {
    if (!fileBlob) {
      setBlobUrl(null);
      return;
    }

    const url = URL.createObjectURL(fileBlob);
    setBlobUrl(url);

    // Auto default: If it's pure audio, default to Audio Saja mode.
    // If it's video, default to Video mode unless user specifically toggled.
    if (currentTrack?.mediaType === 'audio') {
      setIsAudioOnly(true);
    } else {
      setIsAudioOnly(false);
    }

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [trackId]);

  // Helper to determine if current lyrics are un-synced, dummy, or outdated
  const shouldApplyCuratedLyrics = (trackTitle, currentLyrics, curated) => {
    if (!curated) return false;
    if (!currentLyrics || currentLyrics.trim() === '') return true;
    // If lyrics contain old dummy text
    if (currentLyrics.includes('We were young, we were wild and free')) return true;
    // For Obsessed with Youth (10_1vuZAeP0)
    if (
      (trackTitle?.toLowerCase().includes('youth') || trackTitle?.toLowerCase().includes('1vu') || trackTitle?.includes('엑스디') || trackTitle?.includes('어린')) &&
      !currentLyrics.includes('\n\n[00:44.80]')
    ) {
      return true;
    }
    // For u and me in arguments
    if (trackTitle?.toLowerCase().includes('argument') && !currentLyrics.includes('psycho drama')) {
      return true;
    }
    return false;
  };

  // Auto-apply verified curated lyrics to active track if un-synced or outdated
  useEffect(() => {
    if (!currentTrack || !currentTrack.id) return;
    const curated = getCuratedLyrics(currentTrack.title || '');
    if (shouldApplyCuratedLyrics(currentTrack.title, currentTrack.lyrics, curated)) {
      updateTrackLyrics(currentTrack.id, curated).then(() => {
        setCurrentTrack(prev => prev ? { ...prev, lyrics: curated } : null);
        setPlaylist(prev => prev.map(t => t.id === currentTrack.id ? { ...t, lyrics: curated } : t));
      }).catch(console.warn);
    }
  }, [trackId, currentTrack?.lyrics]);

  // Ensure video element volume/mute/speed stays perfectly synced
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
      videoRef.current.muted = isMuted;
      videoRef.current.playbackRate = playbackRate;
    }
  }, [blobUrl, volume, isMuted, playbackRate]);

  // Connect Web Audio API ONLY for audio visualizer, NEVER for video files
  // (Chromium suspends video decoding pipeline when connected to Web Audio)
  const ensureAudioContext = () => {
    // If current track is video, we DO NOT attach createMediaElementSource
    if (!videoRef.current || currentTrack?.mediaType === 'video') return;

    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;

        if (!sourceNodeRef.current && videoRef.current) {
          try {
            const source = ctx.createMediaElementSource(videoRef.current);
            source.connect(analyser);
            analyser.connect(ctx.destination);
            sourceNodeRef.current = source;
          } catch (sourceErr) {
            console.warn('createMediaElementSource notice:', sourceErr);
          }
        }

        audioContextRef.current = ctx;
        analyserRef.current = analyser;
      }

      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    } catch (err) {
      console.warn('Web Audio API context init:', err);
    }
  };

  // Play a specific track
  const playTrack = (track, newPlaylist = null) => {
    if (newPlaylist) {
      setPlaylist(newPlaylist);
    }

    // Auto-match 100% verified LRC lyrics for known songs
    const curated = getCuratedLyrics(track?.title || '');
    if (shouldApplyCuratedLyrics(track?.title, track?.lyrics, curated)) {
      track = { ...track, lyrics: curated };
      updateTrackLyrics(track.id, curated).catch(console.warn);
      if (newPlaylist) {
        setPlaylist(newPlaylist.map(t => t.id === track.id ? { ...t, lyrics: curated } : t));
      } else {
        setPlaylist(prev => prev.map(t => t.id === track.id ? { ...t, lyrics: curated } : t));
      }
    }

    setCurrentTrack(track);
    if (track && track.duration && track.duration > 0) {
      setDuration(track.duration);
    }
    setIsPlaying(true);

    // If playing video, immediately expand player to show the video canvas
    if (track.mediaType === 'video') {
      setIsAudioOnly(false);
      setIsExpanded(true);
    }

    ensureAudioContext();

    // Small delay for DOM to load source if needed
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.volume = isMuted ? 0 : volume;
        videoRef.current.muted = isMuted;
        videoRef.current.playbackRate = playbackRate;
        videoRef.current.play().catch(err => {
          console.warn('Playback play request interrupted:', err);
        });
      }
    }, 60);
  };

  // Toggle Play / Pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    ensureAudioContext();

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Play error:', err);
      });
    }
  };

  // Skip Next
  const nextTrack = async () => {
    let currentPlaylist = playlist;
    if (!currentPlaylist || currentPlaylist.length === 0) {
      try {
        currentPlaylist = await db.mediaLibrary.toArray();
        setPlaylist(currentPlaylist);
      } catch (e) {
        currentPlaylist = [];
      }
    }
    if (!currentPlaylist || currentPlaylist.length === 0) return;

    const currentIndex = currentPlaylist.findIndex(t => t.id === currentTrack?.id);

    if (isShuffle) {
      const remaining = currentPlaylist.filter((_, idx) => idx !== currentIndex);
      const randomTrack = remaining.length > 0 ? remaining[Math.floor(Math.random() * remaining.length)] : currentPlaylist[0];
      playTrack(randomTrack);
      return;
    }

    if (currentIndex >= 0 && currentIndex < currentPlaylist.length - 1) {
      playTrack(currentPlaylist[currentIndex + 1]);
    } else {
      playTrack(currentPlaylist[0]);
    }
  };

  // Skip Previous
  const previousTrack = async () => {
    let currentPlaylist = playlist;
    if (!currentPlaylist || currentPlaylist.length === 0) {
      try {
        currentPlaylist = await db.mediaLibrary.toArray();
        setPlaylist(currentPlaylist);
      } catch (e) {
        currentPlaylist = [];
      }
    }
    if (!currentPlaylist || currentPlaylist.length === 0) return;

    // If more than 3 seconds in, restart track to 0
    if (videoRef.current && videoRef.current.currentTime > 3) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    const currentIndex = currentPlaylist.findIndex(t => t.id === currentTrack?.id);

    if (currentIndex > 0) {
      playTrack(currentPlaylist[currentIndex - 1]);
    } else {
      playTrack(currentPlaylist[currentPlaylist.length - 1]);
    }
  };

  // Seek to specific second
  const seekTo = (seconds) => {
    if (videoRef.current) {
      const maxDur = duration || (currentTrack?.duration) || videoRef.current.duration || 999999;
      const target = Math.max(0, Math.min(maxDur, Number(seconds) || 0));
      try {
        videoRef.current.currentTime = target;
        setCurrentTime(target);
      } catch (err) {
        console.warn('seekTo error:', err);
      }
    }
  };

  // Step backward / forward by offset seconds
  const seekRelative = (offsetSeconds) => {
    if (videoRef.current) {
      const maxDur = duration || (currentTrack?.duration) || videoRef.current.duration || 999999;
      const cur = videoRef.current.currentTime || currentTime || 0;
      const target = Math.max(0, Math.min(maxDur, cur + offsetSeconds));
      try {
        videoRef.current.currentTime = target;
        setCurrentTime(target);
      } catch (err) {
        console.warn('seekRelative error:', err);
      }
    }
  };

  // Toggle Volume & Mute with localStorage persistence
  const handleVolumeChange = (newVol) => {
    const clamped = Math.max(0, Math.min(1, Number(newVol) || 0));
    setVolume(clamped);
    try {
      localStorage.setItem('meMusic_volume', clamped.toString());
    } catch (e) {
      // ignore
    }

    if (videoRef.current) {
      videoRef.current.volume = clamped;
      if (clamped > 0 && isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
        try {
          localStorage.setItem('meMusic_muted', 'false');
        } catch (e) {
          // ignore
        }
      }
    }
  };

  const toggleMute = () => {
    const targetMuted = !isMuted;
    setIsMuted(targetMuted);
    try {
      localStorage.setItem('meMusic_muted', targetMuted.toString());
    } catch (e) {
      // ignore
    }

    if (videoRef.current) {
      videoRef.current.muted = targetMuted;
    }
  };

  // Update lyrics for the active track
  const updateCurrentTrackLyrics = async (newLyrics) => {
    if (!currentTrack || !currentTrack.id) return;
    try {
      await updateTrackLyrics(currentTrack.id, newLyrics);
      setCurrentTrack(prev => prev ? { ...prev, lyrics: newLyrics } : null);
      setPlaylist(prev => prev.map(t => t.id === currentTrack.id ? { ...t, lyrics: newLyrics } : t));
    } catch (err) {
      console.error('Failed to update track lyrics:', err);
    }
  };

  // Cycle repeat modes
  const cycleRepeat = () => {
    const modes = ['none', 'all', 'one'];
    const nextIdx = (modes.indexOf(repeatMode) + 1) % modes.length;
    setRepeatMode(modes[nextIdx]);
  };

  // Change Playback Speed
  const handlePlaybackRateChange = (rate) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  // Toggle Picture-in-Picture
  const togglePictureInPicture = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else if (document.pictureInPictureEnabled && currentTrack?.mediaType === 'video') {
        await videoRef.current.requestPictureInPicture();
        setIsPiPActive(true);
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  };

  // Handle Track End based on repeat mode
  const handleTrackEnded = () => {
    if (repeatMode === 'one') {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
        setIsPlaying(true);
      }
    } else {
      nextTrack();
    }
  };

  // MEDIA SESSION API (Background playback, OS lock screen & notification controls)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Untitled Track',
        artist: currentTrack.artist || 'Offline Media',
        album: 'TuneVault Offline Library',
        artwork: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      // Bind action handlers for OS lock screen / media keys
      const actionHandlers = [
        ['play', () => { togglePlay(); }],
        ['pause', () => { togglePlay(); }],
        ['previoustrack', () => { previousTrack(); }],
        ['nexttrack', () => { nextTrack(); }],
        ['seekbackward', (details) => { seekRelative(-(details.seekOffset || 10)); }],
        ['seekforward', (details) => { seekRelative(details.seekOffset || 10); }],
        ['seekto', (details) => { if (details.seekTime !== undefined) seekTo(details.seekTime); }]
      ];

      actionHandlers.forEach(([action, handler]) => {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch (err) {
          console.warn(`MediaSession action ${action} not supported:`, err);
        }
      });
    }

    return () => {
      // Clear handlers when track unmounts
      if ('mediaSession' in navigator) {
        try {
          ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'seekto'].forEach(action => {
            navigator.mediaSession.setActionHandler(action, null);
          });
        } catch (e) {
          // ignore
        }
      }
    };
  }, [currentTrack, isPlaying, playlist, repeatMode, isShuffle]);

  // Update Media Session Position State
  useEffect(() => {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0, duration),
          playbackRate: playbackRate,
          position: Math.min(Math.max(0, currentTime), duration)
        });
      } catch {
        // Can throw if duration is 0 or position > duration
      }
    }
  }, [currentTime, duration, playbackRate]);

  // Handle visibility change (ensure background playback is uninterrupted)
  useEffect(() => {
    const handleVisibilityChange = () => {
      // If user minimized or locked the screen, ensure playback does not pause
      if (document.hidden && isPlaying && videoRef.current) {
        // Many browsers allow playsInline audio to keep running
        videoRef.current.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying]);

  return (
    <PlayerContext.Provider
      value={{
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
        isPiPActive,
        blobUrl,
        videoRef,
        analyserRef,
        audioContextRef,
        // Methods
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
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
