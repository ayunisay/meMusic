import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addMelodyItem, deleteMelodyItem, addMediaItem } from '../db/db';
import VirtualSynth from './VirtualSynth';
import {
  Mic,
  Square,
  Play,
  Pause,
  Download,
  Trash2,
  Music,
  Clock,
  Sparkles,
  Radio,
  Share2,
  Upload,
  FileAudio
} from 'lucide-react';

const SUGGESTED_TAGS = ['#Chord', '#Acoustic', '#Piano', '#Riff', '#Vocal', '#Lofi', '#Pop', '#Intro', '#Drop', '#Imported'];

export default function MelodyVault() {
  // Recorder states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordSource, setRecordSource] = useState('both'); // 'mic' | 'synth' | 'both'

  // Form states for new recording
  const [title, setTitle] = useState('');
  const [selectedTags, setSelectedTags] = useState(['#Idea']);
  const [customTag, setCustomTag] = useState('');
  const [notesText, setNotesText] = useState('');

  // Melody list search / filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTagFilter, setActiveTagFilter] = useState('all');

  // Currently playing melody audio state
  const [playingMelodyId, setPlayingMelodyId] = useState(null);
  const audioPlayerRef = useRef(null);

  // MediaRecorder & Streams refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const micStreamRef = useRef(null);
  const synthStreamRef = useRef(null);
  const synthContextRef = useRef(null);
  const activeRecordingStreamsRef = useRef([]);

  // Callback from VirtualSynth when internal audio stream is ready
  const handleSynthStreamReady = (stream, ctx) => {
    synthStreamRef.current = stream;
    synthContextRef.current = ctx;
  };

  // Import file ref & state
  const fileInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  // Extract duration from audio file
  const getAudioFileDuration = (file) => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      audio.src = url;

      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration || 0);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };

      setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve(0);
      }, 5000);
    });
  };

  // Handle importing audio files into Melody Vault
  const handleFileImportChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsImporting(true);

    try {
      if (files.length === 1) {
        // Single file: load into Preview & Save Idea box
        const file = files[0];
        setImportStatus(`Loading ${file.name}...`);
        const dur = await getAudioFileDuration(file);
        const url = URL.createObjectURL(file);

        setRecordedBlob(file);
        setAudioUrl(url);
        setRecordingSeconds(Math.round(dur));

        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setTitle(cleanName || 'Imported Idea');
        setSelectedTags(['#Idea', '#Imported']);
        setNotesText(`Imported file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
        setImportStatus('');
      } else {
        // Multiple files: Batch import directly into Melody Vault database!
        let successCount = 0;
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setImportStatus(`Importing (${i + 1}/${files.length}): ${file.name}...`);
          const dur = await getAudioFileDuration(file);
          const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

          await addMelodyItem({
            title: cleanName || `Imported #${i + 1}`,
            tags: ['#Idea', '#Imported'],
            audioBlob: file,
            notesText: `Imported from file: ${file.name}`,
            duration: Math.round(dur)
          });
          successCount++;
        }
        setImportStatus(`Done! Successfully imported ${successCount} melody files.`);
        setTimeout(() => setImportStatus(''), 4000);
      }
    } catch (err) {
      console.error('Error importing audio files into Melody Vault:', err);
      alert('Error importing audio file. Please ensure it is a valid audio format (.mp3, .wav, .m4a, .ogg, etc.).');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Real-time canvas visualizer
  const micCanvasRef = useRef(null);
  const micAnalyserRef = useRef(null);
  const micAnimFrameRef = useRef(null);

  // Live query from Dexie melodyVault table
  const melodies = useLiveQuery(
    async () => {
      let items = await db.melodyVault.toArray();

      if (activeTagFilter !== 'all') {
        items = items.filter(m => m.tags && m.tags.includes(activeTagFilter));
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        items = items.filter(
          m =>
            m.title.toLowerCase().includes(query) ||
            (m.notesText && m.notesText.toLowerCase().includes(query)) ||
            (m.tags && m.tags.some(t => t.toLowerCase().includes(query)))
        );
      }

      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return items;
    },
    [activeTagFilter, searchQuery]
  );

  // Format time mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Start Live Recording (Supports Mic, Digital Synth, or Dual Mix)
  const startRecording = async () => {
    try {
      let streamToRecord = null;
      activeRecordingStreamsRef.current = [];

      if (recordSource === 'mic') {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = micStream;
        activeRecordingStreamsRef.current.push(micStream);
        streamToRecord = micStream;
      } else if (recordSource === 'synth') {
        if (!synthStreamRef.current) {
          alert('Virtual Synth audio is still initializing. Please tap any note on the keyboard first.');
          return;
        }
        if (synthContextRef.current && synthContextRef.current.state === 'suspended') {
          await synthContextRef.current.resume();
        }
        streamToRecord = synthStreamRef.current;
      } else {
        // Dual Mix: Mic + Virtual Synth combined
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = micStream;
        activeRecordingStreamsRef.current.push(micStream);

        if (synthStreamRef.current) {
          if (synthContextRef.current && synthContextRef.current.state === 'suspended') {
            await synthContextRef.current.resume();
          }
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          const mixCtx = new AudioCtx();
          const mixDest = mixCtx.createMediaStreamDestination();

          const micSource = mixCtx.createMediaStreamSource(micStream);
          const synthSource = mixCtx.createMediaStreamSource(synthStreamRef.current);

          micSource.connect(mixDest);
          synthSource.connect(mixDest);

          streamToRecord = mixDest.stream;
        } else {
          streamToRecord = micStream;
        }
      }

      // Setup audio analyzer for live waveform (analyzes mic, synth, or combined stream)
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const analyzerCtx = new AudioCtx();
      const source = analyzerCtx.createMediaStreamSource(streamToRecord);
      const analyser = analyzerCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      micAnalyserRef.current = analyser;

      drawMicWaveform();

      // Setup MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(streamToRecord, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Stop only physical mic tracks so synth stays active
        activeRecordingStreamsRef.current.forEach(stream => {
          stream.getTracks().forEach(track => track.stop());
        });
        activeRecordingStreamsRef.current = [];

        if (micAnimFrameRef.current) {
          cancelAnimationFrame(micAnimFrameRef.current);
        }
      };

      recorder.start(200); // 200ms slice
      setIsRecording(true);
      setRecordingSeconds(0);
      setRecordedBlob(null);

      const sourcePrefix = recordSource === 'synth' ? 'Synth Idea' : recordSource === 'mic' ? 'Vocal Idea' : 'Dual Mix Idea';
      setTitle(`${sourcePrefix} #${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(sec => sec + 1);
      }, 1000);
    } catch (err) {
      console.error('Error starting recording:', err);
      alert('Could not start recording. Please ensure microphone permissions are granted if using mic mode.');
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  // Real-time canvas drawing of microphone input
  const drawMicWaveform = () => {
    const canvas = micCanvasRef.current;
    if (!canvas || !micAnalyserRef.current) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      micAnimFrameRef.current = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const bufferLength = micAnalyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      micAnalyserRef.current.getByteFrequencyData(dataArray);

      const barWidth = width / bufferLength;
      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i];
        const barHeight = (val / 255) * height;
        const x = i * barWidth;
        const y = height - barHeight;

        ctx.fillStyle = `hsl(${140 + (val / 255) * 120}, 90%, 55%)`;
        ctx.fillRect(x, y, barWidth - 1, barHeight);
      }
    };
    render();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (micAnimFrameRef.current) {
        cancelAnimationFrame(micAnimFrameRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Toggle tag in form
  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Add custom tag
  const handleAddCustomTag = (e) => {
    e.preventDefault();
    if (!customTag.trim()) return;
    const formatted = customTag.startsWith('#') ? customTag.trim() : `#${customTag.trim()}`;
    if (!selectedTags.includes(formatted)) {
      setSelectedTags([...selectedTags, formatted]);
    }
    setCustomTag('');
  };

  // Save melody idea to Dexie table
  const handleSaveMelody = async () => {
    if (!recordedBlob) return;

    await addMelodyItem({
      title: title || 'Untitled Idea',
      tags: selectedTags,
      audioBlob: recordedBlob,
      notesText,
      duration: recordingSeconds
    });

    // Reset recorder form
    setRecordedBlob(null);
    setAudioUrl(null);
    setTitle('');
    setNotesText('');
    setRecordingSeconds(0);
  };

  // Play a melody item directly
  const handlePlayMelodyItem = (item) => {
    if (playingMelodyId === item.id) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setPlayingMelodyId(null);
      return;
    }

    if (audioPlayerRef.current) {
      const url = URL.createObjectURL(item.audioBlob);
      audioPlayerRef.current.src = url;
      audioPlayerRef.current.play();
      setPlayingMelodyId(item.id);
      audioPlayerRef.current.onended = () => {
        setPlayingMelodyId(null);
      };
    }
  };

  // Download melody idea audio
  const handleDownloadMelody = (item) => {
    const url = URL.createObjectURL(item.audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.title.replace(/\s+/g, '_')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Promote / Copy melody idea to the main offline Media Library
  const handlePromoteToMediaLibrary = async (item) => {
    await addMediaItem({
      title: item.title,
      artist: 'Melody Vault Original',
      mediaType: 'audio',
      fileBlob: item.audioBlob,
      duration: item.duration
    });
    alert(`"${item.title}" has been saved to your Offline Media Library!`);
  };

  // Delete melody item
  const handleDeleteMelody = async (id, title) => {
    if (confirm(`Delete idea "${title}"?`)) {
      await deleteMelodyItem(id);
      if (playingMelodyId === id) {
        setPlayingMelodyId(null);
      }
    }
  };

  return (
    <div className="w-full px-4 md:px-8 py-6 space-y-8">
      {/* Hidden audio element for melody ideas playback */}
      <audio ref={audioPlayerRef} className="hidden" />

      {/* Hidden file input for importing audio files into Melody Vault */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*"
        onChange={handleFileImportChange}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Radio className="w-7 h-7 text-indigo-500" />
            <span>Melody Vault & Idea Recorder</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Capture spontaneous riffs, hums, chords, and lyrics offline before you forget them.
          </p>
        </div>
      </div>

      {/* Recorder + Synth Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Audio Recorder (4 cols on xl / desktop) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                Live Studio Recorder
              </span>
              <span className="font-mono text-xs bg-zinc-800/80 px-2.5 py-1 rounded-full text-zinc-400">
                MediaRecorder API
              </span>
            </div>

            {/* Input Source Mode Selector */}
            <div className="mt-3 grid grid-cols-3 gap-1 p-1 bg-zinc-950/80 rounded-xl border border-zinc-800 text-[11px] font-medium">
              {[
                { id: 'mic', label: 'Mic Only', desc: 'Vokal / Eksternal' },
                { id: 'synth', label: 'Synth Only', desc: 'Digital Pure' },
                { id: 'both', label: 'Dual Mix', desc: 'Mic + Synth' }
              ].map(({ id, label, desc }) => (
                <button
                  key={id}
                  type="button"
                  disabled={isRecording}
                  onClick={() => setRecordSource(id)}
                  className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition ${
                    recordSource === id
                      ? 'bg-indigo-600 text-white shadow font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                  } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span>{label}</span>
                  <span className="text-[9px] opacity-75">{desc}</span>
                </button>
              ))}
            </div>

            {/* Live Canvas Visualizer */}
            <div className="mt-4 w-full h-16 bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800/80 relative flex items-center justify-center">
              <canvas ref={micCanvasRef} width={360} height={64} className="w-full h-full block" />
              {!isRecording && !recordedBlob && (
                <span className="absolute text-xs text-zinc-600 font-medium text-center px-2">
                  {recordSource === 'synth'
                    ? 'Press Record to capture clean digital synth'
                    : recordSource === 'mic'
                    ? 'Press Record to capture microphone'
                    : 'Press Record to capture mic + synth together'}
                </span>
              )}
            </div>

            {/* Recording Timer Display */}
            <div className="text-center my-6">
              <div className="font-mono text-4xl md:text-5xl font-black tracking-tight text-white">
                {formatTime(recordingSeconds)}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {isRecording
                  ? `🔴 Recording [${recordSource === 'synth' ? 'Digital Synth' : recordSource === 'mic' ? 'Microphone' : 'Mic + Synth Mix'}]...`
                  : recordedBlob
                  ? 'Audio captured! Ready to save.'
                  : `Ready to record (${recordSource === 'synth' ? 'Virtual Synth internal audio' : recordSource === 'mic' ? 'Voice or instrument via mic' : 'Mic voice + synth simultaneously'})`}
              </p>
            </div>
          </div>

          {/* Record Actions */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {!isRecording ? (
                <>
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold text-xs md:text-sm shadow-xl shadow-red-600/30 hover:scale-105 active:scale-95 transition"
                  >
                    <Mic className="w-4 h-4 md:w-5 md:h-5 animate-pulse" />
                    <span>Start Recording</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="flex items-center gap-2 px-4 py-3 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-750 text-zinc-200 font-semibold text-xs md:text-sm shadow-lg hover:scale-105 active:scale-95 transition"
                  >
                    <Upload className="w-4 h-4 text-indigo-400" />
                    <span>Import Audio</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-zinc-100 hover:bg-white text-zinc-900 font-bold text-sm shadow-xl hover:scale-105 active:scale-95 transition"
                >
                  <Square className="w-5 h-5 fill-current" />
                  <span>Stop & Review</span>
                </button>
              )}
            </div>

            {/* Import Status Banner */}
            {importStatus && (
              <div className="p-3 rounded-2xl bg-indigo-950/70 border border-indigo-500/40 text-indigo-300 text-xs flex items-center gap-2.5 animate-in fade-in">
                <FileAudio className="w-4 h-4 text-indigo-400 shrink-0 animate-bounce" />
                <span className="font-medium">{importStatus}</span>
              </div>
            )}

            {/* Recorded Audio Review & Save Form */}
            {recordedBlob && (
              <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/80 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300">Preview & Save Idea</span>
                  {audioUrl && (
                    <audio controls src={audioUrl} className="h-7 max-w-[200px]" />
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Idea Title (e.g. Jazzy Chorus Hook)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />

                {/* Quick Tags Selection */}
                <div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {SUGGESTED_TAGS.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTag(t)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                          selectedTags.includes(t)
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-zinc-800/70 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleAddCustomTag} className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Add custom tag (e.g. #Drop)"
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-zinc-950 border border-zinc-750 rounded-lg text-[11px] text-zinc-200 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 bg-zinc-800 text-zinc-200 rounded-lg text-xs hover:bg-zinc-700"
                    >
                      Add
                    </button>
                  </form>
                </div>

                {/* Chords / Lyrics Memo */}
                <textarea
                  rows={3}
                  placeholder="Chord progressions, strumming patterns, or lyric ideas..."
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500 resize-none"
                />

                <button
                  onClick={handleSaveMelody}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-lg transition active:scale-95"
                >
                  Save Idea to Melody Vault
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Virtual Synth Piano Pad (8 cols on desktop) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col justify-start space-y-4">
          <VirtualSynth
            onInsertNotes={(chordName) => {
              setNotesText(prev => prev ? `${prev} - ${chordName}` : chordName);
            }}
            onStreamReady={handleSynthStreamReady}
          />

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-400 space-y-1.5">
            <h4 className="text-zinc-200 font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Musician Workflow Tip</span>
            </h4>
            <p>
              Use the interactive keys or laptop keys (`A S D F G H J K` and `W E T Y U`) to test notes or tap chords while humming. Any chord you tap can be inserted straight into your idea memo notes!
            </p>
          </div>
        </div>
      </div>

      {/* Saved Melodies Library */}
      <div className="mt-10 pt-6 border-t border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Music className="w-5 h-5 text-indigo-400" />
              <span>Saved Melodies ({melodies ? melodies.length : 0})</span>
            </h3>
            <p className="text-xs text-zinc-400">Stored safely on device in IndexedDB (`melodyVault` table).</p>
          </div>

          {/* Search bar & Import Melodies Button */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search ideas or chords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 rounded-xl text-xs font-semibold transition shrink-0 shadow-sm"
              title="Import audio files (.mp3, .wav, .m4a, etc.) into Melody Vault"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
            </button>
          </div>
        </div>

        {/* Tag filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap mb-5">
          {['all', ...SUGGESTED_TAGS].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTagFilter(tag)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                activeTagFilter === tag
                  ? 'bg-indigo-600 text-white border-indigo-500 font-medium shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              {tag === 'all' ? 'All Tags' : tag}
            </button>
          ))}
        </div>

        {/* Melodies Grid */}
        {!melodies || melodies.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-zinc-800/70 bg-zinc-900/30 text-zinc-500 text-sm">
            No melody ideas recorded yet. Hit <strong>Start Recording</strong> above to capture your first idea!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {melodies.map((item) => {
              const isPlayingThis = playingMelodyId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between hover:border-zinc-700 transition shadow-lg space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                        <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-500 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(item.duration)}</span>
                          <span className="text-zinc-600">•</span>
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </span>
                      </div>

                      {/* Play / Pause Toggle Button */}
                      <button
                        onClick={() => handlePlayMelodyItem(item)}
                        className={`p-2.5 rounded-full transition shadow-md ${
                          isPlayingThis
                            ? 'bg-indigo-600 text-white'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                        }`}
                        title={isPlayingThis ? 'Pause' : 'Play Preview'}
                      >
                        {isPlayingThis ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                      </button>
                    </div>

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {item.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-indigo-300 border border-zinc-700/50"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Notes / Chord progressions */}
                    {item.notesText && (
                      <div className="mt-3 p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 font-mono text-[11px] text-zinc-300 whitespace-pre-wrap max-h-24 overflow-y-auto">
                        {item.notesText}
                      </div>
                    )}
                  </div>

                  {/* Actions: Download, Promote to Library, Delete */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs">
                    <button
                      onClick={() => handlePromoteToMediaLibrary(item)}
                      className="flex items-center gap-1 text-zinc-400 hover:text-indigo-400 transition"
                      title="Add to main Media Library"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>To Library</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDownloadMelody(item)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition"
                        title="Download audio file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMelody(item.id, item.title)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition"
                        title="Delete idea"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
