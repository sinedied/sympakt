import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, sharedStyles } from '../styles/theme.js';
import { iconHeart } from '../icons.js';
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

      footer .heart {
        color: #e74c3c;
        display: inline-flex;
        vertical-align: middle;
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

      button.import-highlight {
        border-color: var(--accent);
        color: var(--accent);
        background: var(--accent-glow);
        box-shadow: 0 0 8px 2px var(--accent-glow);
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
  @state() private headerDragOver = false;

  private notificationTimer?: ReturnType<typeof setTimeout>;
  private zipInput?: HTMLInputElement;

  override render() {
    const filledSlots = this.bankCtrl.slots.filter((s) => s !== null).length;

    return html`
      <header
        @dragover=${this.onHeaderDragOver}
        @dragleave=${this.onHeaderDragLeave}
        @drop=${this.onHeaderDrop}
      >
        <div class="logo">
          <h1>Sympakt</h1>
          <span class="subtitle">Sample Pack Manager</span>
        </div>
        <div class="toolbar">
          <span class="slot-count" title="Filled slots out of 64">${filledSlots}/64</span>
          <button
            class=${this.headerDragOver ? 'import-highlight' : ''}
            @click=${this.onImportZip}
            ?disabled=${this.importing}
            title="Import a sample pack from a .zip file (or drag & drop here)"
          >
            ${this.importing ? 'Importing...' : 'Import .zip'}
          </button>
          <button
            class="primary"
            @click=${this.onOpenExport}
            ?disabled=${filledSlots === 0 || this.exporting}
            title="Export the current bank as a .zip sample pack"
          >
            ${this.exporting ? 'Exporting...' : 'Export .zip'}
          </button>
          <button class="danger" @click=${this.onClearAll} ?disabled=${filledSlots === 0} title="Remove all samples from the bank">
            Clear
          </button>
        </div>
      </header>

      <main>
        <sp-sample-bank></sp-sample-bank>
      </main>

      <footer>
        <span>
          <a href="https://github.com/sinedied/sympakt" target="_blank" rel="noopener">Sympakt</a>
          · Made with <span class="heart">${iconHeart}</span> and vibes by
          <a href="https://sinedied.github.io" target="_blank" rel="noopener">sinedied</a>
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
    await this.importZipFile(file);
    input.value = '';
  }

  private async importZipFile(file: File): Promise<void> {
    this.importing = true;
    try {
      const result = await importSamplePack(file);
      bankState.loadBank(result.slots);
      this.exportIncludeOriginals = result.includeOriginals;
      const count = result.slots.filter((s) => s !== null).length;
      if (result.warning) {
        alert(result.warning);
      }
      this.showNotification(`Imported "${result.packName}" — ${count} samples`);
    } catch (err) {
      console.error('Import failed:', err);
      this.showNotification('Failed to import sample pack', true);
    } finally {
      this.importing = false;
    }
  }

  private onHeaderDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer?.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
      this.headerDragOver = true;
    }
  }

  private onHeaderDragLeave(e: DragEvent): void {
    const header = e.currentTarget as HTMLElement;
    const related = e.relatedTarget as Node | null;
    if (related && header.contains(related)) return;
    this.headerDragOver = false;
  }

  private async onHeaderDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    this.headerDragOver = false;

    const file = e.dataTransfer?.files[0];
    if (!file || !file.name.toLowerCase().endsWith('.zip')) {
      this.showNotification('Please drop a .zip file', true);
      return;
    }

    await this.importZipFile(file);
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
