#!/bin/sh
# Copies the site into out/, points the analytics script at this project's
# own path, which Vercel only provides at build time, and stamps the commit
# into <meta name="build"> so the live page says what's deployed.
set -e
P=${VERCEL_OBSERVABILITY_BASEPATH:-${VITE_VERCEL_OBSERVABILITY_BASEPATH:-${NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH:-/_vercel}}}
rm -rf out
mkdir out
cp -r index.html styles.css favicon.svg apple-touch-icon.png js ds out/
SHA=${VERCEL_GIT_COMMIT_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo dev)}
SHA=$(printf %s "$SHA" | cut -c1-7)
sed -i "s#/_vercel/insights#$P/insights#; s#<meta name=\"build\" content=\"dev\">#<meta name=\"build\" content=\"$SHA\">#" out/index.html
echo "analytics path: $P, build: $SHA"
