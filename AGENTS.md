# Sympakt

A single-page application for managing sample packs for the Elektron Syntakt synthesizer. Built as a client-only web app — all audio processing happens in the browser.

## Overview

- **Purpose**: Create, edit, preview, and export 64-slot sample banks compatible with the Elektron Syntakt
- **Architecture**: Frontend-only SPA using Lit web components, Vite build tooling, TypeScript
- **Audience**: Elektron Syntakt owners who want to manage their sample packs from the browser
- **Deployment**: GitHub Pages (static site)

## Project Structure

```
src/
├── components/       # Lit web components
│   ├── app-shell.ts        # Main application shell
│   ├── sample-bank.ts      # 64-slot scrollable bank with drag & drop
│   ├── sample-slot.ts      # Individual sample slot
│   ├── waveform-view.ts    # Pixelated waveform preview canvas
│   └── export-dialog.ts    # Export options dialog
├── services/
│   ├── audio-engine.ts     # Web Audio API: decode, resample, preview, analyze
│   ├── wav-encoder.ts      # Encode PCM data to 16-bit/48kHz/mono WAV
│   ├── wav-decoder.ts      # Decode WAV files
│   └── zip-service.ts      # ZIP import/export using fflate
├── state/
│   └── bank-state.ts       # Reactive state management for the sample bank
├── types/
│   └── index.ts            # Shared TypeScript types and interfaces
├── styles/
│   └── theme.ts            # Global styles, Elektron design tokens, pixel font
├── index.ts                # App entry point
└── index.html              # HTML shell
```

## Key Technologies and Frameworks

- **Runtime**: Node.js 24+, ESM modules
- **Language**: TypeScript (strict mode)
- **Build**: Vite 6+
- **UI**: Lit 3+ web components (no framework)
- **Audio**: Web Audio API (decoding, resampling, playback, waveform analysis)
- **ZIP**: fflate (lightweight, zero-dependency compression)
- **Styling**: CSS via Lit `css` tagged templates; Elektron-inspired dark theme with pixel fonts

## Constraints and Requirements

- **No backend** — everything runs client-side
- **Minimal dependencies** — prefer browser APIs over libraries
- **Export format**: 16-bit, 48kHz, mono WAV (Syntakt requirement)
- **Max sample length**: looped samples export only the loop region; non-looped samples are truncated to 5 seconds (10 seconds in LOFI mode)
- **Max loop duration**: 5 seconds (10 seconds in LOFI mode)
- **Bank size**: exactly 64 slots
- **File naming on export**: `<slot_number>_<sample_name>.wav` (e.g., `01_kick.wav`)
- **Metadata**: JSON file included in exported ZIP with original filenames, sample options, loop settings, and structure
- **Audio buffer preservation**: full audio duration is kept in memory (no truncation at import); truncation/extraction happens only at export time

## Development Workflow

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Type check
npm run typecheck

# Build for production
npm run build

# Preview production build
npm run preview
```

## Coding Guidelines

- Use Lit reactive properties and decorators for component state
- Prefer `@property()` for public API, `@state()` for internal state
- Use TypeScript strict mode; avoid `any`
- Components should be self-contained with scoped styles via Shadow DOM
- Use `css` tagged template literals for styles — no external CSS files
- Keep audio processing in dedicated services, not in components
- Use `async`/`await` for all asynchronous operations
- Name custom elements with `sp-` prefix (e.g., `<sp-sample-slot>`)
- Use named exports; one primary export per file
- Barrel exports from `types/index.ts` only

## Audio Processing Notes

- Decoding: use `AudioContext.decodeAudioData()` for broad format support
- Resampling: use `OfflineAudioContext` at 48kHz to resample imported audio (full duration preserved)
- Waveform generation: compute RMS values per pixel column from decoded PCM data
- Truncation: non-looped samples > 5s (or > 10s in LOFI mode) show orange truncated region on waveform; truncation happens at export
- WAV encoding: manual PCM encoding to ArrayBuffer (no library needed)

## Loop Editing

- **Toggle**: each slot has a loop button (⟳); enabling sets loop from 10% to end of sample (capped at 5s) with 10% crossfade duration
- **Loop overlay**: interactive canvas overlay on the waveform with draggable handles
  - Green handles: loop start/end points (auto-snap to zero crossings)
  - Blue diamond at top: crossfade duration handle
  - Blue zones: crossfade blend region at end of loop + source region before loop start
  - Dimmed regions: audio outside the loop
- **Crossfade approach**: the tail of the loop is blended with audio from *before* the loop start point (not from the beginning of the loop). This produces a natural seamless transition when playback wraps.
- **Constraints**: loop duration ≤ 5s (≤ 10s in LOFI mode), crossfade ≤ loop length, crossfade ≤ available pre-start audio
- **Playback preview**: looped playback with crossfade baked in via Web Audio API `AudioBufferSourceNode.loop`
- **Export**: looped samples export only the loop region with crossfade applied; non-looped samples truncated to 5s (10s in LOFI mode)
- **ZIP roundtrip**: loop settings and LOFI flag are stored in metadata JSON and restored on import; original files (when included) are used for audio decoding on re-import

## LOFI Mode

- **Purpose**: doubles the effective max sample time from 5s to 10s by exporting the audio at 2× speed (pitched up one octave). On the Syntakt, the user plays the sample pitched down one octave to hear the original sound.
- **Toggle**: each slot has a **LO** button; when active it turns orange.
- **Effective durations**: `MAX_SAMPLE_DURATION × LOFI_SPEED_FACTOR` (currently 5s × 2 = 10s) for truncation, loop constraints, and waveform display.
- **Export**: `resampleToExportFormat(buffer, speedFactor=2)` produces a buffer at 2× playback speed; loop times are scaled by `1/LOFI_SPEED_FACTOR` in the export domain.
- **Preview playback**: plays at normal 1× rate with a **lowpass filter** at 12 kHz (`EXPORT_SAMPLE_RATE / (2 × LOFI_SPEED_FACTOR)`) to simulate the reduced bandwidth of the final exported audio.
- **State**: `Sample.lofi: boolean`, toggled via `bankState.updateSampleLofi()`. Toggling recalculates `isTruncated` and clamps loop duration when disabling LOFI.
- **Metadata**: `lofi` flag is saved/restored in `sympakt.json` for ZIP roundtrip.

## Security Considerations

- All file I/O happens via browser File API and drag-and-drop — no server calls
- No user data leaves the browser
- ZIP extraction should validate filenames and sizes to avoid zip bombs

## Documentation Maintenance

- When features are added or updated, **always update both `README.md` and `AGENTS.md`** to reflect the changes.
- `README.md` is user-facing: update features list, usage instructions, and export format notes.
- `AGENTS.md` is agent-facing: update constraints, processing notes, and add dedicated sections for new features with implementation details.
