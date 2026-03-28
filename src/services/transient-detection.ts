/**
 * Transient detection and slicing utilities for the sample editor.
 */

/**
 * Detect transient onsets in an audio buffer using spectral flux onset detection.
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

  // Use multi-band energy for better transient detection
  const windowSize = Math.round(sampleRate * 0.01); // 10ms window
  const hopSize = Math.round(windowSize / 4); // 75% overlap for better time resolution
  const numFrames = Math.floor((channelData.length - windowSize) / hopSize);

  if (numFrames < 4) return [];

  // Split into 3 frequency bands using simple filtering
  // Band 1: low (DC–500Hz), Band 2: mid (500–4000Hz), Band 3: high (4000Hz+)
  // Approximate by computing energy in different sample regions of each window
  const bandEnergy = [
    new Float32Array(numFrames),
    new Float32Array(numFrames),
    new Float32Array(numFrames),
  ];

  for (let f = 0; f < numFrames; f++) {
    const offset = f * hopSize;
    // Simple approach: compute energy with different weighting
    // Use differences between consecutive samples as a high-pass proxy
    let lowSum = 0;
    let midSum = 0;
    let highSum = 0;

    for (let i = 0; i < windowSize; i++) {
      const s = channelData[offset + i];
      const sPrev = i > 0 ? channelData[offset + i - 1] : 0;
      const sPrev2 = i > 1 ? channelData[offset + i - 2] : 0;
      const diff1 = s - sPrev; // first-order difference ≈ high frequencies
      const diff2 = diff1 - (sPrev - sPrev2); // second-order ≈ very high frequencies

      lowSum += s * s;
      midSum += diff1 * diff1;
      highSum += diff2 * diff2;
    }

    bandEnergy[0][f] = lowSum / windowSize;
    bandEnergy[1][f] = midSum / windowSize;
    bandEnergy[2][f] = highSum / windowSize;
  }

  // Compute onset detection function: sum of positive energy flux across all bands
  const odf = new Float32Array(numFrames);
  for (let f = 1; f < numFrames; f++) {
    let totalFlux = 0;
    for (let b = 0; b < 3; b++) {
      const diff = bandEnergy[b][f] - bandEnergy[b][f - 1];
      if (diff > 0) totalFlux += diff;
    }
    odf[f] = totalFlux;
  }

  // Normalize ODF
  let maxOdf = 0;
  for (let f = 0; f < numFrames; f++) {
    if (odf[f] > maxOdf) maxOdf = odf[f];
  }
  if (maxOdf > 0) {
    for (let f = 0; f < numFrames; f++) {
      odf[f] /= maxOdf;
    }
  }

  // Adaptive threshold: moving mean + offset controlled by sensitivity
  // sensitivity 0 → high offset (few onsets), sensitivity 1 → low offset (many onsets)
  const thresholdOffset = 0.3 - sensitivity * 0.28; // 0→0.30, 1→0.02
  const meanWindow = Math.max(3, Math.round(sampleRate * 0.15 / hopSize)); // ~150ms

  const threshold = new Float32Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    const start = Math.max(0, f - meanWindow);
    const end = Math.min(numFrames, f + meanWindow + 1);
    let sum = 0;
    for (let w = start; w < end; w++) {
      sum += odf[w];
    }
    const mean = sum / (end - start);
    threshold[f] = mean + thresholdOffset;
  }

  // Peak-picking: find local maxima of ODF that exceed threshold
  const minOnsetGap = Math.round(sampleRate * 0.05 / hopSize); // 50ms minimum gap
  const onsets: Array<{ time: number; strength: number }> = [];

  for (let f = 2; f < numFrames - 1; f++) {
    // Must be a local maximum
    if (odf[f] <= odf[f - 1] || odf[f] < odf[f + 1]) continue;
    // Must exceed threshold
    if (odf[f] <= threshold[f]) continue;
    // Must exceed an absolute minimum
    if (odf[f] < 0.01) continue;

    const timeInSeconds = (f * hopSize) / sampleRate;

    // Enforce minimum gap
    if (onsets.length > 0 && (f - Math.round(onsets[onsets.length - 1].time * sampleRate / hopSize)) < minOnsetGap) {
      // Keep the stronger one
      if (odf[f] > onsets[onsets.length - 1].strength) {
        onsets[onsets.length - 1] = { time: timeInSeconds, strength: odf[f] };
      }
      continue;
    }

    onsets.push({ time: timeInSeconds, strength: odf[f] });
  }

  // Limit to maxSlices - 1 boundaries by keeping the strongest
  let result = onsets;
  if (result.length > maxSlices - 1) {
    result.sort((a, b) => b.strength - a.strength);
    result = result.slice(0, maxSlices - 1);
  }

  return result.sort((a, b) => a.time - b.time).map((o) => o.time);
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
