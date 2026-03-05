import type { Sample, LoopSettings, LofiMode } from '../types/index.js';
import { normalizeLofiMode } from '../types/index.js';
import { generateWaveformData } from './audio-engine.js';

const DB_NAME = 'sympakt-db';
const DB_VERSION = 1;
const SAMPLES_STORE = 'samples';
const SETTINGS_STORE = 'settings';

/** Serializable representation of a Sample (AudioBuffer → raw PCM) */
interface StoredSample {
  id: string;
  name: string;
  originalFileName: string;
  /** Raw PCM channel data */
  channelData: Float32Array[];
  sampleRate: number;
  numberOfChannels: number;
  bufferLength: number;
  duration: number;
  isTruncated: boolean;
  originalFile: Uint8Array;
  loop: LoopSettings | null;
  lofi: LofiMode | boolean;
  detectedNote: string | null;
}

/** Settings persisted across sessions */
export interface StoredSettings {
  packName?: string;
  includeOriginals?: boolean;
  pitchDetectionEnabled?: boolean;
  normalizeOnExport?: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SAMPLES_STORE)) {
        db.createObjectStore(SAMPLES_STORE, { keyPath: 'slot' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function serializeSample(sample: Sample): StoredSample {
  const buf = sample.audioBuffer;
  const channelData: Float32Array[] = [];
  for (let c = 0; c < buf.numberOfChannels; c++) {
    channelData.push(new Float32Array(buf.getChannelData(c)));
  }
  return {
    id: sample.id,
    name: sample.name,
    originalFileName: sample.originalFileName,
    channelData,
    sampleRate: buf.sampleRate,
    numberOfChannels: buf.numberOfChannels,
    bufferLength: buf.length,
    duration: sample.duration,
    isTruncated: sample.isTruncated,
    originalFile: sample.originalFile,
    loop: sample.loop,
    lofi: sample.lofi,
    detectedNote: sample.detectedNote,
  };
}

function deserializeSample(stored: StoredSample): Sample {
  const audioBuffer = new AudioBuffer({
    length: stored.bufferLength,
    numberOfChannels: stored.numberOfChannels,
    sampleRate: stored.sampleRate,
  });
  for (let c = 0; c < stored.numberOfChannels; c++) {
    audioBuffer.copyToChannel(new Float32Array(stored.channelData[c]), c);
  }
  return {
    id: stored.id,
    name: stored.name,
    originalFileName: stored.originalFileName,
    audioBuffer,
    waveformData: generateWaveformData(audioBuffer),
    duration: stored.duration,
    isTruncated: stored.isTruncated,
    originalFile: stored.originalFile,
    loop: stored.loop,
    lofi: normalizeLofiMode(stored.lofi),
    detectedNote: stored.detectedNote ?? null,
  };
}

/**
 * Save the full bank (64 slots) to IndexedDB.
 */
export async function saveBank(slots: ReadonlyArray<Sample | null>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(SAMPLES_STORE, 'readwrite');
  const store = tx.objectStore(SAMPLES_STORE);

  // Clear existing data and write fresh
  store.clear();
  for (let i = 0; i < slots.length; i++) {
    const sample = slots[i];
    if (sample) {
      store.put({ slot: i, ...serializeSample(sample) });
    }
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Load the bank from IndexedDB. Returns null if no saved data exists.
 */
export async function loadBank(): Promise<(Sample | null)[] | null> {
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return null;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SAMPLES_STORE, 'readonly');
    const store = tx.objectStore(SAMPLES_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      db.close();
      const records = request.result as (StoredSample & { slot: number })[];
      if (records.length === 0) {
        resolve(null);
        return;
      }
      const slots: (Sample | null)[] = new Array(64).fill(null);
      for (const record of records) {
        try {
          slots[record.slot] = deserializeSample(record);
        } catch (err) {
          console.warn(`Failed to restore sample in slot ${record.slot}:`, err);
        }
      }
      resolve(slots);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Save export settings to IndexedDB.
 */
export async function saveSettings(settings: StoredSettings): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(SETTINGS_STORE, 'readwrite');
  const store = tx.objectStore(SETTINGS_STORE);
  store.put({ key: 'exportOptions', ...settings });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Load export settings from IndexedDB.
 */
export async function loadSettings(): Promise<StoredSettings | null> {
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return null;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const store = tx.objectStore(SETTINGS_STORE);
    const request = store.get('exportOptions');

    request.onsuccess = () => {
      db.close();
      if (!request.result) {
        resolve(null);
        return;
      }
      const { key: _, ...settings } = request.result;
      resolve(settings as StoredSettings);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Clear all persisted data from IndexedDB.
 */
export async function clearAll(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([SAMPLES_STORE, SETTINGS_STORE], 'readwrite');
  tx.objectStore(SAMPLES_STORE).clear();
  tx.objectStore(SETTINGS_STORE).clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
