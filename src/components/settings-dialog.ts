import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { theme, sharedStyles } from '../styles/theme.js';

/**
 * Modal dialog for global settings.
 */
@customElement('sp-settings-dialog')
export class SettingsDialog extends LitElement {
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

      .field-hint {
        font-family: var(--font-pixel);
        font-size: 6px;
        color: var(--text-muted);
        margin-top: -12px;
        margin-bottom: 16px;
        padding-left: 22px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .experimental-badge {
        font-family: var(--font-pixel);
        font-size: 5px;
        color: var(--warning);
        border: 1px solid var(--warning);
        padding: 1px 4px;
        margin-left: 6px;
        vertical-align: middle;
        letter-spacing: 1px;
      }

      .button-row {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 20px;
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Boolean }) pitchDetectionEnabled = false;

  override render() {
    if (!this.open) return null;

    return html`
      <div class="overlay" @click=${this.onOverlayClick}>
        <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
          <h2>Settings</h2>

          <div class="checkbox-field">
            <input
              id="pitch-detection"
              type="checkbox"
              .checked=${this.pitchDetectionEnabled}
              @change=${this.onPitchDetectionChange}
              title="Enable automatic pitch detection for all samples"
            />
            <label for="pitch-detection" title="Enable automatic pitch detection for all samples">
              Pitch detection
              <span class="experimental-badge">Experimental</span>
            </label>
          </div>
          <div class="field-hint">Auto-detect musical notes for each sample</div>

          <div class="button-row">
            <button @click=${this.close}>Close</button>
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

  private onPitchDetectionChange(e: Event): void {
    const enabled = (e.target as HTMLInputElement).checked;
    this.pitchDetectionEnabled = enabled;
    this.dispatchEvent(
      new CustomEvent('pitch-detection-toggle', {
        detail: { enabled },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sp-settings-dialog': SettingsDialog;
  }
}
