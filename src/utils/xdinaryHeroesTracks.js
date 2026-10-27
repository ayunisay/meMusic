import { audioBufferToMp3 } from './mediaOptimizer';
import { addMediaItem } from '../db/db';

/**
 * Procedurally synthesize high-energy rock audio tracks for Xdinary Heroes
 * with kick, snare, hi-hats, bassline, power-chords, and lead riffs using Web Audio API!
 */
export async function synthesizeRockTrack({ title, bpm = 145, key = 'Em', style = 'punk', durationSeconds = 24 }) {
  const sampleRate = 44100;
  const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
    2,
    sampleRate * durationSeconds,
    sampleRate
  );

  // Master bus with gentle distortion / saturation and limiter
  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(0.4, 0);

  // Simple waveshaper curve for warm analog rock drive
  const waveShaper = offlineCtx.createWaveShaper();
  const curve = new Float32Array(sampleRate);
  for (let i = 0; i < sampleRate; i++) {
    const x = (i * 2) / sampleRate - 1;
    curve[i] = (Math.PI + 3) * x / (Math.PI + 3 * Math.abs(x));
  }
  waveShaper.curve = curve;
  waveShaper.oversample = '2x';

  masterGain.connect(waveShaper);
  waveShaper.connect(offlineCtx.destination);

  // Noise buffer for Snare and Hi-Hats
  const noiseBuffer = offlineCtx.createBuffer(1, sampleRate, sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < sampleRate; i++) {
    noiseData[i] = Math.random() * 2 - 1;
  }

  const beatSec = 60 / bpm;
  const totalBeats = Math.floor(durationSeconds / beatSec);

  // 1. DRUMS (Kick, Snare, Hi-hats)
  for (let b = 0; b < totalBeats; b++) {
    const time = b * beatSec;

    // Hi-hats on every 8th note
    for (let sub = 0; sub < 2; sub++) {
      const hatTime = time + sub * (beatSec / 2);
      if (hatTime >= durationSeconds) break;

      const hatNoise = offlineCtx.createBufferSource();
      hatNoise.buffer = noiseBuffer;
      const hatFilter = offlineCtx.createBiquadFilter();
      hatFilter.type = 'highpass';
      hatFilter.frequency.setValueAtTime(7000, hatTime);

      const hatGain = offlineCtx.createGain();
      hatGain.gain.setValueAtTime(sub === 0 ? 0.08 : 0.05, hatTime);
      hatGain.gain.exponentialRampToValueAtTime(0.0001, hatTime + 0.05);

      hatNoise.connect(hatFilter);
      hatFilter.connect(hatGain);
      hatGain.connect(masterGain);
      hatNoise.start(hatTime);
      hatNoise.stop(hatTime + 0.06);
    }

    // Kick on beat 0 and 2 (or 0 and 2.5 for syncopation)
    if (b % 4 === 0 || b % 4 === 2) {
      const kickOsc = offlineCtx.createOscillator();
      const kickGain = offlineCtx.createGain();
      kickOsc.frequency.setValueAtTime(140, time);
      kickOsc.frequency.exponentialRampToValueAtTime(38, time + 0.12);

      kickGain.gain.setValueAtTime(0.65, time);
      kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

      kickOsc.connect(kickGain);
      kickGain.connect(masterGain);
      kickOsc.start(time);
      kickOsc.stop(time + 0.3);
    }

    // Snare on beat 1 and 3 (classic rock backbeat)
    if (b % 4 === 1 || b % 4 === 3) {
      // Noise component
      const snareNoise = offlineCtx.createBufferSource();
      snareNoise.buffer = noiseBuffer;
      const snareFilter = offlineCtx.createBiquadFilter();
      snareFilter.type = 'bandpass';
      snareFilter.frequency.setValueAtTime(2200, time);
      snareFilter.Q.setValueAtTime(1.2, time);

      const snareGain = offlineCtx.createGain();
      snareGain.gain.setValueAtTime(0.3, time);
      snareGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

      snareNoise.connect(snareFilter);
      snareFilter.connect(snareGain);
      snareGain.connect(masterGain);
      snareNoise.start(time);
      snareNoise.stop(time + 0.25);

      // Body punch component
      const snarePunch = offlineCtx.createOscillator();
      const punchGain = offlineCtx.createGain();
      snarePunch.type = 'triangle';
      snarePunch.frequency.setValueAtTime(210, time);
      snarePunch.frequency.exponentialRampToValueAtTime(80, time + 0.1);
      punchGain.gain.setValueAtTime(0.25, time);
      punchGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      snarePunch.connect(punchGain);
      punchGain.connect(masterGain);
      snarePunch.start(time);
      snarePunch.stop(time + 0.15);
    }
  }

  // 2. CHORD PROGRESSIONS & RIFFS
  // Define progression per song style
  let progression = [];
  if (style === 'test-me') {
    // High-octane cyberpunk punk-rock: F#m - D - A - E
    progression = [
      { root: 185.00, chord: [185.00, 220.00, 277.18] }, // F#3
      { root: 146.83, chord: [146.83, 185.00, 220.00] }, // D3
      { root: 220.00, chord: [220.00, 277.18, 329.63] }, // A3
      { root: 164.81, chord: [164.81, 207.65, 246.94] }  // E3
    ];
  } else if (style === 'youth') {
    // Obsessed with Youth: Inspiring, anthemic pop-rock: Dm - Bb - F - C
    progression = [
      { root: 146.83, chord: [146.83, 174.61, 220.00] }, // Dm
      { root: 116.54, chord: [116.54, 146.83, 174.61] }, // Bb
      { root: 174.61, chord: [174.61, 220.00, 261.63] }, // F
      { root: 130.81, chord: [130.81, 164.81, 196.00] }  // C
    ];
  } else {
    // u and me in arguments: Grungy toxic dynamic rock: Em - C - G - D
    progression = [
      { root: 164.81, chord: [164.81, 196.00, 246.94] }, // Em
      { root: 130.81, chord: [130.81, 164.81, 196.00] }, // C
      { root: 196.00, chord: [196.00, 246.94, 293.66] }, // G
      { root: 146.83, chord: [146.83, 185.00, 220.00] }  // D
    ];
  }

  const bars = Math.floor(totalBeats / 4);
  for (let bar = 0; bar < bars; bar++) {
    const chordInfo = progression[bar % progression.length];
    const barTime = bar * 4 * beatSec;

    // Driving Rock Bass (8th notes driving line)
    for (let eight = 0; eight < 8; eight++) {
      const noteTime = barTime + eight * (beatSec / 2);
      if (noteTime >= durationSeconds) break;

      const bassOsc = offlineCtx.createOscillator();
      const bassGain = offlineCtx.createGain();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(chordInfo.root / 2, noteTime);

      const bassFilter = offlineCtx.createBiquadFilter();
      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(320, noteTime);

      bassGain.gain.setValueAtTime(0.25, noteTime);
      bassGain.gain.exponentialRampToValueAtTime(0.001, noteTime + (beatSec / 2) * 0.9);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(masterGain);
      bassOsc.start(noteTime);
      bassOsc.stop(noteTime + (beatSec / 2));
    }

    // Distorted Rhythm Guitar / Synth Power Stabs (16th rhythm)
    for (let beat = 0; beat < 4; beat++) {
      const stabTime = barTime + beat * beatSec;
      chordInfo.chord.forEach((freq, idx) => {
        const gtrOsc = offlineCtx.createOscillator();
        const gtrGain = offlineCtx.createGain();
        gtrOsc.type = 'sawtooth';
        gtrOsc.frequency.setValueAtTime(freq, stabTime);
        gtrOsc.detune.setValueAtTime(idx * 7 - 6, stabTime);

        const gtrFilter = offlineCtx.createBiquadFilter();
        gtrFilter.type = 'lowpass';
        gtrFilter.frequency.setValueAtTime(1800, stabTime);

        gtrGain.gain.setValueAtTime(0.12, stabTime);
        gtrGain.gain.exponentialRampToValueAtTime(0.001, stabTime + beatSec * 0.7);

        gtrOsc.connect(gtrFilter);
        gtrFilter.connect(gtrGain);
        gtrGain.connect(masterGain);
        gtrOsc.start(stabTime);
        gtrOsc.stop(stabTime + beatSec * 0.75);
      });
    }

    // Lead Arpeggio Melody (Synths / Lead Guitar)
    for (let step = 0; step < 8; step++) {
      const leadTime = barTime + step * (beatSec / 2);
      if (leadTime >= durationSeconds) break;

      const noteFreq = chordInfo.chord[step % chordInfo.chord.length] * 2;
      const leadOsc = offlineCtx.createOscillator();
      const leadGain = offlineCtx.createGain();
      leadOsc.type = 'square';
      leadOsc.frequency.setValueAtTime(noteFreq, leadTime);

      const leadFilter = offlineCtx.createBiquadFilter();
      leadFilter.type = 'lowpass';
      leadFilter.frequency.setValueAtTime(3200, leadTime);

      leadGain.gain.setValueAtTime(0.08, leadTime);
      leadGain.gain.exponentialRampToValueAtTime(0.001, leadTime + (beatSec / 2) * 0.85);

      leadOsc.connect(leadFilter);
      leadFilter.connect(leadGain);
      leadGain.connect(masterGain);
      leadOsc.start(leadTime);
      leadOsc.stop(leadTime + (beatSec / 2));
    }
  }

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToMp3(renderedBuffer, 128);
}

