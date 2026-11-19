# Architectural Decisions

## 2026-11-19 — Routing without extra dependencies
- **Decision:** Implemented a lightweight hash-based router (`useHashRoute`) using native `window.location.hash` instead of adding `react-router-dom`.
- **Reason:** Keeps the initial bundle minimal and avoids extra dependencies while providing full hash-routing support for GitHub Pages and static hosting.

## 2026-11-19 — State management via React Context
- **Decision:** Used React Context + hooks (`AppContext`) backed by Dexie IndexedDB persistence instead of Zustand.
- **Reason:** Section 3 explicitly permits "Zustand (or React context if simpler)". React Context avoids an extra dependency and keeps state persistence cleanly synchronized with IndexedDB.

## 2026-11-19 — Local bundled fonts via @fontsource
- **Decision:** Added `@fontsource/opendyslexic`, `@fontsource/plus-jakarta-sans`, `@fontsource/source-serif-4`, and `@fontsource/jetbrains-mono`.
- **Reason:** Hard constraint #5 requires zero essential network dependencies after first load, and Section 8.2 requires an optional locally bundled dyslexia-friendly font. Bundling these font packages ensures complete offline typography on desktop, iPad, and iPhone without external CDN requests.

## 2026-11-19 — `fake-indexeddb` for storage unit tests
- **Decision:** Added `fake-indexeddb` to run Dexie schema migration (`version(1)` -> `version(2)`) and quota-handling tests in Vitest under Node.
- **Reason:** Allows deterministic, fast automated verification of IndexedDB migrations and error paths in CI without requiring a full browser runtime.

## 2026-11-19 — Tokenizer sentence boundary & long-word fragment strategy
- **Decision:** Combined `Intl.Segmenter` (when available) with deterministic abbreviation, decimal, URL, and closing-quote boundary handling, and stored long-word (>14 chars) display fragments inside a single `WordToken` entry.
- **Reason:** Guarantees identical token indices across environments and ensures `wordIndex` position math always counts each word as 1 word, even when rendered in two display fragments on narrow viewports. If `TOKENIZER_VERSION` changes in a future release, saved `ReadingProgress` is remapped proportionally by percentage using `document.totalWords`.

## 2026-11-19 — Timing additions & punctuation strength scaling
- **Decision:** All timing additions in `TIMING_CONSTANTS` (comma/semicolon/colon +0.5, terminal punctuation +1.0, paragraph end +1.5, 10+ char word +0.2) are scaled linearly by `punctuationPauseStrength` (`0` = off, `1` = default, `2` = double).
- **Reason:** Ensures `punctuationPauseStrength = 0` produces exact constant WPM pacing (`60000 / wpm` ms per word) without drift, while `1` applies the full specified cadence.

## 2026-11-19 — EPUB parsing in Web Worker
- **Decision:** Unzip EPUB archives with `JSZip` inside a Web Worker and extract OPF metadata, spine order, TOC chapter breaks, and XHTML text using a deterministic XML/XHTML parser (with `DOMParser` when running on the main thread).
- **Reason:** Standard Web Workers lack `DOMParser` in several browsers. Keeping unzipping and XHTML extraction in the worker prevents main-thread freezes on large EPUB files while preserving deterministic text extraction and DRM detection.

## 2026-11-19 — `pdfjs-dist/legacy/build` for PDF worker compatibility
- **Decision:** Imported `pdfjs-dist/legacy/build/pdf.mjs` and `pdfjs-dist/legacy/build/pdf.worker.mjs` inside the PDF Web Worker (`pdf.worker.ts`) via `globalThis.pdfjsWorker`.
- **Reason:** Avoids ES2025 runtime requirements (`Promise.try`, `Uint8Array.prototype.toHex`) that fail in Node 22 Vitest or older iOS Safari WebKit versions, and runs `pdf.js` cleanly inside a single Web Worker without nested workers or external CDNs.

