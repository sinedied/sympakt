<div align="center">

# Sympakt

**Sample Pack Manager for the Elektron Syntakt**

[![Built with Lit](https://img.shields.io/badge/Built_with-Lit-324FFF?style=flat-square)](https://lit.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6+-646CFF?style=flat-square)](https://vite.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

[Features](#features) · [Getting Started](#getting-started) · [Usage](#usage) · [Export Format](#export-format)

⭐ If you find this useful, give it a star on GitHub!

</div>

Create, preview, and export 64-slot sample banks for the [Elektron Syntakt](https://www.elektron.se/syntakt), entirely from your browser.

## Features

- **64-slot sample bank** — drag-and-drop grid with instant audio preview, auto-conversion to Syntakt format (16-bit, 48 kHz, mono), and ZIP import/export with metadata
- **Loop editing with crossfade** — interactive waveform overlay with zero-crossing snap, adjustable crossfade for click-free seamless loops
- **LOFI / XLOFI mode** — extends max sample time to 10s or 20s by exporting pitched up, with bandwidth-accurate preview
- **Dual sample mode** — pack two samples into one slot (A+B); doubles your sample count within the 64-slot limit
- **Pitch detection** — auto-detects fundamental frequency and displays the musical note
- **Virtual keyboard** — 2-octave chromatic keyboard to audition samples at different pitches
- **Fully offline & private** — single self-contained HTML file, zero backend, session auto-saved in browser

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 24 or later

### Install & Run

```bash
git clone https://github.com/<your-username>/sympackt.git
cd sympackt
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
npm run preview   # preview the production build locally
```

The build outputs a single `index.html` in `dist/` with all JS, CSS, fonts, and the favicon inlined. You can open it directly in any browser — no server needed.

## Usage

1. **Import samples** — drag audio files onto any slot, or click the **+** button to browse
2. **Reorder** — drag slots to rearrange the bank
3. **Preview** — click the play button on any slot to hear the sample
4. **Loop** — click the loop button to enable loop mode; drag the green handles to set loop points and the blue diamond to adjust crossfade
5. **LOFI / XLOFI** — click **LO** to cycle through LOFI modes: off → LOFI (10s max, 2× speed) → XLOFI (20s max, 4× speed). On the Syntakt, pitch the sample down one octave (LOFI) or two octaves (XLOFI) to hear the original sound.
6. **Remove** — click the × button to clear a slot (requires confirmation)
7. **Rename** — click a sample name and choose **RENAME** to edit the display name inline. Press Enter to confirm or Escape to cancel. Works in both normal and dual split modes.
8. **Dual sample mode** — click a sample name and choose **ENABLE DUAL SAMPLE** to split the slot into A and B halves. Drop or click to import a sample into each half. Each side has its own waveform, loop points, and playback controls. LOFI and delete affect the whole slot. To revert to single mode, click the A-side name and choose **DISABLE DUAL SAMPLE**.

   **On the Syntakt**: sample A is accessible at the regular slot position (1–64). To play sample B, set the playback direction to **reverse** — B is stored reversed at the end of the WAV, so reversing it plays the original sound. Use a short **decay** or **sample length** to isolate the half you want to hear, since both samples share the same WAV file.

9. **Import a pack** — click **Import .zip** to load a previously exported sample pack
10. **Export** — click **Export .zip**, set a pack name, toggle normalization, and optionally include original files
11. **Virtual keyboard** — press **P** or click the keyboard icon to show a 2-octave piano; click a sample slot to select it, then play it chromatically using the on-screen keys or QWERTY shortcuts (A–J for white keys, W/E/T/Y/U for sharps). Use **←/→** to shift the octave range and **↑/↓** to switch between samples

### Import from ZIP

When importing a `.zip` file, Sympakt looks for:
- WAV files named `NN_name.wav` (where NN is the slot number)
- A `sympakt.json` file for sample metadata
- An `originals/` folder with source files (if they were included during export)

## Export Format

Exported `.zip` files contain:

| Path | Description |
|------|-------------|
| `01_kick_C3.wav` … `64_pad.wav` | 16-bit, 48 kHz, mono WAV files (note appended to name if detected) |
| `01_kick-snare_DUAL.wav` | Dual sample slot: A in first half, B reversed in second half |
| `sympakt.json` | Pack name, slot mappings, durations, loop settings, original filenames, , if "Include originals" is checked |
| `originals/` *(optional)* | Original source files, if "Include originals" is checked |

> [!NOTE]
> Non-looped samples longer than 5 seconds are automatically truncated on export (10 seconds in LOFI mode, 20 seconds in XLOFI mode). Looped samples export only the selected loop region with crossfade applied. LOFI samples are exported at 2× speed (pitch down one octave on Syntakt), XLOFI at 4× speed (pitch down two octaves). Dual sample slots are exported as a single WAV with A in the first half and B reversed in the second half, separated by 20ms of silence — each side can be up to 2.49s (normal), 4.99s (LOFI), or 9.99s (XLOFI). Samples are normalized to peak volume by default.
