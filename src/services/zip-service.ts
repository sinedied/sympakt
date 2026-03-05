import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import {
  Sample,
  PackMetadata,
  SlotMetadata,
  ExportOptions,
  MAX_SAMPLE_DURATION,
  MAX_SLOTS,
  METADATA_FILENAME,
  DUAL_SPLIT_SILENCE,
  getLofiSpeedFactor,
  getEffectiveMaxDuration,
  getSplitMaxDuration,
  isLofiActive,
  normalizeLofiMode,
} from '../types/index.js';
import type { LofiMode, SplitSample } from '../types/index.js';
import {
  decodeAudioFile,
  resampleToExportFormat,
  generateWaveformData,
  getMonoPCM,
  applyCrossfade,
  detectPitchWithDebug,
} from './audio-engine.js';
import { encodeWav } from './wav-encoder.js';

/**
 * Build dual-split PCM: A in first half, B reversed in second half, silence in between.
 * The total length is always MAX_SAMPLE_DURATION * speedFactor (in export time domain = MAX_SAMPLE_DURATION samples).
 * Layout: [A pcm][silence][B reversed from end]
 */
async function exportDualSplitPCM(sample: Sample, speedFactor: number): Promise<Float32Array> {
  const sampleRate = 48_000; // EXPORT_SAMPLE_RATE
  const totalSamples = Math.round(MAX_SAMPLE_DURATION * sampleRate);
  const silenceSamples = Math.round(DUAL_SPLIT_SILENCE * sampleRate);
  const halfMaxSamples = Math.floor((totalSamples - silenceSamples) / 2);

  const result = new Float32Array(totalSamples); // initialized to 0 (silence)

  // --- Process A sample ---
  const exportBufferA = await resampleToExportFormat(sample.audioBuffer, speedFactor);
  let pcmA = getMonoPCM(exportBufferA);

  if (sample.loop) {
    const sf = speedFactor;
    const loopA = isLofiActive(sample.lofi)
      ? { startTime: sample.loop.startTime / sf, endTime: sample.loop.endTime / sf, crossfadeDuration: sample.loop.crossfadeDuration / sf }
      : sample.loop;
    if (loopA.crossfadeDuration > 0) {
      pcmA = applyCrossfade(pcmA, loopA, exportBufferA.sampleRate);
    }
    const startSample = Math.round(loopA.startTime * exportBufferA.sampleRate);
    const endSample = Math.round(loopA.endTime * exportBufferA.sampleRate);
    pcmA = pcmA.slice(startSample, Math.min(endSample, pcmA.length));
  }
  // Truncate A to half max
  if (pcmA.length > halfMaxSamples) {
    pcmA = pcmA.slice(0, halfMaxSamples);
  }
  // Write A at the beginning
  result.set(pcmA, 0);

  // --- Process B sample (reversed, aligned to end) ---
  if (sample.splitSample) {
    const exportBufferB = await resampleToExportFormat(sample.splitSample.audioBuffer, speedFactor);
    let pcmB = getMonoPCM(exportBufferB);

    if (sample.splitSample.loop) {
      const sf = speedFactor;
      const loopB = isLofiActive(sample.lofi)
        ? { startTime: sample.splitSample.loop.startTime / sf, endTime: sample.splitSample.loop.endTime / sf, crossfadeDuration: sample.splitSample.loop.crossfadeDuration / sf }
        : sample.splitSample.loop;
      if (loopB.crossfadeDuration > 0) {
        pcmB = applyCrossfade(pcmB, loopB, exportBufferB.sampleRate);
      }
      const startSample = Math.round(loopB.startTime * exportBufferB.sampleRate);
      const endSample = Math.round(loopB.endTime * exportBufferB.sampleRate);
      pcmB = pcmB.slice(startSample, Math.min(endSample, pcmB.length));
    }
    // Truncate B to half max
    if (pcmB.length > halfMaxSamples) {
      pcmB = pcmB.slice(0, halfMaxSamples);
    }

    // Reverse B
    const reversedB = new Float32Array(pcmB.length);
    for (let i = 0; i < pcmB.length; i++) {
      reversedB[i] = pcmB[pcmB.length - 1 - i];
    }

    // Write reversed B aligned to the end of the total buffer
    const bOffset = totalSamples - reversedB.length;
    result.set(reversedB, bOffset);
  }

  return result;
}

/**
 * Export the sample bank as a .zip file and trigger download.
 */
