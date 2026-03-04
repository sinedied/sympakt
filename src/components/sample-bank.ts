import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { theme, sharedStyles } from '../styles/theme.js';
import { bankState, BankStateController } from '../state/bank-state.js';
import { processAudioFile } from '../services/zip-service.js';
import { MAX_SLOTS } from '../types/index.js';
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

      @media (min-width: 900px) {
        .bank-list {
          grid-template-rows: repeat(32, auto);
        }
      }

      @media (min-width: 1200px) {
        .bank-list {
          grid-template-rows: repeat(22, auto);
        }
      }

      @media (min-width: 1600px) {
        .bank-list {
          grid-template-rows: repeat(16, auto);
        }
      }
    `,
  ];

  private bankCtrl = new BankStateController(this);

  override render() {
    return html`
      <div class="bank-list">
        ${this.bankCtrl.slots.map(
          (sample, i) => html`
            <sp-sample-slot
              .index=${i}
              .sample=${sample}
              @sample-import=${this.onSampleImport}
              @sample-import-batch=${this.onSampleImportBatch}
              @sample-remove=${this.onSampleRemove}
              @sample-move=${this.onSampleMove}
              @loop-update=${this.onLoopUpdate}
              @lofi-toggle=${this.onLofiToggle}
            ></sp-sample-slot>
          `,
        )}
      </div>
    `;
  }

  private async onSampleImport(e: CustomEvent<{ index: number; file: File }>): Promise<void> {
    const { index, file } = e.detail;
    try {
      const sample = await processAudioFile(file);
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
        const sample = await processAudioFile(files[i]);
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
}

declare global {
  interface HTMLElementTagNameMap {
    'sp-sample-bank': SampleBank;
  }
}
