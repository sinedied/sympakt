import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { theme, sharedStyles } from '../styles/theme.js';

/**
 * Modal dialog for export options.
 */
@customElement('sp-export-dialog')
export class ExportDialog extends LitElement {
  static override styles = [
    theme,
    sharedStyles,
    css`
      :host {
        display: none;
      }

      :host([open]) {
        display: block;
      }

      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .dialog {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        padding: 24px;
        min-width: 320px;
        max-width: 400px;
      }

      h2 {
        font-family: var(--font-pixel);
        font-size: 10px;
        color: var(--accent);
        margin: 0 0 16px 0;
        text-transform: uppercase;
        letter-spacing: 2px;
      }

      .field {
        margin-bottom: 16px;
      }

      .field label {
        display: block;
        margin-bottom: 6px;
      }

      .field input[type='text'] {
        width: 100%;
      }

      .checkbox-field {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
      }

      .checkbox-field input[type='checkbox'] {
        accent-color: var(--accent);
        width: 14px;
        height: 14px;
      }

      .checkbox-field label {
        cursor: pointer;
      }

      .button-row {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 20px;
      }

      .sample-count {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-secondary);
        margin-bottom: 12px;
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Number }) sampleCount = 0;

  @state() private packName = 'My Sample Pack';
  @state() private includeOriginals = false;

  override render() {
    if (!this.open) return null;

    return html`
      <div class="overlay" @click=${this.onOverlayClick}>
        <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
          <h2>Export Sample Pack</h2>

          <div class="sample-count">${this.sampleCount} sample${this.sampleCount !== 1 ? 's' : ''} will be exported</div>

          <div class="field">
            <label for="pack-name">Pack Name</label>
            <input
              id="pack-name"
              type="text"
              .value=${this.packName}
              @input=${(e: Event) => (this.packName = (e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="checkbox-field">
            <input
              id="include-originals"
              type="checkbox"
              .checked=${this.includeOriginals}
              @change=${(e: Event) =>
                (this.includeOriginals = (e.target as HTMLInputElement).checked)}
            />
            <label for="include-originals">Include original files</label>
          </div>

          <div class="button-row">
            <button @click=${this.close}>Cancel</button>
            <button class="primary" @click=${this.onExport}>Export .zip</button>
          </div>
        </div>
      </div>
    `;
  }

  private onOverlayClick(): void {
    this.close();
  }

  private close(): void {
    this.open = false;
    this.dispatchEvent(new CustomEvent('dialog-close'));
  }

  private onExport(): void {
    this.dispatchEvent(
      new CustomEvent('export-confirm', {
        detail: {
          packName: this.packName.trim() || 'Untitled Pack',
          includeOriginals: this.includeOriginals,
        },
        bubbles: true,
        composed: true,
      }),
    );
    this.close();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sp-export-dialog': ExportDialog;
  }
}
