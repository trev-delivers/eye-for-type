# Eye for Type

Learn to see typography: hands-on lessons in kerning, leading, measure, word spacing and rag. Each lesson has a Learn mode with guidance and a Practise mode that takes the guidance away and scores your judgement.

## How scoring works

- **Kerning** is scored against the typeface's own kerning (Source Serif 4's OpenType kerning, set by its designers). It scores the gaps between letters, which is what the eye sees, not each letter's position. After scoring you can flick between yours and the answer, slide your letters to the answer, and get a one-line reason for your worst pair.
- **Leading, measure and word spacing** have no single right answer, so each is scored against a comfortable range, shown on the slider afterwards. Leading's range grows with the line length.
- **Rag** is scored on the shape of the right edge (runts, jagged jumps, notches, slopes), so any good rag passes. Rewriting the paragraph into something else doesn't count.

Text is sized so the measure in characters is the same on every screen, so every lesson behaves the same on a phone and a laptop.

## Running it

A static site with no build step: `index.html`, `styles.css` and the modules in `js/`. Deployed on Vercel.

Colours, type and timing come from the Specimen theme in obvious, vendored into `ds/`. Refresh it with `node scripts/sync-ds.mjs` (or `DS_LOCAL=../obvious node scripts/sync-ds.mjs` against a checkout).

```sh
python3 -m http.server 4180      # serve locally
npm test                          # scoring unit tests
node tests/e2e.mjs                # browser tests (needs Playwright; set PLAYWRIGHT to its index.mjs)
```
