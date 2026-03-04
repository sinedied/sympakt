import {
  EXPORT_SAMPLE_RATE,
  EXPORT_CHANNELS,
  MAX_SAMPLE_DURATION,
  WAVEFORM_COLUMNS,
} from '../types/index.js';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Decode an audio file (any format the browser supports) into an AudioBuffer.
 */
export async function decodeAudioFile(data: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  return ctx.decodeAudioData(data);
}

/**
 * Resample and convert an AudioBuffer to mono, 48 kHz.
 * Returns the resampled AudioBuffer (max MAX_SAMPLE_DURATION seconds).
 */
export async function resampleToExportFormat(
  buffer: AudioBuffer,
): Promise<AudioBuffer> {
  const duration = Math.min(buffer.duration, MAX_SAMPLE_DURATION);
  const length = Math.ceil(duration * EXPORT_SAMPLE_RATE);

  const offline = new OfflineAudioContext(
    EXPORT_CHANNELS,
    length,
    EXPORT_SAMPLE_RATE,
  );

  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0, 0, duration);

  return offline.startRendering();
}

/**
 * Generate waveform data (array of RMS values 0..1, one per column).
 */
export function generateWaveformData(
  buffer: AudioBuffer,
  columns: number = WAVEFORM_COLUMNS,
): number[] {
  // Mix down to mono if needed
  const channelData = buffer.getChannelData(0);
  const samplesPerColumn = Math.floor(channelData.length / columns);
  const waveform: number[] = [];

  for (let col = 0; col < columns; col++) {
    const start = col * samplesPerColumn;
    const end = Math.min(start + samplesPerColumn, channelData.length);
    let sumSq = 0;
    for (let i = start; i < end; i++) {
      sumSq += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sumSq / (end - start));
    waveform.push(Math.min(rms * 3, 1)); // scale up for visibility, clamp to 1
  }

  return waveform;
}

/**
 * Play a sample from an AudioBuffer at a given offset (seconds).
 * Returns a function to stop playback.
 */
export function playSample(
  buffer: AudioBuffer,
  offset = 0,
): () => void {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0, offset);

  return () => {
    try {
      source.stop();
    } catch {
      // already stopped
    }
  };
}

/**
 * Extract raw Float32 PCM data from an AudioBuffer (mono, first channel).
 */
export function getMonoPCM(buffer: AudioBuffer): Float32Array {
  return buffer.getChannelData(0);
}
