import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { theme, sharedStyles } from '../styles/theme.js';
import { Sample, MAX_SAMPLE_DURATION, getEffectiveMaxDuration, ALL_NOTES } from '../types/index.js';
import type { LoopSettings, LofiMode } from '../types/index.js';
import { playSample, playSampleLooped } from '../services/audio-engine.js';
import { iconPlay, iconStop, iconLoop, iconCheck, iconClose, iconPlus } from '../icons.js';
import './waveform-view.js';

/**
 * A single sample slot in the bank.
 * Displays slot number, sample name, waveform preview, and action buttons.
 * Supports drag-and-drop for file import and reordering.
 */
@customElement('sp-sample-slot')
export class SampleSlot extends LitElement {
  static override styles = [
    theme,
    sharedStyles,
    css`
      :host {
        display: block;
      }

      .slot {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
        background: var(--bg-slot);
        border: 1px solid var(--border-color);
        height: var(--slot-height);
        transition: all var(--transition);
        cursor: default;
        user-select: none;
      }

      .slot:hover {
        background: var(--bg-slot-hover);
        border-color: var(--border-hover);
      }

      .slot.drag-over {
        border-color: var(--accent);
        background: var(--accent-glow);
      }

      .slot.dragging {
        opacity: 0.4;
      }

      .slot-number {
        font-family: var(--font-pixel);
        font-size: 8px;
        color: var(--text-muted);
        min-width: 24px;
        text-align: center;
      }

      .waveform-container {
        flex: 1;
        height: 22px;
        position: relative;
        overflow: visible;
      }

      .empty-slot {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-muted);
        font-family: var(--font-pixel);
        font-size: 7px;
        text-transform: uppercase;
        letter-spacing: 2px;
        border: 1px dashed var(--border-color);
      }

      .sample-name-wrap {
        position: relative;
        display: flex;
        align-items: center;
        align-self: stretch;
        cursor: pointer;
      }

      .sample-name-wrap:hover .sample-name {
        color: var(--text-secondary);
      }

      .sample-name {
        font-family: var(--font-pixel);
        font-size: 7px;
        color: var(--text-primary);
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 0 2px;
      }

      .sample-menu {
        position: absolute;
        top: 100%;
        left: 0;
        z-index: 100;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        min-width: 100px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        white-space: nowrap;
      }

      .sample-menu .menu-item {
        display: block;
        width: 100%;
        text-align: left;
        padding: 4px 8px;
        font-family: var(--font-pixel);
        font-size: 7px;
        border: none;
        background: transparent;
        color: var(--text-primary);
        cursor: pointer;
        min-width: 0;
        height: auto;
        position: relative;
      }

      .sample-menu .menu-item:hover {
        background: var(--accent-glow);
        color: var(--accent);
      }

      .sample-menu .submenu {
        position: absolute;
        left: 100%;
        top: 0;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        max-height: 200px;
        overflow-y: auto;
        min-width: 56px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      }

      .sample-menu .submenu button {
        display: block;
        width: 100%;
        text-align: left;
        padding: 3px 8px;
        font-family: var(--font-pixel);
        font-size: 7px;
        border: none;
        background: transparent;
        color: var(--text-primary);
        cursor: pointer;
        min-width: 0;
        height: auto;
      }

      .sample-menu .submenu button:hover {
        background: var(--accent-glow);
        color: var(--accent);
      }

      .sample-menu .submenu button.selected {
        color: #4fc3f7;
      }

      .detected-note {
        font-family: var(--font-pixel);
        font-size: 7px;
        color: #4fc3f7;
        text-align: center;
        white-space: nowrap;
      }

      .duration {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-secondary);
        min-width: 36px;
        text-align: right;
      }

      .duration.truncated {
        color: var(--warning);
      }

      .pitch-debug {
        font-family: var(--font-mono);
        font-size: 8px;
        color: var(--text-muted);
        min-width: 96px;
        text-align: left;
        white-space: nowrap;
      }

      .actions {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .actions button {
        padding: 4px 6px;
        font-size: 7px;
        min-width: 0;
        height: 22px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .btn-play {
        font-size: 10px;
        padding: 4px 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .danger.confirm {
        background: var(--danger);
        color: #000;
        font-weight: bold;
      }

      .danger.confirm:hover {
        color: var(--danger);
      }

      .btn-loop {
        font-size: 7px;
        padding: 4px 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .btn-loop.active {
        background: var(--accent-dim);
        border-color: var(--accent);
        color: #000;
      }

      .btn-lofi {
        font-size: 7px;
        padding: 4px 6px;
      }

      .btn-lofi.active {
        background: var(--warning);
        border-color: var(--warning);
        color: #000;
      }

      .btn-lofi.xlofi {
        background: #ff4488;
        border-color: #ff4488;
        color: #000;
      }

      input[type='file'] {
        display: none;
      }
    `,
  ];

