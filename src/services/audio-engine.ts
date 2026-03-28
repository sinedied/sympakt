import {
  EXPORT_SAMPLE_RATE,
  EXPORT_CHANNELS,
  WAVEFORM_COLUMNS,
  LoopSettings,
  LofiMode,
  PitchDebugInfo,
  getLofiSpeedFactor,
  getEffectiveMaxDuration,
  isLofiActive,
} from '../types/index.js';

/** Compute cutoff frequency for LOFI preview lowpass filter.
 *  Simulates the reduced bandwidth from exporting at N× speed:
 *  effective Nyquist = EXPORT_SAMPLE_RATE / (2 × speedFactor) */
function getLofiCutoff(mode: LofiMode): number {
  return EXPORT_SAMPLE_RATE / (2 * getLofiSpeedFactor(mode));
}

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
  const channelData = buffer.getChannelData(0);
  if (channelData.length === 0) return new Array(columns).fill(0);

  const waveform: number[] = [];

  for (let col = 0; col < columns; col++) {
    // Map each column to a range within the buffer (may overlap for short buffers)
    const start = Math.floor((col / columns) * channelData.length);
    const end = Math.max(start + 1, Math.floor(((col + 1) / columns) * channelData.length));
    const clampedEnd = Math.min(end, channelData.length);
    let sumSq = 0;
    for (let i = start; i < clampedEnd; i++) {
      sumSq += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sumSq / (clampedEnd - start));
    waveform.push(Math.min(rms * 3, 1)); // scale up for visibility, clamp to 1
  }

  return waveform;
}

/**
 * Generate peak waveform data (0..1 per column) for accurate amplitude display.
 * Values represent absolute peak sample values — 1.0 means 0 dBFS.
 * Use this for the sample editor where visual clipping should match audio clipping.
 */
export function generatePeakWaveformData(
  buffer: AudioBuffer,
  columns: number = WAVEFORM_COLUMNS,
): number[] {
  const channelData = buffer.getChannelData(0);
  if (channelData.length === 0) return new Array(columns).fill(0);

  const waveform: number[] = [];

  for (let col = 0; col < columns; col++) {
    const start = Math.floor((col / columns) * channelData.length);
    const end = Math.max(start + 1, Math.floor(((col + 1) / columns) * channelData.length));
    const clampedEnd = Math.min(end, channelData.length);
    let peak = 0;
    for (let i = start; i < clampedEnd; i++) {
      const abs = Math.abs(channelData[i]);
      if (abs > peak) peak = abs;
    }
    waveform.push(Math.min(peak, 1));
  }

  return waveform;
}

/**
 * Play a sample from an AudioBuffer at a given offset (seconds).
 * When lofi mode is active, a lowpass filter simulates the reduced bandwidth
 * of the LOFI/XLOFI export.
 * Returns a function to stop playback.
 */
export function playSample(
  buffer: AudioBuffer,
  offset = 0,
  lofi: LofiMode = 'off',
): () => void {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  if (isLofiActive(lofi)) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = getLofiCutoff(lofi);
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
 * Play a sample pitched by a number of semitones relative to root.
 * Uses playbackRate to shift pitch. Returns a stop function.
 */
export function playSamplePitched(
  buffer: AudioBuffer,
  semitones: number,
  lofi: LofiMode = 'off',
): () => void {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = Math.pow(2, semitones / 12);

  if (isLofiActive(lofi)) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = getLofiCutoff(lofi);
    source.connect(filter);
    filter.connect(ctx.destination);
  } else {
    source.connect(ctx.destination);
  }

  source.start(0);

  return () => {
    try {
      source.stop();
    } catch {
      // already stopped
    }
  };
}

/**
 * Play a sample with full rendering (loop/crossfade, lofi, truncation)
 * pitched by a number of semitones relative to root.
 * Returns a stop function (sync — the async work is handled internally).
 */
