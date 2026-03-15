import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { theme } from '../styles/theme.js';
import { getEffectiveMaxDuration } from '../types/index.js';
import type { LoopSettings, LofiMode } from '../types/index.js';
import { findNearestZeroCrossing } from '../services/audio-engine.js';

type DragTarget = 'loop-start' | 'loop-end' | 'loop-region' | 'crossfade' | null;

/**
 * Pixelated waveform display component with optional interactive loop editing.
 * When loopEnabled is true, the user can:
 * - Drag loop start/end handles (auto-snap to zero crossings)
 * - Drag the loop region to reposition it
 * - Drag the crossfade handle to adjust crossfade length
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
        position: relative;
      }
      canvas {
        width: 100%;
        height: 100%;
        display: block;
        image-rendering: pixelated;
      }
      .loop-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .loop-overlay.interactive {
        pointer-events: auto;
        cursor: default;
      }
      .cf-label {
        position: absolute;
        bottom: calc(100% + 2px);
        transform: translateX(-50%);
        font-size: 9px;
        font-family: sans-serif;
        color: var(--crossfade-color);
        white-space: nowrap;
        pointer-events: none;
      }
    `,
  ];

  @property({ type: Array }) data: number[] = [];
  @property({ type: Number }) duration = 0;
  @property({ type: Boolean }) truncated = false;
  @property({ type: Boolean }) loopEnabled = false;
  @property({ type: Object }) loop: LoopSettings | null = null;
  @property({ type: Object }) audioBuffer: AudioBuffer | null = null;
  @property({ type: String }) lofi: LofiMode = 'off';
  @property({ type: Number }) effectiveMaxOverride: number | null = null;

  @state() private dragTarget: DragTarget = null;
  private dragStartX = 0;
  private dragStartLoop: LoopSettings | null = null;
  private cfLabelEl?: HTMLElement;

  private get effectiveMaxDuration(): number {
    if (this.effectiveMaxOverride !== null) return this.effectiveMaxOverride;
    return getEffectiveMaxDuration(this.lofi);
  }

  private canvas?: HTMLCanvasElement;
  private overlayCanvas?: HTMLCanvasElement;
  private resizeObserver?: ResizeObserver;
  private themeChangedHandler = () => {
    this.drawWaveform();
    this.drawLoopOverlay();
  };

  override firstUpdated(): void {
    this.canvas = this.shadowRoot!.querySelector('canvas:first-of-type')!;
    this.resizeObserver = new ResizeObserver(() => {
      this.drawWaveform();
      this.drawLoopOverlay();
    });
    this.resizeObserver.observe(this.canvas);
    this.updateOverlayRef();
    this.drawWaveform();
    this.drawLoopOverlay();
    document.addEventListener('sp-theme-changed', this.themeChangedHandler);
  }

  override updated(changed: PropertyValues): void {
    // Re-query overlay canvas since Lit may swap the element
    this.updateOverlayRef();
    this.cfLabelEl = this.shadowRoot!.querySelector('.cf-label') as HTMLElement | undefined;

    if (changed.has('data') || changed.has('duration') || changed.has('truncated') || changed.has('lofi') || changed.has('loopEnabled')) {
      this.drawWaveform();
    }
    if (changed.has('loop') || changed.has('loopEnabled') || changed.has('data') || changed.has('dragTarget') || changed.has('lofi')) {
      this.drawLoopOverlay();
    }
  }

  private updateOverlayRef(): void {
    this.overlayCanvas = this.shadowRoot!.querySelector('.loop-overlay') as HTMLCanvasElement | undefined;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    document.removeEventListener('sp-theme-changed', this.themeChangedHandler);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  // --- Waveform drawing ---

  private drawWaveform(): void {
    const canvas = this.canvas;
    if (!canvas || this.data.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width / 2));
    const height = Math.max(1, Math.floor(rect.height / 2));

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);

    const columns = this.data.length;
    const barWidth = Math.max(1, Math.floor(width / columns));
    const centerY = height / 2;

    const truncateCol =
      this.truncated && !this.loopEnabled && this.duration > this.effectiveMaxDuration
        ? Math.floor((this.effectiveMaxDuration / this.duration) * columns)
        : columns;

    for (let i = 0; i < columns; i++) {
      const x = Math.floor((i / columns) * width);
      const amplitude = this.data[i] * centerY;

      if (i < truncateCol) {
        ctx.fillStyle = getComputedStyle(this).getPropertyValue('--waveform-color').trim() || '#00ccaa';
      } else {
        ctx.fillStyle = getComputedStyle(this).getPropertyValue('--waveform-truncated').trim() || '#ff8800';
      }

      const barHeight = Math.max(1, Math.floor(amplitude));
      ctx.fillRect(x, centerY - barHeight, barWidth, barHeight * 2);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, centerY, width, 1);

    if (this.truncated && truncateCol < columns && !this.loopEnabled) {
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

  // --- Loop overlay drawing ---

  private drawLoopOverlay(): void {
    const canvas = this.overlayCanvas;
    if (!canvas) return;

    const rect = this.canvas?.getBoundingClientRect();
    if (!rect) return;

    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);

    if (!this.loopEnabled || !this.loop) return;

    const fullDuration = this.duration;
    if (fullDuration <= 0) return;

    const startX = (this.loop.startTime / fullDuration) * width;
    const endX = (this.loop.endTime / fullDuration) * width;
    const crossfadeWidth = (this.loop.crossfadeDuration / fullDuration) * width;

    // Dim area outside loop region
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, startX, height);
    ctx.fillRect(endX, 0, width - endX, height);

    // Loop region tint
    const accentColor = getComputedStyle(this).getPropertyValue('--accent').trim() || '#00ccaa';
    const [ar, ag, ab] = this.hexToRgb(accentColor);
    ctx.fillStyle = `rgba(${ar}, ${ag}, ${ab}, 0.08)`;
    ctx.fillRect(startX, 0, endX - startX, height);

    // Crossfade zone visualization depends on crossfadeAtStart mode
    const cfColor = getComputedStyle(this).getPropertyValue('--crossfade-color').trim() || '#508cff';
    const [cr, cg, cb] = this.hexToRgb(cfColor);
    const cfAtStart = this.loop.crossfadeAtStart;

    if (cfAtStart) {
      // Crossfade at START of loop
      const cfStartEndX = startX + crossfadeWidth;
      if (crossfadeWidth > 0) {
        // Blue zone at start of loop (where crossfade is applied)
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, 0.18)`;
        ctx.fillRect(startX, 0, crossfadeWidth, height);
      }

      // Source zone AFTER loop end (where crossfade audio comes from)
      if (crossfadeWidth > 0) {
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, 0.18)`;
        const postEndWidth = Math.min(crossfadeWidth, width - endX);
        ctx.fillRect(endX, 0, postEndWidth, height);
      }

      // Crossfade handle line at start zone
      if (crossfadeWidth > 0) {
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, 0.6)`;
        ctx.fillRect(cfStartEndX - 1, 0, 2, height);
      }

      // Crossfade diamond handle at top
      this.drawDiamond(ctx, cfStartEndX, 5, 4, `rgba(${cr}, ${cg}, ${cb}, 0.95)`);

      // Update crossfade label position
      if (this.cfLabelEl) {
        if (this.dragTarget === 'crossfade' && this.loop.crossfadeDuration > 0) {
          const labelX = startX + crossfadeWidth / 2;
          this.cfLabelEl.style.left = `${labelX}px`;
          this.cfLabelEl.textContent = `${(this.loop.crossfadeDuration * 1000).toFixed(0)}ms`;
          this.cfLabelEl.style.display = '';
        } else {
          this.cfLabelEl.style.display = 'none';
        }
      }
    } else {
      // Crossfade at END of loop (default)
      const cfEndStartX = endX - crossfadeWidth;
      if (crossfadeWidth > 0) {
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, 0.18)`;
        ctx.fillRect(cfEndStartX, 0, crossfadeWidth, height);
      }

      // Crossfade zone BEFORE loop start (source of fade-in audio)
      const cfPreStartX = startX - crossfadeWidth;
      if (crossfadeWidth > 0) {
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, 0.18)`;
        ctx.fillRect(Math.max(0, cfPreStartX), 0, crossfadeWidth - Math.max(0, -cfPreStartX), height);
      }

      // Crossfade handle line at end zone
      if (crossfadeWidth > 0) {
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, 0.6)`;
        ctx.fillRect(cfEndStartX - 1, 0, 2, height);
      }

      // Crossfade diamond handle at top (always visible)
      this.drawDiamond(ctx, cfEndStartX, 5, 4, `rgba(${cr}, ${cg}, ${cb}, 0.95)`);

      // Update crossfade label position directly
      if (this.cfLabelEl) {
        if (this.dragTarget === 'crossfade' && this.loop.crossfadeDuration > 0) {
          const labelX = cfEndStartX + crossfadeWidth / 2;
          this.cfLabelEl.style.left = `${labelX}px`;
          this.cfLabelEl.textContent = `${(this.loop.crossfadeDuration * 1000).toFixed(0)}ms`;
          this.cfLabelEl.style.display = '';
        } else {
          this.cfLabelEl.style.display = 'none';
        }
      }
    }

    // Loop start handle
    ctx.fillStyle = accentColor;
    ctx.fillRect(startX - 1, 0, 2, height);

    // Loop end handle
    ctx.fillStyle = accentColor;
    ctx.fillRect(endX - 1, 0, 2, height);

    // Handle grab indicators (small triangles)
    this.drawHandle(ctx, startX, height, 'right');
    this.drawHandle(ctx, endX, height, 'left');
  }

  private drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
    ctx.fill();
  }

  private drawHandle(ctx: CanvasRenderingContext2D, x: number, height: number, direction: 'left' | 'right'): void {
    const size = 4;
    const y = height / 2;
    ctx.fillStyle = getComputedStyle(this).getPropertyValue('--accent').trim() || '#00ccaa';
    ctx.beginPath();
    if (direction === 'right') {
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y);
      ctx.lineTo(x, y + size);
    } else {
      ctx.moveTo(x, y - size);
      ctx.lineTo(x - size, y);
      ctx.lineTo(x, y + size);
    }
    ctx.closePath();
    ctx.fill();
  }

  /** Convert a hex color (#rrggbb) to [r, g, b] */
  private hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16),
    ];
  }

  // --- Mouse interaction for loop editing ---

  private hitTest(clientX: number, clientY: number): DragTarget {
    if (!this.loop || !this.loopEnabled) return null;

    const rect = this.overlayCanvas!.getBoundingClientRect();
    const fullDuration = this.duration;
    if (fullDuration <= 0) return null;
    const startPx = (this.loop.startTime / fullDuration) * rect.width;
    const endPx = (this.loop.endTime / fullDuration) * rect.width;
    const cfWidthPx = (this.loop.crossfadeDuration / fullDuration) * rect.width;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const hitZone = 6;

    // Crossfade handle position depends on mode
    const cfHandlePx = this.loop.crossfadeAtStart
      ? startPx + cfWidthPx   // handle at end of start crossfade zone
      : endPx - cfWidthPx;    // handle at start of end crossfade zone

    // Crossfade handle at top — check first so it takes priority when overlapping end handle
    if (Math.abs(x - cfHandlePx) < hitZone && y < rect.height * 0.5) return 'crossfade';
    if (Math.abs(x - startPx) < hitZone) return 'loop-start';
    if (Math.abs(x - endPx) < hitZone) return 'loop-end';
    if (x > startPx + hitZone && x < endPx - hitZone) return 'loop-region';
    return null;
  }

  private onOverlayMouseDown = (e: MouseEvent): void => {
    if (!this.loopEnabled || !this.loop) return;

    const target = this.hitTest(e.clientX, e.clientY);
    if (!target) return;

    e.preventDefault();
    this.dragTarget = target;
    this.dragStartX = e.clientX;
    this.dragStartLoop = { ...this.loop };

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.dragTarget || !this.dragStartLoop || !this.audioBuffer) return;

    const audioDuration = this.audioBuffer.duration;
    const fullDuration = this.duration;
    const rect = this.overlayCanvas!.getBoundingClientRect();
    const dx = e.clientX - this.dragStartX;
    const dtRaw = (dx / rect.width) * fullDuration;

    let newLoop: LoopSettings;
    const minLoopLen = 0.01;

    switch (this.dragTarget) {
      case 'loop-start': {
        let newStart = this.dragStartLoop.startTime + dtRaw;
        newStart = Math.max(0, Math.min(newStart, this.dragStartLoop.endTime - minLoopLen));
        newStart = findNearestZeroCrossing(this.audioBuffer, newStart);
        newStart = Math.max(0, Math.min(newStart, this.dragStartLoop.endTime - minLoopLen));
        newLoop = {
          ...this.dragStartLoop,
          startTime: newStart,
          crossfadeDuration: Math.min(
            this.dragStartLoop.crossfadeDuration,
            this.dragStartLoop.endTime - newStart,
          ),
        };
        break;
      }
      case 'loop-end': {
        let newEnd = this.dragStartLoop.endTime + dtRaw;
        newEnd = Math.max(this.dragStartLoop.startTime + minLoopLen, Math.min(newEnd, audioDuration));
        newEnd = findNearestZeroCrossing(this.audioBuffer, newEnd);
        newEnd = Math.max(this.dragStartLoop.startTime + minLoopLen, Math.min(newEnd, audioDuration));
        newLoop = {
          ...this.dragStartLoop,
          endTime: newEnd,
          crossfadeDuration: Math.min(
            this.dragStartLoop.crossfadeDuration,
            newEnd - this.dragStartLoop.startTime,
          ),
        };
        break;
      }
      case 'loop-region': {
        const loopLen = this.dragStartLoop.endTime - this.dragStartLoop.startTime;
        let newStart = this.dragStartLoop.startTime + dtRaw;
        newStart = Math.max(0, Math.min(newStart, audioDuration - loopLen));
        newStart = findNearestZeroCrossing(this.audioBuffer, newStart);
        newStart = Math.max(0, Math.min(newStart, audioDuration - loopLen));
        const newEnd = Math.min(newStart + loopLen, audioDuration);
        newLoop = {
          ...this.dragStartLoop,
          startTime: newStart,
          endTime: newEnd,
        };
        break;
      }
      case 'crossfade': {
        const loopLen = this.dragStartLoop.endTime - this.dragStartLoop.startTime;
        const cfAtStart = this.dragStartLoop.crossfadeAtStart;
        let newCf: number;
        if (cfAtStart) {
          // Dragging right increases crossfade at start
          newCf = this.dragStartLoop.crossfadeDuration + dtRaw;
          const maxCf = Math.min(loopLen, audioDuration - this.dragStartLoop.endTime);
          newCf = Math.max(0, Math.min(newCf, maxCf));
        } else {
          // Dragging left increases crossfade at end (original behavior)
          newCf = this.dragStartLoop.crossfadeDuration - dtRaw;
          const maxCf = Math.min(loopLen, this.dragStartLoop.startTime);
          newCf = Math.max(0, Math.min(newCf, maxCf));
        }
        newLoop = {
          ...this.dragStartLoop,
          crossfadeDuration: newCf,
        };
        break;
      }
      default:
        return;
    }

    // Hard clamp: loop DURATION must never exceed effective max duration
    const effectiveMax = this.effectiveMaxDuration;
    const loopLen = newLoop.endTime - newLoop.startTime;
    if (loopLen > effectiveMax) {
      if (this.dragTarget === 'loop-start') {
        newLoop.startTime = newLoop.endTime - effectiveMax;
      } else {
        newLoop.endTime = newLoop.startTime + effectiveMax;
      }
    }
    // Ensure values stay in bounds
    newLoop.startTime = Math.max(0, newLoop.startTime);
    newLoop.endTime = Math.min(newLoop.endTime, audioDuration);
    // Crossfade can't exceed available source audio or the loop length
    const finalLoopLen = newLoop.endTime - newLoop.startTime;
    const maxCfSource = newLoop.crossfadeAtStart
      ? audioDuration - newLoop.endTime  // post-end audio for crossfade at start
      : newLoop.startTime;                // pre-start audio for crossfade at end
    newLoop.crossfadeDuration = Math.min(
      newLoop.crossfadeDuration,
      finalLoopLen,
      maxCfSource,
    );

    this.dispatchEvent(
      new CustomEvent('loop-change', {
        detail: newLoop,
        bubbles: true,
        composed: true,
      }),
    );
  };

  private onMouseUp = (): void => {
    this.dragTarget = null;
    this.dragStartLoop = null;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  };

  private onOverlayMouseMove = (e: MouseEvent): void => {
    if (this.dragTarget) return;
    const target = this.hitTest(e.clientX, e.clientY);
    const overlay = this.overlayCanvas;
    if (!overlay) return;

    switch (target) {
      case 'loop-start':
      case 'loop-end':
        overlay.style.cursor = 'ew-resize';
        break;
      case 'loop-region':
        overlay.style.cursor = 'grab';
        break;
      case 'crossfade':
        overlay.style.cursor = 'col-resize';
        break;
      default:
        overlay.style.cursor = 'default';
    }
  };

  override render() {
    return html`
      <canvas></canvas>
      ${this.loopEnabled
        ? html`<canvas
            class="loop-overlay interactive"
            @mousedown=${this.onOverlayMouseDown}
            @mousemove=${this.onOverlayMouseMove}
          ></canvas>`
        : html`<canvas class="loop-overlay"></canvas>`}
      <div class="cf-label" style="display: none"></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sp-waveform': WaveformView;
  }
}
