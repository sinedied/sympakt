import { ReactiveController, ReactiveControllerHost } from 'lit';
import { Sample, MAX_SLOTS, getEffectiveMaxDuration, getSplitMaxDuration } from '../types/index.js';
import type { LoopSettings, LofiMode, SplitSample } from '../types/index.js';
import { saveBank, loadBank, clearAll as clearPersistedData } from '../services/persistence.js';

type BankListener = () => void;

/**
 * Reactive state store for the 64-slot sample bank.
 * Implements ReactiveController so Lit components can subscribe to changes.
 */
class BankStateStore {
  private slots: (Sample | null)[] = new Array(MAX_SLOTS).fill(null);
  private listeners = new Set<BankListener>();
  private saveTimer?: ReturnType<typeof setTimeout>;
  private _selectedIndex: number | null = null;

  /** Get the currently selected slot index */
  get selectedIndex(): number | null {
    return this._selectedIndex;
  }

  /** Select a slot (null to deselect) */
  selectSlot(index: number | null): void {
    this._selectedIndex = index;
    this.notifyOnly();
  }

  /** Get the currently selected sample */
  getSelectedSample(): Sample | null {
    if (this._selectedIndex === null) return null;
    return this.slots[this._selectedIndex] ?? null;
  }

  /** Get a snapshot of all slots */
  getSlots(): ReadonlyArray<Sample | null> {
    return this.slots;
  }

  /** Get a single slot */
  getSlot(index: number): Sample | null {
    return this.slots[index] ?? null;
  }

  /** Set a sample in a slot */
  setSample(index: number, sample: Sample | null): void {
    if (index < 0 || index >= MAX_SLOTS) return;
    this.slots[index] = sample;
    this.notify();
  }

  /** Remove a sample from a slot */
  removeSample(index: number): void {
    this.setSample(index, null);
  }

  /** Update loop settings for a sample in a slot */
  updateSampleLoop(index: number, loop: LoopSettings | null): void {
    const sample = this.slots[index];
    if (!sample) return;
    this.slots[index] = { ...sample, loop };
    this.notify();
  }

  /** Toggle LOFI mode for a sample, recalculating truncation and clamping loop if needed */
  updateSampleLofi(index: number, lofi: LofiMode): void {
    const sample = this.slots[index];
    if (!sample) return;

    const effectiveMax = sample.splitEnabled
      ? getSplitMaxDuration(lofi)
      : getEffectiveMaxDuration(lofi);
    const isTruncated = sample.duration > effectiveMax;

    // When reducing effective max (e.g. xlofi→lofi, lofi→off), clamp loop duration if needed
    let loop = sample.loop;
    if (loop) {
      const loopLen = loop.endTime - loop.startTime;
      if (loopLen > effectiveMax) {
        const newEnd = Math.min(loop.startTime + effectiveMax, sample.audioBuffer.duration);
        loop = {
          ...loop,
          endTime: newEnd,
          crossfadeDuration: Math.min(loop.crossfadeDuration, newEnd - loop.startTime, loop.startTime),
        };
      }
    }

    // Also clamp B sample loop if in split mode
    let splitSample = sample.splitSample;
    if (sample.splitEnabled && splitSample) {
      const splitMax = getSplitMaxDuration(lofi);
      const bTruncated = splitSample.duration > splitMax;
      let bLoop = splitSample.loop;
      if (bLoop) {
        const bLoopLen = bLoop.endTime - bLoop.startTime;
        if (bLoopLen > splitMax) {
          const newEnd = Math.min(bLoop.startTime + splitMax, splitSample.audioBuffer.duration);
          bLoop = {
            ...bLoop,
            endTime: newEnd,
            crossfadeDuration: Math.min(bLoop.crossfadeDuration, newEnd - bLoop.startTime, bLoop.startTime),
          };
        }
      }
      splitSample = { ...splitSample, isTruncated: bTruncated, loop: bLoop };
    }

    this.slots[index] = { ...sample, lofi, isTruncated, loop, splitSample };
    this.notify();
  }

  /** Update the detected note for a sample (manual override or clear) */
  updateSampleNote(index: number, note: string | null): void {
    const sample = this.slots[index];
    if (!sample) return;
    this.slots[index] = { ...sample, detectedNote: note };
    this.notify();
  }

