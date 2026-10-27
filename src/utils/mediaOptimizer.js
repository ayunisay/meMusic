import { Mp3Encoder } from '@breezystack/lamejs';
import { bufferToWave } from '../db/db';

/**
 * Convert AudioBuffer to MP3 Blob using modern @breezystack/lamejs
 * with graceful WAV fallback if encoder encounters any issue.
 * @param {AudioBuffer} audioBuffer
 * @param {number} kbps - bitrate in kbps (default 128)
 * @param {function} onProgress - optional progress callback (0-100)
 * @returns {Blob} MP3 Blob (or fallback WAV Blob)
 */
export function audioBufferToMp3(audioBuffer, kbps = 128, onProgress = null) {
  try {
    const channels = Math.min(audioBuffer.numberOfChannels, 2);
    const sampleRate = audioBuffer.sampleRate;
    const mp3encoder = new Mp3Encoder(channels, sampleRate, kbps);
    const mp3Data = [];

    const sampleBlockSize = 1152;
    const length = audioBuffer.length;

    // Convert float32 [-1, 1] to int16 [-32768, 32767]
    const leftFloat = audioBuffer.getChannelData(0);
    const rightFloat = channels > 1 ? audioBuffer.getChannelData(1) : leftFloat;

    const leftInt16 = new Int16Array(length);
    const rightInt16 = channels > 1 ? new Int16Array(length) : null;

    for (let i = 0; i < length; i++) {
      // Clamp and scale
      let sL = Math.max(-1, Math.min(1, leftFloat[i]));
      leftInt16[i] = sL < 0 ? sL * 0x8000 : sL * 0x7FFF;

      if (rightInt16) {
        let sR = Math.max(-1, Math.min(1, rightFloat[i]));
        rightInt16[i] = sR < 0 ? sR * 0x8000 : sR * 0x7FFF;
      }
    }

    // Process in chunks to prevent UI freeze and report progress
    for (let i = 0; i < length; i += sampleBlockSize) {
      const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
      let mp3buf;
      if (channels === 2 && rightInt16) {
        const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
        mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      } else {
        mp3buf = mp3encoder.encodeBuffer(leftChunk);
      }

      if (mp3buf && mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }

      if (onProgress && i % (sampleBlockSize * 50) === 0) {
        onProgress(Math.round((i / length) * 100));
      }
    }

    const endBuf = mp3encoder.flush();
    if (endBuf && endBuf.length > 0) {
      mp3Data.push(endBuf);
    }

    if (onProgress) onProgress(100);

    return new Blob(mp3Data, { type: 'audio/mp3' });
  } catch (err) {
    console.warn('MP3 encoding failed, falling back to clean WAV:', err);
    return bufferToWave(audioBuffer, audioBuffer.length);
  }
}

/**
 * Extract audio from a video/audio file and compress to MP3
 * @param {File|Blob} file
 * @param {function} onProgress
 * @returns {Promise<{ blob: Blob, duration: number, originalSize: number, newSize: number, savingsPercent: number }>}
 */
export async function extractAndCompressAudio(file, onProgress = null) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;

    const mp3Blob = audioBufferToMp3(audioBuffer, 128, onProgress);
    const originalSize = file.size;
    const newSize = mp3Blob.size;
    const savingsPercent = originalSize > 0 ? Math.round(((originalSize - newSize) / originalSize) * 100) : 0;

    return {
      blob: mp3Blob,
      duration,
      originalSize,
      newSize,
      savingsPercent: Math.max(0, savingsPercent)
    };
  } finally {
    if (audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  }
}

/**
 * Check if a file should be optimized (e.g. uncompressed WAV/AIFF or large audio > 8MB)
 */
export function isCompressibleAudio(file) {
  const isWavOrAiff = /\.(wav|aif|aiff|flac)$/i.test(file.name) || file.type.includes('wav') || file.type.includes('flac');
  const isLarge = file.size > 8 * 1024 * 1024; // > 8MB
  return isWavOrAiff || isLarge;
}

/**
 * Format bytes to readable string (KB, MB, GB)
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Strict lists of permitted audio and video formats.
 * Non-media files (images, documents, archives, binaries, etc.) are strictly disallowed.
 */
export const SUPPORTED_AUDIO_EXTENSIONS = [
  '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.wma', '.weba', '.aif', '.aiff', '.mid', '.midi', '.amr'
];

export const SUPPORTED_VIDEO_EXTENSIONS = [
  '.mp4', '.webm', '.mkv', '.mov', '.avi', '.wmv', '.flv', '.m4v', '.3gp', '.ts', '.mts', '.m2ts', '.ogv', '.mpg', '.mpeg', '.vob', '.f4v', '.asf'
];

/**
 * HTML <input accept="..."> attributes for file dialogs
 */
export const MEDIA_ACCEPT_ATTRIBUTE = [
  'video/*',
  'audio/*',
  ...SUPPORTED_VIDEO_EXTENSIONS,
  ...SUPPORTED_AUDIO_EXTENSIONS
].join(',');

export const AUDIO_ONLY_ACCEPT_ATTRIBUTE = [
  'audio/*',
  ...SUPPORTED_AUDIO_EXTENSIONS
].join(',');

/**
 * Validates a single file to determine if it is a legitimate audio (song) or video file.
 * Rejects all other file types (.exe, .pdf, .zip, .png, .jpg, .docx, .txt, etc.)
 * @param {File|Blob} file
 * @returns {{ isValid: boolean, isAudio: boolean, isVideo: boolean, mediaType: 'audio' | 'video' | null, reason?: string }}
 */
export function validateMediaFile(file) {
  if (!file) {
    return { isValid: false, isAudio: false, isVideo: false, mediaType: null, reason: 'File tidak ditemukan' };
  }

  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();

  // 1. Check for Video
  const isVideoExt = SUPPORTED_VIDEO_EXTENSIONS.some(ext => name.endsWith(ext));
  const isVideoMime = type.startsWith('video/');

  if (isVideoExt || isVideoMime) {
    return {
      isValid: true,
      isAudio: false,
      isVideo: true,
      mediaType: 'video'
    };
  }

  // 2. Check for Audio / Song
  const isAudioExt = SUPPORTED_AUDIO_EXTENSIONS.some(ext => name.endsWith(ext));
  const isAudioMime = type.startsWith('audio/') || type === 'audio/mpeg' || type === 'audio/mp3';

  if (isAudioExt || isAudioMime) {
    return {
      isValid: true,
      isAudio: true,
      isVideo: false,
      mediaType: 'audio'
    };
  }

  // 3. Reject any other file types
  return {
    isValid: false,
    isAudio: false,
    isVideo: false,
    mediaType: null,
    reason: `File "${file.name || 'Unknown'}" bukan jenis file lagu atau video yang didukung.`
  };
}

/**
 * Filter an array/list of files, separating allowed audio/video files from invalid files.
 * @param {FileList|File[]} files
 * @returns {{ validFiles: Array<{ file: File, mediaType: 'audio' | 'video', isVideo: boolean, isAudio: boolean }>, invalidFiles: Array<{ file: File, reason: string }> }}
 */
export function filterValidMediaFiles(files) {
  const fileArray = Array.from(files || []);
  const validFiles = [];
  const invalidFiles = [];

  for (const file of fileArray) {
    const result = validateMediaFile(file);
    if (result.isValid) {
      validFiles.push({
        file,
        mediaType: result.mediaType,
        isVideo: result.isVideo,
        isAudio: result.isAudio
      });
    } else {
      invalidFiles.push({
        file,
        reason: result.reason
      });
    }
  }

  return { validFiles, invalidFiles };
}
