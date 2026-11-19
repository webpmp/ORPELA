# BUILD_SPEC.md: Reading & Learning Platform (v1 prototype)

Instructions for the AI coding agent. Read this whole file before writing code. Follow it milestone by milestone. When this file and your own preferences conflict, this file wins. If something is ambiguous, pick the default stated here, note the choice in `DECISIONS.md`, and keep going; do not stop to ask unless a decision is marked **ASK**.

## 1. What you are building

**Orpela**: a responsive, installable, offline-capable, local-first Progressive Web App that helps people read faster. Its first complete capability is **sequential word display (SWD)**: show one word, or a small group of words, at a time in a fixed focal position at a configurable speed.

- Targets: desktop browsers, iPad Safari, iPhone Safari (browser and installed Home Screen mode).
- No backend, no accounts, no analytics, no telemetry. All data stays in the browser.
- Open-source prototype: public GitHub repo, deployed to GitHub Pages.
- Future (do NOT build now): traditional e-reader view, web-article import, AI summaries and lessons (bring-your-own-key, cloud and local models such as LM Studio), cloud sync, browser extension.

**Terminology rule:** never use the retired acronym (spelled R-S-V-P, with hyphens here) or its long form anywhere: code, identifiers, file names, UI text, README, comments, commit messages, manifest. Use "SWD" or "sequential word display".

## 2. Hard constraints

1. TypeScript strict mode. No `any` without a comment explaining why.
2. The engine (`src/engine/`) is pure TypeScript with **no React, DOM, or storage imports**. It must run under Node in Vitest.
3. Do not store documents, progress, or sessions in `localStorage`. Use IndexedDB. (`localStorage` is allowed only for trivial per-device UI flags.)
4. Every feature must work with touch only: no hover-only interactions, no keyboard-only actions. Tap targets are at least 44x44 px.
5. Nothing essential may depend on network access after first load.
6. Do not implement anything in section 13 (out of scope).
7. Do not add dependencies beyond the stack in section 3 without recording why in `DECISIONS.md`.
8. Never commit secrets, copyrighted books, or sample texts that are not public domain.
9. Lazy-load heavy code (PDF and EPUB parsing). The initial bundle should stay small.

## 3. Stack

| Concern | Choice |
| --- | --- |
| UI | React 18+, TypeScript, Vite |
| Styling | Tailwind CSS, with theme colors as CSS variables |
| State | Zustand (or React context if simpler) |
| Storage | IndexedDB via Dexie (declarative versions and migrations) |
| PDF | pdf.js, dynamically imported, worker bundled locally (no CDN) |
| EPUB | JSZip + DOMParser (text and metadata only). Use epub.js only if this proves impractical, and record why |
| PWA | vite-plugin-pwa (Workbox), `registerType: 'prompt'` |
| Heavy parsing | Web Worker |
| Routing | Hash-based (`HashRouter` or equivalent) |
| Tests | Vitest (unit), Playwright (one smoke test) |
| Lint/format | ESLint + Prettier |
| CI/CD | GitHub Actions: lint, test, build, deploy to GitHub Pages on push to `main` |

## 4. Repository layout

Create files as features need them; do not create empty scaffolding.

```
src/
  config.ts              # APP_NAME, APP_SHORT_NAME (single source for branding; APP_NAME = "Orpela")
  engine/                # pure TS, fully unit-tested
    tokenizer.ts         # text -> words, sentence + paragraph boundaries
    chunker.ts
    orp.ts
    timing.ts
    scheduler.ts
    navigation.ts
  services/
    importers/           # paste.ts, txt.ts, pdf.ts, epub.ts (common interface)
    storage/             # db.ts (Dexie schema + migrations), repositories
    sessions.ts
    backup.ts            # export/import JSON
  features/
    reader/              # display, controls, settings sheet, progress, context pane
    library/             # list, card, importer UI
  hooks/                 # useSpeedReader, useWakeLock, useResponsiveLayout
  components/            # layout + shared UI
  types/
  App.tsx
public/
  icons/                 # 192, 512, maskable, apple-touch-icon
  samples/               # public-domain sample texts, with source credits
DECISIONS.md
README.md
LICENSE                  # MIT unless told otherwise
```

## 5. Engine specification

### 5.1 Tokenizing (`tokenizer.ts`)

- Input: normalized plain text; paragraphs separated by a blank line.
- Output: array of word tokens, each with `text`, `paragraphIndex`, `sentenceIndex`, and flags for sentence end and paragraph end. Also expose arrays of sentence start indices and paragraph start indices.
- Words split on whitespace; punctuation stays attached to the word. Split on em dashes and double hyphens so joined words become separate tokens.
- Sentence boundaries: use `Intl.Segmenter` (granularity `sentence`) with a fallback regex that handles common abbreviations (`Mr.`, `Dr.`, `e.g.`, `U.S.`), ellipses, decimals, and closing quotes after terminal punctuation.
- Words longer than 14 characters are split into two display fragments (mark the first with a continuation flag) so they fit narrow screens. Position math still counts them as one word.
- **Deterministic:** the same text must always yield the same indices. Export a `TOKENIZER_VERSION` constant. Saved progress is a word index into this token array.

### 5.2 Chunking (`chunker.ts`)

- Group 1, 2, 3, or 4 consecutive words per flash.
- A chunk never crosses a sentence boundary: a sentence ending mid-group shortens that chunk.

### 5.3 Timing (`timing.ts`)

WPM means words per minute regardless of chunk size. Base word time = `60000 / wpm` ms.

`duration = baseWordTime * wordsInChunk * (1 + sum of applicable additions)`