export function playSamplePitchedFull(
  sample: { audioBuffer: AudioBuffer; loop: LoopSettings | null; lofi: LofiMode; duration: number },
  semitones: number,
): () => void {
  const rate = Math.pow(2, semitones / 12);
  const lofi = sample.lofi;

  if (sample.loop) {
    // Build the crossfaded loop buffer synchronously, then play pitched
    const ctx = getAudioContext();
    const buffer = sample.audioBuffer;
    const sampleRate = buffer.sampleRate;
    const loop = sample.loop;

    const loopStartSample = Math.round(loop.startTime * sampleRate);
    const loopEndSample = Math.round(loop.endTime * sampleRate);
    const loopLengthSamples = loopEndSample - loopStartSample;

    if (loopLengthSamples <= 0) {
      return playSamplePitched(buffer, semitones, lofi);
    }

    const loopPcm = new Float32Array(loopLengthSamples);
    const srcData = buffer.getChannelData(0);
    for (let i = 0; i < loopLengthSamples; i++) {
      const idx = loopStartSample + i;
      loopPcm[i] = idx < srcData.length ? srcData[idx] : 0;
    }

    const crossfadeSamples = Math.round(loop.crossfadeDuration * sampleRate);
    if (crossfadeSamples > 0 && crossfadeSamples <= loopLengthSamples) {
      if (loop.crossfadeAtStart) {
        for (let i = 0; i < crossfadeSamples; i++) {
          const fadeIn = i / crossfadeSamples;
          const fadeOut = 1 - i / crossfadeSamples;
          const postEndIdx = loopEndSample + i;
          const postEndVal = (postEndIdx >= 0 && postEndIdx < srcData.length)
            ? srcData[postEndIdx]
            : 0;
          loopPcm[i] = loopPcm[i] * fadeIn + postEndVal * fadeOut;
        }
      } else {
        for (let i = 0; i < crossfadeSamples; i++) {
          const fadeOut = 1 - i / crossfadeSamples;
          const fadeIn = i / crossfadeSamples;
          const endIdx = loopLengthSamples - crossfadeSamples + i;
          const preStartIdx = loopStartSample - crossfadeSamples + i;
          const preStartVal = (preStartIdx >= 0 && preStartIdx < srcData.length)
            ? srcData[preStartIdx]
            : 0;
          loopPcm[endIdx] = loopPcm[endIdx] * fadeOut + preStartVal * fadeIn;
        }
      }
    }

    const loopBuffer = ctx.createBuffer(1, loopLengthSamples, sampleRate);
    loopBuffer.getChannelData(0).set(loopPcm);

    const source = ctx.createBufferSource();
    source.buffer = loopBuffer;
    source.loop = true;
    source.playbackRate.value = rate;

    if (isLofiActive(lofi)) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = getLofiCutoff(lofi);
      source.connect(filter);
      filter.connect(ctx.destination);
    } else {
      source.connect(ctx.destination);
    }

    source.start();
    return () => { try { source.stop(); } catch { /* already stopped */ } };
  }

  // Non-looped: play with truncation and lofi
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = sample.audioBuffer;
  source.playbackRate.value = rate;

  const effectiveMax = getEffectiveMaxDuration(lofi);
  const playDuration = Math.min(sample.duration, effectiveMax);

  if (isLofiActive(lofi)) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = getLofiCutoff(lofi);
    source.connect(filter);
    filter.connect(ctx.destination);
  } else {
    source.connect(ctx.destination);
  }

  // The duration parameter of start() is in the *source* time domain,
  // so playbackRate stretches/compresses it automatically.
  source.start(0, 0, playDuration);

  return () => { try { source.stop(); } catch { /* already stopped */ } };
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
  lofi: LofiMode = 'off',
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

  // Apply crossfade
  const crossfadeSamples = Math.round(loop.crossfadeDuration * sampleRate);
  if (crossfadeSamples > 0 && crossfadeSamples <= loopLengthSamples) {
    if (loop.crossfadeAtStart) {
      for (let i = 0; i < crossfadeSamples; i++) {
        const fadeIn = i / crossfadeSamples;
        const fadeOut = 1 - i / crossfadeSamples;
        const postEndIdx = loopEndSample + i;
        const postEndVal = (postEndIdx >= 0 && postEndIdx < srcData.length)
          ? srcData[postEndIdx]
          : 0;
        loopPcm[i] = loopPcm[i] * fadeIn + postEndVal * fadeOut;
      }
    } else {
      for (let i = 0; i < crossfadeSamples; i++) {
        const fadeOut = 1 - i / crossfadeSamples;
        const fadeIn = i / crossfadeSamples;
        const endIdx = loopLengthSamples - crossfadeSamples + i;
        const preStartIdx = loopStartSample - crossfadeSamples + i;
        const preStartSample = (preStartIdx >= 0 && preStartIdx < srcData.length)
          ? srcData[preStartIdx]
          : 0;
        loopPcm[endIdx] = loopPcm[endIdx] * fadeOut + preStartSample * fadeIn;
      }
    }
  }

  // Create an AudioBuffer for the loop region
  const loopBuffer = ctx.createBuffer(1, loopLengthSamples, sampleRate);
  loopBuffer.getChannelData(0).set(loopPcm);

  const source = ctx.createBufferSource();
  source.buffer = loopBuffer;
  source.loop = true;

  if (isLofiActive(lofi)) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = getLofiCutoff(lofi);
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

