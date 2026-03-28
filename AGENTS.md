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
│   ├── sample-editor.ts    # Destructive sample editor modal (trim, FX, slicer)
│   ├── sample-slot.ts      # Individual sample slot
│   ├── waveform-view.ts    # Pixelated waveform preview canvas
│   ├── virtual-keyboard.ts # 2-octave chromatic keyboard for sample auditioning
│   └── export-dialog.ts    # Export options dialog
├── services/
│   ├── audio-effects.ts    # Audio DSP: trim, reverse, fade, normalize, gain, bitcrush, filter
│   ├── audio-engine.ts     # Web Audio API: decode, resample, preview, analyze
│   ├── persistence.ts      # IndexedDB session persistence (bank + settings)
│   ├── transient-detection.ts # Transient onset detection & even slicing utilities
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
- **File naming on export**: `<slot_number>_<sample_name>[_<detected_note>].wav` (e.g., `01_kick.wav`, `10_Kick_C3.wav`). Dual split slots use: `<slot_number>_<name_A>-<name_B>_DUAL.wav`
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
- Truncation: non-looped samples > 5s (or > 10s in LOFI, > 20s in XLOFI, > 40s in SXLOFI, > 80s in GXLOFI mode) show orange truncated region on waveform; truncation happens at export
- WAV encoding: manual PCM encoding to ArrayBuffer (no library needed)

## Sample Renaming

