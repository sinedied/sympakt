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
    --accent: #00ccaa;
    --accent-dim: #009977;
    --accent-glow: rgba(0, 204, 170, 0.15);
    --danger: #ff4444;
    --warning: #ff8800;
    --warning-dim: rgba(255, 136, 0, 0.3);
    --waveform-color: #00ccaa;
    --waveform-truncated: #ff8800;
    --scrollbar-track: #141414;
    --scrollbar-thumb: #333333;
    --font-pixel: 'PixelFont', monospace;
    --font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    --slot-height: 32px;
    --radius: 2px;
    --transition: 150ms ease;
  }
`;

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
