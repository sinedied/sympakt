import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, sharedStyles } from '../styles/theme.js';
import { bankState, BankStateController } from '../state/bank-state.js';
import { playSamplePitchedFull } from '../services/audio-engine.js';
import { iconPlay, iconPlayPrev } from '../icons.js';

interface KeyDef {
  note: string;
  semitone: number;
  isBlack: boolean;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function buildOctaveKeys(octave: number, baseSemitone: number): KeyDef[] {
  const keys: KeyDef[] = [];
  for (let i = 0; i < 12; i++) {
    keys.push({
      note: `${NOTE_NAMES[i]}${octave}`,
      semitone: baseSemitone + i,
      isBlack: NOTE_NAMES[i].includes('#'),
    });
  }
  return keys;
}

/**
 * QWERTY key mapping on the home/middle row (A S D F G H J).
 * White keys: a=C, s=D, d=E, f=F, g=G, h=A, j=B
 * Black keys (top row): w=C#, e=D#, t=F#, y=G#, u=A#
 * Keys always map to the FIRST displayed octave only.
 */
const QWERTY_TO_NOTE_INDEX: Record<string, number> = {
  a: 0, s: 2, d: 4, f: 5, g: 7, h: 9, j: 11,
  w: 1, e: 3, t: 6, y: 8, u: 10,
};

const NOTE_INDEX_TO_KEY: Map<number, string> = new Map();
for (const [key, noteIdx] of Object.entries(QWERTY_TO_NOTE_INDEX)) {
  if (!NOTE_INDEX_TO_KEY.has(noteIdx)) {
    NOTE_INDEX_TO_KEY.set(noteIdx, key.toUpperCase());
  }
}

const MIN_OCTAVE = 0;
const MAX_OCTAVE = 7;

@customElement('sp-virtual-keyboard')
export class VirtualKeyboard extends LitElement {
  static override styles = [
    theme,
    sharedStyles,
    css`
      :host {
        display: block;
        border-top: 1px solid var(--border-color);
        background: var(--bg-secondary);
        padding: 6px 8px;
        user-select: none;
        -webkit-user-select: none;
      }

      .keyboard-bar {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-bottom: 4px;
      }

      .selected-label {
        font-family: var(--font-pixel);
        font-size: 7px;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .selected-name {
        color: var(--accent);
      }

      .octave-label {
        font-family: var(--font-pixel);
        font-size: 7px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .octave-btn {
        font-family: var(--font-pixel);
        font-size: 8px;
        padding: 2px 6px;
        min-width: 0;
        height: auto;
      }

      .piano-wrapper {
        display: flex;
        justify-content: center;
        overflow-x: auto;
      }

      .piano {
        position: relative;
        height: 80px;
        flex-shrink: 0;
      }

      .white-keys {
        display: flex;
        gap: 2px;
        height: 100%;
      }

      .white-key {
        position: relative;
        width: 42px;
        height: 100%;
        background: #e8e8e8;
        border: 1px solid #999;
        border-radius: 0 0 3px 3px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        padding-bottom: 3px;
        transition: background 60ms ease;
        touch-action: none;
        flex-shrink: 0;
      }

      .white-key:hover {
        background: #d0d0d0;
      }

      .white-key.active {
        background: var(--accent);
        border-color: var(--accent-dim);
      }

      .white-key.root {
        border-color: var(--accent-dim);
      }

      .black-key {
        position: absolute;
        width: 28px;
        height: 100%;
        background: #222;
        border: 1px solid #111;
        border-radius: 0 0 2px 2px;
        cursor: pointer;
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        padding-bottom: 2px;
        z-index: 1;
        transition: background 60ms ease;
        touch-action: none;
      }

      .black-key:hover {
        background: #444;
      }

      .black-key.active {
        background: var(--accent-dim);
        border-color: var(--accent);
      }

      .key-label {
        font-family: var(--font-pixel);
        font-size: 6px;
        color: #666;
        line-height: 1;
        pointer-events: none;
      }

      .key-binding {
        font-family: var(--font-pixel);
        font-size: 6px;
        color: #999;
        line-height: 1;
        pointer-events: none;
        margin-top: 1px;
      }

      .black-key .key-label {
        color: #888;
      }

      .black-key .key-binding {
        color: #777;
      }

      .white-key.active .key-label,
      .white-key.active .key-binding {
        color: #000;
      }

      .black-key.active .key-label,
      .black-key.active .key-binding {
        color: #fff;
      }

      .no-sample {
        font-family: var(--font-pixel);
        font-size: 7px;
        color: var(--text-muted);
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 1px;
        padding: 12px 0;
      }

      @media (max-width: 768px) {
        .piano { height: 65px; }
        .white-key { width: 32px; }
        .key-binding { display: none; }
      }

      @media (max-width: 480px) {
        .piano { height: 55px; }
        .white-key { width: 24px; }
        .key-label { font-size: 5px; }
      }
    `,
  ];