/**
 * Seed the 3 requested Xdinary Heroes tracks directly into IndexedDB
 */
export async function seedXdinaryHeroesCollection() {
  const tracks = [
    {
      title: 'Test Me',
      artist: 'Xdinary Heroes',
      bpm: 152,
      key: 'F#m',
      style: 'test-me',
      durationSeconds: 24,
      desc: 'Title track from mini album "Hello, world!" (2022)'
    },
    {
      title: 'Obsessed with Youth',
      artist: 'Xdinary Heroes',
      bpm: 138,
      key: 'Dm',
      style: 'youth',
      durationSeconds: 25,
      desc: 'Title track from mini album "IMPULSE" (2026)'
    },
    {
      title: 'u and me in arguments',
      artist: 'Xdinary Heroes',
      bpm: 126,
      key: 'Em',
      style: 'arguments',
      durationSeconds: 26,
      desc: 'Featured track from mini album "IMPULSE" (2026)'
    }
  ];

  const addedTracks = [];
  for (const track of tracks) {
    const mp3Blob = await synthesizeRockTrack({
      title: track.title,
      bpm: track.bpm,
      key: track.key,
      style: track.style,
      durationSeconds: track.durationSeconds
    });

    const item = await addMediaItem({
      title: track.title,
      artist: track.artist,
      mediaType: 'audio',
      fileBlob: mp3Blob,
      duration: track.durationSeconds,
      originalSize: mp3Blob.size,
      fileSize: mp3Blob.size,
      isOptimized: true,
      savingsPercent: 0,
      convertedFromVideo: false
    });
    addedTracks.push(item);
  }

  return addedTracks;
}
