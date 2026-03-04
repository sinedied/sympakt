import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import {
  Sample,
  PackMetadata,
  SlotMetadata,
  ExportOptions,
  MAX_SAMPLE_DURATION,
  MAX_SLOTS,
  METADATA_FILENAME,
} from '../types/index.js';
import {
  decodeAudioFile,
  resampleToExportFormat,
  generateWaveformData,
  getMonoPCM,
  applyCrossfade,
} from './audio-engine.js';
import { encodeWav } from './wav-encoder.js';

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
    const exportName = `${slotNumber}_${sanitizeFilename(sample.name)}.wav`;

    // Resample to export format (48kHz mono)
    const exportBuffer = await resampleToExportFormat(sample.audioBuffer);
    let pcm = getMonoPCM(exportBuffer);

    if (sample.loop) {
      // Looped: apply crossfade then extract only the loop region
      if (sample.loop.crossfadeDuration > 0) {
        pcm = applyCrossfade(pcm, sample.loop, exportBuffer.sampleRate);
      }
      const startSample = Math.round(sample.loop.startTime * exportBuffer.sampleRate);
      const endSample = Math.round(sample.loop.endTime * exportBuffer.sampleRate);
      pcm = pcm.slice(startSample, Math.min(endSample, pcm.length));
    } else {
      // Non-looped: truncate to MAX_SAMPLE_DURATION
      const maxSamples = Math.round(MAX_SAMPLE_DURATION * exportBuffer.sampleRate);
      if (pcm.length > maxSamples) {
        pcm = pcm.slice(0, maxSamples);
      }
    }

    const wavData = encodeWav(pcm);
    files[exportName] = new Uint8Array(wavData);

    const meta: SlotMetadata = {
      slot: i + 1,
      name: sample.name,
      originalFileName: sample.originalFileName,
      duration: sample.loop
        ? sample.loop.endTime - sample.loop.startTime
        : Math.min(sample.duration, MAX_SAMPLE_DURATION),
      isTruncated: sample.isTruncated,
      loop: sample.loop ?? undefined,
    };

    // Optionally include original files
    if (options.includeOriginals) {
      const originalPath = `originals/${sample.originalFileName}`;
      files[originalPath] = sample.originalFile;
      meta.originalFilePath = originalPath;
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

  // Collect WAV files (excluding originals/ folder and metadata)
  const wavEntries: { filename: string; basename: string; data: Uint8Array; slotIndex: number }[] = [];

  for (const [filename, data] of Object.entries(unzipped)) {
    if (filename === METADATA_FILENAME) continue;
    if (filename.startsWith('originals/')) continue;
    if (!filename.toLowerCase().endsWith('.wav')) continue;

    const basename = filename.split('/').pop() || filename;

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

    const audioBuffer = await decodeAudioFile(audioSourceData);
    const resampled = await resampleToExportFormat(audioBuffer);
    const waveformData = generateWaveformData(resampled);

    const sample: Sample = {
      id: crypto.randomUUID(),
      name,
      originalFileName,
      audioBuffer: resampled,
      waveformData,
      duration: audioBuffer.duration,
      isTruncated: audioBuffer.duration > MAX_SAMPLE_DURATION,
      originalFile,
      loop: slotMeta?.loop ?? null,
    };

    slots[targetSlot] = sample;
    loaded++;
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
export async function processAudioFile(file: File): Promise<Sample> {
  const arrayBuffer = await file.arrayBuffer();
  const originalFile = new Uint8Array(arrayBuffer.slice(0));
  const audioBuffer = await decodeAudioFile(arrayBuffer);
  const resampled = await resampleToExportFormat(audioBuffer);
  const waveformData = generateWaveformData(audioBuffer);

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
