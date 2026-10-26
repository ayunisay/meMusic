import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  // Current media state
  const [currentTrack, setCurrentTrack] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
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
  const sourceNodeRef = useRef(null);

  // Manage Blob URL creation and cleanup when track changes
  useEffect(() => {
    if (!currentTrack || !currentTrack.fileBlob) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      return;
    }

    const url = URL.createObjectURL(currentTrack.fileBlob);
    setBlobUrl(url);

    // Auto default: If it's pure audio, default to Audio Saja mode.
    // If it's video, default to Video mode unless user specifically toggled.
    if (currentTrack.mediaType === 'audio') {
      setIsAudioOnly(true);
    } else {
      setIsAudioOnly(false);
    }

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [currentTrack]);

  // Connect Web Audio API to the video element safely
  const ensureAudioContext = () => {
    if (!audioContextRef.current && videoRef.current) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;

        // Source node can only be created once per element
        if (!sourceNodeRef.current) {
          const source = ctx.createMediaElementSource(videoRef.current);
          source.connect(analyser);
          analyser.connect(ctx.destination);
          sourceNodeRef.current = source;
        }

        audioContextRef.current = ctx;
        analyserRef.current = analyser;
      } catch (err) {
        console.warn('Web Audio API context init:', err);
      }
    }

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  // Play a specific track
  const playTrack = (track, newPlaylist = null) => {
    if (newPlaylist) {
      setPlaylist(newPlaylist);
    }
    setCurrentTrack(track);
    setIsPlaying(true);

    ensureAudioContext();

    // Small delay for DOM to load source if needed
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch(err => {
          console.warn('Playback play request interrupted:', err);
        });
      }
    }, 50);
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
  const nextTrack = () => {
    if (playlist.length === 0) return;
    const currentIndex = playlist.findIndex(t => t.id === currentTrack?.id);

    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * playlist.length);
      playTrack(playlist[randomIndex]);
      return;
    }

    if (currentIndex < playlist.length - 1) {
      playTrack(playlist[currentIndex + 1]);
    } else if (repeatMode === 'all') {
      playTrack(playlist[0]);
    }
  };

  // Skip Previous
  const previousTrack = () => {
    if (!videoRef.current) return;
    // If more than 3 seconds in, restart track
    if (videoRef.current.currentTime > 3) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (playlist.length === 0) return;
    const currentIndex = playlist.findIndex(t => t.id === currentTrack?.id);

    if (currentIndex > 0) {
      playTrack(playlist[currentIndex - 1]);
    } else if (repeatMode === 'all') {
      playTrack(playlist[playlist.length - 1]);
    } else {
      videoRef.current.currentTime = 0;
    }
  };

  // Seek to specific second
  const seekTo = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  // Step backward / forward by 10s
  const seekRelative = (offsetSeconds) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + offsetSeconds));
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Toggle Volume & Mute
  const handleVolumeChange = (newVol) => {
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      if (newVol > 0 && isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const targetMuted = !isMuted;
      setIsMuted(targetMuted);
      videoRef.current.muted = targetMuted;
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
      } catch (err) {
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
        ensureAudioContext
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
