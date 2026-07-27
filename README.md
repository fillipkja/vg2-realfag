# Realfag VG2 — studieverktøy

Studieverktøy for **studiespesialiserende realfag VG2**: Matematikk R1,
Fysikk 1, Kjemi 1 og Biologi 1. Alt innhold er på norsk.

Verktøyet finnes i tre former, med samme innhold overalt:

| Form | Adresse | Merknad |
|---|---|---|
| Nettside | https://fillipkja.github.io/vg2-realfag/ | fungerer på alle datamaskiner og nettlesere |
| PWA | samme adresse → «Legg til på Hjem-skjerm» | egen app-ikon, utløper aldri |
| iPhone-app | `RealfagVG2.swiftpm` | native skall, må reinstalleres hver ~7. dag |

## Hva appen inneholder

For hvert kapittel i hvert fag:

- **Kompakt** — de viktigste punktene og formlene, til rask repetisjon før prøven.
- **Grundig** — full gjennomgang av teorien, gjennomregnede eksempler,
  vanlige feil og prøvetips. Du velger selv hvilken av de to du trenger.
- **Begreper** — ordlista du må kunne.
- **Quiz** — flervalgsspørsmål med forklaring på hvorfor svaret er riktig.
  70 % eller mer teller kapittelet som gjennomgått.
- **Kort** — flashcards med Leitner-repetisjon: kort du kunne, kommer sjeldnere
  igjen; kort du bommet på, kommer tilbake neste dag.

I tillegg:

- **Formelsamling** for R1, fysikk og kjemi, sortert etter tema.
- **Læringsmetoder** — studieteknikkene med best dokumentert effekt, og hvordan
  du bruker dem i realfag.
- **Søk** på tvers av alle fag — begreper, formler og kapitler.
- **Fremdrift** per fag og kapittel, lagret lokalt på hver enhet.

## Fagstrukturen

Kapitlene i **Matematikk R1**, **Fysikk 1** og **Kjemi 1** følger
Aunivers/Aschehoug, som er læreverket klassen bruker.

**Biologi 1** følger Udirs læreplan **BIO01-02 (LK20)** og progresjonen i
**Bios 1 (Cappelen Damm)**. Grunnen: Aschehoug/Aunivers har ikke noe eget
Biologi 1-verk i det hele tatt — biologi i norsk VGS dekkes av Bios
(Cappelen Damm), Bi 1 (Gyldendal) eller NDLA. Stoffet passer til alle tre.
Får du vite hvilket verk klassen faktisk bruker, står det i
[INNHOLD_BRIEF.md](INNHOLD_BRIEF.md) hvordan du justerer kapittelinndelingen.

## Filstruktur

```
VG2/
├── index.html              # markup + all CSS
├── app.js                  # ruting, visninger, quiz, flashcards, søk
├── data/
│   ├── fag.json            # fag- og kapittelstrukturen
│   ├── kapitler/           # ett kapittel per fil: <fag>-<nn>.json
│   ├── formler-<fag>.json  # formelsamlingene
│   └── studieteknikk.json  # læringsmetodene
├── vendor/katex/           # KaTeX + mhchem, committet (fungerer offline)
├── icons/                  # PWA-ikoner
├── manifest.webmanifest    # PWA-manifest
├── sw.js                   # service worker (network-first for innhold)
├── scripts/
│   ├── validate_data.py    # validerer datafilene mot SCHEMA.md
│   └── skjermbilder.sh     # headless-Chrome skjermbilder til verifisering
├── SCHEMA.md               # dataformatet — kontrakten for alt innhold
└── INNHOLD_BRIEF.md        # slik legger du til eller retter innhold
```

Ingen byggesteg. Det som ligger i repoet, er det som serveres.

## Utvikling

```bash
python3 -m http.server 8721          # åpne http://localhost:8721
python3 scripts/validate_data.py --strict
./scripts/skjermbilder.sh            # bilder i /tmp/vg2_*.png
```

Deploy er `git push` — GitHub Pages publiserer på nytt automatisk (~1 min).

Dype lenker (nyttige for verifisering og for å hoppe rett inn):

```
#/fag/fysikk                        fagoversikt
#/kap/matematikk/3?v=grundig        kapittel, valgt visning
#/formler/kjemi                     formelsamling
#/metoder/aktiv-gjenkalling         én læringsmetode
?theme=dark#/                       tvunget mørk modus
```

## iPhone

```bash
cd /Users/fillip/App_test/RealfagVG2.swiftpm
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
xcodebuild -scheme RealfagVG2 \
  -destination 'platform=iOS,id=<device-id>' \
  -derivedDataPath /tmp/realfagvg2-dd -allowProvisioningUpdates build

xcrun devicectl device install app --device <device-id> \
  "/tmp/realfagvg2-dd/Build/Products/Debug-iphoneos/Realfag VG2.app"
```

Finn `<device-id>` med `xcrun devicectl list devices`. Med gratis signering
utløper skallet etter ~7 dager — kjør de to kommandoene på nytt. **PWA-en
utløper aldri**, så den er det enkleste alternativet i det lange løp.
