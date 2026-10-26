import React, { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Disc3, Activity, BarChart3, Waves } from 'lucide-react';

export default function AudioVisualizer({ className = '' }) {
  const { currentTrack, isPlaying, analyserRef } = usePlayer();
  const canvasRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const [visualizerMode, setVisualizerMode] = useState('bars'); // 'bars' | 'wave' | 'circle'

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      animFrameIdRef.current = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      let bufferLength = 64;
      let dataArray = new Uint8Array(bufferLength);

      if (analyserRef.current && isPlaying) {
        analyserRef.current.getByteFrequencyData(dataArray);
      } else if (isPlaying) {
        // Fallback procedural wave if Web Audio is warming up
        const time = Date.now() / 200;
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = Math.floor(Math.sin(time + i * 0.3) * 30 + 45);
        }
      } else {
        // Flatline / dormant
        dataArray.fill(6);
      }

      if (visualizerMode === 'bars') {
        const barCount = 36;
        const barWidth = (width / barCount) - 3;
        const step = Math.floor(dataArray.length / barCount) || 1;

        for (let i = 0; i < barCount; i++) {
          const val = dataArray[i * step] || 0;
          const barHeight = Math.max(4, (val / 255) * height * 0.85);
          const x = i * (barWidth + 3) + 2;
          const y = height - barHeight;

          // Glowing Indigo to Violet to Cyan gradient
          const gradient = ctx.createLinearGradient(0, y, 0, height);
          gradient.addColorStop(0, '#c084fc'); // purple-400
          gradient.addColorStop(0.5, '#6366f1'); // indigo-500
          gradient.addColorStop(1, '#3b82f6'); // blue-500

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 1, 1]);
          ctx.fill();

          // Subtle reflection/glow under the bar
          if (val > 40) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(168, 85, 247, 0.4)';
          } else {
            ctx.shadowBlur = 0;
          }
        }
      } else if (visualizerMode === 'wave') {
        // Smooth neon waveform
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#818cf8';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#6366f1';

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = (dataArray[i] / 255);
          const y = (height / 2) + (Math.sin(i * 0.2 + Date.now() / 300) * (v * height * 0.45));

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (visualizerMode === 'circle') {
        // Circular radial frequency visualizer
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.26;
        const barCount = 48;
        const step = Math.floor(dataArray.length / barCount) || 1;

        for (let i = 0; i < barCount; i++) {
          const val = dataArray[i * step] || 0;
          const barLength = Math.max(3, (val / 255) * (radius * 0.7));
          const angle = (i * 2 * Math.PI) / barCount;

          const startX = centerX + Math.cos(angle) * radius;
          const startY = centerY + Math.sin(angle) * radius;
          const endX = centerX + Math.cos(angle) * (radius + barLength);
          const endY = centerY + Math.sin(angle) * (radius + barLength);

          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.strokeStyle = `hsl(${260 + (i * 2)}, 90%, ${60 + (val / 255) * 25}%)`;
          ctx.stroke();
        }
      }
    };

    render();

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isPlaying, visualizerMode, analyserRef]);

  return (
    <div className={`relative flex flex-col items-center justify-center w-full h-full p-4 overflow-hidden ${className}`}>
      {/* Vinyl Disc Container */}
      <div className="relative flex items-center justify-center my-4 group">
        {/* Ambient Back Glow */}
        <div
          className={`absolute w-64 h-64 md:w-80 md:h-80 rounded-full blur-3xl transition-opacity duration-700 pointer-events-none ${
            isPlaying ? 'opacity-40 bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500' : 'opacity-10 bg-zinc-700'
          }`}
        />

        {/* Vinyl Disc */}
        <div
          className={`relative w-56 h-56 md:w-72 md:h-72 rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-950 p-2 shadow-2xl border-4 border-zinc-800/80 flex items-center justify-center transition-transform duration-500 ${
            isPlaying ? 'animate-spin-slow' : 'animate-spin-paused'
          }`}
          style={{
            boxShadow: isPlaying ? '0 0 35px rgba(99, 102, 241, 0.35), inset 0 0 25px rgba(0,0,0,0.9)' : '0 10px 25px rgba(0,0,0,0.5)'
          }}
        >
          {/* Vinyl Grooves Texture */}
          <div className="absolute inset-3 rounded-full border border-zinc-800/50" />
          <div className="absolute inset-6 rounded-full border border-zinc-800/40" />
          <div className="absolute inset-10 rounded-full border border-zinc-800/30" />
          <div className="absolute inset-14 rounded-full border border-zinc-800/30" />

          {/* Center Label (Album Art or Icon) */}
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-1 flex items-center justify-center shadow-lg relative overflow-hidden">
            <div className="w-full h-full rounded-full bg-zinc-950/40 backdrop-blur-sm flex flex-col items-center justify-center text-center p-2">
              <Disc3 className={`w-8 h-8 text-white ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
              <div className="text-[10px] font-semibold text-zinc-100 truncate w-20 text-center mt-1">
                {currentTrack?.title || 'TuneVault'}
              </div>
            </div>
            {/* Center Spindle Hole */}
            <div className="absolute w-4 h-4 rounded-full bg-zinc-950 border-2 border-zinc-700 shadow-inner" />
          </div>
        </div>
      </div>

      {/* Real-time Web Audio API Canvas Visualizer */}
      <div className="w-full max-w-md h-24 flex items-center justify-center relative mt-2">
        <canvas
          ref={canvasRef}
          width={400}
          height={96}
          className="w-full h-full block rounded-xl bg-zinc-900/40 border border-zinc-800/40 backdrop-blur-sm"
        />
      </div>

      {/* Visualizer Style Switcher */}
      <div className="flex items-center gap-1.5 mt-3 bg-zinc-900/60 p-1 rounded-full border border-zinc-800/60 text-xs">
        <button
          onClick={() => setVisualizerMode('bars')}
          className={`flex items-center gap-1 px-3 py-1 rounded-full transition-colors ${
            visualizerMode === 'bars' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Spectrum Bars"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Bars</span>
        </button>
        <button
          onClick={() => setVisualizerMode('wave')}
          className={`flex items-center gap-1 px-3 py-1 rounded-full transition-colors ${
            visualizerMode === 'wave' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Oscilloscope Wave"
        >
          <Waves className="w-3.5 h-3.5" />
          <span>Wave</span>
        </button>
        <button
          onClick={() => setVisualizerMode('circle')}
          className={`flex items-center gap-1 px-3 py-1 rounded-full transition-colors ${
            visualizerMode === 'circle' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Circular Pulse"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Pulse</span>
        </button>
      </div>
    </div>
  );
}
