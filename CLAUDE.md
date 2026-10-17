# Eye for Type

My site for learning to see typography. Kerning, leading, measure, word
spacing and rag, each with a Learn mode and a Practise mode that scores you.
It's a static site: `index.html`, `styles.css` and the ES modules in `js/`.
No framework and no runtime dependencies, and I'd like to keep it that way.
Playwright is a dev dependency for the tests and never ships.

## Checks

`npm run check` runs everything, in this order: the scoring unit tests, a
check that `ds/` matches obvious main, the design system audit, the build,
then the browser tests against the built site. CI runs the same command on
every pull request and every push to `main`.

Locally it needs `npm ci` once, Python 3 for the server, and a checkout of
obvious next to this one (or `OBVIOUS=/path/to/obvious`). Without obvious the
audit prints `SKIP` and the rest still runs; CI fails on any `SKIP`.
`PORT=4181 npm run check` if 4180 is taken.

The browser tests in `tests/e2e.mjs` each replay a bug that was found and
fixed, or check a feature. They fail on any console error and on sideways
scroll at 5 widths. A new bug gets a test there that fails without the fix.

## How it ships

Pull request to `main`. Vercel runs `scripts/build.sh`, which copies the site
into `out/` and points the analytics script at the project's own path.

Colours, type and timing come from the Specimen theme in obvious, copied into
`ds/`. Refresh it with `node scripts/sync-ds.mjs`. When obvious main moves,
CI goes red here until `ds/` is synced again. That's on purpose.

## Be careful with

- Saved scores. They live in this browser's localStorage under
  `eye-for-type:v2` (v1 is still read). `cleanScores` in `js/scoring.js`
  tidies whatever it finds. Changing the key or the shape needs a migration
  and a test that old scores still load.
- The type sizing in `js/text.js`. Text is sized so the measure in
  characters is the same on every screen, which is what makes a lesson
  behave the same on a phone and a laptop. Tests 11, 12 and the layout
  tests guard it.
- Scoring in `js/scoring.js` is plain functions with unit tests. Keep the DOM
  out of it.

## Writing

Copy on the site, the README and commit messages follow the write-like-trev
skill in obvious. Plain, UK spelling, no em dashes, and no "X, not Y" lines.
