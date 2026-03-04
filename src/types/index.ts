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
}

/** Metadata stored in the exported JSON file */
export interface PackMetadata {
  name: string;
  version: number;
  createdAt: string;
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
export const METADATA_FILENAME = 'sympakt-metadata.json';
