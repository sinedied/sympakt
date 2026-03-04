import { ReactiveController, ReactiveControllerHost } from 'lit';
import { Sample, MAX_SLOTS } from '../types/index.js';
import type { LoopSettings } from '../types/index.js';

type BankListener = () => void;

/**
 * Reactive state store for the 64-slot sample bank.
 * Implements ReactiveController so Lit components can subscribe to changes.
 */
class BankStateStore {
  private slots: (Sample | null)[] = new Array(MAX_SLOTS).fill(null);
  private listeners = new Set<BankListener>();

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

  /** Clear the whole bank */
  clearAll(): void {
    this.slots = new Array(MAX_SLOTS).fill(null);
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

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
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
