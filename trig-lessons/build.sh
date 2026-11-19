#!/bin/sh
# Wraps each lesson page in a full HTML document for static hosting (Netlify).
# The pages themselves are written without <!doctype>/<head> so they also publish as Claude artifacts.
set -eu
cd "$(dirname "$0")"
rm -rf dist
mkdir dist
for f in *.html; do
  {
    printf '%s\n' '<!doctype html>' '<html lang="en">' '<meta charset="utf-8">' \
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
    cat "$f"
    printf '%s\n' '</html>'
  } > "dist/$f"
done
echo "Built $(ls dist | wc -l) page(s) into trig-lessons/dist"
