import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { theme, sharedStyles } from '../styles/theme.js';
import { bankState, BankStateController } from '../state/bank-state.js';
import { processAudioFile, processSplitAudioFile } from '../services/zip-service.js';
import { MAX_SLOTS, getSplitMaxDuration } from '../types/index.js';
import type { LoopSettings, LofiMode } from '../types/index.js';
import './sample-slot.js';

/**
 * The 64-slot sample bank. Vertically scrollable list.
 */
@customElement('sp-sample-bank')
export class SampleBank extends LitElement {
  static override styles = [
    theme,
    sharedStyles,
    css`
      :host {
        display: block;
        flex: 1;
        overflow: hidden;
      }

      .bank-list {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: 1fr;
        grid-template-rows: repeat(64, auto);
        align-content: start;
        gap: 2px;
        padding: 8px;
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
      }

      /* 2 columns when wide enough AND maxColumns >= 2 */
      @media (min-width: 900px) {
        :host([max-columns="2"]) .bank-list,
        :host([max-columns="3"]) .bank-list,
        :host([max-columns="4"]) .bank-list {
          grid-template-rows: repeat(32, auto);
        }
      }

      /* 3 columns when wide enough AND maxColumns >= 3 */
      @media (min-width: 1200px) {
        :host([max-columns="3"]) .bank-list,
        :host([max-columns="4"]) .bank-list {
          grid-template-rows: repeat(22, auto);
        }
      }

      /* 4 columns when wide enough AND maxColumns >= 4 */
      @media (min-width: 1600px) {
        :host([max-columns="4"]) .bank-list {
          grid-template-rows: repeat(16, auto);
        }
      }
    `,
  ];

  private bankCtrl = new BankStateController(this);
  @property({ type: Boolean }) pitchDebugMode = false;
  @property({ type: Boolean }) pitchDetectionEnabled = false;
  @property({ type: Boolean }) keyboardOpen = false;
  @property({ type: Number, reflect: true, attribute: 'max-columns' }) maxColumns = 4;

  override render() {
    const selectedIndex = bankState.selectedIndex;
    return html`
      <div class="bank-list">
        ${this.bankCtrl.slots.map(
          (sample, i) => html`
            <sp-sample-slot
              .index=${i}
              .sample=${sample}
              .pitchDebugMode=${this.pitchDebugMode}
              .selected=${this.keyboardOpen && selectedIndex === i && sample !== null}
              @sample-import=${this.onSampleImport}
              @sample-import-batch=${this.onSampleImportBatch}
              @sample-remove=${this.onSampleRemove}
              @sample-move=${this.onSampleMove}
              @loop-update=${this.onLoopUpdate}
              @lofi-toggle=${this.onLofiToggle}
              @note-change=${this.onNoteChange}
              @slot-select=${this.onSlotSelect}
              @split-toggle=${this.onSplitToggle}
              @split-sample-import=${this.onSplitSampleImport}
              @split-sample-remove=${this.onSplitSampleRemove}
              @split-loop-update=${this.onSplitLoopUpdate}
              @sample-rename=${this.onSampleRename}
              @split-sample-rename=${this.onSplitSampleRename}
              @sample-reverse=${this.onSampleReverse}
              @split-sample-reverse=${this.onSplitSampleReverse}
            ></sp-sample-slot>
          `,
        )}
      </div>
    `;
  }

  private async onSampleImport(e: CustomEvent<{ index: number; file: File }>): Promise<void> {
    const { index, file } = e.detail;
    try {
      const existing = bankState.getSlot(index);
      const sample = await processAudioFile(file, this.pitchDetectionEnabled);

      // Preserve split mode and B sample when re-importing A side
      if (existing?.splitEnabled) {
        const splitMax = getSplitMaxDuration(existing.lofi);
        sample.splitEnabled = true;
        sample.splitSample = existing.splitSample;
        sample.lofi = existing.lofi;
        sample.isTruncated = sample.duration > splitMax;
      }

      bankState.setSample(index, sample);
    } catch (err) {
      console.error('Failed to import sample:', err);
    }
  }

  private async onSampleImportBatch(
    e: CustomEvent<{ index: number; files: File[] }>,
  ): Promise<void> {
    const { index, files } = e.detail;
    const limit = Math.min(files.length, MAX_SLOTS - index);
    for (let i = 0; i < limit; i++) {
      try {
        const sample = await processAudioFile(files[i], this.pitchDetectionEnabled);
        bankState.setSample(index + i, sample);
      } catch (err) {
        console.error(`Failed to import sample ${files[i].name}:`, err);
      }
    }
  }

  private onSampleRemove(e: CustomEvent<{ index: number }>): void {
    bankState.removeSample(e.detail.index);
  }

  private onSampleMove(e: CustomEvent<{ from: number; to: number }>): void {
    bankState.moveSample(e.detail.from, e.detail.to);
  }

  private onLoopUpdate(e: CustomEvent<{ index: number; loop: LoopSettings | null }>): void {
    bankState.updateSampleLoop(e.detail.index, e.detail.loop);
  }

  private onLofiToggle(e: CustomEvent<{ index: number; lofi: LofiMode }>): void {
    bankState.updateSampleLofi(e.detail.index, e.detail.lofi);
  }

  private onNoteChange(e: CustomEvent<{ index: number; note: string | null }>): void {
    bankState.updateSampleNote(e.detail.index, e.detail.note);
  }

  private onSlotSelect(e: CustomEvent<{ index: number }>): void {
    bankState.selectSlot(e.detail.index);
  }

  private onSplitToggle(e: CustomEvent<{ index: number }>): void {
    bankState.toggleSplitMode(e.detail.index);
  }

  private async onSplitSampleImport(e: CustomEvent<{ index: number; file: File }>): Promise<void> {
    const { index, file } = e.detail;
    const sample = bankState.getSlot(index);
    if (!sample) return;
    try {
      const splitSample = await processSplitAudioFile(file, sample.lofi, this.pitchDetectionEnabled);
      bankState.setSplitSample(index, splitSample);
    } catch (err) {
      console.error('Failed to import split B sample:', err);
    }
  }

  private onSplitSampleRemove(e: CustomEvent<{ index: number }>): void {
    bankState.removeSplitSample(e.detail.index);
  }

  private onSplitLoopUpdate(e: CustomEvent<{ index: number; loop: LoopSettings | null }>): void {
    bankState.updateSplitSampleLoop(e.detail.index, e.detail.loop);
  }

  private onSampleRename(e: CustomEvent<{ index: number; name: string }>): void {
    bankState.renameSample(e.detail.index, e.detail.name);
  }

  private onSplitSampleRename(e: CustomEvent<{ index: number; name: string }>): void {
    bankState.renameSplitSample(e.detail.index, e.detail.name);
  }

  private onSampleReverse(e: CustomEvent<{ index: number }>): void {
    bankState.reverseSample(e.detail.index);
  }

  private onSplitSampleReverse(e: CustomEvent<{ index: number }>): void {
    bankState.reverseSplitSample(e.detail.index);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sp-sample-bank': SampleBank;
  }
}