| Condition (on the chunk's last word) | Addition |
| --- | --- |
| Comma, semicolon, colon | +0.5 |
| Period, question mark, exclamation mark | +1.0 |
| Paragraph end | +1.5 (or auto-pause if enabled) |
| Any word of 10+ characters in the chunk | +0.2 |

Put these constants in one exported object. A single "punctuation pause" setting scales the additions (0 = off, 1 = default, up to 2). WPM range 100 to 1,000, default 300, step 25.

### 5.4 Scheduler (`scheduler.ts`)

- Drive playback with `requestAnimationFrame` and `performance.now()`. Keep an absolute `nextAt` target; after each chunk do `nextAt += duration` (never `now + duration`) so error does not accumulate.
- Accept an injectable clock so tests can use a fake clock.
- If a frame is late, show the current chunk and continue from the target. Never skip words.
- Auto-pause when the page becomes hidden. Never auto-resume.
- Expose: `play`, `pause`, `seek(wordIndex)`, `restart`, `setWpm`, `setChunkSize`, and a subscription for position changes.
- Optional speed ramp: raise WPM by `stepWpm` every `everySeconds` up to `maxWpm`. Optional chunk expansion: step chunk size 1 to 4 over the session. Both are off by default and user-controlled.

### 5.5 Optimal Recognition Point (`orp.ts`)

- Strip leading and trailing punctuation to find the core word, compute the ORP on the core, then map the index back to the displayed string.
- ORP index (0-based) by core length: 1 = 0; 2 to 5 = 1; 6 to 9 = 2; 10 to 13 = 3; 14+ = 4.
- Multi-word chunks (2, 3, and 4 words): lay out the chunk as one single line of text separated by single spaces and center the entire chunk horizontally on the fixed center axis, with no individual letter highlighted or underlined (the top and bottom tick marks serve as the focal reference). Shrink font size to fit narrow screens rather than wrapping or clipping.
- The ORP character is highlighted with a configurable color (default red) **and** bold or underline, so the cue never relies on color alone.

### 5.6 Navigation (`navigation.ts`)

- Previous and next sentence, previous and next paragraph, seek by word index, seek by percentage. Previous-sentence from mid-sentence goes to that sentence's start; from the start goes to the prior sentence.
- Progress: word index, percentage, words read, estimated time remaining at the current WPM including punctuation additions.

## 6. Data model (Dexie)

Name the document type `LibraryDocument` (do not shadow the DOM `Document`). Keep large text out of frequently written records.

```ts
interface LibraryDocument {
  id: string;
  title: string;
  author?: string;
  source: "paste" | "txt" | "pdf" | "epub"; // later: "url" | "ai"
  sourceMeta?: { fileName?: string; url?: string };
  totalWords: number;
  contentHash: string;       // detect duplicate imports
  tokenizerVersion: number;
  createdAt: string;         // ISO
  updatedAt: string;
}

interface DocumentContent { documentId: string; text: string; }

interface ReadingProgress {
  documentId: string;
  wordIndex: number;
  tokenizerVersion: number;
  updatedAt: string;
}

interface ReadingSession {
  id: string;
  documentId: string;
  startedAt: string;
  endedAt?: string;
  startWordIndex: number;
  endWordIndex: number;
  wordsRead: number;
  activeSeconds: number;     // time actually playing
  averageWpm: number;        // wordsRead / activeSeconds
}

interface ReaderSettings {
  wpm: number;
  wordsPerFlash: 1 | 2 | 3 | 4;
  orpEnabled: boolean;
  orpColor: string;
  punctuationPauseStrength: number;   // 0 to 2
  paragraphAutoPause: boolean;
  contextPane: "off" | "faded";
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  readingWidth: number;
  countdownSeconds: number;           // 0 to 5
  maxWpmCap?: number;
  speedRamp: { enabled: boolean; stepWpm: number; everySeconds: number; maxWpm: number };
  chunkExpansion: { enabled: boolean };
  theme: "dark" | "light" | "system";
  textColor?: string;
  backgroundColor?: string;
}
```

Rules:

- Object stores: `documents`, `contents`, `progress`, `sessions`, `settings`. Listing the library must never load full text.
- Version the Dexie schema from day one (`version(1)`), with a tested upgrade path for every future version.
- If a stored `tokenizerVersion` differs from the current one, remap progress by percentage and flag it in a `DECISIONS.md` note.
- Write progress at most every 3 seconds during playback, plus on pause, on `visibilitychange`, and on `pagehide`. Never on every word.
- A session is one continuous play-to-stop span; resuming starts a new session.
- Call `navigator.storage.persist()` on first successful save. Catch quota errors and show a clear message when a document cannot be saved.
- Settings are global in v1.

## 7. Importers

All importers implement one interface:

```ts
interface ImportResult {
  title: string;
  author?: string;
  text: string;                 // plain text, paragraphs separated by a blank line
  source: "paste" | "txt" | "pdf" | "epub";
  warnings: string[];
}
```

- **Paste:** title field (default: first line, else "Untitled"). Options to read now or save to library.
- **TXT:** File API. Detect encoding (UTF-8 default, handle BOM), normalize line endings, rejoin hard-wrapped lines into paragraphs.
- **PDF:** pdf.js in a Web Worker. Remove repeated headers, footers, and page numbers where detectable, rejoin hyphenated line breaks. If pages have no extractable text, add a warning; if the whole file has none, fail with a clear "scanned PDF, no text found" message.
- **EPUB:** read the spine in order, extract text from XHTML, take title and author from package metadata, use the table of contents for chapter breaks. DRM-protected files fail with a clear message.
- File size limit 25 MB (constant). Show progress for large imports. Never freeze the main thread.
- Normalization shared by all importers: collapse repeated whitespace, trim, normalize Unicode quotes only for matching (do not alter displayed text), preserve paragraph breaks.

## 8. UI specification

### 8.1 Screens

1. **Library:** list of documents (title, word count, progress %), sort by title or date added, open/resume, delete with confirmation and undo, import button, "Load sample text" action, settings entry.
2. **Import:** paste field with title; file picker for TXT, PDF, EPUB.
3. **Reader:** the main experience.
4. **Settings sheet:** inside the reader (bottom sheet on phones, side panel on desktop) plus a global settings page.
5. **Help/Install:** install instructions (iOS "Share, then Add to Home Screen"), keyboard shortcuts, speed-reading caveat, privacy statement.

### 8.2 Reader

- Large centered text; the ORP character sits on a fixed vertical axis at the center. Adjustable font size, weight, family (include an optional dyslexia-friendly font that is bundled locally), reading width, colors.
- Controls: play/pause, restart, previous/next sentence, previous/next paragraph, scrubbable progress bar, time remaining, WPM +/-, words-per-flash selector, settings.
- Controls auto-hide during playback and return on tap or pointer movement.
- Optional faded context pane showing surrounding text; hidden by default on phones. Turning it off discourages regressions.
- Configurable countdown before playback starts.
- A plain scrolling text view of the document (simple, non-SWD) is available from the reader so no one is blocked by the format.
- Keep the screen awake while playing using the Screen Wake Lock API; release on pause; degrade silently where unsupported.
- First-session notice: rapidly changing text may be uncomfortable for some people; offer a max-WPM cap.

### 8.3 Input

Keyboard (desktop, iPad keyboards): Space play/pause; Left/Right previous/next sentence; Shift+Left/Right previous/next paragraph; Up/Down WPM +/-; R restart; Esc exit reader.

Touch: tap the display to play/pause; swipe left/right for previous/next sentence; swipe up/down or on-screen +/- buttons for WPM. Every gesture also has a visible button.

### 8.4 Responsive and iOS

- Mobile-first, fluid sizing, no fixed widths. Use `100dvh`, not `100vh`.
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`; apply `env(safe-area-inset-*)` padding to fixed bars and the reader.
- Portrait and landscape on iPhone and iPad; reader state survives rotation.
- Text inputs must stay visible above the on-screen keyboard.
- ORP display must scale down on narrow screens without clipping.

### 8.5 Accessibility

- `prefers-reduced-motion` respected; no animated transitions in reader chrome.
- WCAG AA contrast in default themes; ORP never relies on color alone.
- All controls have accessible names; logical focus order; announce play/pause state with an `aria-live` region.
- Dark and light themes, plus "system".

## 9. PWA and GitHub Pages

- The app is served at `https://<user>.github.io/<repo>/`. Read the base path from an environment variable and set Vite `base` accordingly (`'/<repo>/'` in production, `'/'` in dev).
- Use **hash routing**. GitHub Pages has no SPA rewrite.
- Manifest: name and short name from `config.ts`, `display: "standalone"`, `start_url` and `scope` consistent with the base path, theme and background colors, icons (192, 512, maskable 512). Include `apple-touch-icon`, `apple-mobile-web-app-capable`, and `apple-mobile-web-app-status-bar-style`.
- `vite-plugin-pwa` with `registerType: 'prompt'`: a new service worker waits and the UI shows "Update available". Apply only when the user accepts or when no reading session is active. Never reload during playback.
- Precache all app assets, including the lazy-loaded PDF/EPUB chunks and the pdf.js worker, so imports also work offline.
- Show clear offline and loading states.
- Install UX: use `beforeinstallprompt` where supported; on iOS show a short "Share, then Add to Home Screen" guide (iOS has no install prompt).
- Handle suspension: save position on `visibilitychange` and `pagehide`; do not rely on background timers, background sync, or push.
- Note in README: Safari may clear storage for sites unused for about a week unless installed to the Home Screen. Provide export/import of the whole library as one JSON file (`backup.ts`) as the safeguard.
- CI: GitHub Actions workflow runs lint, unit tests, build, and deploys to Pages on push to `main`.

## 10. Testing

Required Vitest coverage for `src/engine/`:

- Tokenizer: abbreviations, ellipses, quotes, decimals, URLs, em dashes, hyphenation, empty input, very long words, paragraph breaks, determinism.
- Chunker: all four sizes, sentence-boundary shortening, final partial chunk.
- ORP: every length bucket, leading/trailing punctuation, quotes and parentheses, multi-word chunk focal word.
- Timing: every multiplier, WPM extremes (100 and 1,000), strength scaling.
- Scheduler (fake clock): no drift over 2 minutes of simulated playback, pause/resume, seek, WPM change mid-play, hidden-page auto-pause.
- Navigation: sentence and paragraph moves at boundaries, time-remaining estimate.

Also: storage migration test (open a version 1 database with the current code), quota-exceeded handling, one importer test per format using small fixture files (include a scanned-PDF fixture and a malformed EPUB), and one Playwright smoke test: paste text, play, reload, confirm resume position.

Manual device checklist (document results in `QA.md`): latest Chrome, Safari, Firefox on desktop; iPhone and iPad Safari in browser and installed mode; both orientations; airplane-mode run.

## 11. Milestones (definition of done for each)

Work in this order. Commit at the end of each milestone with a clear message. Do not start the next milestone until the current one's checks pass.

| # | Milestone | Done when |
| --- | --- | --- |
| 0 | Repo and deploy | Project scaffolded; lint, test, build pass in CI; a minimal installable PWA is live on GitHub Pages under the repo base path; README stub exists |
| 1 | Engine | All engine modules implemented with passing unit tests from section 10 |
| 2 | Reader UI | Reader screen works on a bundled sample text: playback, ORP, chunking, controls, settings sheet, themes, gestures, wake lock, responsive layouts |
| 3 | Storage and library | Dexie schema, paste and TXT import, library screen, progress saving and resume, sessions and basic statistics, delete with undo, load-sample action. **Shareable prototype checkpoint** |
| 4 | PDF and EPUB | Lazy-loaded, worker-based importers with warnings, size limit, and fixture tests |
| 5 | PWA hardening | Offline verified, update prompt, persistent storage request, JSON export/import, iOS standalone checks, storage-error handling |
| 6 | Polish and release | Accessibility pass, statistics view, README with screenshots and install steps, LICENSE, `QA.md`, tag `v0.1.0` |

## 12. MVP acceptance checklist

**SWD engine**
- [ ] Start, pause, resume, restart
- [ ] 100 to 1,000 WPM
- [ ] Chunk sizes 1, 2, 3, 4, respecting sentence boundaries
- [ ] ORP correct across lengths and punctuation for 1-word chunks; multi-word chunks centered on the focal axis without highlighting
- [ ] Punctuation timing as specified
- [ ] Sentence and paragraph navigation
- [ ] Progress and time remaining shown
- [ ] Measured playback within tolerance of target WPM over a 2-minute run

**Content and persistence**
- [ ] Paste text with title
- [ ] TXT, PDF, EPUB import, with clear errors for unsupported or empty files
- [ ] Save to local library; progress survives restart; resume works
- [ ] Delete documents
- [ ] Export and import the library

**Responsive**
- [ ] Desktop; iPad portrait and landscape; iPhone portrait and landscape
- [ ] Touch-only usable; safe areas and virtual keyboard handled

**PWA**
- [ ] Installable on desktop browsers; Add to Home Screen on iPhone and iPad with guidance
- [ ] Standalone launch
- [ ] Documents and core reading work offline
- [ ] Update prompt, no reload during playback
- [ ] Position saved on suspension and restored
- [ ] Works under the GitHub Pages base path

**Quality**
- [ ] Dark and light themes; settings persist
- [ ] Statistics recorded
- [ ] Keyboard shortcuts work
- [ ] Reduced-motion and contrast requirements met
- [ ] No retired technique acronym anywhere in the repo
- [ ] No critical layout or playback defects

## 13. Out of scope for v1 (do not build)

AI summaries, lessons, or topic exploration; traditional e-reader (beyond the plain scrolling fallback); bookmarks, highlights, notes, tags, collections, search; web-article import; browser extension; accounts, cloud storage, sync; recommendations, quizzes, advanced analytics; additional file formats; OCR; non-space-delimited or right-to-left languages.

Design for them only by keeping the document model and storage layout extensible (for example `source` can later include `"url"` and `"ai"`).

## 14. Framing the training features honestly

Speed-reading research is mixed; pushing display speed tends to trade away comprehension. In the UI and README, present speed ramp, chunk expansion, and the context pane as optional experiments. Never claim guaranteed improvements in speed or comprehension.

## 15. Working agreements# BUILD_SPEC.md: Orpela, a Reading & Learning Platform (v1 prototype)

Instructions for the AI coding agent. Read this whole file before writing code. When this file and your own preferences conflict, this file wins. If something is ambiguous, pick the default stated here, note the choice in `DECISIONS.md`, and keep going; do not stop to ask unless a decision is marked **ASK**.

This file lives at `docs/BUILD_SPEC.md`. It must never be placed in `public/`, because everything in `public/` is published on the live site and cached for offline use.

## 1. What you are building

**Orpela**: a responsive, installable, offline-capable, local-first Progressive Web App that helps people read faster. Its first complete capability is **sequential word display (SWD)**: show one word, or a small group of words, at a time in a fixed focal position at a configurable speed.

- Targets: desktop browsers, iPad Safari, iPhone Safari (browser and installed Home Screen mode).
- No backend, no accounts, no analytics, no telemetry. All data stays in the browser.
- Open-source prototype: public GitHub repo named `ORPELA`, deployed to GitHub Pages at `https://webpmp.github.io/ORPELA/`.
- Future (do NOT build now): traditional e-reader view, web-article import, AI summaries and lessons, cloud sync, browser extension.

**Terminology rule:** this project does not use the well-known acronym for this reading technique (spelled R-S-V-P, with hyphens here so this file stays clean) or its long form. Use "SWD" or "sequential word display" everywhere: code, identifiers, file names, UI text, README, comments, commit messages, manifest, and docs. A case-insensitive search of the whole repository for that acronym (written without hyphens) must return nothing, with no excluded files.

## 2. Hard constraints

1. TypeScript strict mode. No `any` without a comment explaining why.
2. The engine (`src/engine/`) is pure TypeScript with **no React, DOM, or storage imports**. It must run under Node in Vitest.
3. Do not store documents, progress, or sessions in `localStorage`. Use IndexedDB. (`localStorage` is allowed only for trivial per-device UI flags.)
4. Every feature must work with touch only: no hover-only interactions, no keyboard-only actions. Tap targets are at least 44x44 px.
5. Nothing essential may depend on network access after first load. Fonts and all assets are bundled locally.
6. Do not implement anything in section 13 (out of scope).
7. Do not add dependencies beyond section 3 without recording why in `DECISIONS.md`.
8. Never commit secrets, copyrighted books, or sample texts that are not public domain.
9. Lazy-load heavy code (PDF and EPUB parsing). The initial bundle should stay small.
10. Nothing in `public/` except assets the live site needs (icons, logo, sample texts, fonts). No specs, notes, or tooling files.

## 3. Stack

| Concern | Choice |
| --- | --- |
| UI | React 18+, TypeScript, Vite |
| Styling | Tailwind CSS, with theme colors as CSS variables |
| State | React Context + hooks (decided; see `DECISIONS.md`). High-frequency playback state (current word index, phase, countdown) lives in the scheduler store, not in context, so a word change never re-renders the whole tree |
| Storage | IndexedDB via Dexie (declarative versions and migrations); `fake-indexeddb` for tests |
| PDF | pdf.js (legacy build, for older iOS Safari and Node test compatibility), dynamically imported, worker bundled locally (no CDN) |
| EPUB | JSZip in a Web Worker, text and metadata only. Use a **single** extraction code path for worker and main thread, or prove with a fixture test that both paths produce identical text, so word counts and saved progress never diverge |
| Fonts | `@fontsource` packages, Latin subset and only the weights actually used. Check the precache size in the build output |
| PWA | vite-plugin-pwa (Workbox), `registerType: 'prompt'` |
| Heavy parsing | Web Worker |
| Routing | Hash-based, lightweight custom hook or equivalent |
| Tests | Vitest + React Testing Library (unit, hook, component), Playwright (one smoke test) |
| Lint/format | ESLint + Prettier, `tsc --noEmit` |
| Package manager | Bun (`bun.lock`, `bun install --frozen-lockfile`, `bun run ...`) |
| CI/CD | GitHub Actions: Bun lint, test, build, deploy to GitHub Pages on push or manual dispatch to `main` (Pages source set to "GitHub Actions") |

## 4. Repository layout

Create files as features need them; do not create empty scaffolding.

```
.github/workflows/deploy.yml
docs/BUILD_SPEC.md
src/
  config.ts              # APP_NAME, APP_SHORT_NAME (single source for branding; APP_NAME = "Orpela")
  engine/                # pure TS, fully unit-tested
    tokenizer.ts         # text -> words, sentence + paragraph boundaries
    chunker.ts
    orp.ts
    timing.ts
    scheduler.ts         # includes the countdown phase
    navigation.ts
  services/
    importers/           # paste.ts, txt.ts, pdf.ts, epub.ts (common interface)
    storage/             # db.ts (Dexie schema + migrations), repositories
    sessions.ts
    backup.ts            # export/import JSON
  features/
    reader/              # display, controls, settings sheet, progress, context pane
    library/             # list, card, importer UI
  hooks/                 # useSpeedReader, useWakeLock, useResponsiveLayout, usePWAUpdate
  components/            # layout (app header, mobile menu) + shared UI
  types/
  App.tsx
public/
  assets/logo-orpela.png
  icons/                 # 192, 512, maskable, apple-touch-icon
  samples/               # public-domain sample texts, with source credits
DECISIONS.md
README.md
LICENSE                  # MIT unless told otherwise
```

## 5. Engine specification

### 5.1 Tokenizing (`tokenizer.ts`)

- Input: normalized plain text; paragraphs separated by a blank line.
- Output: array of word tokens, each with `text`, `paragraphIndex`, `sentenceIndex`, and flags for sentence end and paragraph end. Also expose arrays of sentence start indices and paragraph start indices.
- Words split on whitespace; punctuation stays attached to the word. Split on em dashes and double hyphens so joined words become separate tokens.
- Sentence boundaries: use `Intl.Segmenter` (granularity `sentence`) with deterministic handling of abbreviations (`Mr.`, `Dr.`, `e.g.`, `U.S.`), ellipses, decimals, URLs, and closing quotes after terminal punctuation.
- Words longer than 14 characters are split into two display fragments inside a single token (mark the first with a continuation flag) so they fit narrow screens. Position math still counts them as one word.
- **Deterministic:** the same text must always yield the same indices. Export a `TOKENIZER_VERSION` constant. Saved progress is a word index into this token array.

### 5.2 Chunking (`chunker.ts`)

- Group 1, 2, 3, or 4 consecutive words per flash.
- A chunk never crosses a sentence boundary: a sentence ending mid-group shortens that chunk. This means the last chunk of a sentence (or of the document) can contain fewer words than the setting. Display logic must therefore key off the **setting**, never the actual chunk length (see 5.5).

### 5.3 Timing (`timing.ts`)

WPM means words per minute regardless of chunk size. Base word time = `60000 / wpm` ms.

`duration = baseWordTime * wordsInChunk * (1 + strength * sum of applicable additions)`

| Condition (on the chunk's last word) | Addition |
| --- | --- |
| Comma, semicolon, colon | +0.5 |
| Period, question mark, exclamation mark | +1.0 |
| Paragraph end | +1.5 (or auto-pause if enabled) |
| Any word of 10+ characters in the chunk | +0.2 |

Put these constants in one exported object. `punctuationPauseStrength` scales all additions linearly (0 = exact constant WPM pacing, 1 = default, up to 2). WPM range 100 to 1,000, default 300, step 25.

### 5.4 Scheduler (`scheduler.ts`)

- Phases: `idle`, `countdown`, `playing`, `paused`, `finished`. The **countdown lives inside the scheduler**, driven by the injectable clock (`performance.now()` in the app), and transitions to `playing` automatically. Do not run the countdown with a separate React timer: re-renders and effect cleanups can cancel it, which previously left playback stuck on the first countdown number (see `DECISIONS.md`).
- Drive playback with `requestAnimationFrame` and the clock. Keep an absolute `nextAt` target; after each chunk do `nextAt += duration` (never `now + duration`) so error does not accumulate.
- If a frame is late, show the current chunk and continue from the target. Never skip words.
- Auto-pause when the page becomes hidden. Never auto-resume.
- Expose: `play`, `pause`, `seek(wordIndex)`, `restart`, `setWpm`, `setChunkSize`, `getState` (returns a **referentially stable** snapshot that changes only when state changes), and `subscribe` (compatible with `useSyncExternalStore`).
- React integration: create the scheduler **once** (held in a ref), subscribe with `useSyncExternalStore`, and pass callback props through refs so lifecycle effects do not depend on unstable inline functions. The app must work with `React.StrictMode` enabled in development.
- Optional speed ramp: raise WPM by `stepWpm` every `everySeconds` up to `maxWpm`. Optional chunk expansion: step chunk size 1 to 4 over the session. Both are off by default and user-controlled.

### 5.5 Optimal Recognition Point (`orp.ts`)

- Strip leading and trailing punctuation to find the core word, compute the ORP on the core, then map the index back to the displayed string.
- ORP index (0-based) by core length: 1 = 0; 2 to 5 = 1; 6 to 9 = 2; 10 to 13 = 3; 14+ = 4.
- **Highlight rule:** a letter is highlighted and underlined only when `orpEnabled` is true **and** `wordsPerFlash === 1`. This depends on the setting, not on the chunk's length, so leftover one-word chunks at the end of a sentence or document, when the setting is 2, 3 or 4, are **not** highlighted.
- With `wordsPerFlash` of 2, 3 or 4: lay the chunk out as one single line, words separated by single spaces, centered horizontally on the fixed center axis, with no individual letter highlighted or underlined. The top and bottom axis tick marks are the focal reference. A leftover one-word chunk uses the same centered layout, font size and vertical position.
- The ORP character is highlighted with a configurable color (default red) **and** underline or bold, so the cue never relies on color alone.
- `computeChunkOrp(words, wordsPerFlash)` returns `orpIndex: null` and `focalWordIndex: null` whenever no highlight applies.

### 5.6 Navigation (`navigation.ts`)

- Previous and next sentence, previous and next paragraph, seek by word index, seek by percentage. Previous-sentence from mid-sentence goes to that sentence's start; from the start goes to the prior sentence.
- Progress: word index, percentage, words read, estimated time remaining at the current WPM including punctuation additions.

## 6. Data model (Dexie)

Name the document type `LibraryDocument` (do not shadow the DOM `Document`). Keep large text out of frequently written records.

```ts
interface LibraryDocument {
  id: string;
  title: string;
  author?: string;
  source: "paste" | "txt" | "pdf" | "epub"; // later: "url" | "ai"
  sourceMeta?: { fileName?: string; url?: string };
  totalWords: number;
  contentHash: string;       // detect duplicate imports
  tokenizerVersion: number;
  createdAt: string;         // ISO
  updatedAt: string;
}

interface DocumentContent { documentId: string; text: string; }

interface ReadingProgress {
  documentId: string;
  wordIndex: number;
  tokenizerVersion: number;
  updatedAt: string;
}

interface ReadingSession {
  id: string;
  documentId: string;
  startedAt: string;
  endedAt?: string;
  startWordIndex: number;
  endWordIndex: number;
  wordsRead: number;
  activeSeconds: number;     // time actually playing
  averageWpm: number;        // wordsRead / activeSeconds
}

interface ReaderSettings {
  wpm: number;
  wordsPerFlash: 1 | 2 | 3 | 4;
  orpEnabled: boolean;
  orpColor: string;
  punctuationPauseStrength: number;   // 0 to 2
  paragraphAutoPause: boolean;
  contextPane: "off" | "faded";
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  readingWidth: number;
  countdownSeconds: number;           // 0 to 5
  maxWpmCap?: number;
  speedRamp: { enabled: boolean; stepWpm: number; everySeconds: number; maxWpm: number };
  chunkExpansion: { enabled: boolean };
  theme: "dark" | "light" | "system";
  textColor?: string;
  backgroundColor?: string;
}
```

Rules:

- Object stores: `documents`, `contents`, `progress`, `sessions`, `settings`. Listing the library must never load full text.
- Version the Dexie schema, with a tested upgrade path for every version (the current schema is at least version 2; keep the 1-to-2 migration test).
- If a stored `tokenizerVersion` differs from the current one, remap progress by percentage and flag it in `DECISIONS.md`.
- Write progress at most every 3 seconds during playback, plus on pause, on `visibilitychange`, on `pagehide`, and whenever the user leaves the reader. Never on every word.
- A session is one continuous play-to-stop span; resuming starts a new session.
- Call `navigator.storage.persist()` on first successful save. Catch quota errors and show a clear message when a document cannot be saved.
- Settings are global in v1.

## 7. Importers

All importers implement one interface:

```ts
interface ImportResult {
  title: string;
  author?: string;
  text: string;                 // plain text, paragraphs separated by a blank line
  source: "paste" | "txt" | "pdf" | "epub";
  warnings: string[];
}
```

- **Paste:** title field (default: first line, else "Untitled"). Options to read now or save to library.
- **TXT:** File API. Detect encoding (UTF-8 default, handle BOM), normalize line endings, rejoin hard-wrapped lines into paragraphs.
- **PDF:** pdf.js in a Web Worker. Remove repeated headers, footers, and page numbers where detectable, rejoin hyphenated line breaks. If pages have no extractable text, add a warning; if the whole file has none, fail with a clear "scanned PDF, no text found" message.
- **EPUB:** read the spine in order, extract text from XHTML, take title and author from package metadata, use the table of contents for chapter breaks. DRM-protected files fail with a clear message. See the single-code-path rule in section 3.
- File size limit 25 MB (constant). Show progress for large imports. Never freeze the main thread.
- Normalization shared by all importers: collapse repeated whitespace, trim, preserve paragraph breaks, do not alter displayed characters.

## 8. UI specification

### 8.1 Screens

1. **Library:** list of documents (title, word count, progress %), sort by title or date added, open/resume, delete with confirmation and undo, import button, "Load sample text" action.
2. **Import:** paste field with title; file picker for TXT, PDF, EPUB.
3. **Reader:** the main experience.
4. **Settings:** a sheet inside the reader (bottom sheet on phones, side panel on desktop) plus a global settings page.
5. **Help/Install:** install instructions (iOS "Share, then Add to Home Screen"), keyboard shortcuts, speed-reading caveat, privacy statement.

### 8.2 Reader

- **Focal stage (fixed frame):** the stage (top and bottom borders and the two axis tick marks) must never move between words. Its height depends only on the user's settings (font size, weight, family) and the viewport width, never on the current chunk. Do not size it from its content or from padding around content; give it a fixed height of roughly 2.5 to 3 times the base font size, and center the text inside it.
- **Stable text size:** use one font size for all chunks. A chunk too wide for the stage is shrunk with `transform: scale(...)` (which does not affect layout), clamped to a sensible minimum, never by changing the font size per chunk. Preferably compute one scale per session from the longest chunk at the current words-per-flash setting. Words with and without descenders must sit on the same baseline.
- 1-word layout: the ORP letter sits on the center axis. Multi-word layout: see 5.5. Both live in the same fixed-height stage, so changing words per flash never moves the frame.
- Adjustable font size, weight, family (include an optional dyslexia-friendly font that is bundled locally), reading width, colors.
- Controls: play/pause, restart, previous/next sentence, previous/next paragraph, scrubbable progress bar, time remaining, WPM +/-, words-per-flash selector, settings.
- **Auto-hide during playback:** after the countdown ends, fade out the app header, the reader toolbar and the bottom controls after about 2 seconds with no pointer, touch or key activity. Show them again on tap, pointer movement, key press or pause. While paused they stay visible. On the reader route these bars overlay the content (fixed or absolute) so they never change the layout, and the focal stage never moves. Hidden bars have `pointer-events: none` and are not focusable (`inert`), and any key press reveals them for keyboard users. With `prefers-reduced-motion`, show and hide instantly. While the chrome is hidden during playback, one tap pauses and shows the controls.
- Reserve space for anything that mounts during playback (countdown text, notices, status line) so nothing shifts the stage.
- Optional faded context pane showing surrounding text; hidden by default on phones. Turning it off discourages regressions.
- Configurable countdown before playback starts (0 to 5 seconds).
- A plain scrolling text view of the document (simple, non-SWD) is available from the reader so no one is blocked by the format.
- Keep the screen awake while playing using the Screen Wake Lock API; release on pause; degrade silently where unsupported.
- First-session comfort notice: rapidly changing text may be uncomfortable for some people; offer a max-WPM cap.
- **Leaving the reader** by any route (header logo, nav links, mobile menu, Esc, browser back, phone back gesture) must pause playback, save progress immediately, end the active session, release the wake lock, and then navigate.

### 8.3 Input

Keyboard (desktop, iPad keyboards): Space play/pause; Left/Right previous/next sentence; Shift+Left/Right previous/next paragraph; Up/Down WPM +/-; R restart; Esc exit reader.

Touch: tap the display to play/pause; swipe left/right for previous/next sentence; swipe up/down or on-screen +/- buttons for WPM. Every gesture also has a visible button. A tap must trigger exactly one toggle (no double handling from touch plus click).

### 8.4 Responsive and iOS

- Mobile-first, fluid sizing, no fixed widths. Use `100dvh`, not `100vh`.
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`; apply `env(safe-area-inset-*)` padding to fixed bars and the reader.
- Portrait and landscape on iPhone and iPad; reader state survives rotation.
- Text inputs must stay visible above the on-screen keyboard.
- The display must scale down on narrow screens without clipping.

### 8.5 Accessibility

- `prefers-reduced-motion` respected; no animated transitions in reader chrome.
- WCAG AA contrast in default themes; ORP never relies on color alone.
- All controls have accessible names; logical focus order; announce play/pause and countdown state with an `aria-live` region.
- Dark and light themes, plus "system".

### 8.6 App header and navigation

- **One shared header on every route**, including the reader. Do not build a separate reader header and do not use back-arrow-plus-label navigation.
- Header contents: brand block on the left (logo mark above the "Orpela" text, both inside one link to `#/`, at least 44 px tall), primary nav (Library, Import, Settings, Help) with the current route marked `aria-current="page"` (none active on the reader route), and an "Import Text" button (hidden on the reader route).
- **Reader toolbar:** on the reader route only, a slim row (about h-12) directly under the header holds the document title (centered, truncated), the "Plain Text" toggle and the settings button, each at least 44x44 px. It auto-hides with the header (see 8.2).
- **Mobile navigation:** below the `md` breakpoint the nav links collapse into a menu button (Menu icon, `aria-label="Open menu"`, `aria-expanded`, at least 44x44 px) that opens a panel listing Library, Import, Settings and Help with the active route marked. Selecting an item, pressing Esc, or tapping outside closes it. Opening it during playback pauses playback. Respect safe areas.
- **Logo:** the image is decorative (`alt=""`, `aria-hidden`) because the link text names it. Build its URL from `import.meta.env.BASE_URL`, never a hardcoded `/assets/...` path. The PNG has an opaque white background and large empty padding, so the current implementation uses a CSS workaround: a `.brand-logo-frame` wrapper that crops to the measured bounding box, and `.brand-logo` blend styles (multiply in light theme, an invert/screen filter in dark theme). This is a stopgap. The proper fix is a trimmed, transparent PNG or SVG, after which the crop and blend CSS must be removed.

## 9. PWA and GitHub Pages

- The app is served at `https://webpmp.github.io/ORPELA/`. Read the base path from an environment variable and set Vite `base` accordingly (`'/ORPELA/'` in production, `'/'` in dev). Manifest `start_url` and `scope`, the service worker scope, and every asset URL (icons, logo, fonts, samples) must work under that base path.
- Use **hash routing**. GitHub Pages has no SPA rewrite.
- Manifest: name and short name from `config.ts`, `display: "standalone"`, theme and background colors, icons (192, 512, maskable 512). Include `apple-touch-icon`, `apple-mobile-web-app-capable`, and `apple-mobile-web-app-status-bar-style`.
- `vite-plugin-pwa` with `registerType: 'prompt'`: a new service worker waits and the UI shows "Update available" with an "Update now" button. Apply only when the user accepts. Never reload during playback.
- Precache all app assets, including lazy-loaded PDF/EPUB chunks, the pdf.js worker, fonts and the logo, so everything works offline.
- Show clear offline and loading states.
- Install UX: use `beforeinstallprompt` where supported; on iOS show a short "Share, then Add to Home Screen" guide.
- Handle suspension: save position on `visibilitychange` and `pagehide`; do not rely on background timers, background sync, or push.
- README note: Safari may clear storage for sites unused for about a week unless installed to the Home Screen. Provide export/import of the whole library as one JSON file (`backup.ts`) as the safeguard.
- **CI/CD** (`.github/workflows/ci.yml`): trigger on push to `main`, `pull_request` to `main`, and `workflow_dispatch`; permissions `contents: read`, `pages: write`, `id-token: write`; build job installs with `bun install --frozen-lockfile` (using `oven-sh/setup-bun` pinned to the `bun.lock` Bun version), runs `bun run lint`, `bun run test`, and `bun run build` with `VITE_BASE_PATH=/ORPELA/`, then configures and uploads `dist` only on `push` or `workflow_dispatch` on `main`; deploy job uses the Pages deploy action under environment `github-pages` with the same `main`-only condition. Repository setting: Pages source = GitHub Actions. A failing test or build must leave the live site on the last good version.

## 10. Testing

Required Vitest coverage for `src/engine/`:

- Tokenizer: abbreviations, ellipses, quotes, decimals, URLs, em dashes, hyphenation, empty input, very long words, paragraph breaks, determinism.
- Chunker: all four sizes, sentence-boundary shortening, final partial chunk.
- ORP: every length bucket, leading/trailing punctuation, quotes and parentheses; `null` highlight for every chunk when `wordsPerFlash` is 2, 3 or 4, **including one-word leftover chunks**.
- Timing: every addition, WPM extremes (100 and 1,000), strength 0, 1 and 2.
- Scheduler (fake clock): countdown transitions (for example 2, then 1, then playing, then the word index advances), no drift over 2 minutes of simulated playback, pause/resume (including during the countdown), seek, WPM change mid-play, hidden-page auto-pause, stable `getState` snapshots.
- Navigation: sentence and paragraph moves at boundaries, time-remaining estimate.

Component and hook tests (React Testing Library):

- **Hook-level regression test** for `useSpeedReader`: start playback, force several re-renders with new inline callback props, advance fake timers, assert the word index advances. Run the app and these tests with `React.StrictMode`.
- `ReaderDisplay`: 1-word chunk highlights only when ORP is on; at `wordsPerFlash` 2, 3 and 4 no chunk is highlighted, including the final chunk of an odd-length document and sentence-end leftovers; a full run of a sample text at 2 words per flash produces zero highlighted chunks; the stage height, axis tick positions, font size and text vertical center are identical across very different chunks (1 word, 4 words, a very long word, descenders).
- Header: the same header renders on all routes; the reader route has no back-arrow button; the toolbar contains title, Plain Text toggle and settings; chrome hides after inactivity during playback and reappears on tap, key press and pause; the stage position is identical with chrome shown or hidden; the mobile menu lists all four destinations and closes correctly; every exit path saves progress and pauses.

Also: storage migration test (open an old-version database with the current code), quota-exceeded handling, one importer test per format using small fixture files (include a scanned-PDF fixture and a malformed EPUB), an EPUB parity test if two code paths exist, and one Playwright smoke test: paste text, play, reload, confirm resume position.

Manual device checklist (document results in `QA.md`): latest Chrome, Safari, Firefox on desktop; iPhone and iPad Safari in browser and installed mode; both orientations; airplane-mode run; accept an "Update available" prompt after a new deploy and confirm the new behavior appears.

## 11. Milestones (definition of done for each)

Work in this order. Commit at the end of each milestone with a clear message. Do not start the next milestone until the current one's checks pass.

| # | Milestone | Done when |
| --- | --- | --- |
| 0 | Repo and deploy | Project scaffolded; lint, test, build pass in CI; a minimal installable PWA is live on GitHub Pages under the repo base path; README stub exists |
| 1 | Engine | All engine modules implemented with passing unit tests from section 10 |
| 2 | Reader UI | Reader screen works on a bundled sample text: playback, ORP, chunking, controls, settings sheet, themes, gestures, wake lock, responsive layouts, fixed focal stage, shared header with auto-hide |
| 3 | Storage and library | Dexie schema, paste and TXT import, library screen, progress saving and resume, sessions and basic statistics, delete with undo, load-sample action. **Shareable prototype checkpoint** |
| 4 | PDF and EPUB | Lazy-loaded, worker-based importers with warnings, size limit, and fixture tests |
| 5 | PWA hardening | Offline verified, update prompt, persistent storage request, JSON export/import, iOS standalone checks, storage-error handling |
| 6 | Polish and release | Accessibility pass, statistics view, README with screenshots and install steps, LICENSE, `QA.md`, tag `v0.1.0` |

## 12. MVP acceptance checklist

**SWD engine**
- [ ] Start, pause, resume, restart; the countdown completes and playback advances
- [ ] 100 to 1,000 WPM
- [ ] Chunk sizes 1, 2, 3, 4, respecting sentence boundaries
- [ ] 1-word display: ORP letter correct across lengths and punctuation; 2, 3 and 4-word display: whole chunk centered with no highlighted letter, including leftover one-word chunks
- [ ] Punctuation timing as specified
- [ ] Sentence and paragraph navigation
- [ ] Progress and time remaining shown
- [ ] Measured playback within tolerance of target WPM over a 2-minute run
- [ ] Focal stage frame and tick marks never move between words

**Content and persistence**
- [ ] Paste text with title
- [ ] TXT, PDF, EPUB import, with clear errors for unsupported or empty files
- [ ] Save to local library; progress survives restart; resume works
- [ ] Delete documents
- [ ] Export and import the library

**Responsive and navigation**
- [ ] Desktop; iPad portrait and landscape; iPhone portrait and landscape
- [ ] Touch-only usable; safe areas and virtual keyboard handled
- [ ] Same header on every route; mobile menu reaches all four destinations
- [ ] Header and controls auto-hide during playback without shifting the layout

**PWA**
- [ ] Installable on desktop browsers; Add to Home Screen on iPhone and iPad with guidance
- [ ] Standalone launch
- [ ] Documents and core reading work offline
- [ ] Update prompt, no reload during playback
- [ ] Position saved on suspension and when leaving the reader, and restored
- [ ] Works under the GitHub Pages base path, including the logo

**Quality**
- [ ] Dark and light themes; settings persist
- [ ] Statistics recorded
- [ ] Keyboard shortcuts work
- [ ] Reduced-motion and contrast requirements met
- [ ] The retired technique acronym appears nowhere in the repo, with no excluded files
- [ ] This spec is not shipped in `dist/` or the precache list
- [ ] No critical layout or playback defects

## 13. Out of scope for v1 (do not build)

AI summaries, lessons, or topic exploration; traditional e-reader (beyond the plain scrolling fallback); bookmarks, highlights, notes, tags, collections, search; web-article import; browser extension; accounts, cloud storage, sync; recommendations, quizzes, advanced analytics; additional file formats; OCR; non-space-delimited or right-to-left languages.

Design for them only by keeping the document model and storage layout extensible (for example `source` can later include `"url"` and `"ai"`).

## 14. Framing the training features honestly

Speed-reading research is mixed; pushing display speed tends to trade away comprehension. In the UI and README, present speed ramp, chunk expansion, and the context pane as optional experiments. Never claim guaranteed improvements in speed or comprehension.

## 15. Working agreements

- Keep a running `DECISIONS.md` (date, decision, reason) for every default you choose, dependency you add, and bug root cause you find.
- Keep commits small and meaningful; one milestone per PR or tagged commit.
- Prefer clear, boring code over clever code. Comment the why, not the what.
- Report at the end of each milestone: what was done, what was verified, what is deferred.
- Tests passing is not proof the UI works. Where a browser is unavailable, say so explicitly and list what still needs a manual check on a real device.

## 16. Open items (use these defaults unless the owner changes them)

- **App name:** "Orpela" (decided), set in `src/config.ts` and the manifest. Repo name `orpela`.
- **License:** MIT.
- **Sample text:** public-domain passages with source credits (currently Meditations, Book IV excerpt).
- **Logo:** replace the CSS crop and blend workaround with a trimmed transparent PNG or SVG when available.
- **Default WPM and punctuation additions:** as specified above; constants exposed for tuning after real use.
- **Future AI (v2, for awareness only):** bring-your-own-key, with an OpenAI-compatible provider adapter (configurable base URL, optional key, model name; LM Studio default `http://localhost:1234/v1`) and a Gemini adapter. Keys stay on the user's device and are excluded from library backups unless the user opts in. Local-model access is desktop-first because HTTPS pages generally cannot call plain-HTTP local servers and phones cannot reach a desktop's localhost. Do not build any of this now.


- Keep a running `DECISIONS.md` (date, decision, reason) for every default you choose or dependency you add.
- Keep commits small and meaningful; one milestone per PR or tagged commit.
- Prefer clear, boring code over clever code. Comment the why, not the what.
- Report at the end of each milestone: what was done, what was verified, what is deferred.

## 16. Open items (use these defaults unless the owner changes them)

- **App name:** "Orpela" (decided). Set only in `src/config.ts` and the manifest (name and short name). Use it in the README title, page `<title>`, and install guidance. Use `orpela` as the default repo name unless the owner says otherwise.
- **License:** MIT.
- **Sample text:** one or two short public-domain passages with source credits.
- **Default WPM and punctuation additions:** as specified above; expose constants for tuning after real use.
- **Future AI (v2, for awareness only):** bring-your-own-key, with an OpenAI-compatible provider adapter (configurable base URL, optional key, model name; LM Studio default `http://localhost:1234/v1`) and a Gemini adapter. Local-model access is desktop-first because HTTPS pages generally cannot call plain-HTTP local servers and phones cannot reach a desktop's localhost. Do not build any of this now.
