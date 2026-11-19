# Orpela

**Orpela** is a responsive, installable, offline-capable, local-first Progressive Web App for **sequential word display (SWD)** reading. It displays one word—or a small group of words—at a time in a fixed focal position at a configurable speed.

## Features

- **Pure TypeScript SWD Engine (`src/engine/`):**
  - Deterministic tokenizer supporting abbreviations, decimals, URLs, ellipses, em-dashes, and split display fragments for words longer than 14 characters.
  - Configurable chunking (1 to 4 words per flash) that never crosses sentence boundaries.
  - Optimal Recognition Point (ORP) alignment with color + underline/bold emphasis (never relying on color alone).
  - Punctuation-aware cadence (clause, terminal, paragraph, and long-word additions) with `0x`–`2x` strength scaling.
  - Drift-free `requestAnimationFrame` scheduler using absolute target timestamps (`nextAt += duration`), plus auto-pause on page hide.
- **Local-First Library & Persistence:**
  - All documents, reading progress, sessions, and settings live locally in IndexedDB via Dexie.
  - No accounts, no backend, no analytics, no telemetry.
  - Full library export/import as a single portable JSON file.
- **Document Importers:**
  - **Paste Text** with automatic title detection.
  - **TXT** with BOM/UTF-8 decoding and hard-wrapped line rejoining.
  - **PDF** lazy-loaded in a Web Worker using a locally bundled `pdfjs-dist` worker (header/footer cleanup, hyphenation rejoining, scanned PDF detection).
  - **EPUB** lazy-loaded in a Web Worker using JSZip (spine order, package metadata, TOC chapter labels, DRM detection).
- **Accessible & Mobile-First:**
  - Built for desktop, iPad, and iPhone (browser and Home Screen standalone mode) using `100dvh` and `env(safe-area-inset-*)`.
  - Locally bundled fonts including **OpenDyslexic**, **Plus Jakarta Sans**, **Source Serif 4**, and **JetBrains Mono**.
  - Plain scrolling text view available anytime from the reader.

## A Note on Speed Reading

Speed-reading research is mixed: pushing presentation speeds too high often reduces reading comprehension. Optional features such as speed ramp, chunk expansion, and the faded context pane are offered strictly as user-controlled experiments.

## Safari Storage & Installing to Home Screen

On iOS and iPadOS Safari, website storage may be cleared by the browser after roughly a week of inactivity unless the app is installed to the Home Screen:

1. Open Orpela in **Safari**.
2. Tap **Share** -> **Add to Home Screen**.
3. Use **Settings -> Export Library JSON** periodically as a portable backup.

## Development

```bash
bun install --frozen-lockfile
bun run dev      # Start Vite dev server at http://localhost:3000/ (base "/")
bun run lint     # TypeScript strict check
bun run test     # Run Vitest suite
bun run build    # Production build (defaults to /ORPELA/ for GitHub Pages)
VITE_BASE_PATH=/ORPELA/ bun run preview  # Preview dist/ under /ORPELA/ (defaults to "/" when unset)
```

## License

MIT
