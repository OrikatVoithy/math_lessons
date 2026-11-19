#!/bin/sh
# Wraps each lesson page in a full HTML document for static hosting (GitHub Pages, Netlify).
# The pages themselves are written without <!doctype>/<head> so they also publish as Claude artifacts.
#   index.html     -> dist/index.html          (Level 1, the site's front page)
#   level-2.html   -> dist/level-2/index.html  (so the address is .../level-2/)
set -eu
cd "$(dirname "$0")"
rm -rf dist
mkdir dist
for f in *.html; do
  if [ "$f" = "index.html" ]; then
    out="dist/index.html"
  else
    mkdir -p "dist/${f%.html}"
    out="dist/${f%.html}/index.html"
  fi
  {
    printf '%s\n' '<!doctype html>' '<html lang="en">' '<meta charset="utf-8">' \
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
    cat "$f"
    printf '%s\n' '</html>'
  } > "$out"
done
echo "Built $(find dist -name index.html | wc -l) page(s) into trig-lessons/dist"