- **Purpose**: allows users to rename any sample's display name directly from the slot UI
- **Trigger**: click a sample name to open the context menu, then choose **RENAME** (first menu item). Available in both normal mode and dual split mode (A and B sides).
- **UI**: the name label is replaced with an inline text input, auto-focused and pre-selected. Press **Enter** to confirm, **Escape** to cancel, or click away (blur) to confirm.
- **Events**: `sample-rename` (dispatched for main/A-side names, detail: `{ index, name }`), `split-sample-rename` (dispatched for B-side names, detail: `{ index, name }`)
- **State**: `bankState.renameSample(index, name)` updates `Sample.name`; `bankState.renameSplitSample(index, name)` updates `SplitSample.name`
- **Persistence**: the renamed name is persisted in IndexedDB (it's just `Sample.name`) and included in exported metadata JSON
- **Export**: the renamed name is used in the export filename: `<slot>_<name>[_<note>].wav`

## Loop Editing

- **Toggle**: each slot has a loop button (loop icon); enabling sets loop from 10% to end of sample (capped at 5s) with 10% crossfade duration
- **Loop overlay**: interactive canvas overlay on the waveform with draggable handles
  - Green handles: loop start/end points (auto-snap to zero crossings)
  - Blue diamond at top: crossfade duration handle
  - Blue zones: crossfade blend region + source region (position depends on crossfade mode)
  - Dimmed regions: audio outside the loop
- **Crossfade modes**: two modes, toggled via context menu when loop is enabled:
  - **Crossfade at end** (default): the tail of the loop is blended with audio from *before* the loop start point. Blue zones appear at end of loop and before loop start. Constraint: crossfade ≤ available pre-start audio (`loop.startTime`).
  - **Crossfade at start**: the beginning of the loop is blended with audio from *after* the loop end point. Blue zones appear at start of loop and after loop end. Constraint: crossfade ≤ available post-end audio (`audioDuration - loop.endTime`).
- **Type**: `LoopSettings.crossfadeAtStart?: boolean` — `undefined`/`false` = crossfade at end (default), `true` = crossfade at start
- **Context menu**: when loop is active, the sample name context menu shows "CROSSFADE AT START" or "CROSSFADE AT END" to toggle between modes. Available in both normal and dual split modes.
- **Events**: `crossfade-position-toggle` (detail: `{ index }`) for main/A-side, `split-crossfade-position-toggle` (detail: `{ index }`) for B-side
- **State**: `bankState.toggleCrossfadePosition(index)` and `bankState.toggleSplitCrossfadePosition(index)` handle the toggle and clamp crossfade duration to available source audio in the new direction
- **Constraints**: loop duration ≤ 5s (≤ 10s in LOFI, ≤ 20s in XLOFI, ≤ 40s in SXLOFI, ≤ 80s in GXLOFI mode), crossfade ≤ loop length, crossfade ≤ available source audio (direction-dependent)
- **Playback preview**: looped playback with crossfade baked in via Web Audio API `AudioBufferSourceNode.loop`
- **Export**: looped samples export only the loop region with crossfade applied; non-looped samples truncated to 5s (10s in LOFI, 20s in XLOFI, 40s in SXLOFI, 80s in GXLOFI mode)
- **Crossfade duration label**: while dragging the crossfade handle, a duration label (e.g. "320ms") is shown above the waveform, centered on the crossfade zone. **Important**: this label is an HTML element (`div.cf-label`) whose `left` and visibility are set imperatively from `drawLoopOverlay()` using the same pixel coordinates as the canvas overlay. Do NOT use Lit reactive state (`@state`) or percentage-based CSS positioning for this — the canvas overlay uses pixel coordinates on the actual element width, and Lit's render cycle introduces a one-frame lag that causes misalignment.
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
- **ZIP roundtrip**: note is stored in metadata JSON; on re-import from a ZIP with metadata, stored notes are always used and pitch detection is never run (even if globally enabled) to avoid overriding user-set values
- **Debug mode**: hidden pitch diagnostics can be toggled with **Cmd/Ctrl + Alt + D** (Shift optional) to display per-slot detection stats (clarity, ZCR, spread, rejection reason)

## LOFI / XLOFI / SXLOFI / GXLOFI Mode

- **Purpose**: extends the effective max sample time beyond 5s by exporting audio at higher playback speed. LOFI (2× speed, one octave up) gives 10s; XLOFI (4× speed, two octaves up) gives 20s; SXLOFI (8× speed, three octaves up) gives 40s; GXLOFI (16× speed, four octaves up) gives 80s. On the Syntakt, the user pitches the sample down accordingly to hear the original sound.
- **Cycle toggle**: each slot has a **LO** button that cycles through available modes. By default: off → LOFI (orange) → XLOFI (pink, **XL**) → off. With extended LOFI modes enabled: off → LOFI (orange) → XLOFI (pink, **XL**) → SXLOFI (purple, **SX**) → GXLOFI (blue, **GX**) → off.
- **Extended modes setting**: SXLOFI and GXLOFI are hidden by default. Enable them via the "Extended LOFI modes" checkbox in the Settings dialog (gear icon). The setting is persisted in IndexedDB.
- **Type**: `LofiMode = 'off' | 'lofi' | 'xlofi' | 'sxlofi' | 'gxlofi'`. `normalizeLofiMode()` handles backward-compatible deserialization of legacy `true`/`false` values.
- **Helper functions** (in `types/index.ts`):
  - `getLofiSpeedFactor(mode)` → 1, 2, 4, 8, or 16
  - `getEffectiveMaxDuration(mode)` → 5, 10, 20, 40, or 80
  - `isLofiActive(mode)` → boolean
  - `normalizeLofiMode(value)` → converts legacy boolean to LofiMode
  - `getNextLofiMode(current, extendedEnabled)` → next mode in cycle
  - `LOFI_CYCLE` → ordered array of all modes
- **Effective durations**: `MAX_SAMPLE_DURATION × getLofiSpeedFactor(mode)` for truncation, loop constraints, and waveform display.
- **Export**: `resampleToExportFormat(buffer, speedFactor)` produces a buffer at N× playback speed; loop times are scaled by `1/speedFactor` in the export domain.
- **Preview playback**: plays at normal 1× rate with a **lowpass filter** at `EXPORT_SAMPLE_RATE / (2 × speedFactor)` to simulate the reduced bandwidth of the final exported audio (12 kHz for LOFI, 6 kHz for XLOFI, 3 kHz for SXLOFI, 1.5 kHz for GXLOFI).
- **State**: `Sample.lofi: LofiMode`, cycled via `bankState.updateSampleLofi()`. Changing mode recalculates `isTruncated` and clamps loop duration when reducing the effective max.
- **Metadata**: `lofi` field is saved/restored in `sympakt.json` for ZIP roundtrip. Legacy `true`/`false` values are auto-converted to `'lofi'`/`'off'`.

## Dual Sample Split

- **Purpose**: allows a single slot to hold two separate samples (A and B) that are exported merged into one WAV. On the Syntakt, the user can access each sample by setting the appropriate start point.
- **Toggle**: enabled per-slot via the sample name context menu → "Dual split A|B". Disabled via the A-side name context menu → "Disable dual split". The setting persists in IndexedDB and metadata.
- **Type**: `Sample.splitEnabled?: boolean`, `Sample.splitSample?: SplitSample | null`. `SplitSample` carries its own `audioBuffer`, `waveformData`, `loop`, `detectedNote`, etc.
- **UI**: when enabled, the slot content is replaced by a split container with two halves (A and B), each showing its own waveform, play/loop buttons, name and duration. LOFI and remove buttons are shared and affect the whole slot. Each half has its own drop zone for importing audio files. The A-side name has a context menu with only a "Disable dual split" option (no pitch submenu in split mode). No separate remove button for B-side; the shared remove handles the entire slot.
- **Max duration per side**: `getSplitMaxDuration(lofi)` = `(getEffectiveMaxDuration(lofi) - DUAL_SPLIT_SILENCE) / 2`. For normal mode: (5 − 0.02) / 2 = 2.49s per side.
- **Silence gap**: `DUAL_SPLIT_SILENCE = 0.020` (20ms) minimum silence between A and B in the exported WAV.
- **Export layout**: total WAV length = `MAX_SAMPLE_DURATION` (in export time domain). Layout: `[A pcm][silence padding][B reversed, aligned to end]`. B is reversed so that on the Syntakt, playing from the end of the sample gives the B sample forwards.
- **Export function**: `exportDualSplitPCM(sample, speedFactor)` in `zip-service.ts` handles the merge.
- **Waveform**: the `sp-waveform` component accepts an optional `effectiveMaxOverride` property so the truncation line uses the split max instead of the full slot max.
- **State management**: `bankState.toggleSplitMode()`, `setSplitSample()`, `updateSplitSampleLoop()`, `removeSplitSample()`, `updateSplitSampleNote()`.
- **Import**: `processSplitAudioFile(file, lofiMode, enablePitch)` in `zip-service.ts` creates a `SplitSample`.
- **Persistence**: `StoredSplitSample` in `persistence.ts` serializes the B sample's AudioBuffer as Float32Arrays, same pattern as the main sample. Fully round-trips through IndexedDB and ZIP metadata.
- **ZIP roundtrip**: `splitEnabled` and `splitSample` metadata fields are stored in `sympakt.json`. B-side original files are stored under `originals/split_b_<filename>`.
- **LOFI interaction**: changing LOFI mode recalculates truncation and clamps loops for both A and B sides.

## Icons

- All UI icons are inline SVGs defined in `src/icons.ts` using Lit `svg` tagged templates
- Icons use `currentColor` for fill/stroke so they inherit the button's text color
- Available icons: `iconPlay`, `iconStop`, `iconLoop`, `iconCheck`, `iconClose`, `iconPlus`, `iconHeart`, `iconGear`, `iconKeyboard`, `iconSplit`
- The heart icon uses pixel-art rendering (`shape-rendering="crispEdges"`) to match the pixel font aesthetic
- When adding new icons, follow the same pattern: export a `const` from `icons.ts`

## Sample Reversing

- **Purpose**: allows users to reverse any sample's audio from the context menu
- **Trigger**: click a sample name to open the context menu, then choose **REVERSE**. Available in both normal mode and dual split mode (A and B sides).
- **Behavior**: when toggled, the audio buffer's channel data is reversed in-place, the waveform data array is reversed, and any active loop points are adjusted (mirrored: `newStart = duration - oldEnd`, `newEnd = duration - oldStart`, crossfade clamped to available pre-start audio). A `reversed` boolean flag tracks the state.
- **Visual indicator**: the `sp-waveform` component shows a **◄◄** badge overlay in the top-right corner when the sample is reversed. The waveform itself naturally reflects the reversed audio data.
- **Playback**: since the audio buffer is physically reversed, normal playback/export just works — no special handling needed.
- **Type**: `Sample.reversed?: boolean`, `SplitSample.reversed?: boolean`
- **State**: `bankState.reverseSample(index)` and `bankState.reverseSplitSample(index)` handle the toggle
- **Events**: `sample-reverse` (detail: `{ index }`) and `split-sample-reverse` (detail: `{ index }`)
- **Persistence**: `reversed` is stored in IndexedDB via `StoredSample` / `StoredSplitSample` and restored on page reload
- **Metadata**: `reversed` field included in `SlotMetadata` and split sample metadata in exported `sympakt.json`
- **ZIP roundtrip**: `reversed` flag is stored in metadata JSON; on re-import, the audio buffer already contains the reversed data, and the flag is restored

## Sample Editor

- **Purpose**: allows users to perform destructive edits on a sample (overwriting the original audio buffer) via a full-featured modal editor
- **Trigger**: click a sample name to open the context menu, then choose **EDIT SAMPLE**. Available in both normal mode and dual split mode (A and B sides).
- **Component**: `src/components/sample-editor.ts` (`<sp-sample-editor>`)
- **Modal behavior**: follows the dialog pattern (`:host([open])`, overlay, dialog). **Cannot be dismissed by clicking outside** — user must explicitly click Apply or Cancel.
- **Layout** (top to bottom):
  - Header with "Edit Sample" title and sample name/duration
  - Large waveform canvas (~160px) with trim handles (draggable white vertical bars) and dashed slice markers. Dimmed regions outside trim = audio to be cut.
  - Time display (start/trimmed/end)
  - Transport bar with Play/Stop preview button (renders effects offline via `OfflineAudioContext`, then plays)
  - Effects section: Reverse toggle, Normalize toggle, Fade In (0–2s slider), Fade Out (0–2s slider), Gain (-24 to +24 dB)
  - Audio FX section: Sample Rate Reduction (48kHz→1kHz), Bit Reduction (16→1 bit), Filter Toggle + Type (LP/HP/BP), Cutoff (20–20kHz log), Resonance (0–30 Q)
  - Slicer section: mode (Transient/Even/Manual), sensitivity (transient), slice count (even, 2–64), click-to-add (manual), Export buttons ("To Slots"/"Download ZIP")
  - Footer with Cancel/Apply buttons
- **Audio DSP service**: `src/services/audio-effects.ts` provides pure functions:
  - `trimAudio(buffer, startTime, endTime)`, `reverseAudio(buffer)`, `fadeIn(buffer, duration)`, `fadeOut(buffer, duration)`, `normalizeAudio(buffer)`, `applyGain(buffer, gainDb)`, `reduceSampleRate(buffer, targetRate)`, `reduceBitDepth(buffer, bits)`, `applyFilter(buffer, type, cutoff, resonance)`, `applyEffectChain(buffer, options)` — all return new AudioBuffer instances
- **Transient detection**: `src/services/transient-detection.ts` — `detectTransients(buffer, sensitivity)` uses energy-based onset detection with adaptive threshold; `createEvenSlices(duration, numSlices)` returns evenly spaced cut points
- **On Apply**: processed audio replaces `Sample.audioBuffer`, `waveformData`, and `duration`; loop settings are cleared (since audio boundaries changed); `reversed` flag is reset
- **Slicer export to slots**: slices audio at boundary points, creates Sample objects, fills bank slots starting from the source slot index. Shows warning if slots are occupied or insufficient — user can cancel or continue (overwriting).
- **Slicer export to ZIP**: encodes each slice as 16-bit/48kHz/mono WAV, bundles into `<name>_slices.zip` via fflate, triggers download
- **Events**: `sample-edit` (detail: `{ index, side }`) dispatched from slot/bank, `editor-apply`, `editor-cancel`, `editor-check-slots`, `editor-export-slices-to-slots`, `editor-export-slices-zip`
- **State flow**: `AppShell.editorOpen/editorSample/editorSlotIndex/editorSide` → `<sp-sample-editor>` properties → on Apply: `bankState.setSample()` or `bankState.setSplitSample()`

## Max Columns Setting

- **Purpose**: lets users control the maximum number of columns displayed in the 64-slot bank grid (1 to 4)
- **UI**: dropdown select in the Settings dialog (gear icon in header), options 1–4, default 4
- **Behavior**: the bank grid uses CSS media queries scoped by a reflected `max-columns` attribute on the `sp-sample-bank` host element. The responsive breakpoints still apply (900px for 2 cols, 1200px for 3, 1600px for 4) but are capped at the chosen max.
- **CSS approach**: attribute selectors `:host([max-columns="N"])` combined with media queries; no JavaScript resize listeners needed
- **Type**: `maxColumns: number` (1–4) on `SampleBank` component, reflected as `max-columns` HTML attribute
- **Events**: `max-columns-change` (detail: `{ maxColumns }`) dispatched from `sp-settings-dialog`
- **State flow**: `AppShell.maxColumns` → `sp-sample-bank.maxColumns` (reflected attribute) → CSS selector matching
- **Persistence**: `maxColumns` field in `StoredSettings`, saved/restored via IndexedDB `settings` store

## Colorblind-Friendly Theme

- **Purpose**: provides an alternate color palette optimized for users with color vision deficiency (deuteranopia, protanopia, tritanopia)
- **Toggle**: "Alternate colors" checkbox in the Settings dialog (gear icon in header), off by default
- **Palette**: replaces the default teal/red/orange scheme with blue (`#5599ff`) / pink (`#ff6699`) / yellow (`#ddbb00`) — colors that are universally distinguishable across common colorblind types
- **Implementation**: CSS custom properties in `theme.ts` use a `var(--sp-X, default)` indirection pattern. When enabled, `applyColorblindTheme()` sets `--sp-*` base variables on `document.documentElement`; these cascade through shadow DOM and override the defaults. When disabled, the properties are removed and defaults apply.
- **Canvas colors**: waveform and loop overlay drawing in `waveform-view.ts` reads colors from CSS custom properties via `getComputedStyle()`, so canvas rendering updates with the theme
- **Affected variables**: `--accent`, `--accent-dim`, `--accent-glow`, `--danger`, `--warning`, `--warning-dim`, `--waveform-color`, `--waveform-truncated`
- **Events**: `colorblind-theme-toggle` (detail: `{ enabled }`) dispatched from `sp-settings-dialog`
- **State flow**: `AppShell.colorblindTheme` → `sp-settings-dialog.colorblindTheme` (property) → `applyColorblindTheme()` on `document.documentElement`
- **Persistence**: `colorblindTheme` field in `StoredSettings`, saved/restored via IndexedDB `settings` store; theme is re-applied on session restore

## Build Output

- Production build produces a **single `index.html`** file via `vite-plugin-singlefile`
- All JavaScript, CSS, the pixel font (base64 woff2), and the favicon (inline SVG data URI) are embedded
- The output file can be saved and used fully offline — no external requests needed
- Font is imported via Vite's `?url` suffix in `src/index.ts` with `assetsInlineLimit: Infinity` to force base64 inlining

## Session Persistence

- **Storage**: IndexedDB database `sympakt-db` with two object stores: `samples` (keyed by slot index) and `settings` (keyed by name)
- **Auto-save**: bank state is debounced-saved (500ms) on every change via `bankState.notify()`
- **AudioBuffer serialization**: channel data stored as `Float32Array[]` with `sampleRate`, `numberOfChannels`, and `length` metadata; waveform data is regenerated on restore via `generateWaveformData()`
- **Export options persistence**: pack name, "include originals" flag, normalize toggle, pitch detection toggle, and max columns saved to the `settings` store when changed and restored on load
- **Restore**: `bankState.restoreFromDB()` + `loadSettings()` called in `AppShell.connectedCallback()`; restoring skips triggering a save cycle
- **Clear**: `bankState.clearAll()` clears both in-memory slots and all IndexedDB data; export options are also reset to defaults
- **Graceful degradation**: all persistence operations use try/catch; failures are logged but do not block the UI

## Security Considerations

- All file I/O happens via browser File API and drag-and-drop — no server calls
- No user data leaves the browser
- ZIP extraction should validate filenames and sizes to avoid zip bombs

## Virtual Keyboard

- **Purpose**: allows users to audition a selected sample at different pitches using a 2-octave chromatic keyboard, without needing the Syntakt hardware.
- **Toggle**: keyboard icon button in the header toolbar (right of the gear/settings button), or press **P** key. Toggles `<sp-virtual-keyboard>` above the footer.
- **Component**: `src/components/virtual-keyboard.ts` (`<sp-virtual-keyboard>`)
- **Selection**: clicking a sample slot dispatches `slot-select` event → `bankState.selectSlot(index)`. Selected slot gets a highlighted border (`.selected` class on `.slot`), but **only when the keyboard is open** (`sample-bank.keyboardOpen` property). Closing the keyboard automatically deselects.
- **Root note**: C3 is always the root (semitone offset 0). The displayed range defaults to C3–B4 (2 octaves) and can be shifted.
- **Octave shifting**: Left/Right arrow keys or ◀/▶ buttons shift the displayed 2-octave range (C0–B1 through C6–B7). Shifting stops all active notes.
- **Sample navigation**: Up/Down arrow keys select the previous/next filled sample slot.
- **Playback**: `playSamplePitchedFull(sample, semitones)` in `audio-engine.ts` renders the full sample including loop with crossfade, LOFI/XLOFI/SXLOFI/GXLOFI lowpass filter, and truncation to `getEffectiveMaxDuration(lofi)`. Uses `playbackRate = 2^(semitones/12)` for pitch shifting.
- **QWERTY mapping**: middle row (A=C, S=D, D=E, F=F, G=G, H=A, J=B, K=C+1, L=D+1) for white keys, top row (W=C#, E=D#, T=F#, Y=G#, U=A#, O=C#+1) for black keys. Shortcuts map to the first displayed octave with K/L/O extending into the second.
- **Touch/pointer support**: keys respond to `pointerdown`/`pointerup`/`pointerleave` with pointer capture for reliable mobile interaction. `touch-action: none` prevents scroll interference.
- **Visual feedback**: pressed keys get `.active` class (accent color for white keys, accent-dim for black keys).
- **Responsive**: white key width scales from 42px (desktop) → 32px (≤768px) → 24px (≤480px). Black key width is computed as 67% of white key width. Key binding labels hidden on mobile.
- **State**: `BankStateStore.selectedIndex` (not persisted) tracks which slot is selected. `BankStateStore.selectSlot()` / `getSelectedSample()` provide the API.

## Documentation Maintenance

- When features are added or updated, **always update both `README.md` and `AGENTS.md`** to reflect the changes.
- `README.md` is user-facing: update features list, usage instructions, and export format notes.
- `AGENTS.md` is agent-facing: update constraints, processing notes, and add dedicated sections for new features with implementation details.
