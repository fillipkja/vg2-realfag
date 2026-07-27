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

## Kvalitetskrav til innholdet

- Faglig korrekt. Kontroller alle formler, tall og fasitsvar to ganger.
- Quiz-forklaringer skal lære bort, ikke bare bekrefte.
- Eksempler i regnefagene skal være FULLT gjennomregnet med mellomregninger.
- Tilpasset norsk læreplan (LK20) og nivået i Matematikk R1 / Fysikk 1 /
  Kjemi 1 / Biologi 1. Ikke dra inn stoff fra R2/Fysikk 2 osv.
- Bruk begrepene slik de brukes i norske lærebøker (Aunivers/Aschehoug for
  matematikk, fysikk og kjemi).