  @property({ type: Number }) index = 0;
  @property({ type: Object }) sample: Sample | null = null;
  @property({ type: Boolean }) pitchDebugMode = false;

  @state() private dragOver = false;
  @state() private dragging = false;
  @state() private playing = false;
  @state() private confirmingRemove = false;
  @state() private sampleMenuOpen = false;
  @state() private pitchSubmenuOpen = false;
  private stopFn?: () => void;
  private outsideClickHandler = this.onOutsideClick.bind(this);

  private fileInput?: HTMLInputElement;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this.outsideClickHandler);
  }

  override render() {
    const slotNum = String(this.index + 1).padStart(2, '0');
    const cls = `slot${this.dragOver ? ' drag-over' : ''}${this.dragging ? ' dragging' : ''}`;

    return html`
      <div
        class=${cls}
        draggable=${this.sample ? 'true' : 'false'}
        @dragstart=${this.onDragStart}
        @dragend=${this.onDragEnd}
        @dragover=${this.onDragOver}
        @dragleave=${this.onDragLeave}
        @drop=${this.onDrop}
      >
        <span class="slot-number">${slotNum}</span>

        <div class="waveform-container">
          ${this.sample
            ? html`
                <sp-waveform
                  .data=${this.sample.waveformData}
                  .duration=${this.sample.duration}
                  .truncated=${this.sample.isTruncated}
                  .loopEnabled=${this.sample.loop !== null}
                  .loop=${this.sample.loop}
                  .audioBuffer=${this.sample.audioBuffer}
                  .lofi=${this.sample.lofi}
                  @loop-change=${this.onLoopChange}
                ></sp-waveform>
              `
            : html`<div class="empty-slot" @click=${this.onClickImport} title="Drop an audio file here or click to browse">Drop or click</div>`}
        </div>

        ${this.sample
          ? html`
              <span class="sample-name-wrap" @click=${this.toggleSampleMenu}>
                <span class="sample-name" title="Click for options">${this.sample.name}</span>
                ${this.sampleMenuOpen ? this.renderSampleMenu() : nothing}
              </span>
              ${this.sample.detectedNote
                ? html`<span class="detected-note" title="Detected pitch">${this.sample.detectedNote}</span>`
                : nothing}
              ${this.pitchDebugMode
                ? html`
                    <span class="pitch-debug" title=${this.pitchDebugTitle}>
                      ${this.pitchDebugLabel}
                    </span>
                  `
                : nothing}
              <span class="duration ${this.sample.isTruncated && !this.sample.loop ? 'truncated' : ''}"
                title="${this.sample.loop
                  ? 'Loop duration'
                  : this.sample.isTruncated
                    ? `Sample will be truncated to ${this.effectiveMaxDuration}s on export`
                    : 'Sample duration'}">
                ${this.sample.loop
                  ? formatDuration(this.sample.loop.endTime - this.sample.loop.startTime)
                  : formatDuration(Math.min(this.sample.duration, this.effectiveMaxDuration))}
              </span>
              <div class="actions">
                <button class="btn-play" @click=${this.togglePlay} title="${this.playing ? 'Stop playback' : 'Preview sample'}">
                  ${this.playing ? iconStop : iconPlay}
                </button>
                <button
                  class="btn-loop ${this.sample.loop !== null ? 'active' : ''}"
                  @click=${this.toggleLoop}
                  title="${this.sample.loop !== null ? 'Disable loop — export full sample (up to 5s)' : 'Enable loop — set loop points for seamless looping'}"
                >${iconLoop}</button>
                <button
                  class="btn-lofi ${this.lofiButtonClass}"
                  @click=${this.toggleLofi}
                  title="${this.lofiButtonTitle}"
                >${this.lofiButtonLabel}</button>
                ${this.confirmingRemove
                  ? html`<button class="danger confirm" @click=${this.onConfirmRemove} title="Click to confirm removal">${iconCheck}</button>`
                  : html`<button class="danger" @click=${this.onRemoveClick} title="Remove sample from this slot">${iconClose}</button>`}
              </div>
            `
          : html`
              <div class="actions">
                <button @click=${this.onClickImport} title="Add a sample to this slot">${iconPlus}</button>
              </div>
            `}

        <input type="file" accept="audio/*" @change=${this.onFileSelected} />
      </div>
    `;
  }

  private onClickImport(): void {
    if (!this.fileInput) {
      this.fileInput = this.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
    }
    this.fileInput?.click();
  }

  private onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.dispatchEvent(
        new CustomEvent('sample-import', {
          detail: { index: this.index, file },
          bubbles: true,
          composed: true,
        }),
      );
    }
    input.value = '';
  }

  private onRemoveClick(e: Event): void {
    e.stopPropagation();
    this.confirmingRemove = true;
    requestAnimationFrame(() => {
      document.addEventListener('click', this.outsideClickHandler, { once: true });
    });
  }

  private onConfirmRemove(e: Event): void {
    e.stopPropagation();
    document.removeEventListener('click', this.outsideClickHandler);
    this.confirmingRemove = false;
    this.stopPlayback();
    this.dispatchEvent(
      new CustomEvent('sample-remove', {
        detail: { index: this.index },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onOutsideClick(): void {
    this.confirmingRemove = false;
    this.sampleMenuOpen = false;
    this.pitchSubmenuOpen = false;
  }

  private toggleSampleMenu(e: Event): void {
    e.stopPropagation();
    this.sampleMenuOpen = !this.sampleMenuOpen;
    this.pitchSubmenuOpen = false;
    if (this.sampleMenuOpen) {
      requestAnimationFrame(() => {
        document.addEventListener('click', () => {
          this.sampleMenuOpen = false;
          this.pitchSubmenuOpen = false;
        }, { once: true });
      });
    }
  }

  private renderSampleMenu() {
    return html`
      <div class="sample-menu" @click=${(e: Event) => e.stopPropagation()}>
        <div class="menu-item"
          @mouseenter=${() => { this.pitchSubmenuOpen = true; }}
          @mouseleave=${() => { this.pitchSubmenuOpen = false; }}
        >
          Set pitch ▸
          ${this.pitchSubmenuOpen ? this.renderPitchSubmenu() : nothing}
        </div>
      </div>
    `;
  }

  private renderPitchSubmenu() {
    const current = this.sample?.detectedNote ?? null;
    return html`
      <div class="submenu">
        <button class=${current === null ? 'selected' : ''} @click=${() => this.selectNote(null)}>None</button>
        ${ALL_NOTES.map(
          (note) => html`<button class=${current === note ? 'selected' : ''} @click=${() => this.selectNote(note)}>${note}</button>`,
        )}
      </div>
    `;
  }

  private selectNote(note: string | null): void {
    this.sampleMenuOpen = false;
    this.pitchSubmenuOpen = false;
    this.dispatchEvent(
      new CustomEvent('note-change', {
        detail: { index: this.index, note },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private get effectiveMaxDuration(): number {
    return this.sample
      ? getEffectiveMaxDuration(this.sample.lofi)
      : MAX_SAMPLE_DURATION;
  }

  private get lofiButtonClass(): string {
    if (!this.sample) return '';
    switch (this.sample.lofi) {
      case 'xlofi': return 'xlofi';
      case 'lofi': return 'active';
      default: return '';
    }
  }

  private get lofiButtonLabel(): string {
    if (!this.sample) return 'LO';
    return this.sample.lofi === 'xlofi' ? 'XL' : 'LO';
  }

  private get lofiButtonTitle(): string {
    if (!this.sample) return '';
    switch (this.sample.lofi) {
      case 'xlofi': return 'Disable XLOFI — click to return to normal (5s max)';
      case 'lofi': return 'Enable XLOFI — 20s max, pitched up 2 octaves (quarter sample rate)';
      default: return 'Enable LOFI — 10s max, pitched up 1 octave (half sample rate)';
    }
  }

  private get pitchDebugLabel(): string {
    if (!this.sample) return '';
    if (!this.sample.pitchDebug) return 'dbg:no-data';
    const debug = this.sample.pitchDebug;
    if (debug.rejectedReason) {
      return `dbg:${debug.rejectedReason}`;
    }
    return `dbg c${debug.avgClarity.toFixed(2)} z${debug.avgZcr.toFixed(2)}`;
  }

  private get pitchDebugTitle(): string {
    if (!this.sample) return '';
    if (!this.sample.pitchDebug) return 'No pitch diagnostics available for this sample. Re-import to regenerate diagnostics.';
    const debug = this.sample.pitchDebug;
    const freq = debug.detectedFrequency !== null ? `${debug.detectedFrequency.toFixed(1)}Hz` : 'n/a';
    const spread = debug.spreadRatio !== null ? debug.spreadRatio.toFixed(3) : 'n/a';
    return [
      `freq: ${freq}`,
      `note: ${debug.detectedNote ?? 'none'}`,
      `detections: ${debug.detections}`,
      `clarity: ${debug.avgClarity.toFixed(3)}`,
      `zcr: ${debug.avgZcr.toFixed(3)}`,
      `spread: ${spread}`,
      `rate: ${Math.round(debug.analysisRate)}Hz`,
      `factor: ${debug.downsampleFactor}`,
      `reason: ${debug.rejectedReason ?? 'accepted'}`,
    ].join(' · ');
  }

  private toggleLoop(): void {
    if (!this.sample) return;
    const effectiveMax = this.effectiveMaxDuration;
    const audioDuration = this.sample.audioBuffer.duration;
    const loopEnd = Math.min(audioDuration, effectiveMax);
    // Start at 10% to allow room for default 10% crossfade
    const loopStart = loopEnd * 0.1;
    const loopDuration = loopEnd - loopStart;
    const newLoop: LoopSettings | null = this.sample.loop
      ? null
      : {
          startTime: loopStart,
          endTime: loopEnd,
          crossfadeDuration: loopDuration * 0.1,
        };

    this.dispatchEvent(
      new CustomEvent('loop-update', {
        detail: { index: this.index, loop: newLoop },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onLoopChange(e: CustomEvent<LoopSettings>): void {
    this.dispatchEvent(
      new CustomEvent('loop-update', {
        detail: { index: this.index, loop: e.detail },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private toggleLofi(): void {
    if (!this.sample) return;
    this.stopPlayback();
    const nextMode: LofiMode =
      this.sample.lofi === 'off' ? 'lofi' :
      this.sample.lofi === 'lofi' ? 'xlofi' : 'off';
    this.dispatchEvent(
      new CustomEvent('lofi-toggle', {
        detail: { index: this.index, lofi: nextMode },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private togglePlay(): void {
    if (this.playing) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  private startPlayback(): void {
    if (!this.sample) return;
    this.playing = true;
    const lofi = this.sample.lofi;

    if (this.sample.loop) {
      // Looped playback with crossfade — no auto-stop
      playSampleLooped(this.sample.audioBuffer, this.sample.loop, lofi).then((stop) => {
        this.stopFn = stop;
      });
    } else {
      this.stopFn = playSample(this.sample.audioBuffer, 0, lofi);
      // Auto-stop after effective duration
      const dur = Math.min(this.sample.duration, this.effectiveMaxDuration);
      setTimeout(() => this.stopPlayback(), dur * 1000);
    }
  }

  private stopPlayback(): void {
    this.stopFn?.();
    this.stopFn = undefined;
    this.playing = false;
  }

  // --- Drag & Drop ---

  private onDragStart(e: DragEvent): void {
    if (!this.sample) return;
    this.dragging = true;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', String(this.index));
  }

  private onDragEnd(): void {
    this.dragging = false;
  }

  private onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    this.dragOver = true;
  }

  private onDragLeave(): void {
    this.dragOver = false;
  }

  private onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver = false;

    // Check for directory or file drops via DataTransferItem entries
    const items = e.dataTransfer?.items;
    if (items && items.length > 0) {
      // Try to detect a folder drop using webkitGetAsEntry
      const entry = items[0].webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        this.handleFolderDrop(entry as FileSystemDirectoryEntry);
        return;
      }
    }

    // Check if it's a file drop
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const audioFiles = Array.from(files).filter(
        (f) => f.type.startsWith('audio/') || f.name.match(/\.(wav|mp3|ogg|flac|aiff|m4a)$/i),
      );
      if (audioFiles.length > 1) {
        // Multiple audio files dropped — treat as batch
        this.dispatchEvent(
          new CustomEvent('sample-import-batch', {
            detail: { index: this.index, files: audioFiles },
            bubbles: true,
            composed: true,
          }),
        );
        return;
      }
      if (audioFiles.length === 1) {
        this.dispatchEvent(
          new CustomEvent('sample-import', {
            detail: { index: this.index, file: audioFiles[0] },
            bubbles: true,
            composed: true,
          }),
        );
        return;
      }
    }

    // Otherwise it's a reorder drag
    const fromIndex = parseInt(e.dataTransfer!.getData('text/plain'), 10);
    if (!isNaN(fromIndex) && fromIndex !== this.index) {
      this.dispatchEvent(
        new CustomEvent('sample-move', {
          detail: { from: fromIndex, to: this.index },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private async handleFolderDrop(dirEntry: FileSystemDirectoryEntry): Promise<void> {
    const files = await readAudioFilesFromDirectory(dirEntry);
    if (files.length > 0) {
      this.dispatchEvent(
        new CustomEvent('sample-import-batch', {
          detail: { index: this.index, files },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }
}

function formatDuration(seconds: number): string {
  return seconds.toFixed(2) + 's';
}

const AUDIO_EXT_RE = /\.(wav|mp3|ogg|flac|aiff|m4a)$/i;

/** Read all audio files from a dropped directory entry, sorted by name.
 *  Applies the same exclusion logic as ZIP import:
 *  - skip macOS resource forks (._prefix, __MACOSX paths)
 *  - skip non-audio files
 *  - skip empty files
 */
async function readAudioFilesFromDirectory(dirEntry: FileSystemDirectoryEntry): Promise<File[]> {
  const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
    dirEntry.createReader().readEntries(resolve, reject);
  });

  const filtered = entries
    .filter((entry): entry is FileSystemFileEntry => {
      if (!entry.isFile) return false;
      if (!AUDIO_EXT_RE.test(entry.name)) return false;
      // Skip macOS resource fork files (._prefix)
      if (entry.name.startsWith('._')) return false;
      // Skip __MACOSX directory artifacts
      if (entry.fullPath.includes('__MACOSX/')) return false;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const files = await Promise.all(
    filtered.map(
      (entry) =>
        new Promise<File>((resolve, reject) => {
          entry.file(resolve, reject);
        }),
    ),
  );

  // Skip empty files (same as ZIP import)
  return files.filter((f) => f.size > 0);
}

declare global {
  interface HTMLElementTagNameMap {
    'sp-sample-slot': SampleSlot;
  }
}
