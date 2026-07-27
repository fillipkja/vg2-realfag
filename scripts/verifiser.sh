#!/bin/zsh
# Kjører HELE verifiseringen. Bruk denne før hver push.
#   scripts/verifiser.sh [port]
#
# 1. dataskjema        — validate_data.py --strict
# 2. LaTeX             — hvert uttrykk gjennom KaTeX med throwOnError
# 3. figurer           — hver figur gjennom figurmotoren
# 4. funksjonstest     — quiz, kort, repetisjon, fremdrift, søk
# 5. skjermbilder      — visuell sjekk i lys og mørk modus
set -uo pipefail
PORT="${1:-8721}"
ROT="${0:A:h:h}"
cd "$ROT"

feilet=0
kjor() {
  print -n -- "→ $1 … "
  if UT=$(eval "$2" 2>&1); then
    print -- "OK"
  else
    print -- "FEILET"
    print -r -- "$UT" | tail -25 | sed 's/^/    /'
    feilet=1
  fi
}

if ! curl -s -o /dev/null "http://localhost:${PORT}/"; then
  print -- "Ingen server på port ${PORT}. Start den med:"
  print -- "    python3 scripts/server.py ${PORT} &"
  exit 1
fi

kjor "dataskjema"    "python3 scripts/validate_data.py --strict"
kjor "LaTeX"         "./scripts/latexsjekk.sh ${PORT}"
kjor "figurer"       "./scripts/figursjekk.sh ${PORT}"
kjor "funksjonstest" "./scripts/funksjonstest.sh ${PORT}"
kjor "skjermbilder"  "./scripts/skjermbilder.sh ${PORT}"

print -- ""
if [[ $feilet -eq 0 ]]; then
  print -- "ALT GRØNT — klart for push. Bildene ligger i /tmp/vg2_*.png; se på dem."
else
  print -- "NOE FEILET — ikke push før det er rettet."
  exit 1
fi
