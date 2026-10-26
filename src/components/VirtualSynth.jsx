import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Sliders, Music, Sparkles } from 'lucide-react';

// Note frequencies for Octave 4
const BASE_NOTES = [
  { note: 'C', key: 'A', freq: 261.63, isBlack: false },
  { note: 'C#', key: 'W', freq: 277.18, isBlack: true },
  { note: 'D', key: 'S', freq: 293.66, isBlack: false },
  { note: 'D#', key: 'E', freq: 311.13, isBlack: true },
  { note: 'E', key: 'D', freq: 329.63, isBlack: false },
  { note: 'F', key: 'F', freq: 349.23, isBlack: false },
  { note: 'F#', key: 'T', freq: 369.99, isBlack: true },
  { note: 'G', key: 'G', freq: 392.00, isBlack: false },
  { note: 'G#', key: 'Y', freq: 415.30, isBlack: true },
  { note: 'A', key: 'H', freq: 440.00, isBlack: false },
  { note: 'A#', key: 'U', freq: 466.16, isBlack: true },
  { note: 'B', key: 'J', freq: 493.88, isBlack: false },
  { note: 'C5', key: 'K', freq: 523.25, isBlack: false }
];

export default function VirtualSynth({ onInsertNotes }) {
  const [octaveOffset, setOctaveOffset] = useState(0);
  const [instrument, setInstrument] = useState('piano'); // 'piano' | 'synth' | 'organ' | 'pad'
  const [activeNotes, setActiveNotes] = useState(new Set());
  const audioCtxRef = useRef(null);
  const activeOscillatorsRef = useRef({});

  // Ensure AudioContext
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
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
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc1.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 1.25);

      activeOscillatorsRef.current[noteId] = { oscs: [osc1], gain: gainNode };
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
      gainNode.connect(ctx.destination);
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
      gainNode.connect(ctx.destination);

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
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);

      activeOscillatorsRef.current[noteId] = { oscs: [osc1, osc2], gain: gainNode };
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
          try { o.stop(); o.disconnect(); } catch (e) {}
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
    chordNotes.forEach(noteName => {
      const found = BASE_NOTES.find(n => n.note === noteName);
      if (found) {
        playFreq(found.freq, found.note);
        setTimeout(() => stopFreq(found.note), 800);
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
      const noteItem = BASE_NOTES.find(n => n.key === key);
      if (noteItem && !activeNotes.has(noteItem.note)) {
        playFreq(noteItem.freq, noteItem.note);
      }
    };

    const handleKeyUp = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toUpperCase();
      const noteItem = BASE_NOTES.find(n => n.key === key);
      if (noteItem) {
        stopFreq(noteItem.note);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [octaveOffset, instrument, activeNotes]);

  return (
    <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl">
      {/* Synth Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-zinc-100">Virtual Idea Synth</h3>
          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
            Keys A-K / W-U
          </span>
        </div>

        {/* Instrument selector */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
          {[
            { id: 'piano', label: 'Piano' },
            { id: 'synth', label: 'Synth' },
            { id: 'organ', label: 'Organ' },
            { id: 'pad', label: 'Pad' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setInstrument(id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                instrument === id ? 'bg-indigo-600 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
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

      {/* Interactive Piano Keys */}
      <div className="relative w-full h-36 max-w-xl mx-auto flex select-none touch-none bg-zinc-950 p-2 rounded-xl border border-zinc-800 shadow-inner">
        {/* White keys */}
        {BASE_NOTES.filter(n => !n.isBlack).map((whiteKey) => {
          const isPressed = activeNotes.has(whiteKey.note);
          return (
            <button
              key={whiteKey.note}
              onMouseDown={() => playFreq(whiteKey.freq, whiteKey.note)}
              onMouseUp={() => stopFreq(whiteKey.note)}
              onMouseLeave={() => stopFreq(whiteKey.note)}
              onTouchStart={(e) => { e.preventDefault(); playFreq(whiteKey.freq, whiteKey.note); }}
              onTouchEnd={(e) => { e.preventDefault(); stopFreq(whiteKey.note); }}
              className={`relative flex-1 h-full rounded-b-lg border-x border-b border-zinc-300/40 flex flex-col justify-end items-center pb-2 transition-all ${
                isPressed
                  ? 'bg-indigo-200 translate-y-1 shadow-inner'
                  : 'bg-white hover:bg-zinc-100 shadow'
              }`}
            >
              <span className="text-[11px] font-bold text-zinc-800">{whiteKey.note}</span>
              <span className="text-[9px] font-mono text-zinc-500 font-semibold">{whiteKey.key}</span>
            </button>
          );
        })}

        {/* Black keys overlaid on top */}
        <div className="absolute top-2 left-2 right-2 h-20 pointer-events-none flex">
          {BASE_NOTES.map((noteItem, idx) => {
            if (!noteItem.isBlack) return null;
            const isPressed = activeNotes.has(noteItem.note);

            // Calculate precise horizontal positioning for sharps
            // White keys: C(0), D(1), E(2), F(3), G(4), A(5), B(6), C5(7) -> 8 white keys
            const keyPositions = {
              'C#': '9%',
              'D#': '22%',
              'F#': '47%',
              'G#': '59.5%',
              'A#': '72%'
            };

            const leftPos = keyPositions[noteItem.note] || '0%';

            return (
              <button
                key={noteItem.note}
                style={{ left: leftPos }}
                onMouseDown={() => playFreq(noteItem.freq, noteItem.note)}
                onMouseUp={() => stopFreq(noteItem.note)}
                onMouseLeave={() => stopFreq(noteItem.note)}
                onTouchStart={(e) => { e.preventDefault(); playFreq(noteItem.freq, noteItem.note); }}
                onTouchEnd={(e) => { e.preventDefault(); stopFreq(noteItem.note); }}
                className={`absolute w-7 md:w-8 h-20 rounded-b-md z-10 pointer-events-auto border border-zinc-900 flex flex-col justify-end items-center pb-1.5 transition-all ${
                  isPressed
                    ? 'bg-indigo-600 translate-y-0.5 shadow-lg'
                    : 'bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-md'
                }`}
              >
                <span className="text-[9px] font-bold text-white">{noteItem.note}</span>
                <span className="text-[8px] font-mono text-indigo-300">{noteItem.key}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Chord Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 pt-3 border-t border-zinc-800/80">
        <span className="text-[11px] text-zinc-500 font-medium mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          Test Chords:
        </span>
        {[
          { name: 'C maj', notes: ['C', 'E', 'G'] },
          { name: 'Am', notes: ['A', 'C', 'E'] },
          { name: 'F maj', notes: ['F', 'A', 'C5'] },
          { name: 'G maj', notes: ['G', 'B', 'D'] },
          { name: 'Em', notes: ['E', 'G', 'B'] },
          { name: 'Dm', notes: ['D', 'F', 'A'] }
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
