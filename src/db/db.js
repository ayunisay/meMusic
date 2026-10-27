import Dexie from 'dexie';

export const db = new Dexie('TuneVaultDB');

// Define database schema
db.version(1).stores({
  mediaLibrary: '++id, title, artist, mediaType, duration, createdAt',
  melodyVault: '++id, title, *tags, duration, createdAt'
});

/**
 * Add a new media item (audio or video) to IndexedDB
 */
export async function addMediaItem({
  title,
  artist = 'Unknown Artist',
  mediaType,
  fileBlob,
  duration = 0,
  originalSize = null,
  fileSize = null,
  isOptimized = false,
  savingsPercent = 0,
  convertedFromVideo = false,
  lyrics = ''
}) {
  const actualSize = fileSize || (fileBlob ? fileBlob.size : 0);
  const initialSize = originalSize || actualSize;
  const item = {
    title: title || 'Untitled Track',
    artist: artist || 'Unknown Artist',
    mediaType: mediaType === 'video' ? 'video' : 'audio',
    fileBlob,
    duration: Number(duration) || 0,
    originalSize: initialSize,
    fileSize: actualSize,
    isOptimized: Boolean(isOptimized),
    savingsPercent: Number(savingsPercent) || 0,
    convertedFromVideo: Boolean(convertedFromVideo),
    lyrics: lyrics || '',
    createdAt: new Date().toISOString()
  };
  const id = await db.mediaLibrary.add(item);
  return { id, ...item };
}

/**
 * Delete a media item by ID
 */
export async function deleteMediaItem(id) {
  return await db.mediaLibrary.delete(id);
}

/**
 * Update media item details
 */
export async function updateMediaItem(id, updates) {
  return await db.mediaLibrary.update(id, updates);
}

/**
 * Update lyrics for a track
 */
export async function updateTrackLyrics(id, lyrics) {
  return await db.mediaLibrary.update(id, { lyrics: lyrics || '' });
}

/**
 * Add a recorded melody idea to IndexedDB
 */
