import {
  EXPORT_SAMPLE_RATE,
  EXPORT_CHANNELS,
  WAVEFORM_COLUMNS,
  LOFI_SPEED_FACTOR,
  LoopSettings,
} from '../types/index.js';

/** Cutoff frequency for LOFI preview lowpass filter.
 *  Simulates the reduced bandwidth from exporting at 2× speed:
 *  effective Nyquist = EXPORT_SAMPLE_RATE / (2 × LOFI_SPEED_FACTOR) = 12 kHz */
const LOFI_CUTOFF = EXPORT_SAMPLE_RATE / (2 * LOFI_SPEED_FACTOR);

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
 * Returns the resampled AudioBuffer (full duration preserved).
 * When speedFactor > 1, the audio is played faster (pitched up),
 * producing a shorter buffer (used for LOFI export).
 */
export async function resampleToExportFormat(
  buffer: AudioBuffer,
  speedFactor = 1,
): Promise<AudioBuffer> {
  const duration = buffer.duration;
  const outputDuration = duration / speedFactor;
  const length = Math.ceil(outputDuration * EXPORT_SAMPLE_RATE);

  const offline = new OfflineAudioContext(
    EXPORT_CHANNELS,
    length,
    EXPORT_SAMPLE_RATE,
  );

  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = speedFactor;
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
 * When lofi is true, a lowpass filter simulates the reduced bandwidth
 * of the LOFI export (12 kHz cutoff).
 * Returns a function to stop playback.
 */
export function playSample(
  buffer: AudioBuffer,
  offset = 0,
  lofi = false,
): () => void {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  if (lofi) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = LOFI_CUTOFF;
    source.connect(filter);
    filter.connect(ctx.destination);
  } else {
    source.connect(ctx.destination);
  }

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
 * Play a sample in a looping region with crossfade applied.
 * The crossfade blends the tail of the loop with audio from BEFORE
 * the loop start point for a natural seamless transition.
 * Returns a stop function.
 */
export async function playSampleLooped(
  buffer: AudioBuffer,
  loop: LoopSettings,
  lofi = false,
): Promise<() => void> {
  const ctx = getAudioContext();
  const sampleRate = buffer.sampleRate;

  const loopStartSample = Math.round(loop.startTime * sampleRate);
  const loopEndSample = Math.round(loop.endTime * sampleRate);
  const loopLengthSamples = loopEndSample - loopStartSample;

  if (loopLengthSamples <= 0) {
    return playSample(buffer, loop.startTime);
  }

  // Extract the loop region
  const loopPcm = new Float32Array(loopLengthSamples);
  const srcData = buffer.getChannelData(0);
  for (let i = 0; i < loopLengthSamples; i++) {
    const idx = loopStartSample + i;
    loopPcm[i] = idx < srcData.length ? srcData[idx] : 0;
  }

  // Apply crossfade: blend tail of loop with audio BEFORE the start point
  const crossfadeSamples = Math.round(loop.crossfadeDuration * sampleRate);
  if (crossfadeSamples > 0 && crossfadeSamples <= loopLengthSamples) {
    for (let i = 0; i < crossfadeSamples; i++) {
      const fadeOut = 1 - i / crossfadeSamples;
      const fadeIn = i / crossfadeSamples;
      const endIdx = loopLengthSamples - crossfadeSamples + i;
      // Source from before the loop start (pre-start audio)
      const preStartIdx = loopStartSample - crossfadeSamples + i;
      const preStartSample = (preStartIdx >= 0 && preStartIdx < srcData.length)
        ? srcData[preStartIdx]
        : 0;
      loopPcm[endIdx] = loopPcm[endIdx] * fadeOut + preStartSample * fadeIn;
    }
  }

  // Create an AudioBuffer for the loop region
  const loopBuffer = ctx.createBuffer(1, loopLengthSamples, sampleRate);
  loopBuffer.getChannelData(0).set(loopPcm);

  const source = ctx.createBufferSource();
  source.buffer = loopBuffer;
  source.loop = true;

  if (lofi) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = LOFI_CUTOFF;
    source.connect(filter);
    filter.connect(ctx.destination);
  } else {
    source.connect(ctx.destination);
  }

  source.start();

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

/**
 * Find the nearest zero crossing to a given time in seconds.
 * Searches within a small window around the target time.
 * A zero crossing is where the waveform crosses from positive to negative or vice versa.
 */
export function findNearestZeroCrossing(
  buffer: AudioBuffer,
  targetTime: number,
  searchWindowSeconds = 0.005,
): number {
  const pcm = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const targetSample = Math.round(targetTime * sampleRate);
  const windowSamples = Math.round(searchWindowSeconds * sampleRate);
  const searchStart = Math.max(0, targetSample - windowSamples);
  const searchEnd = Math.min(pcm.length - 1, targetSample + windowSamples);

  let bestSample = targetSample;
  let bestDist = Infinity;

  for (let i = searchStart; i < searchEnd; i++) {
    // Zero crossing: sign change between consecutive samples
    if ((pcm[i] >= 0 && pcm[i + 1] < 0) || (pcm[i] < 0 && pcm[i + 1] >= 0)) {
      const dist = Math.abs(i - targetSample);
      if (dist < bestDist) {
        bestDist = dist;
        bestSample = i;
      }
    }
  }

  return Math.max(0, Math.min(bestSample / sampleRate, buffer.duration));
}

/**
 * Apply a linear crossfade to a looped region of PCM data.
 * Blends the tail of the loop with audio from BEFORE the loop start point.
 * This creates a natural seamless transition when the loop wraps.
 * Returns a new Float32Array with the crossfade applied.
 */
export function applyCrossfade(
  pcm: Float32Array,
  loop: LoopSettings,
  sampleRate: number,
): Float32Array {
  const result = new Float32Array(pcm);
  const loopStartSample = Math.round(loop.startTime * sampleRate);
  const loopEndSample = Math.round(loop.endTime * sampleRate);
  const crossfadeSamples = Math.round(loop.crossfadeDuration * sampleRate);

  if (crossfadeSamples <= 0) return result;

  const loopLength = loopEndSample - loopStartSample;
  if (crossfadeSamples > loopLength) return result;

  // Apply crossfade at the end of the loop region:
  // Fade out the last N samples of the loop, fade in N samples from before the start
  for (let i = 0; i < crossfadeSamples; i++) {
    const fadeOut = 1 - i / crossfadeSamples; // 1 → 0
    const fadeIn = i / crossfadeSamples;       // 0 → 1

    const endIdx = loopEndSample - crossfadeSamples + i;
    // Source from before the loop start
    const preStartIdx = loopStartSample - crossfadeSamples + i;
    const preStartSample = (preStartIdx >= 0 && preStartIdx < result.length)
      ? pcm[preStartIdx]
      : 0;

    if (endIdx >= 0 && endIdx < result.length) {
      result[endIdx] = result[endIdx] * fadeOut + preStartSample * fadeIn;
    }
  }

  return result;
}
