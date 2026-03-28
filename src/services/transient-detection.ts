/**
 * Transient detection and slicing utilities for the sample editor.
 */

/**
 * Detect transient onsets in an audio buffer using energy-based onset detection.
 * Returns sorted array of onset times in seconds.
 *
 * @param buffer - The audio buffer to analyze
 * @param sensitivity - Detection sensitivity 0–1 (0 = fewer onsets, 1 = more onsets)
 * @param maxSlices - Maximum number of slices to return (default 64)
 */
export function detectTransients(
  buffer: AudioBuffer,
  sensitivity: number,
  maxSlices = 64,
): number[] {
  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  // Analysis parameters — window and hop scale with sensitivity
  const windowSize = Math.round(sampleRate * 0.01); // 10ms window
  const hopSize = Math.round(windowSize / 2);
  const numFrames = Math.floor((channelData.length - windowSize) / hopSize);

  if (numFrames < 2) return [];

  // Compute short-time energy for each frame
  const energy = new Float32Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    const offset = f * hopSize;
    let sum = 0;
    for (let i = 0; i < windowSize; i++) {
      const s = channelData[offset + i];
      sum += s * s;
    }
    energy[f] = sum / windowSize;
  }

  // Compute onset detection function (energy flux — positive differences only)
  const flux = new Float32Array(numFrames);
  for (let f = 1; f < numFrames; f++) {
    const diff = energy[f] - energy[f - 1];
    flux[f] = diff > 0 ? diff : 0;
  }

  // Adaptive threshold using a moving median + scaled offset
  const medianWindow = Math.round(sampleRate * 0.1 / hopSize); // ~100ms
  const thresholdScale = 1.5 - sensitivity * 1.3; // sensitivity 0→1.5, 1→0.2

  const onsets: number[] = [];
  const minOnsetGapSamples = Math.round(sampleRate * 0.03); // 30ms minimum gap between onsets

  for (let f = 1; f < numFrames; f++) {
    // Compute local median
    const start = Math.max(0, f - medianWindow);
    const end = Math.min(numFrames, f + medianWindow);
    const window: number[] = [];
    for (let w = start; w < end; w++) {
      window.push(flux[w]);
    }
    window.sort((a, b) => a - b);
    const median = window[Math.floor(window.length / 2)];

    // Dynamic threshold
    const threshold = median + thresholdScale * (median + 1e-8);

    if (flux[f] > threshold && flux[f] > 1e-8) {
      const timeInSeconds = (f * hopSize) / sampleRate;
      // Enforce minimum gap
      if (onsets.length === 0 || (timeInSeconds - onsets[onsets.length - 1]) > minOnsetGapSamples / sampleRate) {
        onsets.push(timeInSeconds);
      }
    }
  }

  // Limit to maxSlices - 1 boundaries (maxSlices total slices)
  if (onsets.length > maxSlices - 1) {
    // Keep most prominent onsets by sorting by flux strength and picking top N
    const onsetsWithStrength = onsets.map((t) => {
      const frame = Math.round((t * sampleRate) / hopSize);
      return { time: t, strength: flux[Math.min(frame, flux.length - 1)] };
    });
    onsetsWithStrength.sort((a, b) => b.strength - a.strength);
    const top = onsetsWithStrength.slice(0, maxSlices - 1);
    top.sort((a, b) => a.time - b.time);
    return top.map((o) => o.time);
  }

  return onsets;
}

/**
 * Create evenly spaced slice boundaries for a given duration.
 * Returns N-1 interior cut points for N slices.
 *
 * @param duration - Total audio duration in seconds
 * @param numSlices - Number of slices (2–64)
 */
export function createEvenSlices(duration: number, numSlices: number): number[] {
  const n = Math.max(2, Math.min(64, Math.round(numSlices)));
  const points: number[] = [];
  for (let i = 1; i < n; i++) {
    points.push((i / n) * duration);
  }
  return points;
}
