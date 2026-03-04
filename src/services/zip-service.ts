import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import {
  Sample,
  PackMetadata,
  SlotMetadata,
  ExportOptions,
  MAX_SAMPLE_DURATION,
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

  // Add metadata JSON
  const metadata: PackMetadata = {
    name: options.packName || 'Untitled Pack',
    version: 1,
    createdAt: new Date().toISOString(),
    slots: slotMetadata,
  };

  files[METADATA_FILENAME] = strToU8(JSON.stringify(metadata, null, 2));

  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}

/**
 * Import a .zip file and return an array of samples keyed by slot index.
 * Returns a sparse array where populated slots have Sample objects.
 */
export async function importSamplePack(
  file: File,
): Promise<{ slots: (Sample | null)[]; packName: string }> {
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
  const wavEntries: { filename: string; data: Uint8Array; slotIndex: number }[] = [];

  for (const [filename, data] of Object.entries(unzipped)) {
    if (filename === METADATA_FILENAME) continue;
    if (filename.startsWith('originals/')) continue;
    if (!filename.toLowerCase().endsWith('.wav')) continue;

    // Try to extract slot number from filename pattern: NN_name.wav
    const match = filename.match(/^(\d{2})_/);
    const slotIndex = match ? parseInt(match[1], 10) - 1 : wavEntries.length;

    wavEntries.push({ filename, data, slotIndex });
  }

  // Sort by slot index
  wavEntries.sort((a, b) => a.slotIndex - b.slotIndex);

  const slots: (Sample | null)[] = new Array(64).fill(null);

  for (const entry of wavEntries) {
    if (entry.slotIndex < 0 || entry.slotIndex >= 64) continue;

    // Determine original filename from metadata if available
    const slotMeta = metadata?.slots.find((s) => s.slot === entry.slotIndex + 1);
    const name = slotMeta?.name ?? stripExtension(entry.filename.replace(/^\d{2}_/, ''));
    const originalFileName = slotMeta?.originalFileName ?? entry.filename;

    // Prefer original file for decoding if available
    let originalFile = entry.data;
    let audioSourceData: ArrayBuffer = entry.data.buffer as ArrayBuffer;
    if (slotMeta?.originalFilePath && unzipped[slotMeta.originalFilePath]) {
      originalFile = unzipped[slotMeta.originalFilePath];
      audioSourceData = originalFile.buffer as ArrayBuffer;
    }

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

    slots[entry.slotIndex] = sample;
  }

  return {
    slots,
    packName: metadata?.name ?? stripExtension(file.name),
  };
}

/**
 * Process a single audio file for import into a slot.
 */
export async function processAudioFile(file: File): Promise<Sample> {
  const arrayBuffer = await file.arrayBuffer();
  const originalFile = new Uint8Array(arrayBuffer);
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
