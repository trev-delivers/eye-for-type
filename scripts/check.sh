#!/bin/sh
# Every check, in order. CI runs this on every pull request and every push to
# main; run it yourself before pushing.  npm run check
#   PORT     where the built site is served for the browser tests (4180)
#   OBVIOUS  a checkout of obvious, for the design system audit (../obvious)
set -e
PORT=${PORT:-4180}
OBVIOUS=${OBVIOUS:-../obvious}

echo "== unit tests"
node --test tests/*.test.mjs

echo "== ds/ matches obvious main"
node scripts/sync-ds.mjs --check

echo "== design system audit"
if [ -f "$OBVIOUS/scripts/audit-ds.mjs" ]; then
  node "$OBVIOUS/scripts/audit-ds.mjs" . --max 13
else
  echo "SKIP design system audit: no obvious checkout at $OBVIOUS (set OBVIOUS)"
fi

echo "== build"
sh scripts/build.sh

echo "== browser tests"
# Serve what Vercel would serve, so a file left out of the build fails here.
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory out >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
URL="http://127.0.0.1:$PORT/"
i=0
until curl -fs -o /dev/null "$URL"; do
  i=$((i + 1))
  if [ $i -gt 50 ]; then echo "The site didn't start on port $PORT"; exit 1; fi
  sleep 0.2
done
URL="$URL" node tests/e2e.mjs
