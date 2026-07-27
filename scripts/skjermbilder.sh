#!/bin/zsh
# Tar skjermbilder av appen med headless Chrome for visuell verifisering.
#
#   scripts/skjermbilder.sh [port]
#
# Headless Chrome klemmer --window-size til minst 500x813, så appen rendres i
# en iframe med eksakt telefonbredde (393 px = iPhone 15) på en rammeside.
# Bildene havner i /tmp/vg2_<navn>.png.
set -uo pipefail

PORT="${1:-8721}"
BREDDE=393
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROT="${0:A:h:h}"
BASE="http://localhost:${PORT}"

lag_ramme() {  # $1=rute  $2=høyde  $3=tema
  cat > "${ROT}/_ramme.html" <<HTML
<!doctype html><html lang="nb"><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#888}
  iframe{width:${BREDDE}px;height:$2px;border:0;display:block;
         color-scheme:${3};background:${3:l} }
</style>
<body><iframe src="./?theme=$3$1"></iframe>
HTML
}

skudd() {
  local navn="$1" rute="$2" hoyde="${3:-1200}" tema="${4:-light}"
  lag_ramme "$rute" "$hoyde" "$tema"
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --window-size="${BREDDE},${hoyde}" \
    --screenshot="/tmp/vg2_${navn}.png" \
    --virtual-time-budget=7000 \
    "${BASE}/_ramme.html" 2>/dev/null
  printf '  %-14s %s\n' "$navn" "/tmp/vg2_${navn}.png"
}

echo "Skjermbilder fra ${BASE} (bredde ${BREDDE} px)"
skudd hjem      '#/'                              1500
skudd fag       '#/fag/matematikk'                1600
skudd fagbio    '#/fag/biologi'                   1600
skudd kompakt   '#/kap/matematikk/3?v=kompakt'    2000
skudd grundig   '#/kap/matematikk/3?v=grundig'    2400
skudd begreper  '#/kap/matematikk/3?v=begreper'   1800
skudd quiz      '#/kap/matematikk/3?v=quiz'       1100
skudd kort      '#/kap/matematikk/3?v=kort'       1100
skudd formler   '#/formler/matematikk'            1700
skudd metoder   '#/metoder'                       1400
skudd sok       '#/sok'                            900
skudd mork      '#/kap/matematikk/3?v=kompakt'    2000 dark
skudd hjemmork  '#/'                              1500 dark

rm -f "${ROT}/_ramme.html"
