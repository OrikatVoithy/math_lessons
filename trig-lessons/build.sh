#!/bin/sh
# Builds the lesson pages.
#
# Each page is written without <!doctype>/<head>, and may pull in shared code with a line like
#   <script data-include="quiz.js"></script>   or   <style data-include="quiz.css"></style>
# which is replaced by the contents of shared/quiz.js (or .css), so every built page is one
# self-contained file.
#
#   dist/      full HTML documents for hosting (GitHub Pages)
#                index.html   -> dist/index.html          (Level 1, the site's front page)
#                level-2.html -> dist/level-2/index.html  (so the address is .../level-2/)
#   preview/   the same pages without the document wrapper, for Claude artifact previews
set -eu
cd "$(dirname "$0")"

resolve() {
  awk '
    /^[ \t]*<(script|style) data-include="[^"]+"><\/(script|style)>[ \t]*$/ {
      tag = $0; sub(/^[ \t]*</, "", tag); sub(/ .*/, "", tag)
      file = $0; sub(/.*data-include="/, "", file); sub(/".*/, "", file)
      path = "shared/" file
      if ((getline line < path) <= 0) { print "build.sh: missing " path > "/dev/stderr"; exit 1 }
      print "<" tag ">"
      print line
      while ((getline line < path) > 0) print line
      close(path)
      print "</" tag ">"
      next
    }
    { print }
  ' "$1"
}

rm -rf dist preview
mkdir dist preview
for f in *.html; do
  if [ "$f" = "index.html" ]; then
    out="dist/index.html"
  else
    mkdir -p "dist/${f%.html}"
    out="dist/${f%.html}/index.html"
  fi
  resolve "$f" > "preview/$f"
  {
    printf '%s\n' '<!doctype html>' '<html lang="en">' '<meta charset="utf-8">' \
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
    cat "preview/$f"
    printf '%s\n' '</html>'
  } > "$out"
done
echo "Built $(find dist -name index.html | wc -l) page(s) into trig-lessons/dist (and previews in trig-lessons/preview)"
