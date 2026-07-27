#!/bin/zsh
# Kjører funksjonstesten (quiz, flashcards, fremdrift, søk) i headless Chrome.
#   scripts/funksjonstest.sh [port]
# Avslutter med kode 1 hvis noen test feiler.
set -uo pipefail

PORT="${1:-8721}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

UT=$("$CHROME" --headless --disable-gpu --window-size=1200,1000 \
  --virtual-time-budget=90000 --dump-dom \
  "http://localhost:${PORT}/scripts/funksjonstest.html" 2>/dev/null)

# Hent bare <pre>-innholdet — resten av DOM-en inneholder testens egen kildekode,
# så et grep over hele utskriften ville matchet strenger i skriptet.
RAPPORT=$(print -r -- "$UT" | python3 -c '
import sys, re, html
t = sys.stdin.read()
m = re.search(r"<pre id=\"ut\">(.*?)</pre>", t, re.S)
print(html.unescape(m.group(1)) if m else "FANT INGEN TESTUTSKRIFT")
')
print -r -- "$RAPPORT"
print -r -- "$RAPPORT" | grep -qE "^ALLE [0-9]+ TESTER OK$" || exit 1
