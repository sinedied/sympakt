import { EXPORT_CHANNELS } from '../types/index.js';

/**
 * Create a new AudioBuffer by copying data from a source buffer.
 * Optionally specify a different length (in frames).
 */
function cloneBuffer(buffer: AudioBuffer, length?: number): AudioBuffer {
  const len = length ?? buffer.length;
  const newBuf = new AudioBuffer({
    length: len,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = newBuf.getChannelData(ch);
    dst.set(src.subarray(0, Math.min(src.length, len)));
  }
  return newBuf;
}

/**
 * Trim an AudioBuffer to a start/end time range (seconds).
 * Returns a new AudioBuffer containing only the trimmed region.
 */
export function trimAudio(buffer: AudioBuffer, startTime: number, endTime: number): AudioBuffer {
  const sr = buffer.sampleRate;
  const startSample = Math.max(0, Math.round(startTime * sr));
  const endSample = Math.min(buffer.length, Math.round(endTime * sr));
  const length = endSample - startSample;

  if (length <= 0) {
    return new AudioBuffer({ length: 1, numberOfChannels: buffer.numberOfChannels, sampleRate: sr });
  }

  const newBuf = new AudioBuffer({
    length,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: sr,
  });

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = newBuf.getChannelData(ch);
    dst.set(src.subarray(startSample, endSample));
  }
  return newBuf;
}

/**
 * Reverse audio buffer. Returns a new reversed AudioBuffer.
 */
export function reverseAudio(buffer: AudioBuffer): AudioBuffer {
  const newBuf = cloneBuffer(buffer);
  for (let ch = 0; ch < newBuf.numberOfChannels; ch++) {
    const data = newBuf.getChannelData(ch);
    data.reverse();
  }
  return newBuf;
}

/**
 * Apply a linear fade-in to the audio buffer. Returns a new AudioBuffer.
 */
export function fadeIn(buffer: AudioBuffer, duration: number): AudioBuffer {
  if (duration <= 0) return cloneBuffer(buffer);
  const newBuf = cloneBuffer(buffer);
  const fadeSamples = Math.min(Math.round(duration * buffer.sampleRate), buffer.length);
  for (let ch = 0; ch < newBuf.numberOfChannels; ch++) {
    const data = newBuf.getChannelData(ch);
    for (let i = 0; i < fadeSamples; i++) {
      data[i] *= i / fadeSamples;
    }
  }
  return newBuf;
}

/**
 * Apply a linear fade-out to the audio buffer. Returns a new AudioBuffer.
 */
export function fadeOut(buffer: AudioBuffer, duration: number): AudioBuffer {
  if (duration <= 0) return cloneBuffer(buffer);
  const newBuf = cloneBuffer(buffer);
  const fadeSamples = Math.min(Math.round(duration * buffer.sampleRate), buffer.length);
  const fadeStart = buffer.length - fadeSamples;
  for (let ch = 0; ch < newBuf.numberOfChannels; ch++) {
    const data = newBuf.getChannelData(ch);
    for (let i = 0; i < fadeSamples; i++) {
      data[fadeStart + i] *= 1 - i / fadeSamples;
    }
  }
  return newBuf;
}

/**
 * Peak-normalize audio to 0 dBFS. Returns a new AudioBuffer.
 */
export function normalizeAudio(buffer: AudioBuffer): AudioBuffer {
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }
  if (peak === 0 || peak >= 0.9999) return cloneBuffer(buffer);

  const gain = 1 / peak;
  const newBuf = cloneBuffer(buffer);
  for (let ch = 0; ch < newBuf.numberOfChannels; ch++) {
    const data = newBuf.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      data[i] *= gain;
    }
  }
  return newBuf;
}

/**
 * Apply gain in dB to audio buffer. Returns a new AudioBuffer.
 */
export function applyGain(buffer: AudioBuffer, gainDb: number): AudioBuffer {
  if (gainDb === 0) return cloneBuffer(buffer);
  const multiplier = Math.pow(10, gainDb / 20);
  const newBuf = cloneBuffer(buffer);
  for (let ch = 0; ch < newBuf.numberOfChannels; ch++) {
    const data = newBuf.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.max(-1, Math.min(1, data[i] * multiplier));
    }
  }
  return newBuf;
}

