# Dataskjema for Realfag VG2

Alt innhold ligger som JSON-filer i `data/`. Denne filen er kontrakten:
innholdsprodusenter MÅ følge den nøyaktig. Kjør alltid
`python3 scripts/validate_data.py <fil>` etter at en fil er skrevet, og fiks
alle feil før du er ferdig.

## Generelle regler

- **Språk: norsk bokmål.** Naturlig, presist fagspråk på VG2-nivå. Du-form.
- **Gyldig JSON.** Husk at backslash må dobles i JSON-strenger: skriv
  `"\\frac{1}{2}"`, `"\\ce{H2O}"`.
- **Matematikk skrives i LaTeX** med `$...$` (inline) og `$$...$$` (blokk).
  Kjemiske formler og reaksjonslikninger med mhchem: `$\\ce{2H2 + O2 -> 2H2O}$`.
  Enheter i tekst kan skrives rett frem (9,81 m/s²), i LaTeX med `\\,\\text{m/s}^2`.
- **HTML-felter** (feltnavn som slutter på `html`, samt `oppgave`/`losning`)
  tillater KUN disse taggene:
  `p, ul, ol, li, strong, em, br, table, thead, tbody, tr, th, td, h4, sub, sup`.
  Ingen attributter unntatt ingen. Ingen `<script>`, `<img>`, `<a>`, `<div>`, `<span>`.
- **Alle andre strengfelter er ren tekst** (kan inneholde `$...$`-LaTeX, men ingen HTML).
- Desimaltall i løpende tekst bruker komma (norsk): «0,5», men i LaTeX brukes
  punktum eller `{,}`: `$0{,}5$`.

## Kapittelfil: `data/kapitler/<fagid>-<nn>.json`

`<fagid>` ∈ `matematikk | fysikk | kjemi | biologi`, `<nn>` = kapittelnummer
med to sifre (`01`, `02`, …). `nr` og `tittel` må stemme med `data/fag.json`.

```json
{
  "fag": "matematikk",
  "nr": 3,
  "tittel": "Derivasjon",
  "intro": "1–2 setninger ren tekst: hva kapittelet handler om og hvorfor det er viktig.",

  "kompakt": {
    "punkter": ["6–10 korte punkter — det aller viktigste i kapittelet. Ren tekst + $LaTeX$."],
    "formler": [{ "navn": "Produktregelen", "latex": "(uv)' = u'v + uv'" }]
  },

  "grundig": {
    "seksjoner": [{ "tittel": "Delemne", "html": "<p>Teoriforklaring…</p>" }],
    "eksempler": [{ "tittel": "Kort beskrivende tittel", "oppgave": "<p>Oppgavetekst…</p>", "losning": "<p>Full gjennomregnet/forklart løsning, steg for steg.</p>" }],
    "vanligeFeil": ["3–6 vanlige feil elever gjør, ren tekst."],
    "tips": ["3–5 konkrete prøve-/eksamenstips for akkurat dette kapittelet."]
  },

  "begreper": [{ "begrep": "Momentan vekstfart", "forklaring": "Én til to setninger." }],

  "quiz": [{
    "sporsmal": "Spørsmålstekst (kan inneholde $LaTeX$).",
    "alternativer": ["A", "B", "C", "D"],
    "riktig": 0,
    "forklaring": "Hvorfor riktig svar er riktig — og gjerne hvorfor de vanligste feilsvarene er gale."
  }],

  "flashcards": [{ "front": "Begrep/formel/spørsmål", "bak": "Svar/forklaring" }]
}
```

### Antall (håndheves av validatoren)