// ── Pitch detection ──────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const D6_FREQUENCY = 1174.66;

/**
 * Map a frequency (Hz) to its nearest musical note string (e.g. "C3", "A#4").
 * Returns null if frequency is out of audible/musical range.
 */
export function frequencyToNote(freq: number): string | null {
  if (freq <= 0 || !isFinite(freq)) return null;
  // MIDI note number: 69 = A4 = 440 Hz
  const midi = 12 * Math.log2(freq / 440) + 69;
  const rounded = Math.round(midi);
  if (rounded < 12 || rounded > 127) return null;
  const noteName = NOTE_NAMES[rounded % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${noteName}${octave}`;
}

/**
 * Detect the fundamental frequency of an AudioBuffer using a downsampled
 * McLeod Pitch Method analysis.
 * Returns the detected note string (e.g. "C3") or null if no clear pitch.
 */
export function detectPitch(buffer: AudioBuffer): string | null {
  return detectPitchWithDebug(buffer).note;
}

/**
 * Detect pitch with diagnostics for hidden debug mode.
 */
export function detectPitchWithDebug(buffer: AudioBuffer): { note: string | null; debug: PitchDebugInfo } {
  const pcm = buffer.getChannelData(0);
  const sourceRate = buffer.sampleRate;

  // Analyze a bit longer for better stability on sustained tones
  const analysisDuration = 1.2;
  const maxSamples = Math.min(pcm.length, Math.round(sourceRate * analysisDuration));
  if (maxSamples < 512) {
    return {
      note: null,
      debug: {
        detectedFrequency: null,
        detectedNote: null,
        detections: 0,
        avgClarity: 0,
        avgZcr: 0,
        spreadRatio: null,
        rejectedReason: 'too-short',
        analysisRate: sourceRate,
        downsampleFactor: 1,
      },
    };
  }

  // Basic level gate
  let rms = 0;
  for (let i = 0; i < maxSamples; i++) rms += pcm[i] * pcm[i];
  rms = Math.sqrt(rms / maxSamples);
  if (rms < 0.01) {
    return {
      note: null,
      debug: {
        detectedFrequency: null,
        detectedNote: null,
        detections: 0,
        avgClarity: 0,
        avgZcr: 0,
        spreadRatio: null,
        rejectedReason: 'too-quiet',
        analysisRate: sourceRate,
        downsampleFactor: 1,
      },
    };
  }

  // Skip attack transient (adaptive): keep enough body for very short sounds
  const desiredSkip = Math.round(sourceRate * 0.07);
  const maxSkipForLength = Math.max(0, maxSamples - 512);
  const skipSamples = Math.min(desiredSkip, Math.floor(maxSamples * 0.2), maxSkipForLength);
  if (maxSamples - skipSamples < 512) {
    return {
      note: null,
      debug: {
        detectedFrequency: null,
        detectedNote: null,
        detections: 0,
        avgClarity: 0,
        avgZcr: 0,
        spreadRatio: null,
        rejectedReason: 'no-sustain',
        analysisRate: sourceRate,
        downsampleFactor: 1,
      },
    };
  }

  // Downsample to ~12 kHz for better pitch resolution
  const targetRate = 12_000;
  const downsampleFactor = Math.max(1, Math.floor(sourceRate / targetRate));
  const analysisRate = sourceRate / downsampleFactor;
  const analysisPcm = downsampleMono(pcm.subarray(skipSamples, maxSamples), downsampleFactor);

  const windowSize = Math.min(analysisPcm.length, Math.round(analysisRate * 0.06)); // 60 ms
  if (windowSize < 192) {
    return {
      note: null,
      debug: {
        detectedFrequency: null,
        detectedNote: null,
        detections: 0,
        avgClarity: 0,
        avgZcr: 0,
        spreadRatio: null,
        rejectedReason: 'window-too-small',
        analysisRate,
        downsampleFactor,
      },
    };
  }

  const analyzedDurationSec = maxSamples / sourceRate;

  const maxWindows = 6;
  const stride = Math.max(1, Math.floor((analysisPcm.length - windowSize) / maxWindows));
  const detections: Array<{ freq: number; clarity: number }> = [];
  const zcrValues: number[] = [];

  for (let offset = 0; offset + windowSize <= analysisPcm.length; offset += stride) {
    // Noise/percussive rejection: high ZCR usually indicates unpitched content
    const zcr = computeZeroCrossingRate(analysisPcm, offset, windowSize);
    zcrValues.push(zcr);
    const zcrGate = analyzedDurationSec < 0.12 ? 0.22 : 0.15;
    if (zcr > zcrGate) continue;

    const detection = mpmDetectWindow(analysisPcm, offset, windowSize, analysisRate);
    if (detection) detections.push(detection);
    if (detections.length >= maxWindows) break;
  }

  const avgZcr = zcrValues.length > 0
    ? zcrValues.reduce((sum, value) => sum + value, 0) / zcrValues.length
    : 0;

  // Need consistent windows across the sample (adaptive for short material)
  const minDetections = analyzedDurationSec < 0.12 ? 1 : analyzedDurationSec < 0.25 ? 2 : 3;

  if (detections.length === 0) {
    return {
      note: null,
      debug: {
        detectedFrequency: null,
        detectedNote: null,
        detections: 0,
        avgClarity: 0,
        avgZcr,
        spreadRatio: null,
        rejectedReason: 'no-detections',
        analysisRate,
        downsampleFactor,
      },
    };
  }

  if (detections.length < minDetections) {
    const avgClarityFew = detections.reduce((sum, d) => sum + d.clarity, 0) / detections.length;
    return {
      note: null,
      debug: {
        detectedFrequency: null,
        detectedNote: null,
        detections: detections.length,
        avgClarity: avgClarityFew,
        avgZcr,
        spreadRatio: null,
        rejectedReason: 'not-enough-consistent-windows',
        analysisRate,
        downsampleFactor,
      },
    };
  }

  const freqs = detections.map((d) => d.freq).sort((a, b) => a - b);
  const q1 = freqs[Math.floor((freqs.length - 1) * 0.25)];
  const q3 = freqs[Math.floor((freqs.length - 1) * 0.75)];
  const spreadRatio = q1 > 0 ? q3 / q1 : null;
  const avgClarity = detections.reduce((sum, d) => sum + d.clarity, 0) / detections.length;

  const midiBins = freqs.map((freq) => Math.round(12 * Math.log2(freq / 440) + 69));
  const midiCounts = new Map<number, number>();
  for (const midi of midiBins) {
    midiCounts.set(midi, (midiCounts.get(midi) ?? 0) + 1);
  }
  let modeMidi = midiBins[0] ?? 0;
  let modeCount = 0;
  for (const [midi, count] of midiCounts.entries()) {
    if (count > modeCount) {
      modeCount = count;
      modeMidi = midi;
    }
  }
  const modeRatio = detections.length > 0 ? modeCount / detections.length : 0;
  const hasConsensus = modeCount >= 2 && modeRatio >= 0.4;

  const spreadGate = analyzedDurationSec < 0.2 ? 1.45 : detections.length < 4 ? 1.35 : 1.28;
  if (spreadRatio !== null && spreadRatio > spreadGate && !hasConsensus) {
    return {
      note: null,
      debug: {
        detectedFrequency: null,
        detectedNote: null,
        detections: detections.length,
        avgClarity,
        avgZcr,
        spreadRatio,
        rejectedReason: 'inconsistent-frequency',
        analysisRate,
        downsampleFactor,
      },
    };
  }

  const clarityGate = analyzedDurationSec < 0.12 ? 0.62 : 0.72;
  if (avgClarity < clarityGate) {
    return {
      note: null,
      debug: {
        detectedFrequency: null,
        detectedNote: null,
        detections: detections.length,
        avgClarity,
        avgZcr,
        spreadRatio,
        rejectedReason: 'low-clarity',
        analysisRate,
        downsampleFactor,
      },
    };
  }

  const consensusFreq = 440 * (2 ** ((modeMidi - 69) / 12));
  const medianFreq = hasConsensus ? consensusFreq : freqs[Math.floor(freqs.length / 2)];

  const midiNote = Math.round(12 * Math.log2(medianFreq / 440) + 69);

  if (medianFreq >= D6_FREQUENCY || midiNote >= 86) {
    return {
      note: null,
      debug: {
        detectedFrequency: null,
        detectedNote: null,
        detections: detections.length,
        avgClarity,
        avgZcr,
        spreadRatio,
        rejectedReason: 'above-max-fundamental',
        analysisRate,
        downsampleFactor,
      },
    };
  }

  // High-frequency safeguard: don't trust high note detections unless highly stable.
  // This keeps legitimate high tones while rejecting BD/HH attack artifacts.
  if (medianFreq > 520) {
    const highFreqReliable =
      detections.length >= 4 &&
      avgClarity >= 0.84 &&
      avgZcr <= 0.1 &&
      spreadRatio !== null &&
      spreadRatio <= 1.08;

    if (!highFreqReliable) {
      return {
        note: null,
        debug: {
          detectedFrequency: null,
          detectedNote: null,
          detections: detections.length,
          avgClarity,
          avgZcr,
          spreadRatio,
          rejectedReason: 'high-freq-unreliable',
          analysisRate,
          downsampleFactor,
        },
      };
    }
  }

  const note = frequencyToNote(medianFreq);

  if (!note) {
    return {
      note: null,
      debug: {
        detectedFrequency: null,
        detectedNote: null,
        detections: detections.length,
        avgClarity,
        avgZcr,
        spreadRatio,
        rejectedReason: 'note-out-of-range',
        analysisRate,
        downsampleFactor,
      },
    };
  }

  return {
    note,
    debug: {
      detectedFrequency: medianFreq,
      detectedNote: note,
      detections: detections.length,
      avgClarity,
      avgZcr,
      spreadRatio,
      rejectedReason: null,
      analysisRate,
      downsampleFactor,
    },
  };
}

/**
 * Downsample by simple box averaging (good enough for pitch analysis).
 */
function downsampleMono(input: Float32Array, factor: number): Float32Array {
  if (factor <= 1) return input;
  const outLength = Math.floor(input.length / factor);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    let sum = 0;
    const start = i * factor;
    for (let j = 0; j < factor; j++) sum += input[start + j];
    out[i] = sum / factor;
  }
  return out;
}

/**
 * Compute zero-crossing rate for a window.
 */
function computeZeroCrossingRate(
  pcm: Float32Array,
  offset: number,
  windowSize: number,
): number {
  let crossings = 0;
  for (let i = offset + 1; i < offset + windowSize; i++) {
    const a = pcm[i - 1];
    const b = pcm[i];
    if ((a >= 0 && b < 0) || (a < 0 && b >= 0)) crossings++;
  }
  return crossings / (windowSize - 1);
}

/**
 * McLeod Pitch Method (MPM) on a single window.
 * Returns frequency + clarity, or null if no reliable pitch.
 */
function mpmDetectWindow(
  pcm: Float32Array,
  offset: number,
  windowSize: number,
  sampleRate: number,
): { freq: number; clarity: number } | null {
  // Restrict to realistic pack content range to avoid high-octave false positives.
  const minHz = 55;   // A1
  const maxHz = 1100; // broad range; high-frequency reliability filtering happens later

  const minPeriod = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxPeriod = Math.min(windowSize - 1, Math.floor(sampleRate / minHz));

  if (minPeriod >= maxPeriod) return null;

  const nsdf = new Float32Array(maxPeriod + 1);
  for (let tau = minPeriod; tau <= maxPeriod; tau++) {
    let d = 0;
    let m = 0;
    const len = windowSize - tau;
    for (let i = 0; i < len; i++) {
      const a = pcm[offset + i];
      const b = pcm[offset + i + tau];
      d += (a - b) * (a - b);
      m += a * a + b * b;
    }
    nsdf[tau] = m > 0 ? 1 - d / m : 0;
  }

  interface Peak { tau: number; value: number }
  const peaks: Peak[] = [];
  let wasNegative = true;
  let localMax = -Infinity;
  let localMaxTau = minPeriod;

  for (let tau = minPeriod; tau <= maxPeriod; tau++) {
    if (nsdf[tau] < 0) {
      if (!wasNegative && localMax > 0) {
        peaks.push({ tau: localMaxTau, value: localMax });
      }
      wasNegative = true;
      localMax = -Infinity;
    } else {
      wasNegative = false;
      if (nsdf[tau] > localMax) {
        localMax = nsdf[tau];
        localMaxTau = tau;
      }
    }
  }
  if (!wasNegative && localMax > 0) {
    peaks.push({ tau: localMaxTau, value: localMax });
  }

  if (peaks.length === 0) return null;

  let globalMax = 0;
  for (const p of peaks) {
    if (p.value > globalMax) globalMax = p.value;
  }

  if (globalMax < 0.68) return null;

  // Select the largest-period peak among near-max peaks.
  // This biases toward the true fundamental instead of upper harmonics.
  const threshold = globalMax * 0.9;
  let bestPeak: Peak | null = null;
  for (const p of peaks) {
    if (p.value >= threshold) {
      bestPeak = p;
    }
  }

  if (!bestPeak) return null;

  const tau = bestPeak.tau;
  if (tau > minPeriod && tau < maxPeriod) {
    const y0 = nsdf[tau - 1];
    const y1 = nsdf[tau];
    const y2 = nsdf[tau + 1];
    const denom = 2 * (2 * y1 - y0 - y2);
    if (Math.abs(denom) > 1e-12) {
      const shift = (y0 - y2) / denom;
      const refinedPeriod = Math.max(minPeriod, Math.min(maxPeriod, tau + Math.max(-1, Math.min(1, shift))));
      return { freq: sampleRate / refinedPeriod, clarity: bestPeak.value };
    }
  }

  return { freq: sampleRate / tau, clarity: bestPeak.value };
}

/**
 * Apply a linear crossfade to a looped region of PCM data.
 * When crossfadeAtStart is false/undefined (default): blends the tail of the loop
 * with audio from BEFORE the loop start point.
 * When crossfadeAtStart is true: blends the beginning of the loop
 * with audio from AFTER the loop end point.
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

  if (loop.crossfadeAtStart) {
    // Crossfade at the START of the loop region:
    // Fade in the first N samples of the loop, fade out N samples from after the end
    for (let i = 0; i < crossfadeSamples; i++) {
      const fadeIn = i / crossfadeSamples;       // 0 → 1
      const fadeOut = 1 - i / crossfadeSamples;  // 1 → 0

      const startIdx = loopStartSample + i;
      const postEndIdx = loopEndSample + i;
      const postEndSample = (postEndIdx >= 0 && postEndIdx < pcm.length)
        ? pcm[postEndIdx]
        : 0;

      if (startIdx >= 0 && startIdx < result.length) {
        result[startIdx] = result[startIdx] * fadeIn + postEndSample * fadeOut;
      }
    }
  } else {
    // Crossfade at the END of the loop region (default):
    // Fade out the last N samples of the loop, fade in N samples from before the start
    for (let i = 0; i < crossfadeSamples; i++) {
      const fadeOut = 1 - i / crossfadeSamples; // 1 → 0
      const fadeIn = i / crossfadeSamples;       // 0 → 1

      const endIdx = loopEndSample - crossfadeSamples + i;
      const preStartIdx = loopStartSample - crossfadeSamples + i;
      const preStartSample = (preStartIdx >= 0 && preStartIdx < result.length)
        ? pcm[preStartIdx]
        : 0;

      if (endIdx >= 0 && endIdx < result.length) {
        result[endIdx] = result[endIdx] * fadeOut + preStartSample * fadeIn;
      }
    }
  }

  return result;
}
