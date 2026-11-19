<h1>
  <img src="public/assets/logo-orpela-transparent.png" alt="Orpela logo" height="72" align="absmiddle">
  Orpela
</h1>

Orpela is a free speed reading app that runs in your browser. It shows one word, or a small group of words, at a time in a fixed spot on the screen, at a speed you choose. You can install it on your phone, tablet, or computer, and it keeps working without an internet connection.

Try it here: https://webpmp.github.io/ORPELA/

## What it does

**Reading**

- Choose a speed from 100 to 1,000 words per minute and show 1 to 4 words at a time.
- The key letter in each word is highlighted and underlined, so the cue never depends on color alone.
- The pace slows down after commas, periods, and paragraph breaks.
- Playback pauses on its own when you switch away from the page.
- A plain scrolling text view is always available if you would rather read normally.

**Your library**

- Paste text, or import TXT, PDF, and EPUB files.
- Everything is stored on your device. There are no accounts, no servers, no analytics, and no tracking.
- Your progress is saved, so you can pick up where you left off.
- You can export your whole library as one JSON file and import it again later.

**Works everywhere**

- Built for desktop, iPad, and iPhone, in the browser or installed to the Home Screen.
- Includes the OpenDyslexic font for readers who find it easier, along with a few other fonts.
- Light and dark themes.

## A note on speed reading

Research on speed reading is mixed. Reading very fast often costs you comprehension. Features like speed ramp, growing word groups, and the faded context view are optional experiments, so use whatever works for you.

## Install it on your device

On iPhone or iPad, open the site in Safari, tap Share, then tap Add to Home Screen.

Safari can clear a website's stored data after about a week without use, unless the app is installed to the Home Screen. It is a good idea to back up your library now and then from Settings by using Export Library JSON.

## Development

```bash
bun install --frozen-lockfile
bun run dev      # Start Vite dev server at http://localhost:3000/ (base "/")
bun run lint     # TypeScript strict check
bun run test     # Run Vitest suite
bun run build    # Production build (defaults to /ORPELA/ for GitHub Pages)
VITE_BASE_PATH=/ORPELA/ bun run preview  # Preview dist/ under /ORPELA/ (defaults to "/" when unset)
```

The reading engine lives in `src/engine/` and is plain TypeScript with no framework code. The full build specification is in `docs/BUILD_SPEC.md`.

## License

MIT
