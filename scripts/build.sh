#!/bin/sh
# Copies the site into out/ and points the analytics script at this
# project's own path, which Vercel only provides at build time.
set -e
P=${VERCEL_OBSERVABILITY_BASEPATH:-${VITE_VERCEL_OBSERVABILITY_BASEPATH:-${NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH:-/_vercel}}}
rm -rf out
mkdir out
cp -r index.html styles.css favicon.svg apple-touch-icon.png js ds out/
sed -i "s#/_vercel/insights#$P/insights#" out/index.html
echo "analytics path: $P"