export async function exportSamplePack(
  slots: ReadonlyArray<Sample | null>,
  options: ExportOptions,
): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};
  const slotMetadata: SlotMetadata[] = [];

  for (let i = 0; i < slots.length; i++) {
    const sample = slots[i];
    if (!sample) continue;

    const slotNumber = String(i + 1).padStart(2, '0');
    const speedFactor = getLofiSpeedFactor(sample.lofi);
    let pcm: Float32Array;

    if (sample.splitEnabled) {
      // --- Dual split export ---
      pcm = await exportDualSplitPCM(sample, speedFactor);
    } else {
      // --- Normal single sample export ---
      const exportBuffer = await resampleToExportFormat(sample.audioBuffer, speedFactor);
      pcm = getMonoPCM(exportBuffer);

      if (sample.loop) {
        const sf = speedFactor;
        const loopForExport = isLofiActive(sample.lofi)
          ? {
              startTime: sample.loop.startTime / sf,
              endTime: sample.loop.endTime / sf,
              crossfadeDuration: sample.loop.crossfadeDuration / sf,
            }
          : sample.loop;
        if (loopForExport.crossfadeDuration > 0) {
          pcm = applyCrossfade(pcm, loopForExport, exportBuffer.sampleRate);
        }
        const startSample = Math.round(loopForExport.startTime * exportBuffer.sampleRate);
        const endSample = Math.round(loopForExport.endTime * exportBuffer.sampleRate);
        pcm = pcm.slice(startSample, Math.min(endSample, pcm.length));
      } else {
        const maxSamples = Math.round(MAX_SAMPLE_DURATION * exportBuffer.sampleRate);
        if (pcm.length > maxSamples) {
          pcm = pcm.slice(0, maxSamples);
        }
      }
    }

    // Normalize PCM to maximize volume without clipping
    if (options.normalizeOnExport) {
      let peak = 0;
      for (let j = 0; j < pcm.length; j++) {
        const abs = Math.abs(pcm[j]);
        if (abs > peak) peak = abs;
      }
      if (peak > 0 && peak < 1) {
        const gain = 1 / peak;
        for (let j = 0; j < pcm.length; j++) {
          pcm[j] *= gain;
        }
      }
    }

    let exportName: string;
    if (sample.splitEnabled) {
      const bName = sample.splitSample ? sanitizeFilename(sample.splitSample.name) : 'empty';
      exportName = `${slotNumber}_${sanitizeFilename(sample.name)}-${bName}_DUAL.wav`;
    } else {
      const noteSuffix = sample.detectedNote ? `_${sample.detectedNote}` : '';
      exportName = `${slotNumber}_${sanitizeFilename(sample.name)}${noteSuffix}.wav`;
    }
    const wavData = encodeWav(pcm);
    files[exportName] = new Uint8Array(wavData);

    const meta: SlotMetadata = {
      slot: i + 1,
      name: sample.name,
      originalFileName: sample.originalFileName,
      duration: sample.loop
        ? sample.loop.endTime - sample.loop.startTime
        : Math.min(sample.duration, sample.splitEnabled ? getSplitMaxDuration(sample.lofi) : getEffectiveMaxDuration(sample.lofi)),
      isTruncated: sample.isTruncated,
      loop: sample.loop ?? undefined,
      lofi: isLofiActive(sample.lofi) ? sample.lofi : undefined,
      detectedNote: sample.detectedNote ?? undefined,
      splitEnabled: sample.splitEnabled || undefined,
    };

    if (sample.splitEnabled && sample.splitSample) {
      meta.splitSample = {
        name: sample.splitSample.name,
        originalFileName: sample.splitSample.originalFileName,
        duration: sample.splitSample.loop
          ? sample.splitSample.loop.endTime - sample.splitSample.loop.startTime
          : Math.min(sample.splitSample.duration, getSplitMaxDuration(sample.lofi)),
        isTruncated: sample.splitSample.isTruncated,
        loop: sample.splitSample.loop ?? undefined,
        detectedNote: sample.splitSample.detectedNote ?? undefined,
      };
    }

    // Optionally include original files
    if (options.includeOriginals) {
      const originalPath = `originals/${sample.originalFileName}`;
      files[originalPath] = sample.originalFile;
      meta.originalFilePath = originalPath;

      if (sample.splitEnabled && sample.splitSample) {
        const bOrigPath = `originals/split_b_${sample.splitSample.originalFileName}`;
        files[bOrigPath] = sample.splitSample.originalFile;
        meta.splitSample!.originalFilePath = bOrigPath;
      }
    }

    slotMetadata.push(meta);
  }

  // Only include metadata when originals are present (needed for re-import with edits)
  if (options.includeOriginals) {
    const metadata: PackMetadata = {
      name: options.packName || 'Untitled Pack',
      version: 1,
      createdAt: new Date().toISOString(),
      includeOriginals: options.includeOriginals,
      slots: slotMetadata,
    };

    files[METADATA_FILENAME] = strToU8(JSON.stringify(metadata, null, 2));
  }

  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}