/**
 * Reduce sample rate by resampling down then back up to the original rate.
 * Creates aliasing / lo-fi crunch effect.
 */
export async function reduceSampleRate(buffer: AudioBuffer, targetRate: number): Promise<AudioBuffer> {
  const originalRate = buffer.sampleRate;
  if (targetRate >= originalRate) return cloneBuffer(buffer);

  // Downsample to target rate
  const downLength = Math.ceil(buffer.duration * targetRate);
  const downCtx = new OfflineAudioContext(EXPORT_CHANNELS, downLength, targetRate);
  const src1 = downCtx.createBufferSource();
  src1.buffer = buffer;
  src1.connect(downCtx.destination);
  src1.start();
  const downsampled = await downCtx.startRendering();

  // Upsample back to original rate (creates aliasing/stepping)
  const upLength = Math.ceil(buffer.duration * originalRate);
  const upCtx = new OfflineAudioContext(EXPORT_CHANNELS, upLength, originalRate);
  const src2 = upCtx.createBufferSource();
  src2.buffer = downsampled;
  src2.connect(upCtx.destination);
  src2.start();
  return upCtx.startRendering();
}

/**
 * Reduce bit depth by quantizing float samples to N-bit resolution (1–16).
 * Returns a new AudioBuffer.
 */
export function reduceBitDepth(buffer: AudioBuffer, bits: number): AudioBuffer {
  const clampedBits = Math.max(1, Math.min(16, Math.round(bits)));
  if (clampedBits >= 16) return cloneBuffer(buffer);

  const levels = Math.pow(2, clampedBits);
  const newBuf = cloneBuffer(buffer);
  for (let ch = 0; ch < newBuf.numberOfChannels; ch++) {
    const data = newBuf.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      // Quantize: map [-1,1] to integer levels then back
      const normalized = (data[i] + 1) * 0.5; // 0..1
      const quantized = Math.round(normalized * (levels - 1)) / (levels - 1);
      data[i] = quantized * 2 - 1; // back to -1..1
    }
  }
  return newBuf;
}

/**
 * Apply a biquad filter (lowpass, highpass, or bandpass) using OfflineAudioContext.
 * Returns a new AudioBuffer.
 */
export async function applyFilter(
  buffer: AudioBuffer,
  type: BiquadFilterType,
  cutoff: number,
  resonance: number,
): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(
    EXPORT_CHANNELS,
    buffer.length,
    buffer.sampleRate,
  );

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = cutoff;
  filter.Q.value = resonance;

  source.connect(filter);
  filter.connect(ctx.destination);
  source.start();

  return ctx.startRendering();
}

/**
 * Apply the full chain of effects to a buffer in sequence.
 * Returns a new AudioBuffer with all effects applied.
 */
export async function applyEffectChain(
  buffer: AudioBuffer,
  options: {
    trimStart: number;
    trimEnd: number;
    reverse: boolean;
    fadeInDuration: number;
    fadeOutDuration: number;
    normalize: boolean;
    gainDb: number;
    sampleRateReduction: number;
    bitReduction: number;
    filterEnabled: boolean;
    filterType: BiquadFilterType;
    filterCutoff: number;
    filterResonance: number;
  },
): Promise<AudioBuffer> {
  let result = trimAudio(buffer, options.trimStart, options.trimEnd);

  if (options.reverse) {
    result = reverseAudio(result);
  }

  if (options.fadeInDuration > 0) {
    result = fadeIn(result, options.fadeInDuration);
  }

  if (options.fadeOutDuration > 0) {
    result = fadeOut(result, options.fadeOutDuration);
  }

  if (options.normalize) {
    result = normalizeAudio(result);
  }

  if (options.gainDb !== 0) {
    result = applyGain(result, options.gainDb);
  }

  if (options.sampleRateReduction < result.sampleRate) {
    result = await reduceSampleRate(result, options.sampleRateReduction);
  }

  if (options.bitReduction < 16) {
    result = reduceBitDepth(result, options.bitReduction);
  }

  if (options.filterEnabled) {
    result = await applyFilter(result, options.filterType, options.filterCutoff, options.filterResonance);
  }

  return result;
}
