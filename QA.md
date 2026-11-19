# QA Checklist (`v0.1.0`)

## Automated Verification
- `npm run lint` (`tsc --noEmit` with `"strict": true`)
- `npm test` (Vitest unit & integration tests across `src/engine/` and `src/services/`)
- `npm run build` (Production Vite + Workbox service worker build)

## Manual Device & Browser Matrix
Record pass/fail results across target environments:

- [ ] Desktop Chrome (latest): installable via `beforeinstallprompt`, offline mode, keyboard shortcuts
- [ ] Desktop Safari (latest): standalone/offline caching, reader playback, PDF/EPUB import
- [ ] Desktop Firefox (latest): reader playback, IndexedDB persistence, JSON backup export/import
- [ ] iPad Safari (portrait & landscape, browser + Home Screen standalone): rotation preserves position, safe areas respected
- [ ] iPhone Safari (portrait & landscape, browser + Home Screen standalone): virtual keyboard keeps paste inputs visible, ORP never clips on narrow screens, touch gestures + visible buttons >=44x44px
- [ ] Airplane-mode offline run: open installed app offline, read saved documents, import local TXT/PDF/EPUB