export async function addMelodyItem({ title, tags = [], audioBlob, notesText = '', duration = 0 }) {
  const item = {
    title: title || `Idea #${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    tags: Array.isArray(tags) ? tags : [],
    audioBlob,
    notesText: notesText || '',
    duration: Number(duration) || 0,
    createdAt: new Date().toISOString()
  };
  const id = await db.melodyVault.add(item);
  return { id, ...item };
}

/**
 * Update melody item
 */
export async function updateMelodyItem(id, updates) {
  return await db.melodyVault.update(id, updates);
}

/**
 * Delete melody item by ID
 */
export async function deleteMelodyItem(id) {
  return await db.melodyVault.delete(id);
}

/**
 * Estimate storage quota
 */
export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    const { quota, usage } = await navigator.storage.estimate();
    return {
      usageBytes: usage || 0,
      quotaBytes: quota || 0,
      usageMB: ((usage || 0) / (1024 * 1024)).toFixed(1),
      quotaMB: ((quota || 0) / (1024 * 1024)).toFixed(0),
      percent: quota ? Math.round((usage / quota) * 100) : 0
    };
  }
  return null;
}

/**
 * Get comprehensive storage breakdown across media types and savings
 */
export async function getStorageBreakdown() {
  try {
    const mediaItems = await db.mediaLibrary.toArray();
    const melodyItems = await db.melodyVault.toArray();

    let audioBytes = 0;
    let videoBytes = 0;
    let melodyBytes = 0;
    let totalSavedBytes = 0;
    let optimizedCount = 0;

    for (const item of mediaItems) {
      const size = item.fileSize || (item.fileBlob ? item.fileBlob.size : 0);
      if (item.mediaType === 'video') {
        videoBytes += size;
      } else {
        audioBytes += size;
      }
      if (item.isOptimized && item.originalSize && item.originalSize > size) {
        totalSavedBytes += (item.originalSize - size);
        optimizedCount++;
      }
    }

    for (const item of melodyItems) {
      const size = item.audioBlob ? item.audioBlob.size : 0;
      melodyBytes += size;
    }

    const totalBytes = audioBytes + videoBytes + melodyBytes;

    return {
      totalBytes,
      totalMB: (totalBytes / (1024 * 1024)).toFixed(1),
      audioBytes,
      audioMB: (audioBytes / (1024 * 1024)).toFixed(1),
      videoBytes,
      videoMB: (videoBytes / (1024 * 1024)).toFixed(1),
      melodyBytes,
      melodyMB: (melodyBytes / (1024 * 1024)).toFixed(1),
      totalSavedBytes,
      totalSavedMB: (totalSavedBytes / (1024 * 1024)).toFixed(1),
      optimizedCount,
      mediaCount: mediaItems.length,
      melodyCount: melodyItems.length
    };
  } catch (err) {
    console.error('Error calculating storage breakdown:', err);
    return null;
  }
}

/**
 * Check if a file already exists in library to avoid duplicate storage
 */
export async function checkIsDuplicate(fileName, fileSize) {
  try {
    const cleanName = fileName.replace(/\.[^/.]+$/, '').trim().toLowerCase();
    const existing = await db.mediaLibrary
      .filter(item => {
        const itemTitle = (item.title || '').trim().toLowerCase();
        const itemSize = item.fileSize || (item.fileBlob ? item.fileBlob.size : 0);
        return itemTitle === cleanName || (fileSize && itemSize === fileSize);
      })
      .first();
    return existing || null;
  } catch {
    return null;
  }
}

/**
 * Generate a demo synthesized audio blob (chill lo-fi / synth chord progression)
 * so users have instant music to test with if their library is empty.
 */
export async function generateSampleAudioBlob(bpm = 84, durationSeconds = 16) {
  const sampleRate = 44100;
  const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
    2,
    sampleRate * durationSeconds,
    sampleRate
  );

  // Master bus with gentle reverb & limiter
  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(0.35, 0);
  masterGain.connect(offlineCtx.destination);

  // Chord progression: Am7 -> Fmaj7 -> Cmaj7 -> G
  // Frequencies in Hz:
  const chords = [
    [220.00, 261.63, 329.63, 392.00], // A3, C4, E4, G4
    [174.61, 220.00, 261.63, 329.63], // F3, A3, C4, E4
    [130.81, 196.00, 261.63, 329.63], // C3, G3, C4, E4
    [196.00, 246.94, 293.66, 392.00]  // G3, B3, D4, G4
  ];

  const secondsPerChord = durationSeconds / chords.length;

  chords.forEach((chord, chordIdx) => {
    const startTime = chordIdx * secondsPerChord;
    chord.forEach((freq, noteIdx) => {
      // Warm pad synthesizer
      const osc = offlineCtx.createOscillator();
      const oscGain = offlineCtx.createGain();
      
      osc.type = noteIdx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Subtle detune for lush analog feel
      osc.detune.setValueAtTime(noteIdx * 3 - 4, startTime);

      // ADSR Envelope
      const noteDuration = secondsPerChord - 0.2;
      oscGain.gain.setValueAtTime(0.0001, startTime);
      oscGain.gain.linearRampToValueAtTime(0.18, startTime + 0.3);
      oscGain.gain.exponentialRampToValueAtTime(0.12, startTime + 1.2);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDuration);

      osc.connect(oscGain);
      oscGain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + noteDuration + 0.2);
    });

    // Add rhythmic soft bass pulse
    const bassOsc = offlineCtx.createOscillator();
    const bassGain = offlineCtx.createGain();
    bassOsc.type = 'triangle';
    bassOsc.frequency.setValueAtTime(chord[0] / 2, startTime);
    bassGain.gain.setValueAtTime(0.22, startTime);
    bassGain.gain.exponentialRampToValueAtTime(0.001, startTime + secondsPerChord * 0.9);
    bassOsc.connect(bassGain);
    bassGain.connect(masterGain);
    bassOsc.start(startTime);
    bassOsc.stop(startTime + secondsPerChord);
  });

  const renderedBuffer = await offlineCtx.startRendering();
  
  // Convert AudioBuffer to WAV Blob
  return bufferToWave(renderedBuffer, renderedBuffer.length);
}

/**
 * Helper to encode AudioBuffer to WAV Blob
 */
export function bufferToWave(abuffer, len) {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels = [];
  let sample = 0;
  let offset = 0;
  let pos = 0;

  function setUint16(data) {
    out.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF identifier
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);  // file length - 8
  setUint32(0x45564157); // "WAVE"

  // format chunk identifier
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16);         // length = 16
  setUint16(1);          // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16);            // 16-bit

  // data chunk identifier
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4); // chunk length

  for (let i = 0; i < abuffer.numberOfChannels; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: 'audio/wav' });
}

/**
 * Pre-populate initial demo tracks if database is completely empty
 */
export async function seedInitialDemoIfEmpty() {
  const count = await db.mediaLibrary.count();
  if (count === 0) {
    try {
      const demoBlob = await generateSampleAudioBlob(80, 16);
      await addMediaItem({
        title: 'Midnight Neo-Soul Loop',
        artist: 'TuneVault Synthesizer',
        mediaType: 'audio',
        fileBlob: demoBlob,
        duration: 16
      });

      // Also seed an initial melody note in melody vault
      const melodyCount = await db.melodyVault.count();
      if (melodyCount === 0) {
        const melodyBlob = await generateSampleAudioBlob(100, 8);
        await addMelodyItem({
          title: 'Acoustic Intro Idea in Am',
          tags: ['#Acoustic', '#Chord', '#Idea'],
          audioBlob: melodyBlob,
          notesText: 'Intro: Am7 -> Fmaj7 -> Cmaj7 -> G\nTempo: ~84 BPM\nStrumming: Down, Down-Up, Up-Down-Up',
          duration: 8
        });
      }
    } catch (e) {
      console.warn('Initial seed skipped:', e);
    }
  }
}
