# Innholdsbrief — slik oppdaterer du fagstoffet

Dette er instruksjonene Claude (eller du selv) skal følge for å **legge til
eller rette** innhold i appen. I motsetning til War Room har denne appen
**ingen daglig automatisk oppdatering**: pensum endrer seg ikke fra dag til dag,
og en automat som skriver om verifiserte kapitler hver natt ville bare kunne
gjøre innholdet dårligere. Kjør oppdateringer manuelt, når du har en grunn.

## Grunnregler

1. **Rør bare datafiler.** Alt innhold ligger i `data/`. App-koden
   (`index.html`, `app.js`, `sw.js`) endres bare når du bevisst vil endre
   design eller oppførsel.
2. **`SCHEMA.md` er kontrakten.** Les den før du skriver en datafil.
3. **`data/kapitler/matematikk-03.json` er fasiteksempelet.** Nye kapitler skal
   treffe samme nivå på dybde, tone og LaTeX-bruk.
4. **Kjør hele verifiseringen før hver push.** Start serveren én gang, og kjør så
   ett skript som gjør alt:
   ```bash
   python3 scripts/server.py 8721 &     # flertrådet; http.server er det ikke
   ./scripts/verifiser.sh
   ```
   Den kjører i tur og orden:

   | Steg | Skript | Fanger |
   |---|---|---|
   | dataskjema | `validate_data.py --strict` | feil felter, antall, figurdata, manglende filer |
   | LaTeX | `latexsjekk.sh` | formler KaTeX ikke kan tolke — de blir **rød råtekst** i appen |
   | figurer | `figursjekk.sh` | figurer som ikke blir en gyldig SVG |
   | funksjonstest | `funksjonstest.sh` | quiz, flashcards, repetisjon, fremdrift, søk |
   | skjermbilder | `skjermbilder.sh` | layout i lys og mørk modus (se på `/tmp/vg2_*.png`) |

5. **Se faktisk på skjermbildene.** Skriptene sjekker struktur, ikke om noe
   kolliderer visuelt.
6. **Aldri force-push.**

## Oppgave A — rette en faktafeil

1. Finn filen: begreper og formler ligger i `data/kapitler/<fag>-<nn>.json`,
   samleformlene i `data/formler-<fag>.json`.
2. Rett med `Edit`. Behold skjemaet nøyaktig — samme felter, samme antall
   elementer i listene (validatoren håndhever grensene).
3. Kjør validatoren på filen.
4. Commit: `git commit -am "Rett <hva> i <fag> kap. <nr>"` og `git push`.

## Oppgave B — legge til et nytt kapittel

1. Legg kapittelet inn i `data/fag.json` under riktig fag: `nr`, `tittel` og
   `undertema`. `nr` og `tittel` **må** stemme med kapittelfilen.
2. Lag `data/kapitler/<fag>-<nn>.json` etter `SCHEMA.md`.
3. Valider, verifiser visuelt, commit, push.

## Oppgave C — tilpasse biologi til læreverket skolen faktisk bruker

Kapitlene for biologi er bygd på Udirs læreplan **BIO01-02 (LK20)** og
progresjonen i **Bios 1 (Cappelen Damm)**, fordi Aschehoug/Aunivers ikke har et
eget Biologi 1-verk. Får du vite hvilket verk klassen bruker:

1. Skaff innholdsfortegnelsen (forlagets «bla i bok» eller baksiden av boka).
2. Oppdater `kapitler`-listen for `biologi` i `data/fag.json` slik at nummer og
   titler matcher boka.
3. Døp om / skriv om kapittelfilene tilsvarende. Selve fagstoffet er stort sett
   det samme — det er rekkefølgen og inndelingen som varierer mellom forlag.
4. Oppdater `kildenote` for faget.

## Oppgave D — regenerere et helt kapittel med Claude

Kjør Claude headless med en presis instruks:

```bash
claude -p "Les SCHEMA.md og data/kapitler/matematikk-03.json (fasiteksempel).
Skriv så data/kapitler/fysikk-05.json for kapittel 5 «Termisk energi» i Fysikk 1.
Alt på norsk bokmål, LK20-nivå. Kjør python3 scripts/validate_data.py på filen
til den gir 0 feil. Rør ingen andre filer." \
  --allowedTools "Bash,Read,Edit,Write,Glob,Grep,WebSearch,WebFetch" \
  --max-turns 40
```

Etterpå: la en **egen** kjøring faktasjekke resultatet — det er den som fanger
regnefeil og gale quizsvar:

```bash
claude -p "Faktasjekk data/kapitler/fysikk-05.json som en streng faglærer:
regn om hvert eksempel selv, kontroller hver formel, sjekk at det merkede
quizsvaret faktisk er riktig og at bare ett alternativ er riktig. Rett alt som
er galt. Kjør validatoren til den er grønn. Rør ingen andre filer." \
  --allowedTools "Bash,Read,Edit,Write,Glob,Grep,WebSearch,WebFetch" \
  --max-turns 40
```

## Oppgave E — legge til en figur

Figurer er data, ikke bilder: appen tegner dem som SVG. Se avsnittet «Figurer» i
`SCHEMA.md` for de fjorten typene.

Ikke rediger kapittelfilen direkte for å sette inn en figur — bruk hjelpeskriptet,
som treffer riktig plass og validerer etterpå:

```bash
cat > /tmp/figspek.json <<'JSON'
{ "seksjoner": { "2": { "type": "flyt", "retning": "ned", "tittel": "…",
    "steg": [{"tekst":"…"},{"tekst":"…"}] } } }
JSON
python3 scripts/legg_til_figurer.py data/kapitler/kjemi-03.json /tmp/figspek.json
```

Indeksene er 0-baserte og må finnes i kapittelet. Bare de plassene du oppgir
endres; de andre figurene står urørt. `--fjern` fjerner **alle** figurene i
kapittelet — bruk den med omhu.

## Sjekkliste før push

- [ ] `./scripts/verifiser.sh` er helt grønn
- [ ] Du har **sett på** bildene i `/tmp/vg2_*.png`, i både lys og mørk modus
- [ ] Ingen endringer i `index.html` / `app.js` / `figurer.js` / `sw.js` du ikke
      mente å gjøre (`git diff --stat`)
- [ ] Ny formel eller nytt begrep dukker opp i søket (`#/sok`)
