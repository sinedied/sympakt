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
├── assets/
│   └── PressStart2P-Regular.woff2  # Pixel font (inlined at build time)
├── components/       # Lit web components
│   ├── app-shell.ts        # Main application shell
│   ├── sample-bank.ts      # 64-slot scrollable bank with drag & drop
│   ├── sample-slot.ts      # Individual sample slot
│   ├── waveform-view.ts    # Pixelated waveform preview canvas
│   └── export-dialog.ts    # Export options dialog
├── services/
│   ├── audio-engine.ts     # Web Audio API: decode, resample, preview, analyze
│   ├── persistence.ts      # IndexedDB session persistence (bank + settings)
│   ├── wav-encoder.ts      # Encode PCM data to 16-bit/48kHz/mono WAV
│   ├── wav-decoder.ts      # Decode WAV files
│   └── zip-service.ts      # ZIP import/export using fflate
├── state/
│   └── bank-state.ts       # Reactive state management for the sample bank
├── types/
│   └── index.ts            # Shared TypeScript types and interfaces
├── styles/
│   └── theme.ts            # Global styles, Elektron design tokens, pixel font
├── icons.ts                # SVG icon library (Lit svg templates)
├── vite-env.d.ts           # Vite client type declarations
├── index.ts                # App entry point
└── index.html              # HTML shell
```

## Key Technologies and Frameworks

- **Runtime**: Node.js 24+, ESM modules
- **Language**: TypeScript (strict mode)
- **Build**: Vite 6+ with `vite-plugin-singlefile` (single HTML output)
- **UI**: Lit 3+ web components (no framework)
- **Audio**: Web Audio API (decoding, resampling, playback, waveform analysis)
- **ZIP**: fflate (lightweight, zero-dependency compression)
- **Styling**: CSS via Lit `css` tagged templates; Elektron-inspired dark theme with pixel fonts
- **Icons**: Inline SVG via Lit `svg` tagged templates (`src/icons.ts`)

## Constraints and Requirements

- **No backend** — everything runs client-side
- **Single-file build** — production build outputs a single self-contained `index.html` (all JS, CSS, fonts, and favicon inlined)
- **Minimal dependencies** — prefer browser APIs over libraries
- **Export format**: 16-bit, 48kHz, mono WAV (Syntakt requirement)
- **Normalization**: peak normalization applied per-sample on export (enabled by default, can be toggled in export dialog)
- **Max sample length**: looped samples export only the loop region; non-looped samples are truncated to 5 seconds (10 seconds in LOFI mode)
- **Max loop duration**: 5 seconds (10 seconds in LOFI mode)
- **Bank size**: exactly 64 slots
- **File naming on export**: `<slot_number>_<sample_name>[_<detected_note>].wav` (e.g., `01_kick.wav`, `10_Kick_C3.wav`)
- **Metadata**: JSON file included in exported ZIP with original filenames, sample options, loop settings, detected notes, and structure
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
- Truncation: non-looped samples > 5s (or > 10s in LOFI, > 20s in XLOFI mode) show orange truncated region on waveform; truncation happens at export
- WAV encoding: manual PCM encoding to ArrayBuffer (no library needed)

## Loop Editing

- **Toggle**: each slot has a loop button (loop icon); enabling sets loop from 10% to end of sample (capped at 5s) with 10% crossfade duration
- **Loop overlay**: interactive canvas overlay on the waveform with draggable handles
  - Green handles: loop start/end points (auto-snap to zero crossings)
  - Blue diamond at top: crossfade duration handle
  - Blue zones: crossfade blend region at end of loop + source region before loop start
  - Dimmed regions: audio outside the loop
- **Crossfade approach**: the tail of the loop is blended with audio from *before* the loop start point (not from the beginning of the loop). This produces a natural seamless transition when playback wraps.
- **Constraints**: loop duration ≤ 5s (≤ 10s in LOFI, ≤ 20s in XLOFI mode), crossfade ≤ loop length, crossfade ≤ available pre-start audio
- **Playback preview**: looped playback with crossfade baked in via Web Audio API `AudioBufferSourceNode.loop`
- **Export**: looped samples export only the loop region with crossfade applied; non-looped samples truncated to 5s (10s in LOFI, 20s in XLOFI mode)
- **ZIP roundtrip**: loop settings and LOFI mode are stored in metadata JSON and restored on import; original files (when included) are used for audio decoding on re-import

## Pitch Detection

- **Purpose**: automatically detect the fundamental frequency of each imported sample and display the corresponding musical note (e.g. C3, A#4, G2)
- **Global toggle**: pitch detection is off by default. Enable it in the Settings dialog (gear icon in header). The setting is persisted in IndexedDB across sessions.
- **When enabled**: pitch detection runs on all current samples and on newly imported ones. When disabled, all existing pitch data is cleared.
- **Algorithm**: McLeod Pitch Method (NSDF) with downsampling, zero-crossing rate filtering, and parabolic interpolation. Analyzes multiple windows in the first ~1.2s of audio and takes the median detected frequency.
- **Function**: `detectPitch(buffer: AudioBuffer): string | null` and `detectPitchWithDebug(buffer)` in `services/audio-engine.ts`; `frequencyToNote(freq: number): string | null` maps Hz to note name
- **Type**: `Sample.detectedNote: string | null` — null when no clear pitch is detected (e.g. noise, percussion)
- **Manual override**: clicking the detected note opens a dropdown with all notes C0–B7 plus "None". The selected note overrides auto-detection and is used in export/metadata.
- **UI**: detected note is displayed in the sample slot between the sample name and duration, styled in blue. Click to change.
- **Export filename**: when a note is set, it is appended to the filename: `<slot>_<name>_<note>.wav` (e.g. `10_Kick_C3.wav`)
- **Metadata**: `detectedNote` field is included in `SlotMetadata` when present
- **Persistence**: `detectedNote` is stored in IndexedDB and restored on page reload
- **ZIP roundtrip**: note is stored in metadata JSON; on re-import, the stored note is used (falls back to re-detection if pitch detection is enabled)
- **Debug mode**: hidden pitch diagnostics can be toggled with **Cmd/Ctrl + Alt + D** (Shift optional) to display per-slot detection stats (clarity, ZCR, spread, rejection reason)

## LOFI / XLOFI Mode

- **Purpose**: extends the effective max sample time beyond 5s by exporting audio at higher playback speed. LOFI (2× speed, one octave up) gives 10s; XLOFI (4× speed, two octaves up) gives 20s. On the Syntakt, the user pitches the sample down accordingly to hear the original sound.
- **Three-state toggle**: each slot has a **LO** button that cycles: off → LOFI (orange) → XLOFI (pink, label changes to **XL**) → off.
- **Type**: `LofiMode = 'off' | 'lofi' | 'xlofi'` — replaces the old boolean. `normalizeLofiMode()` handles backward-compatible deserialization of legacy `true`/`false` values.
- **Helper functions** (in `types/index.ts`):
  - `getLofiSpeedFactor(mode)` → 1, 2, or 4
  - `getEffectiveMaxDuration(mode)` → 5, 10, or 20
  - `isLofiActive(mode)` → boolean
  - `normalizeLofiMode(value)` → converts legacy boolean to LofiMode
- **Effective durations**: `MAX_SAMPLE_DURATION × getLofiSpeedFactor(mode)` for truncation, loop constraints, and waveform display.
- **Export**: `resampleToExportFormat(buffer, speedFactor)` produces a buffer at N× playback speed; loop times are scaled by `1/speedFactor` in the export domain.
- **Preview playback**: plays at normal 1× rate with a **lowpass filter** at `EXPORT_SAMPLE_RATE / (2 × speedFactor)` to simulate the reduced bandwidth of the final exported audio (12 kHz for LOFI, 6 kHz for XLOFI).
- **State**: `Sample.lofi: LofiMode`, cycled via `bankState.updateSampleLofi()`. Changing mode recalculates `isTruncated` and clamps loop duration when reducing the effective max.
- **Metadata**: `lofi` field is saved/restored in `sympakt.json` for ZIP roundtrip. Legacy `true`/`false` values are auto-converted to `'lofi'`/`'off'`.

## Icons

- All UI icons are inline SVGs defined in `src/icons.ts` using Lit `svg` tagged templates
- Icons use `currentColor` for fill/stroke so they inherit the button's text color
- Available icons: `iconPlay`, `iconStop`, `iconLoop`, `iconCheck`, `iconClose`, `iconPlus`, `iconHeart`, `iconGear`
- The heart icon uses pixel-art rendering (`shape-rendering="crispEdges"`) to match the pixel font aesthetic
- When adding new icons, follow the same pattern: export a `const` from `icons.ts`

## Build Output

- Production build produces a **single `index.html`** file via `vite-plugin-singlefile`
- All JavaScript, CSS, the pixel font (base64 woff2), and the favicon (inline SVG data URI) are embedded
- The output file can be saved and used fully offline — no external requests needed
- Font is imported via Vite's `?url` suffix in `src/index.ts` with `assetsInlineLimit: Infinity` to force base64 inlining

## Session Persistence

- **Storage**: IndexedDB database `sympakt-db` with two object stores: `samples` (keyed by slot index) and `settings` (keyed by name)
- **Auto-save**: bank state is debounced-saved (500ms) on every change via `bankState.notify()`
- **AudioBuffer serialization**: channel data stored as `Float32Array[]` with `sampleRate`, `numberOfChannels`, and `length` metadata; waveform data is regenerated on restore via `generateWaveformData()`
- **Export options persistence**: pack name, "include originals" flag, normalize toggle, and pitch detection toggle saved to the `settings` store when changed and restored on load
- **Restore**: `bankState.restoreFromDB()` + `loadSettings()` called in `AppShell.connectedCallback()`; restoring skips triggering a save cycle
- **Clear**: `bankState.clearAll()` clears both in-memory slots and all IndexedDB data; export options are also reset to defaults
- **Graceful degradation**: all persistence operations use try/catch; failures are logged but do not block the UI

## Security Considerations

- All file I/O happens via browser File API and drag-and-drop — no server calls
- No user data leaves the browser
- ZIP extraction should validate filenames and sizes to avoid zip bombs

## Documentation Maintenance

- When features are added or updated, **always update both `README.md` and `AGENTS.md`** to reflect the changes.
- `README.md` is user-facing: update features list, usage instructions, and export format notes.
- `AGENTS.md` is agent-facing: update constraints, processing notes, and add dedicated sections for new features with implementation details.
