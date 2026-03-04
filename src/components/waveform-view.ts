import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { theme } from '../styles/theme.js';
import { MAX_SAMPLE_DURATION } from '../types/index.js';

/**
 * Pixelated waveform display component.
 * Renders waveform data on a canvas with truncation indicator.
 */
@customElement('sp-waveform')
export class WaveformView extends LitElement {
  static override styles = [
    theme,
    css`
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      canvas {
        width: 100%;
        height: 100%;
        display: block;
        image-rendering: pixelated;
      }
    `,
  ];

  @property({ type: Array }) data: number[] = [];
  @property({ type: Number }) duration = 0;
  @property({ type: Boolean }) truncated = false;

  private canvas?: HTMLCanvasElement;
  private resizeObserver?: ResizeObserver;

  override firstUpdated(): void {
    this.canvas = this.shadowRoot!.querySelector('canvas')!;
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(this.canvas);
    this.draw();
  }

  override updated(changed: PropertyValues): void {
    if (changed.has('data') || changed.has('duration') || changed.has('truncated')) {
      this.draw();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  private draw(): void {
    const canvas = this.canvas;
    if (!canvas || this.data.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    // Use pixelated render: lower internal resolution
    const width = Math.max(1, Math.floor(rect.width / 2));
    const height = Math.max(1, Math.floor(rect.height / 2));

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);

    const columns = this.data.length;
    const barWidth = Math.max(1, Math.floor(width / columns));
    const centerY = height / 2;

    // Determine truncation cutoff column
    const truncateCol =
      this.truncated && this.duration > MAX_SAMPLE_DURATION
        ? Math.floor((MAX_SAMPLE_DURATION / this.duration) * columns)
        : columns;

    for (let i = 0; i < columns; i++) {
      const x = Math.floor((i / columns) * width);
      const amplitude = this.data[i] * centerY;

      if (i < truncateCol) {
        ctx.fillStyle = getComputedStyle(this).getPropertyValue('--waveform-color').trim() || '#00ccaa';
      } else {
        ctx.fillStyle = getComputedStyle(this).getPropertyValue('--waveform-truncated').trim() || '#ff8800';
      }

      // Draw symmetric bar
      const barHeight = Math.max(1, Math.floor(amplitude));
      ctx.fillRect(x, centerY - barHeight, barWidth, barHeight * 2);
    }

    // Draw center line
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, centerY, width, 1);

    // Draw truncation line
    if (this.truncated && truncateCol < columns) {
      const truncX = Math.floor((truncateCol / columns) * width);
      ctx.strokeStyle = getComputedStyle(this).getPropertyValue('--warning').trim() || '#ff8800';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(truncX, 0);
      ctx.lineTo(truncX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  override render() {
    return html`<canvas></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sp-waveform': WaveformView;
  }
}