  /** Toggle dual split mode for a slot */
  toggleSplitMode(index: number): void {
    const sample = this.slots[index];
    if (!sample) return;
    const splitEnabled = !sample.splitEnabled;
    const splitMaxDur = getSplitMaxDuration(sample.lofi);

    // Recalculate A sample truncation based on split max
    const isTruncated = splitEnabled
      ? sample.duration > splitMaxDur
      : sample.duration > getEffectiveMaxDuration(sample.lofi);

    // Clamp A loop if needed
    let loop = sample.loop;
    if (splitEnabled && loop) {
      const loopLen = loop.endTime - loop.startTime;
      if (loopLen > splitMaxDur) {
        const newEnd = Math.min(loop.startTime + splitMaxDur, sample.audioBuffer.duration);
        loop = {
          ...loop,
          endTime: newEnd,
          crossfadeDuration: Math.min(loop.crossfadeDuration, newEnd - loop.startTime, loop.startTime),
        };
      }
    }

    this.slots[index] = {
      ...sample,
      splitEnabled,
      isTruncated,
      loop,
      // Discard B sample when disabling split
      splitSample: splitEnabled ? (sample.splitSample ?? null) : undefined,
    };
    this.notify();
  }

  /** Set the B-side sample in a dual split slot */
  setSplitSample(index: number, splitSample: SplitSample | null): void {
    const sample = this.slots[index];
    if (!sample || !sample.splitEnabled) return;
    this.slots[index] = { ...sample, splitSample };
    this.notify();
  }

  /** Update loop settings for the B-side sample */
  updateSplitSampleLoop(index: number, loop: LoopSettings | null): void {
    const sample = this.slots[index];
    if (!sample?.splitSample) return;
    this.slots[index] = {
      ...sample,
      splitSample: { ...sample.splitSample, loop },
    };
    this.notify();
  }

  /** Remove the B-side sample from a dual split slot */
  removeSplitSample(index: number): void {
    const sample = this.slots[index];
    if (!sample) return;
    this.slots[index] = { ...sample, splitSample: null };
    this.notify();
  }

  /** Update the detected note for the B-side sample */
  updateSplitSampleNote(index: number, note: string | null): void {
    const sample = this.slots[index];
    if (!sample?.splitSample) return;
    this.slots[index] = {
      ...sample,
      splitSample: { ...sample.splitSample, detectedNote: note },
    };
    this.notify();
  }

  /** Clear pitch detection data from all samples */
  clearAllPitchData(): void {
    for (let i = 0; i < this.slots.length; i++) {
      const sample = this.slots[i];
      if (sample && (sample.detectedNote !== null || sample.pitchDebug)) {
        this.slots[i] = { ...sample, detectedNote: null, pitchDebug: undefined };
      }
    }
    this.notify();
  }

  /** Move a sample from one slot to another, shifting others */
  moveSample(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= MAX_SLOTS) return;
    if (toIndex < 0 || toIndex >= MAX_SLOTS) return;
    const sample = this.slots[fromIndex];
    this.slots.splice(fromIndex, 1);
    this.slots.splice(toIndex, 0, sample);
    this.notify();
  }

  /** Clear the whole bank and persisted data */
  clearAll(): void {
    this.slots = new Array(MAX_SLOTS).fill(null);
    clearPersistedData().catch((err) => console.warn('Failed to clear persisted data:', err));
    this.notify();
  }

  /** Load a full bank (e.g. from imported ZIP) */
  loadBank(slots: (Sample | null)[]): void {
    this.slots = slots.slice(0, MAX_SLOTS);
    while (this.slots.length < MAX_SLOTS) {
      this.slots.push(null);
    }
    this.notify();
  }

  subscribe(listener: BankListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Restore bank state from IndexedDB. Returns true if data was found.
   */
  async restoreFromDB(): Promise<boolean> {
    try {
      const slots = await loadBank();
      if (slots) {
        this.slots = slots;
        this.notifyOnly();
        return true;
      }
    } catch (err) {
      console.warn('Failed to restore bank from IndexedDB:', err);
    }
    return false;
  }

  /** Notify listeners without triggering a save (used during restore) */
  private notifyOnly(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private notify(): void {
    this.notifyOnly();
    this.debouncedSave();
  }

  private debouncedSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      saveBank(this.slots).catch((err) =>
        console.warn('Failed to persist bank state:', err),
      );
    }, 500);
  }
}

/** Singleton state store */
export const bankState = new BankStateStore();

/**
 * Lit ReactiveController that triggers host updates when bank state changes.
 */
export class BankStateController implements ReactiveController {
  private unsubscribe?: () => void;

  constructor(private host: ReactiveControllerHost) {
    this.host.addController(this);
  }

  hostConnected(): void {
    this.unsubscribe = bankState.subscribe(() => {
      this.host.requestUpdate();
    });
  }

  hostDisconnected(): void {
    this.unsubscribe?.();
  }

  get slots(): ReadonlyArray<Sample | null> {
    return bankState.getSlots();
  }
}
