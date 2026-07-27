#!/bin/zsh
# Bygger og installerer iPhone-skallet på Fillips iPhone 15.
# Telefonen må være tilkoblet med kabel (eller på samme nett og paret).
#
#   scripts/installer-iphone.sh
#
# Med gratis signering utløper appen etter ~7 dager — kjør skriptet på nytt.
set -euo pipefail

PAKKE="/Users/fillip/App_test/RealfagVG2.swiftpm"
ENHET="2A4EF61A-3626-5B0A-8FEB-155F005B09C3"   # Fillip's iPhone 15
DD="/tmp/realfagvg2-dd"
APP="${DD}/Build/Products/Debug-iphoneos/Realfag VG2.app"

export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer

tilstand() {
  xcrun devicectl list devices 2>/dev/null \
    | awk -v id="$ENHET" '$0 ~ id { print $(NF-3) }'
}

echo "→ Sjekker enheten …"
if [[ "$(tilstand)" != "connected" ]]; then
  echo "   Telefonen er ikke tilgjengelig (tilstand: $(tilstand))."
  echo "   Koble iPhonen til med kabel, lås den opp og trykk «Stol på denne datamaskinen»."
  exit 1
fi

echo "→ Bygger …"
cd "$PAKKE"
xcodebuild -scheme RealfagVG2 \
  -destination "platform=iOS,id=${ENHET}" \
  -derivedDataPath "$DD" \
  -allowProvisioningUpdates build \
  | tail -3

echo "→ Installerer …"
xcrun devicectl device install app --device "$ENHET" "$APP"

cat <<'TXT'

Ferdig. Første gang må du godkjenne utviklersertifikatet på telefonen:
  Innstillinger → Generelt → VPN og enhetsadministrasjon → stol på utvikleren.

Alternativet som aldri utløper: åpne
  https://fillipkja.github.io/vg2-realfag/
i Safari på telefonen → Del → «Legg til på Hjem-skjerm».
TXT
