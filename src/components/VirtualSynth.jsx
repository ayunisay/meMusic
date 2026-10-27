import React, { useState, useEffect, useRef } from 'react';
import { Music, Sparkles } from 'lucide-react';

// 1-Octave Notes (13 keys: C4 to C5)
const NOTES_1_OCTAVE = [
  { id: 'C4', note: 'C', key: 'A', freq: 261.63, isBlack: false },
  { id: 'C#4', note: 'C#', key: 'W', freq: 277.18, isBlack: true, afterWhiteId: 'C4' },
  { id: 'D4', note: 'D', key: 'S', freq: 293.66, isBlack: false },
  { id: 'D#4', note: 'D#', key: 'E', freq: 311.13, isBlack: true, afterWhiteId: 'D4' },
  { id: 'E4', note: 'E', key: 'D', freq: 329.63, isBlack: false },
  { id: 'F4', note: 'F', key: 'F', freq: 349.23, isBlack: false },
  { id: 'F#4', note: 'F#', key: 'T', freq: 369.99, isBlack: true, afterWhiteId: 'F4' },
  { id: 'G4', note: 'G', key: 'G', freq: 392.00, isBlack: false },
  { id: 'G#4', note: 'G#', key: 'Y', freq: 415.30, isBlack: true, afterWhiteId: 'G4' },
  { id: 'A4', note: 'A', key: 'H', freq: 440.00, isBlack: false },
  { id: 'A#4', note: 'A#', key: 'U', freq: 466.16, isBlack: true, afterWhiteId: 'A4' },
  { id: 'B4', note: 'B', key: 'J', freq: 493.88, isBlack: false },
  { id: 'C5', note: 'C5', key: 'K', freq: 523.25, isBlack: false }
];

// 2-Octaves Notes (25 keys: C4 to C6 - Full Range)
const NOTES_2_OCTAVES = [
  // Lower Octave (C4 - B4)
  { id: 'C4', note: 'C4', key: 'A', freq: 261.63, isBlack: false },
  { id: 'C#4', note: 'C#', key: 'W', freq: 277.18, isBlack: true, afterWhiteId: 'C4' },
  { id: 'D4', note: 'D4', key: 'S', freq: 293.66, isBlack: false },
  { id: 'D#4', note: 'D#', key: 'E', freq: 311.13, isBlack: true, afterWhiteId: 'D4' },
  { id: 'E4', note: 'E4', key: 'D', freq: 329.63, isBlack: false },
  { id: 'F4', note: 'F4', key: 'F', freq: 349.23, isBlack: false },
  { id: 'F#4', note: 'F#', key: 'T', freq: 369.99, isBlack: true, afterWhiteId: 'F4' },
  { id: 'G4', note: 'G4', key: 'G', freq: 392.00, isBlack: false },
  { id: 'G#4', note: 'G#', key: 'Y', freq: 415.30, isBlack: true, afterWhiteId: 'G4' },
  { id: 'A4', note: 'A4', key: 'H', freq: 440.00, isBlack: false },
  { id: 'A#4', note: 'A#', key: 'U', freq: 466.16, isBlack: true, afterWhiteId: 'A4' },
  { id: 'B4', note: 'B4', key: 'J', freq: 493.88, isBlack: false },

  // Upper Octave (C5 - B5)
  { id: 'C5', note: 'C5', key: 'K', freq: 523.25, isBlack: false },
  { id: 'C#5', note: 'C#', key: 'O', freq: 554.37, isBlack: true, afterWhiteId: 'C5' },
  { id: 'D5', note: 'D5', key: 'L', freq: 587.33, isBlack: false },
  { id: 'D#5', note: 'D#', key: 'P', freq: 622.25, isBlack: true, afterWhiteId: 'D5' },
  { id: 'E5', note: 'E5', key: ';', freq: 659.25, isBlack: false },
  { id: 'F5', note: 'F5', key: "'", freq: 698.46, isBlack: false },
  { id: 'F#5', note: 'F#', key: ']', freq: 739.99, isBlack: true, afterWhiteId: 'F5' },
  { id: 'G5', note: 'G5', key: 'Z', freq: 783.99, isBlack: false },
  { id: 'G#5', note: 'G#', key: 'S', freq: 830.61, isBlack: true, afterWhiteId: 'G5' },
  { id: 'A5', note: 'A5', key: 'X', freq: 880.00, isBlack: false },
  { id: 'A#5', note: 'A#', key: 'D', freq: 932.33, isBlack: true, afterWhiteId: 'A5' },
  { id: 'B5', note: 'B5', key: 'C', freq: 987.77, isBlack: false },

  // Top C (C6)
  { id: 'C6', note: 'C6', key: 'V', freq: 1046.50, isBlack: false }
];

