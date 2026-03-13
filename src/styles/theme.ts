import { css } from 'lit';

export const theme = css`
  :host {
    --bg-primary: #0a0a0a;
    --bg-secondary: #141414;
    --bg-slot: #1a1a1a;
    --bg-slot-hover: #222222;
    --bg-slot-active: #2a2a2a;
    --border-color: #333333;
    --border-hover: #555555;
    --text-primary: #e0e0e0;
    --text-secondary: #999999;
    --text-muted: #777777;
    --accent: var(--sp-accent, #00ccaa);
    --accent-dim: var(--sp-accent-dim, #009977);
    --accent-glow: var(--sp-accent-glow, rgba(0, 204, 170, 0.15));
    --danger: var(--sp-danger, #ff4444);
    --warning: var(--sp-warning, #ff8800);
    --warning-dim: var(--sp-warning-dim, rgba(255, 136, 0, 0.3));
    --waveform-color: var(--sp-waveform-color, #00ccaa);
    --waveform-truncated: var(--sp-waveform-truncated, #ff8800);
    --crossfade-color: var(--sp-crossfade-color, #508cff);
    --scrollbar-track: #141414;
    --scrollbar-thumb: #333333;
    --font-pixel: 'PixelFont', monospace;
    --font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    --slot-height: 32px;
    --radius: 2px;
    --transition: 150ms ease;
  }
`;

/** Colorblind-friendly color overrides (blue/yellow/pink palette) */
export const colorblindThemeProperties: Record<string, string> = {
  '--sp-accent': '#5599ff',
  '--sp-accent-dim': '#3366cc',
  '--sp-accent-glow': 'rgba(85, 153, 255, 0.15)',
  '--sp-danger': '#ff6699',
  '--sp-warning': '#ddbb00',
  '--sp-warning-dim': 'rgba(221, 187, 0, 0.3)',
  '--sp-waveform-color': '#5599ff',
  '--sp-waveform-truncated': '#ddbb00',
  '--sp-crossfade-color': '#ff9944',
};

/** Apply or remove the colorblind theme on the document root */
export function applyColorblindTheme(enabled: boolean): void {
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(colorblindThemeProperties)) {
    if (enabled) {
      root.style.setProperty(prop, value);
    } else {
      root.style.removeProperty(prop);
    }
  }
  // Notify waveform components to repaint with new colors
  document.dispatchEvent(new CustomEvent('sp-theme-changed'));
}

export const sharedStyles = css`
  * {
    box-sizing: border-box;
  }

  button {
    font-family: var(--font-pixel);
    font-size: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    padding: 6px 12px;
    cursor: pointer;
    transition: all var(--transition);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  button:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-glow);
  }

  button:active {
    transform: scale(0.97);
  }

  button.primary {
    background: var(--accent-dim);
    border-color: var(--accent);
    color: #000;
    font-weight: bold;
  }

  button.primary:hover {
    background: var(--accent);
  }

  button.danger {
    border-color: var(--danger);
    color: var(--danger);
  }

  button.danger:hover {
    background: rgba(255, 68, 68, 0.15);
  }

  input[type='text'] {
    font-family: var(--font-pixel);
    font-size: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    padding: 6px 10px;
    outline: none;
    transition: border-color var(--transition);
  }

  input[type='text']:focus {
    border-color: var(--accent);
  }

  label {
    font-family: var(--font-pixel);
    font-size: 8px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #444;
  }
`;
