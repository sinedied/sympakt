<div align="center">

# SYMPAKT

**Sample Pack Manager for the Elektron Syntakt**

[![Built with Lit](https://img.shields.io/badge/Built_with-Lit-324FFF?style=flat-square)](https://lit.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6+-646CFF?style=flat-square)](https://vite.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

Create, preview, and export 64-slot sample banks for the [Elektron Syntakt](https://www.elektron.se/syntakt) — entirely in the browser.

[Features](#features) · [Getting Started](#getting-started) · [Usage](#usage) · [Export Format](#export-format)

</div>

---

## Features

- **64-slot sample bank** — vertically scrollable grid with drag-and-drop reordering
- **Pixelated waveform previews** — Elektron-inspired visual style using Web Audio API analysis
- **In-browser audio playback** — preview any sample instantly
- **ZIP import/export** — load and save complete sample packs as `.zip` files
- **Auto-conversion** — imported samples are resampled to 16-bit, 48 kHz, mono (Syntakt format)
- **5-second truncation** — samples exceeding max duration are truncated with visual warning
- **Original file preservation** — optionally include source files in the exported archive
- **Metadata JSON** — each pack includes a `sympakt-metadata.json` with slot mappings and sample info
- **Zero backend** — everything runs client-side, no data ever leaves your browser
- **Dark pixel UI** — design language inspired by Elektron hardware aesthetics

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
4. **Remove** — click ✕ to clear a slot
5. **Import a pack** — click **Import .zip** to load a previously exported sample pack
6. **Export** — click **Export .zip**, set a pack name, and optionally include original files

### Import from ZIP

When importing a `.zip` file, Sympakt looks for:
- WAV files named `NN_name.wav` (where NN is the slot number)
- A `sympakt-metadata.json` file for sample metadata
- An `originals/` folder with source files (if they were included during export)

## Export Format

Exported `.zip` files contain:

| Path | Description |
|------|-------------|
| `01_kick.wav` … `64_pad.wav` | 16-bit, 48 kHz, mono WAV files |
| `sympakt-metadata.json` | Pack name, slot mappings, durations, original filenames |
| `originals/` *(optional)* | Original source files, if "Include originals" is checked |

> [!NOTE]
> Samples longer than 5 seconds are automatically truncated on export. The waveform preview highlights the truncated portion in orange.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Components | [Lit](https://lit.dev) 3 |
| Build | [Vite](https://vite.dev) 6 |
| Language | TypeScript (strict) |
| Audio | Web Audio API |
| Compression | [fflate](https://github.com/101arrowz/fflate) |
| Deployment | GitHub Pages |

## Deployment

The project includes a GitHub Actions workflow that automatically builds and deploys to GitHub Pages on every push to `main`. See [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

To enable it:
1. Go to your repository **Settings → Pages**
2. Set **Source** to **GitHub Actions**

---

<div align="center">

⭐ If you find this useful, give it a star on GitHub!

</div>
