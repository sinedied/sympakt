import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, sharedStyles } from '../styles/theme.js';
import { bankState, BankStateController } from '../state/bank-state.js';
import {
  exportSamplePack,
  importSamplePack,
  downloadBlob,
} from '../services/zip-service.js';
import type { ExportOptions } from '../types/index.js';
import './sample-bank.js';
import './export-dialog.js';

/**
 * Main application shell.
 */
@customElement('sp-app')
export class AppShell extends LitElement {
  static override styles = [
    theme,
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
        background: var(--bg-primary);
        color: var(--text-primary);
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-secondary);
        flex-shrink: 0;
      }

      .logo {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }

      h1 {
        font-family: var(--font-pixel);
        font-size: 12px;
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 3px;
        margin: 0;
      }

      .subtitle {
        font-family: var(--font-pixel);
        font-size: 7px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .toolbar {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .slot-count {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-secondary);
        margin-right: 8px;
      }

      main {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      footer {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px 16px;
        border-top: 1px solid var(--border-color);
        background: var(--bg-secondary);
        flex-shrink: 0;
      }

      footer span {
        font-family: var(--font-pixel);
        font-size: 6px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      footer a {
        color: var(--accent-dim);
        text-decoration: none;
      }

      footer a:hover {
        color: var(--accent);
      }

      .notification {
        position: fixed;
        top: 16px;
        right: 16px;
        background: var(--bg-secondary);
        border: 1px solid var(--accent);
        padding: 10px 16px;
        font-family: var(--font-pixel);
        font-size: 8px;
        color: var(--accent);
        z-index: 2000;
        animation: fadeIn 200ms ease;
      }

      .notification.error {
        border-color: var(--danger);
        color: var(--danger);
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      input[type='file'] {
        display: none;
      }
    `,
  ];

  private bankCtrl = new BankStateController(this);

  @state() private exportDialogOpen = false;
  @state() private notification: { message: string; error: boolean } | null = null;
  @state() private exporting = false;
  @state() private importing = false;
  @state() private exportIncludeOriginals = false;

  private notificationTimer?: ReturnType<typeof setTimeout>;
  private zipInput?: HTMLInputElement;

  override render() {
    const filledSlots = this.bankCtrl.slots.filter((s) => s !== null).length;

    return html`
      <header>
        <div class="logo">
          <h1>Sympakt</h1>
          <span class="subtitle">Sample Pack Manager</span>
        </div>
        <div class="toolbar">
          <span class="slot-count">${filledSlots}/64</span>
          <button @click=${this.onImportZip} ?disabled=${this.importing}>
            ${this.importing ? 'Importing...' : 'Import .zip'}
          </button>
          <button
            class="primary"
            @click=${this.onOpenExport}
            ?disabled=${filledSlots === 0 || this.exporting}
          >
            ${this.exporting ? 'Exporting...' : 'Export .zip'}
          </button>
          <button class="danger" @click=${this.onClearAll} ?disabled=${filledSlots === 0}>
            Clear
          </button>
        </div>
      </header>

      <main>
        <sp-sample-bank></sp-sample-bank>
      </main>

      <footer>
        <span>
          Sympakt · For the
          <a href="https://www.elektron.se/syntakt" target="_blank" rel="noopener">Elektron Syntakt</a>
        </span>
      </footer>

      <sp-export-dialog
        ?open=${this.exportDialogOpen}
        .sampleCount=${filledSlots}
        .includeOriginals=${this.exportIncludeOriginals}
        @dialog-close=${() => (this.exportDialogOpen = false)}
        @export-confirm=${this.onExportConfirm}
      ></sp-export-dialog>

      ${this.notification
        ? html`<div class="notification ${this.notification.error ? 'error' : ''}">
            ${this.notification.message}
          </div>`
        : nothing}

      <input type="file" accept=".zip" @change=${this.onZipFileSelected} />
    `;
  }

  private showNotification(message: string, error = false): void {
    this.notification = { message, error };
    clearTimeout(this.notificationTimer);
    this.notificationTimer = setTimeout(() => {
      this.notification = null;
    }, 3000);
  }

  private onImportZip(): void {
    if (!this.zipInput) {
      this.zipInput = this.shadowRoot!.querySelector('input[type="file"]') as HTMLInputElement;
    }
    this.zipInput?.click();
  }

  private async onZipFileSelected(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importing = true;
    try {
      const result = await importSamplePack(file);
      bankState.loadBank(result.slots);
      this.exportIncludeOriginals = result.includeOriginals;
      const count = result.slots.filter((s) => s !== null).length;
      this.showNotification(`Imported "${result.packName}" — ${count} samples`);
    } catch (err) {
      console.error('Import failed:', err);
      this.showNotification('Failed to import sample pack', true);
    } finally {
      this.importing = false;
      input.value = '';
    }
  }

  private onOpenExport(): void {
    this.exportDialogOpen = true;
  }

  private async onExportConfirm(e: CustomEvent<ExportOptions>): Promise<void> {
    this.exporting = true;
    try {
      this.exportIncludeOriginals = e.detail.includeOriginals;
      const blob = await exportSamplePack(this.bankCtrl.slots, e.detail);
      const filename = `${e.detail.packName.replace(/[^a-zA-Z0-9_\- ]/g, '_')}.zip`;
      downloadBlob(blob, filename);
      this.showNotification(`Exported "${e.detail.packName}"`); 
    } catch (err) {
      console.error('Export failed:', err);
      this.showNotification('Failed to export sample pack', true);
    } finally {
      this.exporting = false;
    }
  }

  private onClearAll(): void {
    if (confirm('Clear all slots?')) {
      bankState.clearAll();
      this.showNotification('All slots cleared');
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sp-app': AppShell;
  }
}