export default function VirtualSynth({ onInsertNotes, onStreamReady }) {
  const [octaveOffset, setOctaveOffset] = useState(0);
  const [instrument, setInstrument] = useState('piano'); // 'piano' | 'epiano' | 'synth' | 'organ' | 'pad' | 'guitar' | 'strings' | 'bass'
  const [keyboardRange, setKeyboardRange] = useState('2-octaves'); // '2-octaves' (25 keys) | '1-octave' (13 keys)
  const [activeNotes, setActiveNotes] = useState(new Set());
  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const synthDestRef = useRef(null);
  const activeOscillatorsRef = useRef({});

  const currentNotes = keyboardRange === '2-octaves' ? NOTES_2_OCTAVES : NOTES_1_OCTAVE;
  const whiteKeys = currentNotes.filter(n => !n.isBlack);
  const blackKeys = currentNotes.filter(n => n.isBlack);

  // Ensure AudioContext and MediaStreamDestination for digital recording
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.85, ctx.currentTime);
      masterGain.connect(ctx.destination);

      const streamDest = ctx.createMediaStreamDestination();
      masterGain.connect(streamDest);

      masterGainRef.current = masterGain;
      synthDestRef.current = streamDest;

      if (onStreamReady) {
        onStreamReady(streamDest.stream, ctx);
      }
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  useEffect(() => {
    if (onStreamReady && !synthDestRef.current) {
      try {
        const ctx = getAudioContext();
        if (synthDestRef.current) {
          onStreamReady(synthDestRef.current.stream, ctx);
        }
      } catch {
        // user gesture required
      }
    }
  }, [onStreamReady]);

  // Connect helper to route to master gain (feeds both speakers and recording stream)
  const connectOut = (node) => {
    if (masterGainRef.current) {
      node.connect(masterGainRef.current);
    } else if (audioCtxRef.current) {
      node.connect(audioCtxRef.current.destination);
    }
  };

  // Play a single note frequency
  const playFreq = (freq, noteId) => {
    const ctx = getAudioContext();
    if (activeOscillatorsRef.current[noteId]) {
      stopFreq(noteId);
    }

    const adjustedFreq = freq * Math.pow(2, octaveOffset);

    const osc1 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const now = ctx.currentTime;

    if (instrument === 'piano') {
      // Warm acoustic-like piano envelope
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(adjustedFreq, now);

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.32, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc1.connect(gainNode);
      connectOut(gainNode);
      osc1.start(now);
      osc1.stop(now + 1.25);

      activeOscillatorsRef.current[noteId] = { oscs: [osc1], gain: gainNode };
    } else if (instrument === 'epiano') {
      // Vintage Electric Piano / Rhodes (chime tine + warm sine)
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(adjustedFreq, now);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(adjustedFreq * 4, now); // Bell tine harmonic

      const tineGain = ctx.createGain();
      tineGain.gain.setValueAtTime(0.18, now);
      tineGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

      osc1.connect(gainNode);
      osc2.connect(tineGain);
      tineGain.connect(gainNode);
      connectOut(gainNode);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.45);
      osc2.stop(now + 0.2);

      activeOscillatorsRef.current[noteId] = { oscs: [osc1, osc2], gain: gainNode };
    } else if (instrument === 'synth') {
      // Sawtooth lead with punchy decay
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(adjustedFreq, now);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(300, now + 0.8);

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      osc1.connect(filter);
      filter.connect(gainNode);
      connectOut(gainNode);
      osc1.start(now);
      osc1.stop(now + 1.0);

      activeOscillatorsRef.current[noteId] = { oscs: [osc1], gain: gainNode };
    } else if (instrument === 'organ') {
      // Drawbar organ tone
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(adjustedFreq, now);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(adjustedFreq * 2, now);

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.25, now + 0.05);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      connectOut(gainNode);

      osc1.start(now);
      osc2.start(now);

      activeOscillatorsRef.current[noteId] = { oscs: [osc1, osc2], gain: gainNode };
    } else if (instrument === 'pad') {
      // Lush ambient pad
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(adjustedFreq, now);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(adjustedFreq, now);
      osc2.detune.setValueAtTime(8, now); // slight chorus detune

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.2);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      connectOut(gainNode);

      osc1.start(now);
      osc2.start(now);

      activeOscillatorsRef.current[noteId] = { oscs: [osc1, osc2], gain: gainNode };
    } else if (instrument === 'guitar') {
      // Acoustic Pluck Guitar
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(adjustedFreq, now);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(adjustedFreq * 6, 8000), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(adjustedFreq * 1.5, 400), now + 0.18);

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.35, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

      osc1.connect(filter);
      filter.connect(gainNode);
      connectOut(gainNode);

      osc1.start(now);
      osc1.stop(now + 0.9);

      activeOscillatorsRef.current[noteId] = { oscs: [osc1], gain: gainNode };
    } else if (instrument === 'strings') {
      // Lush String Ensemble
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(adjustedFreq, now);
      osc1.detune.setValueAtTime(-6, now);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(adjustedFreq, now);
      osc2.detune.setValueAtTime(6, now);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now);

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.22, now + 0.12);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);
      connectOut(gainNode);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.4);
      osc2.stop(now + 1.4);

      activeOscillatorsRef.current[noteId] = { oscs: [osc1, osc2], gain: gainNode };
    } else if (instrument === 'bass') {
      // 808 Sub Bass (one octave lower)
      osc1.type = 'sine';
      const baseFreq = adjustedFreq * 0.5;
      osc1.frequency.setValueAtTime(baseFreq * 1.6, now);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.06);

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.4, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

      osc1.connect(gainNode);
      connectOut(gainNode);

      osc1.start(now);
      osc1.stop(now + 1.15);

      activeOscillatorsRef.current[noteId] = { oscs: [osc1], gain: gainNode };
    }

    setActiveNotes(prev => new Set(prev).add(noteId));
  };

  // Stop note
  const stopFreq = (noteId) => {
    const active = activeOscillatorsRef.current[noteId];
    if (active && audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      active.gain.gain.cancelScheduledValues(now);
      active.gain.gain.linearRampToValueAtTime(0.0001, now + 0.15);
      setTimeout(() => {
        active.oscs.forEach(o => {
          try { o.stop(); o.disconnect(); } catch {}
        });
        delete activeOscillatorsRef.current[noteId];
      }, 160);
    }
    setActiveNotes(prev => {
      const updated = new Set(prev);
      updated.delete(noteId);
      return updated;
    });
  };

  // Play chord progression helper
  const playChord = (chordNotes, chordName) => {
    chordNotes.forEach(noteId => {
      const found = currentNotes.find(n => n.id === noteId || n.note === noteId) ||
                    NOTES_2_OCTAVES.find(n => n.id === noteId);
      if (found) {
        playFreq(found.freq, found.id);
        setTimeout(() => stopFreq(found.id), 850);
      }
    });
    if (onInsertNotes && chordName) {
      onInsertNotes(chordName);
    }
  };

  // Physical Keyboard listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toUpperCase();
      const noteItem = currentNotes.find(n => n.key && n.key.toUpperCase() === key);
      if (noteItem && !activeNotes.has(noteItem.id)) {
        playFreq(noteItem.freq, noteItem.id);
      }
    };

    const handleKeyUp = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toUpperCase();
      const noteItem = currentNotes.find(n => n.key && n.key.toUpperCase() === key);
      if (noteItem) {
        stopFreq(noteItem.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [octaveOffset, instrument, activeNotes, currentNotes]);

  return (
    <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl">
      {/* Synth Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-zinc-100">Virtual Idea Synth</h3>
          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
            {keyboardRange === '2-octaves' ? '25 Keys Range' : '13 Keys Range'}
          </span>
        </div>

        {/* Keyboard Range Switcher (25 tuts vs 13 tuts) */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
          <button
            onClick={() => setKeyboardRange('2-octaves')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              keyboardRange === '2-octaves'
                ? 'bg-indigo-600 text-white font-semibold shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            25 Tuts (2 Octaves)
          </button>
          <button
            onClick={() => setKeyboardRange('1-octave')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              keyboardRange === '1-octave'
                ? 'bg-indigo-600 text-white font-semibold shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            13 Tuts (1 Octave)
          </button>
        </div>

        {/* Instrument selector */}
        <div className="flex flex-wrap items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
          {[
            { id: 'piano', label: 'Piano' },
            { id: 'epiano', label: 'E-Piano' },
            { id: 'synth', label: 'Synth' },
            { id: 'organ', label: 'Organ' },
            { id: 'pad', label: 'Pad' },
            { id: 'guitar', label: 'Pluck' },
            { id: 'strings', label: 'Strings' },
            { id: 'bass', label: '808 Bass' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => {
                getAudioContext();
                setInstrument(id);
              }}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition ${
                instrument === id ? 'bg-indigo-600 text-white font-semibold shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Octave Shift */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-zinc-500">Octave:</span>
          <button
            onClick={() => setOctaveOffset(Math.max(-2, octaveOffset - 1))}
            className="w-6 h-6 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 flex items-center justify-center font-bold"
          >
            -
          </button>
          <span className="font-mono text-indigo-400 w-4 text-center">{octaveOffset >= 0 ? `+${octaveOffset}` : octaveOffset}</span>
          <button
            onClick={() => setOctaveOffset(Math.min(2, octaveOffset + 1))}
            className="w-6 h-6 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 flex items-center justify-center font-bold"
          >
            +
          </button>
        </div>
      </div>

      {/* Interactive Piano Keys (Horizontal scroll on mobile, full width on desktop) */}
      <div className="w-full overflow-x-auto pb-1 scrollbar-thin">
        <div
          className={`relative h-44 md:h-52 w-full flex select-none touch-none bg-zinc-950 p-2 rounded-2xl border border-zinc-800 shadow-inner ${
            keyboardRange === '2-octaves' ? 'min-w-[620px]' : 'min-w-[340px]'
          }`}
        >
          {/* White keys */}
          {whiteKeys.map((whiteKey) => {
            const isPressed = activeNotes.has(whiteKey.id);
            return (
              <button
                key={whiteKey.id}
                style={{ width: `${100 / whiteKeys.length}%` }}
                onMouseDown={() => playFreq(whiteKey.freq, whiteKey.id)}
                onMouseUp={() => stopFreq(whiteKey.id)}
                onMouseLeave={() => stopFreq(whiteKey.id)}
                onTouchStart={(e) => { e.preventDefault(); playFreq(whiteKey.freq, whiteKey.id); }}
                onTouchEnd={(e) => { e.preventDefault(); stopFreq(whiteKey.id); }}
                className={`relative h-full rounded-b-lg border-x border-b border-zinc-300/40 flex flex-col justify-end items-center pb-2.5 transition-all ${
                  isPressed
                    ? 'bg-indigo-300 translate-y-1 shadow-inner'
                    : 'bg-white hover:bg-zinc-100 shadow'
                }`}
              >
                <span className="text-[10px] md:text-xs font-bold text-zinc-800">{whiteKey.note}</span>
                <span className="text-[9px] font-mono text-zinc-500 font-semibold">{whiteKey.key}</span>
              </button>
            );
          })}

          {/* Black keys overlaid on top */}
          <div className="absolute top-2 left-2 right-2 h-28 md:h-32 pointer-events-none">
            {blackKeys.map((noteItem) => {
              const isPressed = activeNotes.has(noteItem.id);
              const whiteIdx = whiteKeys.findIndex(w => w.id === noteItem.afterWhiteId);
              if (whiteIdx === -1) return null;
              const leftPercent = ((whiteIdx + 1) / whiteKeys.length) * 100;

              return (
                <button
                  key={noteItem.id}
                  style={{
                    left: `${leftPercent}%`,
                    width: `calc(${100 / whiteKeys.length}% * 0.72)`,
                    maxWidth: keyboardRange === '2-octaves' ? '34px' : '42px',
                    minWidth: '15px',
                    transform: 'translateX(-50%)'
                  }}
                  onMouseDown={() => playFreq(noteItem.freq, noteItem.id)}
                  onMouseUp={() => stopFreq(noteItem.id)}
                  onMouseLeave={() => stopFreq(noteItem.id)}
                  onTouchStart={(e) => { e.preventDefault(); playFreq(noteItem.freq, noteItem.id); }}
                  onTouchEnd={(e) => { e.preventDefault(); stopFreq(noteItem.id); }}
                  className={`absolute top-0 h-28 md:h-32 rounded-b-md z-10 pointer-events-auto border border-zinc-950 flex flex-col justify-end items-center pb-2 transition-all ${
                    isPressed
                      ? 'bg-indigo-600 translate-y-0.5 shadow-lg shadow-indigo-600/40 text-white'
                      : 'bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 text-zinc-400 shadow-md hover:from-zinc-700'
                  }`}
                >
                  <span className="text-[9px] font-bold">{noteItem.note}</span>
                  <span className="text-[8px] font-mono text-indigo-300">{noteItem.key}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Chord Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 pt-3 border-t border-zinc-800/80">
        <span className="text-[11px] text-zinc-500 font-medium mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          Test Chords:
        </span>
        {[
          { name: 'C maj', notes: ['C4', 'E4', 'G4'] },
          { name: 'Am', notes: ['A4', 'C5', 'E5'] },
          { name: 'F maj', notes: ['F4', 'A4', 'C5'] },
          { name: 'G maj', notes: ['G4', 'B4', 'D5'] },
          { name: 'Em', notes: ['E4', 'G4', 'B4'] },
          { name: 'Dm', notes: ['D4', 'F4', 'A4'] },
          { name: 'E maj', notes: ['E4', 'G#4', 'B4'] },
          { name: 'Fm', notes: ['F4', 'G#4', 'C5'] },
          { name: 'C7', notes: ['C4', 'E4', 'G4', 'A#4'] },
          { name: 'G7', notes: ['G4', 'B4', 'D5', 'F5'] }
        ].map((chord) => (
          <button
            key={chord.name}
            onClick={() => playChord(chord.notes, chord.name)}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-zinc-700/60 text-xs font-semibold text-zinc-300 hover:text-white transition active:scale-95"
          >
            {chord.name}
          </button>
        ))}
      </div>
    </div>
  );
}