/**
 * Import a .zip file and return an array of samples keyed by slot index.
 * Returns a sparse array where populated slots have Sample objects.
 */
export async function importSamplePack(
  file: File,
  enablePitchDetection = false,
): Promise<{ slots: (Sample | null)[]; packName: string; includeOriginals: boolean; warning?: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const unzipped = unzipSync(new Uint8Array(arrayBuffer));

  // Try to read metadata
  let metadata: PackMetadata | null = null;
  const metaBytes = unzipped[METADATA_FILENAME];
  if (metaBytes) {
    try {
      metadata = JSON.parse(strFromU8(metaBytes)) as PackMetadata;
    } catch {
      // Ignore invalid metadata
    }
  }

  // Collect WAV files (excluding originals/, __MACOSX/ resource forks, and empty entries)
  const wavEntries: { filename: string; basename: string; data: Uint8Array; slotIndex: number }[] = [];

  for (const [filename, data] of Object.entries(unzipped)) {
    if (!filename.toLowerCase().endsWith('.wav')) continue;
    if (filename.startsWith('originals/')) continue;
    if (filename.includes('__MACOSX/')) continue;
    if (data.length === 0) continue;

    const basename = filename.split('/').pop() || filename;
    // Skip macOS resource fork files (._prefix can appear outside __MACOSX/)
    if (basename.startsWith('._')) continue;

    // Try to extract slot number from filename pattern: <number>_name.wav
    const match = basename.match(/^(\d+)_/);
    const slotIndex = match ? parseInt(match[1], 10) - 1 : -1;

    wavEntries.push({ filename, basename, data, slotIndex });
  }

  // Sort: entries with valid slot indices first (by index), then the rest in order
  wavEntries.sort((a, b) => {
    if (a.slotIndex >= 0 && b.slotIndex >= 0) return a.slotIndex - b.slotIndex;
    if (a.slotIndex >= 0) return -1;
    if (b.slotIndex >= 0) return 1;
    return 0;
  });

  // Warn if more than 64 WAV files found (only relevant without metadata)
  let warning: string | undefined;
  if (!metadata && wavEntries.length > MAX_SLOTS) {
    warning = `ZIP contains ${wavEntries.length} WAV files. Only the first ${MAX_SLOTS} will be loaded.`;
  }

  const slots: (Sample | null)[] = new Array(MAX_SLOTS).fill(null);
  let nextSlot = 0;
  let loaded = 0;

  for (const entry of wavEntries) {
    if (loaded >= MAX_SLOTS) break;

    // Determine target slot
    let targetSlot: number;
    if (entry.slotIndex >= 0 && entry.slotIndex < MAX_SLOTS && slots[entry.slotIndex] === null) {
      targetSlot = entry.slotIndex;
    } else {
      while (nextSlot < MAX_SLOTS && slots[nextSlot] !== null) nextSlot++;
      if (nextSlot >= MAX_SLOTS) break;
      targetSlot = nextSlot;
    }

    // Determine name and original file info from metadata if available
    const slotMeta = entry.slotIndex >= 0
      ? metadata?.slots.find((s) => s.slot === entry.slotIndex + 1)
      : undefined;
    const name = slotMeta?.name ?? stripExtension(entry.basename.replace(/^\d+_/, ''));
    const originalFileName = slotMeta?.originalFileName ?? entry.basename;

    // Prefer original file for decoding if available
    let originalFile = entry.data;
    let audioSourceData: ArrayBuffer;
    if (slotMeta?.originalFilePath && unzipped[slotMeta.originalFilePath]) {
      originalFile = unzipped[slotMeta.originalFilePath];
    }
    // Slice a copy for decoding — decodeAudioData detaches the buffer
    audioSourceData = (originalFile.buffer as ArrayBuffer).slice(
      originalFile.byteOffset,
      originalFile.byteOffset + originalFile.byteLength,
    );

    try {
      const audioBuffer = await decodeAudioFile(audioSourceData);
      const resampled = await resampleToExportFormat(audioBuffer);
      const waveformData = generateWaveformData(resampled);

      const lofiMode = normalizeLofiMode(slotMeta?.lofi);
      // When metadata is present, always use stored pitch and skip detection
      // to avoid overriding user-set values (including explicit "None")
      const pitchResult = metadata
        ? {
            note: slotMeta?.detectedNote ?? null,
            debug: slotMeta?.detectedNote
              ? {
                  detectedFrequency: null,
                  detectedNote: slotMeta.detectedNote,
                  detections: 0,
                  avgClarity: 0,
                  avgZcr: 0,
                  spreadRatio: null,
                  rejectedReason: 'from-metadata',
                  analysisRate: resampled.sampleRate,
                  downsampleFactor: 1,
                }
              : undefined,
          }
        : enablePitchDetection
          ? detectPitchWithDebug(resampled)
          : { note: null, debug: undefined };
      const sample: Sample = {
        id: crypto.randomUUID(),
        name,
        originalFileName,
        audioBuffer: resampled,
        waveformData,
        duration: audioBuffer.duration,
        isTruncated: slotMeta?.splitEnabled
          ? audioBuffer.duration > getSplitMaxDuration(lofiMode)
          : audioBuffer.duration > getEffectiveMaxDuration(lofiMode),
        originalFile,
        loop: slotMeta?.loop ?? null,
        lofi: lofiMode,
        detectedNote: pitchResult.note,
        pitchDebug: pitchResult.debug,
        splitEnabled: slotMeta?.splitEnabled ?? false,
      };

      // Restore B-side sample from metadata if split is enabled
      if (slotMeta?.splitEnabled && slotMeta?.splitSample) {
        const bMeta = slotMeta.splitSample;
        let bOriginalFile: Uint8Array | undefined;
        if (bMeta.originalFilePath && unzipped[bMeta.originalFilePath]) {
          bOriginalFile = unzipped[bMeta.originalFilePath];
        }
        if (bOriginalFile) {
          try {
            const bSourceData = (bOriginalFile.buffer as ArrayBuffer).slice(
              bOriginalFile.byteOffset,
              bOriginalFile.byteOffset + bOriginalFile.byteLength,
            );
            const bAudioBuffer = await decodeAudioFile(bSourceData);
            const bResampled = await resampleToExportFormat(bAudioBuffer);
            const bWaveformData = generateWaveformData(bResampled);
            const splitMaxDur = getSplitMaxDuration(lofiMode);
            sample.splitSample = {
              name: bMeta.name,
              originalFileName: bMeta.originalFileName,
              audioBuffer: bResampled,
              waveformData: bWaveformData,
              duration: bAudioBuffer.duration,
              isTruncated: bAudioBuffer.duration > splitMaxDur,
              originalFile: bOriginalFile,
              loop: bMeta.loop ?? null,
              detectedNote: bMeta.detectedNote ?? null,
            };
          } catch {
            console.warn(`Skipping unreadable split B file for slot ${targetSlot + 1}`);
          }
        }
      }

      slots[targetSlot] = sample;
      loaded++;
    } catch {
      console.warn(`Skipping unreadable file: ${entry.filename}`);
    }
  }

  return {
    slots,
    packName: metadata?.name ?? stripExtension(file.name),
    includeOriginals: metadata?.includeOriginals ?? false,
    warning,
  };
}

