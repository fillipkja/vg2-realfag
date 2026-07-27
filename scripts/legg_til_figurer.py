#!/usr/bin/env python3
"""Setter figurer inn i en kapittelfil på riktig plass.

Brukes slik at innholdsagenter ikke må treffe med tekstsøk inne i store
JSON-filer. Skriv figurene til en spesifikasjonsfil og kjør:

    python3 scripts/legg_til_figurer.py data/kapitler/fysikk-01.json /tmp/figspek.json

Spesifikasjonsfilen har formen:

    {
      "kompakt":    { ...figur... },
      "seksjoner":  { "0": {...}, "3": {...} },
      "eksempler":  { "1": {...} }
    }

Alle nøkler er valgfrie. Indeksene er 0-basert og må finnes i kapittelet.
Resten av kapittelfilen røres ikke. Kjører validatoren til slutt.

Flagg:
  --fjern    fjern alle figurer fra kapittelfilen i stedet for å legge til
"""
import json
import subprocess
import sys
from pathlib import Path

ROT = Path(__file__).resolve().parent.parent


def dø(melding):
    print(f"FEIL: {melding}", file=sys.stderr)
    sys.exit(1)


def les(sti):
    try:
        with open(sti, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        dø(f"finner ikke {sti}")
    except json.JSONDecodeError as e:
        dø(f"{sti} er ugyldig JSON: {e}")


def main():
    argv = [a for a in sys.argv[1:] if not a.startswith("--")]
    fjern = "--fjern" in sys.argv
    if not argv:
        dø("bruk: legg_til_figurer.py <kapittelfil> [<figurspek.json>] [--fjern]")

    kapsti = Path(argv[0])
    if not kapsti.is_absolute():
        kapsti = ROT / kapsti
    kap = les(kapsti)

    if fjern:
        n = 0
        if kap.get("kompakt", {}).pop("figur", None) is not None:
            n += 1
        for s in kap.get("grundig", {}).get("seksjoner", []):
            if s.pop("figur", None) is not None:
                n += 1
        for e in kap.get("grundig", {}).get("eksempler", []):
            if e.pop("figur", None) is not None:
                n += 1
        skriv(kapsti, kap)
        print(f"fjernet {n} figurer fra {kapsti.name}")
        return valider(kapsti)

    if len(argv) < 2:
        dø("mangler figurspesifikasjonsfil")
    spek = les(Path(argv[1]))
    if not isinstance(spek, dict):
        dø("spesifikasjonen skal være et objekt")

    ukjente = set(spek) - {"kompakt", "seksjoner", "eksempler"}
    if ukjente:
        dø(f"ukjente nøkler i spesifikasjonen: {', '.join(sorted(ukjente))} "
           f"(gyldige: kompakt, seksjoner, eksempler)")

    lagt = []
    if "kompakt" in spek:
        kap.setdefault("kompakt", {})["figur"] = spek["kompakt"]
        lagt.append("kompakt")

    for felt, nøkkel in (("seksjoner", "seksjoner"), ("eksempler", "eksempler")):
        if felt not in spek:
            continue
        liste = kap.get("grundig", {}).get(nøkkel)
        if not isinstance(liste, list):
            dø(f"kapittelet har ingen grundig.{nøkkel}")
        for idx, fig in spek[felt].items():
            try:
                i = int(idx)
            except (TypeError, ValueError):
                dø(f"{felt}: «{idx}» er ikke et tall")
            if not (0 <= i < len(liste)):
                dø(f"{felt}[{i}] finnes ikke — kapittelet har {len(liste)} "
                   f"{nøkkel} (gyldige indekser 0-{len(liste) - 1})")
            liste[i]["figur"] = fig
            lagt.append(f"{felt}[{i}]")

    if not lagt:
        dø("spesifikasjonen inneholder ingen figurer")

    skriv(kapsti, kap)
    print(f"la inn {len(lagt)} figurer i {kapsti.name}: {', '.join(lagt)}")
    return valider(kapsti)


def skriv(sti, data):
    with open(sti, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def valider(kapsti):
    r = subprocess.run(
        [sys.executable, str(ROT / "scripts" / "validate_data.py"), str(kapsti)],
        capture_output=True, text=True, cwd=ROT)
    print(r.stdout.strip() or r.stderr.strip())
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