  // @ts-expect-error Needed for reactive subscription side-effect
  private _bankCtrl = new BankStateController(this);

  @state() private startOctave = 3;
  @state() private activeKeys = new Set<number>();
  private stopFns = new Map<number, () => void>();
  private keydownHandler = this.onKeyDown.bind(this);
  private keyupHandler = this.onKeyUp.bind(this);

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.keydownHandler);
    window.removeEventListener('keyup', this.keyupHandler);
    this.stopAllNotes();
  }

  private toSemitone(octave: number, noteIndex: number): number {
    return (octave - 3) * 12 + noteIndex;
  }

  private get displayedKeys(): KeyDef[] {
    const base1 = this.toSemitone(this.startOctave, 0);
    const base2 = this.toSemitone(this.startOctave + 1, 0);
    return [
      ...buildOctaveKeys(this.startOctave, base1),
      ...buildOctaveKeys(this.startOctave + 1, base2),
    ];
  }

  override render() {
    const sample = bankState.getSelectedSample();
    const selectedIndex = bankState.selectedIndex;

    const nameHtml = selectedIndex !== null && sample
      ? html`<span class="selected-label">Playing: <span class="selected-name">${String(selectedIndex + 1).padStart(2, '0')} ${sample.name}</span></span>`
      : html`<span class="selected-label">Select a sample to play</span>`;

    const canDown = this.startOctave > MIN_OCTAVE;
    const canUp = this.startOctave < MAX_OCTAVE - 1;
    const octaveLabel = `C${this.startOctave}\u2013B${this.startOctave + 1}`;

    return html`
      <div class="keyboard-bar">
        ${nameHtml}
        <button class="octave-btn" @click=${this.octaveDown} ?disabled=${!canDown}>${iconPlayPrev}</button>
        <span class="octave-label">${octaveLabel}</span>
        <button class="octave-btn" @click=${this.octaveUp} ?disabled=${!canUp}>${iconPlay}</button>
      </div>
      ${sample ? this.renderPiano() : html`<div class="no-sample">Click a sample slot to select it</div>`}
    `;
  }

  private renderPiano() {
    const allKeys = this.displayedKeys;
    const whiteKeys = allKeys.filter((k) => !k.isBlack);
    const blackKeys = allKeys.filter((k) => k.isBlack);
    const firstBase = this.toSemitone(this.startOctave, 0);

    return html`
      <div class="piano-wrapper">
        <div class="piano">
          <div class="white-keys">
            ${whiteKeys.map((k) => this.renderWhiteKey(k, firstBase))}
          </div>
          ${this.renderBlackKeys(blackKeys, firstBase)}
        </div>
      </div>
    `;
  }

  private renderWhiteKey(k: KeyDef, firstBase: number) {
    const idx = k.semitone - firstBase;
    const binding = idx >= 0 && idx < 12 ? NOTE_INDEX_TO_KEY.get(idx) : undefined;
    const classes = 'white-key'
      + (this.activeKeys.has(k.semitone) ? ' active' : '')
      + (k.semitone === 0 ? ' root' : '');
    return html`
      <div
        class=${classes}
        @pointerdown=${(e: PointerEvent) => this.onPointerDown(e, k.semitone)}
        @pointerup=${(e: PointerEvent) => this.onPointerUp(e, k.semitone)}
        @pointerleave=${(e: PointerEvent) => this.onPointerUp(e, k.semitone)}
      >
        <span class="key-label">${k.note}</span>
        ${binding ? html`<span class="key-binding">${binding}</span>` : nothing}
      </div>
    `;
  }

  private renderBlackKeys(blackKeys: KeyDef[], firstBase: number) {
    const whiteKeyEls = this.shadowRoot?.querySelectorAll('.white-key');
    if (!whiteKeyEls || whiteKeyEls.length === 0) {
      requestAnimationFrame(() => this.requestUpdate());
      return nothing;
    }
    const whiteKeyWidth = (whiteKeyEls[0] as HTMLElement).offsetWidth;
    const gap = 2;
    const pitch = whiteKeyWidth + gap;
    const bkw = Math.round(whiteKeyWidth * 0.67);
    const baseOfRange = this.toSemitone(this.startOctave, 0);

    const whiteKeysBefore: Record<number, number> = {
      1: 0.5, 3: 1.5, 6: 3.5, 8: 4.5, 10: 5.5,
    };

    const positions: Array<{ k: KeyDef; left: number }> = [];
    for (const k of blackKeys) {
      const noteInOctave = ((k.semitone % 12) + 12) % 12;
      const octaveOffset = Math.floor((k.semitone - baseOfRange) / 12);
      const pos = whiteKeysBefore[noteInOctave];
      if (pos === undefined) continue;
      const whiteIndex = octaveOffset * 7 + pos;
      positions.push({ k, left: whiteIndex * pitch + (pitch - bkw) / 2 });
    }

    return html`
      <div style="position:absolute;top:0;left:0;right:0;height:55%;pointer-events:none;">
        ${positions.map((p) => this.renderBlackKey(p.k, p.left, bkw, firstBase))}
      </div>
    `;
  }

  private renderBlackKey(k: KeyDef, left: number, width: number, firstBase: number) {
    const idx = k.semitone - firstBase;
    const binding = idx >= 0 && idx < 12 ? NOTE_INDEX_TO_KEY.get(idx) : undefined;
    const classes = 'black-key' + (this.activeKeys.has(k.semitone) ? ' active' : '');
    const style = `position:absolute;left:${left}px;width:${width}px`;
    return html`
      <div
        class=${classes}
        style=${style}
        @pointerdown=${(e: PointerEvent) => this.onPointerDown(e, k.semitone)}
        @pointerup=${(e: PointerEvent) => this.onPointerUp(e, k.semitone)}
        @pointerleave=${(e: PointerEvent) => this.onPointerUp(e, k.semitone)}
      >
        <span class="key-label">${k.note}</span>
        ${binding ? html`<span class="key-binding">${binding}</span>` : nothing}
      </div>
    `;
  }

  private onPointerDown(e: PointerEvent, semitone: number): void {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.noteOn(semitone);
  }

  private onPointerUp(e: PointerEvent, semitone: number): void {
    e.preventDefault();
    this.noteOff(semitone);
  }

  private onKeyDown(e: KeyboardEvent): void {
    const origin = e.composedPath()[0];
    if (origin instanceof HTMLInputElement || origin instanceof HTMLTextAreaElement) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const key = e.key.toLowerCase();

    if (key === 'arrowup' || key === 'arrowdown') {
      e.preventDefault();
      this.selectAdjacentSample(key === 'arrowup' ? -1 : 1);
      return;
    }
    if (key === 'arrowleft') {
      e.preventDefault();
      this.octaveDown();
      return;
    }
    if (key === 'arrowright') {
      e.preventDefault();
      this.octaveUp();
      return;
    }

    const noteIndex = QWERTY_TO_NOTE_INDEX[key];
    if (noteIndex !== undefined && !e.repeat) {
      e.preventDefault();
      this.noteOn(this.toSemitone(this.startOctave, noteIndex));
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    const noteIndex = QWERTY_TO_NOTE_INDEX[key];
    if (noteIndex !== undefined) {
      this.noteOff(this.toSemitone(this.startOctave, noteIndex));
    }
  }

  private selectAdjacentSample(direction: -1 | 1): void {
    const slots = bankState.getSlots();
    const current = bankState.selectedIndex;

    if (current === null) {
      if (direction === 1) {
        const idx = slots.findIndex((s) => s !== null);
        if (idx !== -1) bankState.selectSlot(idx);
      } else {
        for (let i = slots.length - 1; i >= 0; i--) {
          if (slots[i] !== null) { bankState.selectSlot(i); break; }
        }
      }
      return;
    }

    let i = current + direction;
    while (i >= 0 && i < slots.length) {
      if (slots[i] !== null) {
        bankState.selectSlot(i);
        return;
      }
      i += direction;
    }
  }

  private octaveDown(): void {
    if (this.startOctave > MIN_OCTAVE) {
      this.stopAllNotes();
      this.startOctave--;
    }
  }

  private octaveUp(): void {
    if (this.startOctave < MAX_OCTAVE - 1) {
      this.stopAllNotes();
      this.startOctave++;
    }
  }

  private noteOn(semitone: number): void {
    if (this.activeKeys.has(semitone)) return;
    const sample = bankState.getSelectedSample();
    if (!sample) return;
    window.dispatchEvent(new Event('stop-all-playback'));
    const stop = playSamplePitchedFull(sample, semitone);
    this.stopFns.set(semitone, stop);
    this.activeKeys = new Set(this.activeKeys).add(semitone);
  }

  private noteOff(semitone: number): void {
    if (!this.activeKeys.has(semitone)) return;
    const stop = this.stopFns.get(semitone);
    stop?.();
    this.stopFns.delete(semitone);
    const next = new Set(this.activeKeys);
    next.delete(semitone);
    this.activeKeys = next;
  }

  private stopAllNotes(): void {
    for (const stop of this.stopFns.values()) {
      stop();
    }
    this.stopFns.clear();
    this.activeKeys = new Set();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sp-virtual-keyboard': VirtualKeyboard;
  }
}
