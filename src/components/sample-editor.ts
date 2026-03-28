import { LitElement, html, css, nothing, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { theme, sharedStyles } from '../styles/theme.js';
import { generateWaveformData, generatePeakWaveformData, findNearestZeroCrossing } from '../services/audio-engine.js';
import { applyEffectChain, reverseAudio, normalizeAudio, applyGain } from '../services/audio-effects.js';
import { detectTransients, createEvenSlices } from '../services/transient-detection.js';
import { EXPORT_SAMPLE_RATE, WAVEFORM_COLUMNS } from '../types/index.js';
import type { Sample, SplitSample } from '../types/index.js';
import { iconPlay, iconStop, iconDownload, iconGrid } from '../icons.js';

type SlicerMode = 'off' | 'transient' | 'even' | 'manual';
type DragTarget = 'trim-start' | 'trim-end' | 'fade-in' | 'fade-out' | null;
type AccordionSection = 'utility' | 'fx' | 'slicer';

/** Powers of 2 for even slicing */
const EVEN_SLICE_VALUES = [2, 4, 8, 16, 32, 64];

interface EditorState {
  trimStart: number;
  trimEnd: number;
  reverse: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
  normalize: boolean;
  gainDb: number;
  sampleRateReduction: number;
  bitReduction: number;
  filterEnabled: boolean;
  filterType: BiquadFilterType;
  filterCutoff: number;
  filterResonance: number;
}

function defaultEditorState(duration: number): EditorState {
  return {
    trimStart: 0,
    trimEnd: duration,
    reverse: false,
    fadeInDuration: 0,
    fadeOutDuration: 0,
    normalize: false,
    gainDb: 0,
    sampleRateReduction: EXPORT_SAMPLE_RATE,
    bitReduction: 16,
    filterEnabled: false,
    filterType: 'lowpass',
    filterCutoff: 10000,
    filterResonance: 1,
  };
}

function statesEqual(a: EditorState, b: EditorState): boolean {
  return a.trimStart === b.trimStart && a.trimEnd === b.trimEnd &&
    a.reverse === b.reverse && a.fadeInDuration === b.fadeInDuration &&
    a.fadeOutDuration === b.fadeOutDuration && a.normalize === b.normalize &&
    a.gainDb === b.gainDb && a.sampleRateReduction === b.sampleRateReduction &&
    a.bitReduction === b.bitReduction && a.filterEnabled === b.filterEnabled &&
    a.filterType === b.filterType && a.filterCutoff === b.filterCutoff &&
    a.filterResonance === b.filterResonance;
}

@customElement('sp-sample-editor')
export class SampleEditor extends LitElement {
  static override styles = [
    theme,
    sharedStyles,
    css`
      :host { display: none; }
      :host([open]) { display: block; }

      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .dialog {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        width: calc(100vw - 32px);
        height: calc(100vh - 32px);
        height: calc(100dvh - 32px);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .editor-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-color);
        flex-shrink: 0;
      }

      h2 {
        font-family: var(--font-pixel);
        font-size: 10px;
        color: var(--accent);
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 2px;
      }

      .sample-name {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-secondary);
      }

      .waveform-section {
        flex-shrink: 0;
        padding: 12px 16px 0;
      }

      .waveform-area {
        position: relative;
        height: 160px;
        background: var(--bg-slot);
        border: 1px solid var(--border-color);
        touch-action: none;
      }

      .waveform-area canvas {
        width: 100%;
        height: 100%;
        display: block;
      }

      .fade-label {
        position: absolute;
        bottom: calc(100% + 2px);
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--crossfade-color);
        pointer-events: none;
        white-space: nowrap;
        display: none;
        transform: translateX(-50%);
      }

      .time-display {
        display: flex;
        justify-content: space-between;
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-secondary);
        padding: 4px 0;
      }

      .controls-area {
        flex: 1;
        overflow-y: auto;
        padding: 0 16px 12px;
        min-height: 0;
      }

      .accordion {
        border: 1px solid var(--border-color);
        margin-top: 8px;
      }

      .accordion-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        cursor: pointer;
        user-select: none;
        background: var(--bg-slot);
        border: none;
        width: 100%;
        text-align: left;
        color: var(--text-primary);
        font-family: var(--font-pixel);
        font-size: 8px;
        text-transform: uppercase;
        letter-spacing: 1px;
        transition: background var(--transition);
      }

      .accordion-header:hover {
        background: var(--bg-slot-hover);
      }

      .accordion-header:active {
        transform: none;
      }

      .accordion-header .title {
        color: var(--accent);
      }

      .accordion-header .chevron {
        font-size: 10px;
        color: var(--text-muted);
        transition: transform 200ms ease;
        display: none;
      }

      .accordion-header[aria-expanded="true"] .chevron {
        transform: rotate(180deg);
      }

      .accordion-body {
        padding: 10px;
        display: block;
      }

      .accordion-body.open {
        display: block;
      }

      .controls-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }

      .control-group {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 80px;
      }

      .control-group label {
        font-family: var(--font-pixel);
        font-size: 6px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .control-group input[type='range'] {
        width: 100px;
        accent-color: var(--accent);
        height: 4px;
      }

      .control-group input[type='range']:disabled {
        opacity: 0.3;
      }

      .control-group .value {
        font-family: var(--font-mono);
        font-size: 8px;
        color: var(--text-secondary);
      }

      .checkbox-field {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .checkbox-field input[type='checkbox'] {
        accent-color: var(--accent);
        width: 12px;
        height: 12px;
      }

      .checkbox-field label {
        font-family: var(--font-pixel);
        font-size: 7px;
        text-transform: uppercase;
        letter-spacing: 1px;
        cursor: pointer;
      }

      .radio-group {
        display: flex;
        gap: 4px;
      }

      .radio-group button {
        padding: 3px 8px;
        font-size: 7px;
      }

      .radio-group button.active {
        background: var(--accent-dim);
        border-color: var(--accent);
        color: #000;
      }

      .slicer-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: flex-end;
      }

      .slice-info {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-secondary);
      }

      .slicer-actions {
        display: flex;
        gap: 8px;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid var(--border-color);
      }

      .slicer-actions button {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      .editor-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        border-top: 1px solid var(--border-color);
        flex-shrink: 0;
        gap: 8px;
      }

      .footer-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .footer-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .processing {
        font-family: var(--font-pixel);
        font-size: 7px;
        color: var(--warning);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .preview-label { margin-left: 4px; }

      .confirm-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1100;
      }

      .confirm-dialog {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        padding: 20px;
        max-width: 400px;
      }

      .confirm-dialog h3 {
        font-family: var(--font-pixel);
        font-size: 9px;
        color: var(--accent);
        margin: 0 0 12px 0;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .confirm-dialog.warning h3 { color: var(--warning); }
      .confirm-dialog.warning { border-color: var(--warning); }

      .confirm-dialog p {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-secondary);
        margin: 0 0 16px 0;
      }

      .confirm-dialog .button-row {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      @media (max-width: 600px) {
        .dialog {
          width: 100vw;
          height: 100vh;
          height: 100dvh;
        }
        .waveform-area { height: 120px; }
        .control-group input[type='range'] { width: 70px; }
        .preview-label { display: none; }
        .editor-header { padding: 8px 12px; }
        .waveform-section { padding: 8px 12px 0; }
        .controls-area { padding: 0 12px 8px; }
        .editor-footer { padding: 8px 12px; }
        .accordion-header .chevron { display: inline; }
        .accordion-header { cursor: pointer; }
        .accordion-body { display: none; }
        .accordion-body.open { display: block; }
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Object }) sample: Sample | SplitSample | null = null;
  @property({ type: Number }) slotIndex = 0;
  @property({ type: String }) side: 'main' | 'a' | 'b' = 'main';

  @state() private fx: EditorState = defaultEditorState(0);
  @state() private initialFx: EditorState = defaultEditorState(0);
  @state() private activeSection: AccordionSection = 'utility';
  @state() private slicerMode: SlicerMode = 'off';
  @state() private slicerSensitivity = 0.5;
  @state() private slicerCount = 4;
  @state() private sliceMarkers: number[] = [];
  @state() private isPlaying = false;
  @state() private isProcessing = false;
  @state() private dragTarget: DragTarget = null;
  @state() private showSliceWarning = false;
  @state() private sliceWarningMessage = '';
  @state() private showCloseConfirm = false;
  @state() private displayWaveformData: number[] = [];

  private canvas?: HTMLCanvasElement;
  private sourceWaveformData: number[] = [];
  private stopPlaybackFn?: () => void;
  private resizeObserver?: ResizeObserver;
  private audioCtx?: AudioContext;
  private keydownHandler = this.onKeyDown.bind(this);

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this.keydownHandler);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.keydownHandler);
    this.stopPreview();
    this.resizeObserver?.disconnect();
  }

  override updated(changed: PropertyValues): void {
    if (changed.has('open') && this.open && this.sample) {
      this.initEditor();
    }
    if (changed.has('open') && !this.open) {
      this.stopPreview();
    }
    if (changed.has('fx') || changed.has('sliceMarkers') || changed.has('displayWaveformData')) {
      this.drawWaveform();
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.open) return;
    if (e.code === 'Space' && !this.isProcessing) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      e.preventDefault();
      this.onTogglePlayback();
    }
  }

  private get hasChanges(): boolean {
    return !statesEqual(this.fx, this.initialFx);
  }

  private initEditor(): void {
    if (!this.sample) return;
    const buf = this.sample.audioBuffer;
    this.fx = defaultEditorState(buf.duration);
    this.initialFx = defaultEditorState(buf.duration);
    this.sourceWaveformData = generatePeakWaveformData(buf, WAVEFORM_COLUMNS);
    this.displayWaveformData = this.sourceWaveformData;
    this.sliceMarkers = [];
    this.slicerMode = 'off';
    this.activeSection = 'utility';
    this.slicerSensitivity = 0.5;
    this.slicerCount = 4;
    this.isPlaying = false;
    this.isProcessing = false;
    this.showCloseConfirm = false;
    this.showSliceWarning = false;

    requestAnimationFrame(() => {
      this.canvas = this.shadowRoot!.querySelector('.waveform-canvas') as HTMLCanvasElement;
      if (this.canvas) {
        this.resizeObserver?.disconnect();
        this.resizeObserver = new ResizeObserver(() => this.drawWaveform());
        this.resizeObserver.observe(this.canvas);
        this.drawWaveform();
      }
    });
  }

  private updateDisplayWaveform(): void {
    if (!this.sample) return;
    let buf = this.sample.audioBuffer;
    if (this.fx.reverse) buf = reverseAudio(buf);
    if (this.fx.normalize) buf = normalizeAudio(buf);
    if (this.fx.gainDb !== 0) buf = applyGain(buf, this.fx.gainDb);
    this.displayWaveformData = generatePeakWaveformData(buf, WAVEFORM_COLUMNS);
  }

  // --- Waveform ---

  private drawWaveform(): void {
    const canvas = this.canvas;
    if (!canvas || this.displayWaveformData.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);

    const columns = this.displayWaveformData.length;
    const centerY = height / 2;
    const duration = this.sample?.audioBuffer.duration ?? 0;

    const styles = getComputedStyle(this);
    const waveColor = styles.getPropertyValue('--waveform-color').trim() || '#00ccaa';
    const dimColor = 'rgba(255,255,255,0.08)';
    const sliceColor = styles.getPropertyValue('--warning').trim() || '#ff8800';
    const crossfadeColor = styles.getPropertyValue('--crossfade-color').trim() || '#508cff';
    const cfh = crossfadeColor.replace('#', '');
    const cfR = parseInt(cfh.substring(0, 2), 16);
    const cfG = parseInt(cfh.substring(2, 4), 16);
    const cfB = parseInt(cfh.substring(4, 6), 16);
    const fadeColor = `rgba(${cfR}, ${cfG}, ${cfB}, 0.25)`;

    const trimStartCol = duration > 0 ? Math.floor((this.fx.trimStart / duration) * columns) : 0;
    const trimEndCol = duration > 0 ? Math.floor((this.fx.trimEnd / duration) * columns) : columns;

    for (let i = 0; i < columns; i++) {
      const x = Math.floor((i / columns) * width);
      const barWidth = Math.max(1, Math.floor(width / columns));
      const amplitude = this.displayWaveformData[i] * centerY;
      ctx.fillStyle = (i >= trimStartCol && i < trimEndCol) ? waveColor : dimColor;
      ctx.fillRect(x, centerY - amplitude, barWidth, amplitude * 2 || 1);
    }

    // Fade in — always draw flag handle
    if (duration > 0) {
      const fadeInEndTime = this.fx.trimStart + this.fx.fadeInDuration;
      const fiStartX = (this.fx.trimStart / duration) * width;
      const fiEndX = (fadeInEndTime / duration) * width;
      if (this.fx.fadeInDuration > 0) {
        ctx.fillStyle = fadeColor;
        ctx.beginPath();
        ctx.moveTo(fiStartX, 0);
        ctx.lineTo(fiStartX, height);
        ctx.lineTo(fiEndX, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = crossfadeColor;
        ctx.fillRect(fiEndX - 1 * dpr, 0, 2 * dpr, height);
      }
      // Flag handle (always visible) — wide flag pointing right
      const fs = 12 * dpr;
      const fh = 10 * dpr;
      ctx.fillStyle = crossfadeColor;
      ctx.beginPath();
      ctx.moveTo(fiEndX, 0);
      ctx.lineTo(fiEndX + fs, 0);
      ctx.lineTo(fiEndX + fs, fh);
      ctx.lineTo(fiEndX, fh);
      ctx.closePath();
      ctx.fill();
    }

    // Fade out — always draw flag handle
    if (duration > 0) {
      // Clamp fade-out handle to never go past trim-end
      const fadeOutStartTime = this.fx.trimEnd - this.fx.fadeOutDuration;
      const foStartX = (fadeOutStartTime / duration) * width;
      const foEndX = (this.fx.trimEnd / duration) * width;
      if (this.fx.fadeOutDuration > 0) {
        ctx.fillStyle = fadeColor;
        ctx.beginPath();
        ctx.moveTo(foStartX, 0);
        ctx.lineTo(foEndX, 0);
        ctx.lineTo(foEndX, height);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = crossfadeColor;
        ctx.fillRect(foStartX - 1 * dpr, 0, 2 * dpr, height);
      }
      // Flag handle (always visible) — wide flag pointing left
      const fs = 12 * dpr;
      const fh = 10 * dpr;
      ctx.fillStyle = crossfadeColor;
      ctx.beginPath();
      ctx.moveTo(foStartX, 0);
      ctx.lineTo(foStartX - fs, 0);
      ctx.lineTo(foStartX - fs, fh);
      ctx.lineTo(foStartX, fh);
      ctx.closePath();
      ctx.fill();
    }

    // Update fade duration labels imperatively
    this.updateFadeLabels();

    // Trim handles (drawn on top of fades) — use smooth pixel positions matching fade handles
    const hw = Math.max(2, 3 * dpr);
    const tsX = duration > 0 ? (this.fx.trimStart / duration) * width : 0;
    const teX = duration > 0 ? (this.fx.trimEnd / duration) * width : width;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tsX, 0, hw, height);
    ctx.fillRect(teX - hw, 0, hw, height);

    // Slice markers
    if (this.sliceMarkers.length > 0) {
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.strokeStyle = sliceColor;
      ctx.lineWidth = 1.5 * dpr;
      for (const t of this.sliceMarkers) {
        if (t <= this.fx.trimStart || t >= this.fx.trimEnd) continue;
        const x = Math.floor((t / duration) * width);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  /** Imperatively position the fade duration labels using canvas pixel coordinates */
  private updateFadeLabels(): void {
    const area = this.shadowRoot?.querySelector('.waveform-area') as HTMLElement | null;
    if (!area) return;
    const fiLabel = area.querySelector('.fade-label.fi') as HTMLElement | null;
    const foLabel = area.querySelector('.fade-label.fo') as HTMLElement | null;
    const duration = this.sample?.audioBuffer.duration ?? 0;
    if (!fiLabel || !foLabel || duration <= 0) return;
    const areaWidth = area.clientWidth;

    // Fade in label — centered on handle, above the waveform
    if (this.fx.fadeInDuration > 0 && this.dragTarget === 'fade-in') {
      const fiEndX = ((this.fx.trimStart + this.fx.fadeInDuration) / duration) * areaWidth;
      fiLabel.style.display = 'block';
      fiLabel.style.left = fiEndX + 'px';
      fiLabel.style.transform = 'translateX(-50%)';
      fiLabel.textContent = (this.fx.fadeInDuration * 1000).toFixed(0) + 'ms';
    } else {
      fiLabel.style.display = 'none';
    }

    // Fade out label — centered on handle, above the waveform
    if (this.fx.fadeOutDuration > 0 && this.dragTarget === 'fade-out') {
      const foStartX = ((this.fx.trimEnd - this.fx.fadeOutDuration) / duration) * areaWidth;
      foLabel.style.display = 'block';
      foLabel.style.left = foStartX + 'px';
      foLabel.style.transform = 'translateX(-50%)';
      foLabel.textContent = (this.fx.fadeOutDuration * 1000).toFixed(0) + 'ms';
    } else {
      foLabel.style.display = 'none';
    }
  }

  // --- Waveform interaction ---

  private getTimeFromPointer(e: PointerEvent): number {
    if (!this.canvas) return 0;
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return ratio * (this.sample?.audioBuffer.duration ?? 0);
  }

  private getHitTolerance(): number {
    if (!this.canvas) return 0;
    const rect = this.canvas.getBoundingClientRect();
    return 10 / rect.width * (this.sample?.audioBuffer.duration ?? 0);
  }

  private isNearSliceMarker(time: number): boolean {
    const tolerance = this.getHitTolerance();
    return this.sliceMarkers.some((m) => Math.abs(m - time) < tolerance);
  }

  private onCanvasPointerDown(e: PointerEvent): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const time = this.getTimeFromPointer(e);
    const tol = this.getHitTolerance();

    // Compute handle positions
    const fadeInPos = this.fx.trimStart + this.fx.fadeInDuration;
    const fadeOutPos = this.fx.trimEnd - this.fx.fadeOutDuration;
    const rect = canvas.getBoundingClientRect();
    const flagPx = 14; // flag width in CSS pixels for hit testing
    const flagTime = (flagPx / rect.width) * (this.sample?.audioBuffer.duration ?? 0);

    // Flag hit test: check if click is in the flag area (top of handle)
    const clickY = e.clientY - rect.top;
    const flagZone = clickY < 16; // top 16px is flag area

    // When fade=0, fade handles overlap trim handles.
    // In that case, only pick fade if click is in the flag zone.
    // When fade>0, fade handles are separate from trim handles.

    // Fade in flag/handle
    const nearFadeIn = this.fx.fadeInDuration > 0
      ? Math.abs(time - fadeInPos) < tol
      : (flagZone && time >= this.fx.trimStart && time <= this.fx.trimStart + flagTime);
    if (nearFadeIn) {
      this.dragTarget = 'fade-in';
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    // Fade out flag/handle
    const nearFadeOut = this.fx.fadeOutDuration > 0
      ? Math.abs(time - fadeOutPos) < tol
      : (flagZone && time >= this.fx.trimEnd - flagTime && time <= this.fx.trimEnd);
    if (nearFadeOut) {
      this.dragTarget = 'fade-out';
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    // Trim handles
    if (Math.abs(time - this.fx.trimStart) < tol) {
      this.dragTarget = 'trim-start';
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (Math.abs(time - this.fx.trimEnd) < tol) {
      this.dragTarget = 'trim-end';
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    // Slicer click
    if (this.slicerMode !== 'off' && time > this.fx.trimStart && time < this.fx.trimEnd) {
      const existingIdx = this.sliceMarkers.findIndex((m) => Math.abs(m - time) < tol);
      if (existingIdx >= 0) {
        if (this.slicerMode === 'transient' || this.slicerMode === 'even') this.slicerMode = 'manual';
        this.sliceMarkers = this.sliceMarkers.filter((_, i) => i !== existingIdx);
        return;
      }
      if (this.slicerMode === 'manual' || this.slicerMode === 'transient') {
        if (this.slicerMode === 'transient') this.slicerMode = 'manual';
        if (this.sliceMarkers.length < 63) {
          const snapped = this.sample?.audioBuffer
            ? findNearestZeroCrossing(this.sample.audioBuffer, time, 0.005)
            : time;
          this.sliceMarkers = [...this.sliceMarkers, snapped].sort((a, b) => a - b);
        }
      }
    }
  }

  private onCanvasPointerMove(e: PointerEvent): void {
    const canvas = this.canvas;
    if (!canvas) return;

    if (this.dragTarget) {
      const time = this.getTimeFromPointer(e);
      const duration = this.sample?.audioBuffer.duration ?? 0;
      const newFx = { ...this.fx };
      switch (this.dragTarget) {
        case 'trim-start': {
          newFx.trimStart = Math.max(0, Math.min(time, this.fx.trimEnd - 0.001));
          const trimLen = newFx.trimEnd - newFx.trimStart;
          if (newFx.fadeInDuration > trimLen) newFx.fadeInDuration = trimLen;
          if (newFx.fadeOutDuration > trimLen) newFx.fadeOutDuration = trimLen;
          break;
        }
        case 'trim-end': {
          newFx.trimEnd = Math.min(duration, Math.max(time, this.fx.trimStart + 0.001));
          const trimLen = newFx.trimEnd - newFx.trimStart;
          if (newFx.fadeOutDuration > trimLen) newFx.fadeOutDuration = trimLen;
          if (newFx.fadeInDuration > trimLen) newFx.fadeInDuration = trimLen;
          break;
        }
        case 'fade-in': {
          const maxFade = this.fx.trimEnd - this.fx.trimStart;
          newFx.fadeInDuration = Math.max(0, Math.min(time - this.fx.trimStart, maxFade));
          break;
        }
        case 'fade-out': {
          const maxFade = this.fx.trimEnd - this.fx.trimStart;
          newFx.fadeOutDuration = Math.max(0, Math.min(this.fx.trimEnd - time, maxFade));
          break;
        }
      }
      this.fx = newFx;
      return;
    }

    // Cursor
    const time = this.getTimeFromPointer(e);
    const tol = this.getHitTolerance();
    let cursor = 'default';
    const fiPos = this.fx.trimStart + this.fx.fadeInDuration;
    const foPos = this.fx.trimEnd - this.fx.fadeOutDuration;
    if (Math.abs(time - fiPos) < tol) cursor = 'col-resize';
    else if (Math.abs(time - foPos) < tol) cursor = 'col-resize';
    else if (Math.abs(time - this.fx.trimStart) < tol || Math.abs(time - this.fx.trimEnd) < tol) cursor = 'ew-resize';
    else if (this.slicerMode !== 'off' && this.isNearSliceMarker(time)) cursor = 'pointer';
    else if (this.slicerMode === 'manual' || this.slicerMode === 'transient') cursor = 'crosshair';
    canvas.style.cursor = cursor;
  }

  private onCanvasPointerUp(e: PointerEvent): void {
    if (this.dragTarget) {
      this.canvas?.releasePointerCapture(e.pointerId);
      this.dragTarget = null;
      this.updateFadeLabels();
    }
  }

  // --- Slicer ---

  private updateSliceMarkers(): void {
    if (!this.sample) return;
    const trimmed = this.fx.trimEnd - this.fx.trimStart;
    if (this.slicerMode === 'transient') {
      const onsets = detectTransients(this.sample.audioBuffer, this.slicerSensitivity, 64);
      this.sliceMarkers = onsets.filter((t) => t > this.fx.trimStart && t < this.fx.trimEnd);
    } else if (this.slicerMode === 'even') {
      this.sliceMarkers = createEvenSlices(trimmed, this.slicerCount).map((t) => t + this.fx.trimStart);
    }
  }

  private onSlicerModeChange(mode: SlicerMode): void {
    this.slicerMode = mode;
    if (mode === 'off' || mode === 'manual') this.sliceMarkers = [];
    else this.updateSliceMarkers();
  }

  private onSlicerSensitivityChange(e: Event): void {
    this.slicerSensitivity = parseFloat((e.target as HTMLInputElement).value);
    if (this.slicerMode === 'transient') this.updateSliceMarkers();
  }

  private onSlicerCountChange(count: number): void {
    this.slicerCount = count;
    if (this.slicerMode === 'even') this.updateSliceMarkers();
  }

  // --- Preview ---

  private async onTogglePlayback(): Promise<void> {
    if (this.isPlaying) { this.stopPreview(); return; }
    if (!this.sample) return;
    this.isProcessing = true;
    try {
      const processed = await applyEffectChain(this.sample.audioBuffer, this.fx);
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      const source = this.audioCtx.createBufferSource();
      source.buffer = processed;
      source.connect(this.audioCtx.destination);
      source.start();
      this.isPlaying = true;
      source.onended = () => { this.isPlaying = false; this.stopPlaybackFn = undefined; };
      this.stopPlaybackFn = () => { try { source.stop(); } catch { /* ok */ } this.isPlaying = false; this.stopPlaybackFn = undefined; };
    } catch (err) {
      console.error('Preview failed:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  private stopPreview(): void {
    this.stopPlaybackFn?.();
    this.isPlaying = false;
  }

  // --- Apply / Close ---

  private async onApply(): Promise<void> {
    if (!this.sample || !this.hasChanges) return;
    this.stopPreview();
    this.isProcessing = true;
    try {
      const processed = await applyEffectChain(this.sample.audioBuffer, this.fx);
      const waveformData = generateWaveformData(processed, WAVEFORM_COLUMNS);
      this.dispatchEvent(new CustomEvent('editor-apply', {
        detail: { audioBuffer: processed, waveformData, duration: processed.duration, slotIndex: this.slotIndex, side: this.side },
        bubbles: true, composed: true,
      }));
      // Stay open — fully reinitialize to reflect newly applied audio
      this.sample = { ...this.sample, audioBuffer: processed, waveformData, duration: processed.duration } as Sample | SplitSample;
      this.initEditor();
    } catch (err) {
      console.error('Apply failed:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  private onClose(): void {
    if (this.hasChanges) { this.showCloseConfirm = true; return; }
    this.doClose();
  }

  private doClose(): void {
    this.stopPreview();
    this.showCloseConfirm = false;
    this.open = false;
    this.dispatchEvent(new CustomEvent('editor-cancel', { bubbles: true, composed: true }));
    this.dispatchEvent(new CustomEvent('dialog-close'));
  }

  private onCloseConfirmDiscard(): void { this.doClose(); }
  private onCloseConfirmKeep(): void { this.showCloseConfirm = false; }

  // --- Slice export ---

  private getSliceBoundaries(): number[] {
    return [this.fx.trimStart, ...this.sliceMarkers.filter((t) => t > this.fx.trimStart && t < this.fx.trimEnd), this.fx.trimEnd];
  }

  private getSliceCount(): number {
    if (this.slicerMode === 'off') return 1;
    return this.getSliceBoundaries().length - 1;
  }

  private async buildSliceBuffers(): Promise<AudioBuffer[]> {
    if (!this.sample) return [];
    const bounds = this.getSliceBoundaries();
    const slices: AudioBuffer[] = [];
    for (let i = 0; i < bounds.length - 1; i++) {
      slices.push(await applyEffectChain(this.sample.audioBuffer, { ...this.fx, trimStart: bounds[i], trimEnd: bounds[i + 1] }));
    }
    return slices;
  }

  private onExportSlicesToSlots(): void {
    if (!this.sample || this.getSliceCount() < 2) return;
    this.dispatchEvent(new CustomEvent('editor-check-slots', {
      detail: { slotIndex: this.slotIndex, sliceCount: this.getSliceCount() },
      bubbles: true, composed: true,
    }));
  }

  public showSlotWarning(message: string): void {
    this.sliceWarningMessage = message;
    this.showSliceWarning = true;
  }

  public async proceedSliceExport(): Promise<void> { await this.doSliceExportToSlots(); }

  private async doSliceExportToSlots(): Promise<void> {
    this.showSliceWarning = false;
    this.isProcessing = true;
    try {
      const slices = await this.buildSliceBuffers();
      const name = this.sample?.name ?? 'slice';
      this.dispatchEvent(new CustomEvent('editor-export-slices-to-slots', {
        detail: {
          slotIndex: this.slotIndex,
          slices: slices.map((buf, i) => ({
            audioBuffer: buf,
            waveformData: generateWaveformData(buf, WAVEFORM_COLUMNS),
            duration: buf.duration,
            name: `${name}_${String(i + 1).padStart(2, '0')}`,
          })),
        },
        bubbles: true, composed: true,
      }));
      this.doClose();
    } catch (err) {
      console.error('Slice export failed:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  private async onExportSlicesZip(): Promise<void> {
    if (!this.sample || this.getSliceCount() < 2) return;
    this.isProcessing = true;
    try {
      const slices = await this.buildSliceBuffers();
      this.dispatchEvent(new CustomEvent('editor-export-slices-zip', {
        detail: { sampleName: this.sample.name, slices },
        bubbles: true, composed: true,
      }));
    } catch (err) {
      console.error('Slice ZIP export failed:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  private onSliceWarningCancel(): void { this.showSliceWarning = false; }
  private onSliceWarningContinue(): void { this.doSliceExportToSlots(); }

  // --- FX helpers ---

  private updateFx(partial: Partial<EditorState>): void { this.fx = { ...this.fx, ...partial }; }
  private updateUtilityFx(partial: Partial<EditorState>): void { this.fx = { ...this.fx, ...partial }; this.updateDisplayWaveform(); }
  private toggleSection(section: AccordionSection): void { this.activeSection = section; }
  private formatTime(t: number): string { return t.toFixed(3) + 's'; }
  private formatFreq(f: number): string { return f >= 1000 ? (f / 1000).toFixed(1) + 'kHz' : Math.round(f) + 'Hz'; }

  // --- Render ---

  override render() {
    if (!this.open || !this.sample) return null;
    const duration = this.sample.audioBuffer.duration;
    const trimmedDuration = this.fx.trimEnd - this.fx.trimStart;
    const sliceCount = this.getSliceCount();
    const hasChanges = this.hasChanges;

    return html`
      <div class="overlay">
        <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
          <div class="editor-header">
            <h2>Edit Sample</h2>
            <span class="sample-name">${this.sample.name} · ${duration.toFixed(2)}s</span>
          </div>

          <div class="waveform-section">
            <div class="waveform-area"
              @pointerdown=${this.onCanvasPointerDown}
              @pointermove=${this.onCanvasPointerMove}
              @pointerup=${this.onCanvasPointerUp}>
              <canvas class="waveform-canvas"></canvas>
              <div class="fade-label fi"></div>
              <div class="fade-label fo"></div>
            </div>
            <div class="time-display">
              <span>Start: ${this.formatTime(this.fx.trimStart)}</span>
              <span>Duration: ${trimmedDuration.toFixed(3)}s</span>
              <span>End: ${this.formatTime(this.fx.trimEnd)}</span>
            </div>
          </div>

          <div class="controls-area">
            <!-- Utility -->
            <div class="accordion">
              <button class="accordion-header" aria-expanded=${this.activeSection === 'utility' ? 'true' : 'false'}
                @click=${() => this.toggleSection('utility')}>
                <span class="title">Utility</span><span class="chevron">▼</span>
              </button>
              <div class="accordion-body ${this.activeSection === 'utility' ? 'open' : ''}">
                <div class="controls-row">
                  <div class="checkbox-field">
                    <input type="checkbox" id="ed-reverse" .checked=${this.fx.reverse}
                      @change=${(e: Event) => this.updateUtilityFx({ reverse: (e.target as HTMLInputElement).checked })} />
                    <label for="ed-reverse">Reverse</label>
                  </div>
                  <div class="checkbox-field">
                    <input type="checkbox" id="ed-normalize" .checked=${this.fx.normalize}
                      @change=${(e: Event) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        this.updateUtilityFx(checked ? { normalize: true, gainDb: 0 } : { normalize: false });
                      }} />
                    <label for="ed-normalize">Normalize</label>
                  </div>
                  <div class="control-group">
                    <label>Gain</label>
                    <input type="range" min="-24" max="24" step="0.5" .value=${String(this.fx.gainDb)}
                      @input=${(e: Event) => this.updateUtilityFx({ gainDb: parseFloat((e.target as HTMLInputElement).value) })} />
                    <span class="value">${this.fx.gainDb > 0 ? '+' : ''}${this.fx.gainDb.toFixed(1)} dB</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- FX -->
            <div class="accordion">
              <button class="accordion-header" aria-expanded=${this.activeSection === 'fx' ? 'true' : 'false'}
                @click=${() => this.toggleSection('fx')}>
                <span class="title">FX</span><span class="chevron">▼</span>
              </button>
              <div class="accordion-body ${this.activeSection === 'fx' ? 'open' : ''}">
                <div class="controls-row">
                  <div class="control-group">
                    <label>Sample Rate</label>
                    <input type="range" min="1000" max="48000" step="100" .value=${String(this.fx.sampleRateReduction)}
                      @input=${(e: Event) => this.updateFx({ sampleRateReduction: parseInt((e.target as HTMLInputElement).value) })} />
                    <span class="value">${this.formatFreq(this.fx.sampleRateReduction)}</span>
                  </div>
                  <div class="control-group">
                    <label>Bit Depth</label>
                    <input type="range" min="1" max="16" step="1" .value=${String(this.fx.bitReduction)}
                      @input=${(e: Event) => this.updateFx({ bitReduction: parseInt((e.target as HTMLInputElement).value) })} />
                    <span class="value">${this.fx.bitReduction} bit</span>
                  </div>
                </div>
                <div class="controls-row" style="margin-top:8px">
                  <div class="control-group">
                    <label>Filter</label>
                    <div class="radio-group">
                      <button class=${!this.fx.filterEnabled ? 'active' : ''}
                        @click=${() => this.updateFx({ filterEnabled: false })}>Off</button>
                      ${(['lowpass', 'highpass', 'bandpass'] as const).map((t) => html`
                        <button class=${this.fx.filterType === t && this.fx.filterEnabled ? 'active' : ''}
                          @click=${() => this.updateFx({ filterType: t, filterEnabled: true })}>${t === 'lowpass' ? 'LP' : t === 'highpass' ? 'HP' : 'BP'}</button>
                      `)}
                    </div>
                  </div>
                </div>
                <div class="controls-row" style="margin-top:8px">
                  <div class="control-group">
                    <label>Cutoff</label>
                    <input type="range" min="1.3" max="4.3" step="0.01"
                      .value=${String(Math.log10(this.fx.filterCutoff))}
                      ?disabled=${!this.fx.filterEnabled}
                      @input=${(e: Event) => this.updateFx({ filterCutoff: Math.round(Math.pow(10, parseFloat((e.target as HTMLInputElement).value))) })} />
                    <span class="value">${this.formatFreq(this.fx.filterCutoff)}</span>
                  </div>
                  <div class="control-group">
                    <label>Resonance</label>
                    <input type="range" min="0" max="30" step="0.1"
                      .value=${String(this.fx.filterResonance)}
                      ?disabled=${!this.fx.filterEnabled}
                      @input=${(e: Event) => this.updateFx({ filterResonance: parseFloat((e.target as HTMLInputElement).value) })} />
                    <span class="value">Q ${this.fx.filterResonance.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Slicer -->
            <div class="accordion">
              <button class="accordion-header" aria-expanded=${this.activeSection === 'slicer' ? 'true' : 'false'}
                @click=${() => this.toggleSection('slicer')}>
                <span class="title">Slicer${this.slicerMode !== 'off' && sliceCount >= 2 ? html` <span style="color:var(--text-muted);font-size:7px;letter-spacing:0;margin-left:8px">${sliceCount} slices</span>` : nothing}</span><span class="chevron">▼</span>
              </button>
              <div class="accordion-body ${this.activeSection === 'slicer' ? 'open' : ''}">
                <div class="slicer-controls">
                  <div class="control-group">
                    <label>Mode</label>
                    <div class="radio-group">
                      <button class=${this.slicerMode === 'off' ? 'active' : ''} @click=${() => this.onSlicerModeChange('off')}>Off</button>
                      <button class=${this.slicerMode === 'transient' ? 'active' : ''} @click=${() => this.onSlicerModeChange('transient')}>Transient</button>
                      <button class=${this.slicerMode === 'even' ? 'active' : ''} @click=${() => this.onSlicerModeChange('even')}>Even</button>
                      <button class=${this.slicerMode === 'manual' ? 'active' : ''} @click=${() => this.onSlicerModeChange('manual')}>Manual</button>
                    </div>
                  </div>
                </div>
                ${this.slicerMode === 'transient' ? html`
                  <div class="slicer-controls" style="margin-top:8px">
                    <div class="control-group">
                      <label>Sensitivity</label>
                      <input type="range" min="0" max="1" step="0.01" .value=${String(this.slicerSensitivity)}
                        @input=${this.onSlicerSensitivityChange} />
                      <span class="value">${(this.slicerSensitivity * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ` : nothing}
                ${this.slicerMode === 'even' ? html`
                  <div class="slicer-controls" style="margin-top:8px">
                    <div class="control-group">
                      <label>Slices</label>
                      <div class="radio-group">
                        ${EVEN_SLICE_VALUES.map((n) => html`
                          <button class=${this.slicerCount === n ? 'active' : ''}
                            @click=${() => this.onSlicerCountChange(n)}>${n}</button>
                        `)}
                      </div>
                    </div>
                  </div>
                ` : nothing}
                ${this.slicerMode === 'manual' ? html`
                  <div class="slicer-controls" style="margin-top:8px">
                    <span class="slice-info">Click waveform to add/remove markers</span>
                  </div>
                ` : nothing}
                ${this.slicerMode !== 'off' && sliceCount >= 2 ? html`
                  <div class="slicer-actions">
                    <button @click=${this.onExportSlicesToSlots} ?disabled=${this.isProcessing}
                      title="Export slices to bank slots starting from slot ${this.slotIndex + 1}">
                      ${iconGrid} To Slots
                    </button>
                    <button @click=${this.onExportSlicesZip} ?disabled=${this.isProcessing}
                      title="Download slices as individual WAV files in a ZIP">
                      ${iconDownload} Download ZIP
                    </button>
                  </div>
                ` : nothing}
              </div>
            </div>
          </div>

          <div class="editor-footer">
            <div class="footer-left">
              <button @click=${this.onTogglePlayback} ?disabled=${this.isProcessing} title="Preview with effects (Space)">
                ${this.isPlaying ? iconStop : iconPlay}
                <span class="preview-label">${this.isPlaying ? 'Stop' : 'Preview'}</span>
              </button>
              ${this.isProcessing ? html`<span class="processing">Processing...</span>` : nothing}
            </div>
            <div class="footer-right">
              <button @click=${this.onClose}>Close</button>
              <button class="primary" @click=${this.onApply} ?disabled=${this.isProcessing || !hasChanges}>Apply</button>
            </div>
          </div>
        </div>
      </div>

      ${this.showCloseConfirm ? html`
        <div class="confirm-overlay" @click=${(e: Event) => e.stopPropagation()}>
          <div class="confirm-dialog">
            <h3>Unsaved Changes</h3>
            <p>You have unapplied changes. Discard them and close?</p>
            <div class="button-row">
              <button @click=${this.onCloseConfirmKeep}>Keep Editing</button>
              <button class="primary" @click=${this.onCloseConfirmDiscard}>Discard & Close</button>
            </div>
          </div>
        </div>
      ` : nothing}

      ${this.showSliceWarning ? html`
        <div class="confirm-overlay" @click=${(e: Event) => e.stopPropagation()}>
          <div class="confirm-dialog warning">
            <h3>Warning</h3>
            <p>${this.sliceWarningMessage}</p>
            <div class="button-row">
              <button @click=${this.onSliceWarningCancel}>Cancel</button>
              <button class="primary" @click=${this.onSliceWarningContinue}>Continue</button>
            </div>
          </div>
        </div>
      ` : nothing}
    `;
  }
}
