<div align="center">

# Sympakt

**Sample Pack Manager for the Elektron Syntakt**

[![Built with Lit](https://img.shields.io/badge/Built_with-Lit-324FFF?style=flat-square)](https://lit.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6+-646CFF?style=flat-square)](https://vite.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

Create, preview, and export 64-slot sample banks for the [Elektron Syntakt](https://www.elektron.se/syntakt) — entirely in the browser.

[Features](#features) · [Getting Started](#getting-started) · [Usage](#usage) · [Export Format](#export-format)

⭐ If you find this useful, give it a star on GitHub!

</div>

## Features

- **64-slot sample bank** — vertically scrollable grid with drag-and-drop reordering
- **In-browser audio playback** — preview any sample instantly
- **Seamless loop editing** — interactive waveform overlay with draggable start/end handles that snap to zero crossings
- **Crossfade looping** — adjustable crossfade blends the loop tail with pre-start audio for click-free seamless loops
- **ZIP import/export** — load and save complete sample packs as `.zip` files
- **Auto-conversion** — imported samples are resampled to 16-bit, 48 kHz, mono (Syntakt format)
- **5-second truncation** — samples exceeding max duration are truncated with visual warning
- **LOFI / XLOFI mode** — extends max sample time to 10s (LOFI, 2× speed) or 20s (XLOFI, 4× speed) by exporting pitched up; preview simulates the bandwidth reduction with a lowpass filter
- **Dual sample mode** — pack two samples into one slot (A and B); on the Syntakt, sample A plays normally and sample B is accessed using the reversed playback direction. Useful for doubling your sample count within the 64-slot limit
- **Auto pitch detection** — detects the fundamental frequency of each sample and displays the musical note (e.g. C3, A#4); detected notes are included in exported filenames and metadata. Enabled via Settings as an experimental feature.
- **Manual note override** — click any detected note (or the dash placeholder) to open a dropdown and choose a different note or set it to "None"
- **Global settings** — gear button in the header opens a settings dialog; settings are persisted across sessions
- **Hidden pitch debug mode** — press Cmd/Ctrl + Alt + D (Shift optional) to toggle per-slot pitch diagnostics (confidence, ZCR, and rejection reason)
- **Original file preservation** — optionally include source files in the exported archive
- **Normalize on export** — automatically maximizes sample volume without clipping (enabled by default)
- **Metadata JSON** — each pack includes a `sympakt.json` with slot mappings, loop settings, and sample info
- **Zero backend** — everything runs client-side, no data ever leaves your browser
- **Single-file that works offline** — App is only one self-contained HTML file, fully usable offline
- **Session persistence** — your current bank, samples, and export options are automatically saved to IndexedDB and restored when you reopen the page
- **Virtual keyboard** — toggle a 2-octave piano keyboard (press **P** or click the keyboard icon) to audition selected samples at different pitches with full rendering (loop, crossfade, LOFI); use arrow keys to navigate samples and shift octaves, plus QWERTY shortcuts for quick playing

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
7. **Dual sample mode** — right-click (or click) a sample name and choose **ENABLE DUAL SAMPLE** to split the slot into A and B halves. Drop or click to import a sample into each half. Each side has its own waveform, loop points, and playback controls. LOFI and delete affect the whole slot. To revert to single mode, click either sample name and choose **DISABLE DUAL SAMPLE**.

   **On the Syntakt**: sample A is accessible at the regular slot position (1–64). To play sample B, set the playback direction to **reverse** — B is stored reversed at the end of the WAV, so reversing it plays the original sound. Use a short **decay** or **sample length** to isolate the half you want to hear, since both samples share the same WAV file.

8. **Import a pack** — click **Import .zip** to load a previously exported sample pack
9. **Export** — click **Export .zip**, set a pack name, toggle normalization, and optionally include original files
10. **Virtual keyboard** — press **P** or click the keyboard icon to show a 2-octave piano; click a sample slot to select it, then play it chromatically using the on-screen keys or QWERTY shortcuts (A–J for white keys, W/E/T/Y/U for sharps). Use **←/→** to shift the octave range and **↑/↓** to switch between samples

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
