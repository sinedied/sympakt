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
- **LOFI mode** — doubles max sample time to 10 seconds by exporting at 2× speed (one octave up); preview simulates the bandwidth reduction with a lowpass filter
- **Original file preservation** — optionally include source files in the exported archive
- **Metadata JSON** — each pack includes a `sympakt.json` with slot mappings, loop settings, and sample info
- **Zero backend** — everything runs client-side, no data ever leaves your browser

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

## Usage

1. **Import samples** — drag audio files onto any slot, or click the `+` button to browse
2. **Reorder** — drag slots to rearrange the bank
3. **Preview** — click ▶ on any slot to play the sample
4. **Loop** — click ⟳ to enable loop mode; drag the green handles to set loop points and the blue diamond to adjust crossfade
5. **LOFI** — click **LO** to enable LOFI mode; doubles max duration to 10s by exporting at 2× speed (play the sample pitched down one octave on the Syntakt to hear the original sound)
6. **Remove** — click ✕ to clear a slot (requires confirmation)
6. **Import a pack** — click **Import .zip** to load a previously exported sample pack
7. **Export** — click **Export .zip**, set a pack name, and optionally include original files

### Import from ZIP

When importing a `.zip` file, Sympakt looks for:
- WAV files named `NN_name.wav` (where NN is the slot number)
- A `sympakt.json` file for sample metadata
- An `originals/` folder with source files (if they were included during export)

## Export Format

Exported `.zip` files contain:

| Path | Description |
|------|-------------|
| `01_kick.wav` … `64_pad.wav` | 16-bit, 48 kHz, mono WAV files |
| `sympakt.json` | Pack name, slot mappings, durations, loop settings, original filenames, , if "Include originals" is checked |
| `originals/` *(optional)* | Original source files, if "Include originals" is checked |

> [!NOTE]
> Non-looped samples longer than 5 seconds are automatically truncated on export (10 seconds in LOFI mode). Looped samples export only the selected loop region with crossfade applied. LOFI samples are exported at 2× speed — pitch them down one octave on the Syntakt to hear the original sound.