| Felt | Antall |
|---|---|
| `kompakt.punkter` | 6–10 |
| `kompakt.formler` | 0–14 (0 kun der formler ikke gir mening, f.eks. biologi) |
| `grundig.seksjoner` | 3–7, hver `html` ca. 120–300 ord |
| `grundig.eksempler` | 2–4 (regnefag: gjennomregnede oppgaver; biologi: gjennomgåtte prosesser/case) |
| `grundig.vanligeFeil` | 3–6 |
| `grundig.tips` | 3–5 |
| `begreper` | 8–15 |
| `quiz` | 8–12, alltid nøyaktig 4 alternativer, `riktig` ∈ 0–3. Varier hvilken indeks som er riktig. |
| `flashcards` | 12–16 |

## Formelsamling: `data/formler-<fagid>.json` (kun matematikk, fysikk, kjemi)

```json
{
  "fag": "matematikk",
  "kategorier": [{
    "tittel": "Derivasjon",
    "formler": [{ "navn": "Kjerneregelen", "latex": "g(u(x))' = g'(u) \\cdot u'(x)", "forklaring": "Valgfri kort merknad om når/hvordan den brukes." }]
  }]
}
```
6–12 kategorier per fag, 3–12 formler per kategori. Dekk hele årets pensum.

## Studieteknikk: `data/studieteknikk.json`

```json
{
  "metoder": [{
    "id": "aktiv-gjenkalling",
    "tittel": "Aktiv gjenkalling",
    "kort": "Én setning som oppsummerer metoden.",
    "html": "<p>Artikkel på 200–450 ord: hva metoden er, hvorfor den virker (forskningsbasert), og konkret hvordan en VG2-realfagselev bruker den.</p>"
  }]
}
```

## Figurer

Figurer er **data, ikke bilder**: appen tegner dem som SVG. De skalerer, virker
offline og følger lys/mørk modus. Farger settes av appen — du oppgir aldri farge
som hex, bare eventuelt serienummeret `farge: 1 | 2 | 3`.

En figur kan legges tre steder:

| Plassering | Felt | Bruk |
|---|---|---|
| Sammendraget | `kompakt.figur` | **én** figur som oppsummerer kapittelet visuelt |
| En teoriseksjon | `grundig.seksjoner[i].figur` | figuren som forklarer nettopp den seksjonen |
| Et eksempel | `grundig.eksempler[i].figur` | figuren oppgaven refererer til |

Alle figurer tar `type` (påkrevd), `tittel` og `forklaring` (én til to setninger
som sier hva eleven skal se — ikke gjenta tittelen).

**Legg bare inn en figur der den faktisk forklarer noe.** En figur som bare
pynter er verre enn ingen figur. Sikt på 2–5 figurer per kapittel.

### `graf` — koordinatsystem med funksjoner
```json
{ "type": "graf", "tittel": "…", "forklaring": "…",
  "xmin": -2, "xmax": 4, "ymin": -3, "ymax": 6,
  "xlabel": "t (s)", "ylabel": "v (m/s)",
  "kurver": [{ "uttrykk": "x^2-2*x", "navn": "f", "farge": 1 }],
  "linjer": [{ "fra": [0,0], "til": [3,3], "navn": "tangent", "farge": 2, "stiplet": false }],
  "punkter": [{ "x": 1, "y": -1, "navn": "(1, −1)", "hjelpelinjer": true }],
  "asymptoter": [{ "retning": "vertikal", "verdi": 2, "navn": "x = 2" }],
  "omraade": { "uttrykk": "x^2", "fra": 0, "til": 2 } }
```
`uttrykk` tolkes av en egen parser: `+ - * / ^`, parenteser, variabelen `x`,
konstantene `pi` og `e`, og funksjonene `sin cos tan asin acos atan sinh cosh
tanh exp ln log lg sqrt abs floor ceil`. Bruk `*` eksplisitt (`2*x`, ikke `2x`).
`ymin`/`ymax` kan utelates — da regnes de ut. Maks 3 kurver.

