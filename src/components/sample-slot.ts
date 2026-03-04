import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { theme, sharedStyles } from '../styles/theme.js';
import { Sample, MAX_SAMPLE_DURATION } from '../types/index.js';
import type { LoopSettings } from '../types/index.js';
import { playSample, playSampleLooped } from '../services/audio-engine.js';
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
        overflow: hidden;
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

      .sample-name {
        font-family: var(--font-pixel);
        font-size: 7px;
        color: var(--text-primary);
        min-width: 80px;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
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

      .actions {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .actions button {
        padding: 4px 6px;
        font-size: 7px;
        min-width: 0;
      }

      .btn-play {
        font-size: 10px;
        padding: 4px 8px;
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
      }

      .btn-loop.active {
        background: var(--accent-dim);
        border-color: var(--accent);
        color: #000;
      }

      input[type='file'] {
        display: none;
      }
    `,
  ];

  @property({ type: Number }) index = 0;
  @property({ type: Object }) sample: Sample | null = null;

  @state() private dragOver = false;
  @state() private dragging = false;
  @state() private playing = false;
  @state() private confirmingRemove = false;
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
                  @loop-change=${this.onLoopChange}
                ></sp-waveform>
              `
            : html`<div class="empty-slot" @click=${this.onClickImport}>Drop or click</div>`}
        </div>

        ${this.sample
          ? html`
              <span class="sample-name" title=${this.sample.name}>${this.sample.name}</span>
              <span class="duration ${this.sample.isTruncated && !this.sample.loop ? 'truncated' : ''}">
                ${this.sample.loop
                  ? formatDuration(this.sample.loop.endTime - this.sample.loop.startTime)
                  : formatDuration(Math.min(this.sample.duration, MAX_SAMPLE_DURATION))}
              </span>
              <div class="actions">
                <button class="btn-play" @click=${this.togglePlay} title="Play/Stop">
                  ${this.playing ? '■' : '▶'}
                </button>
                <button
                  class="btn-loop ${this.sample.loop !== null ? 'active' : ''}"
                  @click=${this.toggleLoop}
                  title="${this.sample.loop !== null ? 'Disable loop' : 'Enable loop'}"
                >⟳</button>
                ${this.confirmingRemove
                  ? html`<button class="danger confirm" @click=${this.onConfirmRemove} title="Confirm remove">✓</button>`
                  : html`<button class="danger" @click=${this.onRemoveClick} title="Remove">✕</button>`}
              </div>
            `
          : html`
              <div class="actions">
                <button @click=${this.onClickImport}>+</button>
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
  }

  private toggleLoop(): void {
    if (!this.sample) return;
    const audioDuration = this.sample.audioBuffer.duration;
    const loopEnd = Math.min(audioDuration, MAX_SAMPLE_DURATION);
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

    if (this.sample.loop) {
      // Looped playback with crossfade — no auto-stop
      playSampleLooped(this.sample.audioBuffer, this.sample.loop).then((stop) => {
        this.stopFn = stop;
      });
    } else {
      this.stopFn = playSample(this.sample.audioBuffer);
      // Auto-stop after duration
      const dur = Math.min(this.sample.duration, MAX_SAMPLE_DURATION);
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

    // Check if it's a file drop
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('audio/') || file.name.match(/\.(wav|mp3|ogg|flac|aiff|m4a)$/i)) {
        this.dispatchEvent(
          new CustomEvent('sample-import', {
            detail: { index: this.index, file },
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
}

function formatDuration(seconds: number): string {
  return seconds.toFixed(2) + 's';
}

declare global {
  interface HTMLElementTagNameMap {
    'sp-sample-slot': SampleSlot;
  }
}