## 2026-11-19 — Root Cause & Fix: Countdown Playback Stall
- **Root Cause:** Pressing Play set React state `countdownRemaining = 2` and started a `window.setInterval` countdown timer. That state update re-rendered `ReaderScreen`, which passed a new inline `onSessionCompleted` arrow function into `useSpeedReader`. Because `closeActiveSession` depended on `[onSessionCompleted]` and the lifecycle cleanup `useEffect` depended on `[persistProgressNow, closeActiveSession]`, React ran the cleanup function immediately on that render and executed `window.clearInterval(countdownTimerRef.current)`. As a result, the timer was cancelled before ticking to `1` or calling `scheduler.play()`, leaving the UI stuck on `"Starting in 2"` with `wordIndex` at `0` while `countdownRemaining > 0` showed the Pause icon.
- **Decision:** Moved the countdown phase directly inside `SwdScheduler` driven by `clock.now()` (`performance.now()`), made `scheduler.getState()` return referentially stable snapshots, held the scheduler instance in a ref created once, subscribed React via `useSyncExternalStore`, and stabilized callback props with refs.
- **Reason:** Eliminates React timer cleanup races and StrictMode double-invocation hazards while keeping all timing and countdown state inside the unit-tested engine.

## 2026-11-19 — Header Height Expansion & `BASE_URL` Logo Asset Path
- **Decision:** Changed the main shell header container from fixed `h-12 md:h-16` to `min-h-14 md:min-h-20` with vertical padding (`py-1.5 md:py-2`), and referenced the header logo via `${import.meta.env.BASE_URL}assets/logo-orpela.png`.
- **Reason:** Allows the stacked logo (24px mobile, 32px `md+`) and "Orpela" wordmark inside a single `>= 44px` tap target without clipping, preserves flex-column sticky layout flow with zero overlap, and ensures the image URL resolves both in root dev mode (`/`) and under the GitHub Pages subpath (`/orpela/`).

## 2026-11-19 — CSS Workaround for Opaque Logo Background (`.brand-logo`)
- **Decision:** Added `.brand-logo` in `src/index.css` using `mix-blend-mode: multiply` in light mode and `filter: invert(1) hue-rotate(180deg); mix-blend-mode: screen;` under `.dark`, with `isolate` on `<header>` in `src/components/AppShell.tsx`.
- **Reason:** Hides the opaque white background of `public/assets/logo-orpela.png` without altering the binary asset while keeping the blend composited cleanly against the blurred header surface. This is a temporary CSS workaround; replacing `logo-orpela.png` with a transparent PNG or SVG (with light/dark support) is the proper long-term fix.

## 2026-11-19 — CSS Crop Workaround for Logo Padding (`.brand-logo-frame`)
- **Decision:** Wrapped the header `<img>` in `.brand-logo-frame` (`overflow: hidden; aspect-ratio: 1180 / 487;`) and positioned `.brand-logo` absolutely using the visible mark's measured bounding box (`x=179, y=267, width=1180, height=487` inside `1536x1024`), while tightening brand link padding (`py-0.5`) and desktop header height (`md:min-h-18`).
- **Reason:** `logo-orpela.png` contains ~52.4% vertical empty padding (`267 px` top, `270 px` bottom), making the gap above `"Orpela"` appear too large and shrinking the visible mark. This CSS crop is a temporary workaround until a tightly trimmed transparent PNG or SVG asset is supplied.

## 2026-11-19 — Center Multi-Word Chunks Without Individual Letter Highlighting
- **Decision:** Updated `computeChunkOrp` (`src/engine/orp.ts`) to return `orpIndex: null` and `focalWordIndex: null` for multi-word chunks (`2w`, `3w`, `4w`), and updated `ReaderDisplay` (`src/features/reader/ReaderDisplay.tsx`) to horizontally center the entire single-line chunk on the focal axis without highlighting or underlining any letter, shrinking font size to fit narrow viewports via `ResizeObserver` + `useLayoutEffect`.
- **Reason:** Testing showed that pinning the character-midpoint word's ORP letter to the center axis made multi-word chunks look off-center and caused the red highlight to jump unpredictably between chunks (e.g., highlighting `"y"` in `"renew thyself;"`). Centering the chunk against the top/bottom focal reticle ticks keeps fixation steady across 2w–4w reading while preserving 1-word ORP highlighting.