### `fortegnslinje` — norsk fortegnslinje
```json
{ "type": "fortegnslinje", "tittel": "…", "forklaring": "…",
  "xmin": -3, "xmax": 3,
  "linjer": [{ "navn": "x − 1", "nullpunkt": [1], "fortegn": ["-", "+"] }],
  "resultat": { "navn": "f'(x)", "nullpunkt": [-1, 1], "fortegn": ["+", "-", "+"] } }
```
`fortegn` har alltid ett element mer enn `nullpunkt`. Heltrukken strek = positiv,
stiplet = negativ, ring i nullpunktene.

### `vektor` — vektorer og kraftdiagram
```json
{ "type": "vektor", "tittel": "…", "forklaring": "…",
  "xmin": -1, "xmax": 5, "ymin": -1, "ymax": 4, "rutenett": true,
  "vektorer": [{ "fra": [0,0], "til": [3,1], "navn": "a", "farge": 1 }],
  "parallellogram": [0, 1],
  "vinkel": { "mellom": [0,1], "navn": "α" },
  "kropp": { "x": 0, "y": 0, "form": "boks", "navn": "m" },
  "underlag": { "y": 0 } }
```
Sett `kropp` (og gjerne `rutenett: false`) for et frilegemediagram i fysikk.

### `tallinje` — definisjonsmengder og intervaller
```json
{ "type": "tallinje", "tittel": "…", "min": -3, "max": 6,
  "intervaller": [{ "fra": 1, "til": 6, "lukket": [true, false], "navn": "Df", "farge": 1 }],
  "punkter": [{ "verdi": 1, "navn": "1", "fylt": true }] }
```

### `flyt` — prosess eller framgangsmåte
```json
{ "type": "flyt", "tittel": "…", "forklaring": "…", "retning": "ned",
  "steg": [{ "tekst": "Balansér likningen", "note": "koeffisientene gir forholdet" }],
  "tilbakekopling": { "fra": 3, "til": 0, "tekst": "negativ tilbakekopling" } }
```
`retning`: `"ned"` (2–6 steg) eller `"hoyre"` (2–4 steg). `tilbakekopling` gir
sløyfen tilbake — perfekt for homeostase. Hold `tekst` under ~40 tegn.

### `syklus` — rundgang med 3–6 faser
```json
{ "type": "syklus", "tittel": "Cellesyklusen", "senter": "Cellesyklus",
  "faser": [{ "navn": "G1", "note": "vekst og vanlig aktivitet" }] }
```
`navn` skal være kort (≤ 6 tegn), `note` under ~30 tegn.

### `nivaaer` — energinivåer og energidiagram
```json
{ "type": "nivaaer", "tittel": "…", "enhet": "E (eV)", "desimaler": 2,
  "nivaaer": [{ "verdi": -13.6, "navn": "n = 1", "grunn": true }],
  "overganger": [{ "fra": 2, "til": 1, "navn": "Hα", "farge": 2, "x": 0 }] }
```
`fra`/`til` er indekser i `nivaaer`. `x` (0, 1, 2 …) sprer pilene sidelengs.
Brukes både til atomfysikk og til entalpidiagram i termokjemi.

### `stolper` — søylediagram, én serie
```json
{ "type": "stolper", "tittel": "…", "enhet": "kJ per m² per år",
  "data": [{ "navn": "Produsenter", "verdi": 20000 }] }
```
2–6 søyler. Lange navn roteres automatisk.

## Kvalitetskrav til innholdet

- Faglig korrekt. Kontroller alle formler, tall og fasitsvar to ganger.
- Quiz-forklaringer skal lære bort, ikke bare bekrefte.
- Eksempler i regnefagene skal være FULLT gjennomregnet med mellomregninger.
- Tilpasset norsk læreplan (LK20) og nivået i Matematikk R1 / Fysikk 1 /
  Kjemi 1 / Biologi 1. Ikke dra inn stoff fra R2/Fysikk 2 osv.
- Bruk begrepene slik de brukes i norske lærebøker (Aunivers/Aschehoug for
  matematikk, fysikk og kjemi).
