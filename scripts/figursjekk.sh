#!/bin/zsh
# Sjekker at hver figur i hvert kapittel faktisk kan tegnes av figurmotoren.
#   scripts/figursjekk.sh [port]
# Avslutter med kode 1 hvis noen figur feiler.
set -uo pipefail
PORT="${1:-8721}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
UT=$("$CHROME" --headless --disable-gpu --window-size=900,900 \
  --virtual-time-budget=40000 --dump-dom \
  "http://localhost:${PORT}/scripts/figursjekk.html" 2>/dev/null)
RAPPORT=$(print -r -- "$UT" | python3 -c '
import sys, re, html
t = sys.stdin.read()
m = re.search(r"<pre id=\"ut\">(.*?)</pre>", t, re.S)
print(html.unescape(m.group(1)) if m else "FANT INGEN RAPPORT")
')
print -r -- "$RAPPORT"
print -r -- "$RAPPORT" | grep -q "^FIGURSJEKK-OK$" || exit 1
