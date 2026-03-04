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
  /** Whether LOFI mode is enabled (2× speed export for 10s effective max duration) */
  lofi: boolean;
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
  /** Whether LOFI mode is enabled */
  lofi?: boolean;
}

/** Export options presented to the user */
export interface ExportOptions {
  packName: string;
  includeOriginals: boolean;
}

/** Constants */
export const MAX_SLOTS = 64;
export const MAX_SAMPLE_DURATION = 5; // seconds
export const EXPORT_SAMPLE_RATE = 48_000;
export const EXPORT_BIT_DEPTH = 16;
export const EXPORT_CHANNELS = 1; // mono
export const WAVEFORM_COLUMNS = 200; // number of columns in waveform display
export const METADATA_FILENAME = 'sympakt.json';
export const LOFI_SPEED_FACTOR = 2; // playback speed multiplier for LOFI mode
