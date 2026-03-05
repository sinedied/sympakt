/** LOFI mode: off = normal, lofi = 2× speed (10s max), xlofi = 4× speed (20s max) */
export type LofiMode = 'off' | 'lofi' | 'xlofi';

export interface PitchDebugInfo {
  detectedFrequency: number | null;
  detectedNote: string | null;
  detections: number;
  avgClarity: number;
  avgZcr: number;
  spreadRatio: number | null;
  rejectedReason: string | null;
  analysisRate: number;
  downsampleFactor: number;
}

/** Represents a single sample in the bank */
export interface Sample {
  /** Unique identifier */
  id: string;
  /** Display name (without extension) */
  name: string;
  /** Original file name as imported */
  originalFileName: string;
  /** Decoded audio buffer */
  audioBuffer: AudioBuffer;
  /** Waveform RMS data for rendering (0-1 per column) */
  waveformData: number[];
  /** Duration in seconds */
  duration: number;
  /** Whether the sample exceeds MAX_SAMPLE_DURATION */
  isTruncated: boolean;
  /** The original file bytes (kept for optional re-export) */
  originalFile: Uint8Array;
  /** Loop settings (null = no loop) */
  loop: LoopSettings | null;
  /** LOFI mode: off, lofi (2× speed, 10s max), or xlofi (4× speed, 20s max) */
  lofi: LofiMode;
  /** Auto-detected musical note (e.g. "C3", "A#4"), null if no clear pitch */
  detectedNote: string | null;
  /** Optional debug info from pitch detection analysis */
  pitchDebug?: PitchDebugInfo;
  /** Whether dual split mode is enabled for this slot */
  splitEnabled?: boolean;
  /** B-side sample data in dual split mode (null/undefined = no B sample) */
  splitSample?: SplitSample | null;
}

/** B-side sample in dual split mode */
export interface SplitSample {
  /** Display name (without extension) */
  name: string;
  /** Original file name as imported */
  originalFileName: string;
  /** Decoded audio buffer */
  audioBuffer: AudioBuffer;
  /** Waveform RMS data for rendering (0-1 per column) */
  waveformData: number[];
  /** Duration in seconds */
  duration: number;
  /** Whether the B sample exceeds the split max duration */
  isTruncated: boolean;
  /** The original file bytes */
  originalFile: Uint8Array;
  /** Loop settings (null = no loop) */
  loop: LoopSettings | null;
  /** Auto-detected musical note */
  detectedNote: string | null;
  /** Optional debug info from pitch detection analysis */
  pitchDebug?: PitchDebugInfo;
}

/** Loop point and crossfade settings for seamless looping */
export interface LoopSettings {
  /** Loop start time in seconds (snapped to zero crossing) */
  startTime: number;
  /** Loop end time in seconds (snapped to zero crossing) */
  endTime: number;
  /** Crossfade duration in seconds (0 = no crossfade, max = loop length) */
  crossfadeDuration: number;
}

/** Metadata stored in the exported JSON file */
export interface PackMetadata {
  name: string;
  version: number;
  createdAt: string;
  includeOriginals: boolean;
  slots: SlotMetadata[];
}

export interface SlotMetadata {
  slot: number;
  name: string;
  originalFileName: string;
  /** Path to the original file inside the ZIP (if included) */
  originalFilePath?: string;
  duration: number;
  isTruncated: boolean;
  /** Loop settings (omitted if no loop) */
  loop?: LoopSettings;
  /** LOFI mode (omitted or 'off' = normal) */
  lofi?: LofiMode | boolean;
  /** Auto-detected musical note (omitted if no clear pitch) */
  detectedNote?: string;
  /** Dual split mode enabled */
  splitEnabled?: boolean;
  /** B-side sample metadata in dual split */
  splitSample?: {
    name: string;
    originalFileName: string;
    originalFilePath?: string;
    duration: number;
    isTruncated: boolean;
    loop?: LoopSettings;
    detectedNote?: string;
  };
}

/** Export options presented to the user */
export interface ExportOptions {
  packName: string;
  includeOriginals: boolean;
  normalizeOnExport: boolean;
}

/** All musical notes from C0 to B7 for the note picker dropdown */
export const ALL_NOTES: string[] = (() => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const notes: string[] = [];
  for (let octave = 0; octave <= 7; octave++) {
    for (const n of names) notes.push(`${n}${octave}`);
  }
  return notes;
})();

/** Constants */
export const MAX_SLOTS = 64;
export const MAX_SAMPLE_DURATION = 5; // seconds
export const EXPORT_SAMPLE_RATE = 48_000;
export const EXPORT_BIT_DEPTH = 16;
export const EXPORT_CHANNELS = 1; // mono
export const WAVEFORM_COLUMNS = 200; // number of columns in waveform display
export const METADATA_FILENAME = 'sympakt.json';
export const LOFI_SPEED_FACTOR = 2; // playback speed multiplier for LOFI mode
export const XLOFI_SPEED_FACTOR = 4; // playback speed multiplier for XLOFI mode
export const DUAL_SPLIT_SILENCE = 0.020; // 20ms minimum silence between A and B in dual split

/** Get the speed factor for a given LOFI mode */
export function getLofiSpeedFactor(mode: LofiMode): number {
  switch (mode) {
    case 'xlofi': return XLOFI_SPEED_FACTOR;
    case 'lofi': return LOFI_SPEED_FACTOR;
    default: return 1;
  }
}

/** Get the effective max sample duration for a given LOFI mode */
export function getEffectiveMaxDuration(mode: LofiMode): number {
  return MAX_SAMPLE_DURATION * getLofiSpeedFactor(mode);
}

/** Whether any LOFI mode is active */
export function isLofiActive(mode: LofiMode): boolean {
  return mode !== 'off';
}

/** Get the max duration for each side of a dual split */
export function getSplitMaxDuration(mode: LofiMode): number {
  return (getEffectiveMaxDuration(mode) - DUAL_SPLIT_SILENCE) / 2;
}

/** Normalize legacy boolean lofi values to LofiMode */
export function normalizeLofiMode(value: LofiMode | boolean | undefined): LofiMode {
  if (value === true) return 'lofi';
  if (value === false || value === undefined) return 'off';
  return value;
}