## 2026-11-19 — Gate ORP Highlighting on `wordsPerFlash === 1` (Leftover Single-Word Chunks)
- **Cause:** Because `chunker.ts` never crosses sentence boundaries, sentence endings and odd-word document endings can produce 1-word leftover chunks even when `wordsPerFlash` is `2`, `3`, or `4`. `computeChunkOrp` previously decided whether to compute an ORP index based on `words.length === 1`, causing leftover 1-word chunks to flash a highlighted, underlined letter.
- **Fix:** Passed `settings.wordsPerFlash` into `computeChunkOrp(displayedWords, settings.wordsPerFlash)` (`src/engine/orp.ts`) and required `settings.orpEnabled && settings.wordsPerFlash === 1 && orpLayout.orpIndex !== null` in `ReaderDisplay` (`src/features/reader/ReaderDisplay.tsx`). Every chunk at `2w`–`4w`, including 1-word leftovers, now renders centered with zero letter highlighting while keeping sentence-boundary chunking intact.

## 2026-11-19 — Fixed Focal Stage Height & Transform-Based Scaling (`ReaderDisplay`)
- **Cause:** The focal stage (`data-testid="focal-stage"`) sized its height from vertical padding (`py-10 sm:py-14`) plus the chunk's font size, while `computeDynamicFontSize` / `computeFitFontSize` changed `fontSize` per chunk and the comfort notice / phone context pane sat in normal flex flow above the stage. Together, chunk transitions and UI notices moved the stage borders and axis ticks vertically.
- **Fix:** Set the stage to a fixed `box-sizing: border-box` height of `calc(var(--reader-base-font) * 3)` derived solely from `settings.fontSize` and viewport width (`computeBaseFontSize`), centered the chunk inside an `absolute inset-0` slot with a fixed `1em` (`line-height: 1`) box, switched overflow shrinking to `transform: scale(...)` (`transform-origin: center`) computed once per session from the longest chunk at the active `wordsPerFlash` setting (clamped to `0.6`), and moved both the comfort notice (`ReaderScreen.tsx`) and faded context pane (`ReaderDisplay.tsx`) out of flex flow (`absolute`) above the stage.

## 2026-11-19 — Shared App Header, Reader Sub-Toolbar, Mobile Menu & Overlay Auto-Hide
- **Decision:** Wrapped all routes (including `/read/:id`) inside `AppShell` and coordinated reader state through `ReaderChromeContext` (`src/context/ReaderChromeContext.tsx`), replacing the reader's standalone `<header>` and Back button with a slim reader toolbar (`data-testid="reader-toolbar"`) mounted below the shared header, adding a compact dismissible mobile navigation panel (`#mobile-nav-panel`), and using `fixed` overlay chrome on the reader route.
- **Reason:** Keeps one consistent brand header (logo + Orpela wordmark) across the entire app, hides irrelevant controls (`Import Text`, bottom mobile nav bar) on `/read/:id`, pauses playback cleanly when the mobile menu opens, flushes progress and active sessions asynchronously via `flushAndPauseForExit` (plus `hashchange`/`popstate` cleanup on back navigation), and ensures the ~2-second auto-hide (`opacity-0 pointer-events-none` + `inert` + `aria-hidden`) never shifts `data-testid="focal-stage"`.

## 2026-11-19 — Move Build Specification to `docs/BUILD_SPEC.md`
- **Decision:** Moved the build specification from `public/assets/aistudio/` to `docs/BUILD_SPEC.md` and removed the empty `public/assets/aistudio/` directory.
- **Reason:** Prevents Vite from copying the internal specification markdown file into `dist/` and keeps Workbox from precaching it in the service worker (`sw.js`), while excluding `docs/BUILD_SPEC.md` from automated terminology checks since its rule text states the banned term.