/**
 * Process a single audio file for import into a slot.
 */
export async function processAudioFile(file: File, enablePitchDetection = false): Promise<Sample> {
  const arrayBuffer = await file.arrayBuffer();
  const originalFile = new Uint8Array(arrayBuffer.slice(0));
  const audioBuffer = await decodeAudioFile(arrayBuffer);
  const resampled = await resampleToExportFormat(audioBuffer);
  const waveformData = generateWaveformData(audioBuffer);
  const pitchResult = enablePitchDetection ? detectPitchWithDebug(resampled) : { note: null, debug: undefined };

  return {
    id: crypto.randomUUID(),
    name: stripExtension(file.name),
    originalFileName: file.name,
    audioBuffer: resampled,
    waveformData,
    duration: audioBuffer.duration,
    isTruncated: audioBuffer.duration > MAX_SAMPLE_DURATION,
    originalFile,
    loop: null,
    lofi: 'off',
    detectedNote: pitchResult.note,
    pitchDebug: pitchResult.debug,
  };
}

/**
 * Process a single audio file for import as a B-side split sample.
 */
export async function processSplitAudioFile(
  file: File,
  lofiMode: LofiMode,
  enablePitchDetection = false,
): Promise<SplitSample> {
  const arrayBuffer = await file.arrayBuffer();
  const originalFile = new Uint8Array(arrayBuffer.slice(0));
  const audioBuffer = await decodeAudioFile(arrayBuffer);
  const resampled = await resampleToExportFormat(audioBuffer);
  const waveformData = generateWaveformData(audioBuffer);
  const splitMaxDur = getSplitMaxDuration(lofiMode);
  const pitchResult = enablePitchDetection ? detectPitchWithDebug(resampled) : { note: null, debug: undefined };

  return {
    name: stripExtension(file.name),
    originalFileName: file.name,
    audioBuffer: resampled,
    waveformData,
    duration: audioBuffer.duration,
    isTruncated: audioBuffer.duration > splitMaxDur,
    originalFile,
    loop: null,
    detectedNote: pitchResult.note,
    pitchDebug: pitchResult.debug,
  };
}

/** Trigger a download of a Blob */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-. ]/g, '_').trim();
}
