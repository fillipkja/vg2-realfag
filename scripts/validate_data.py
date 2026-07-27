#!/usr/bin/env python3
"""Validerer datafilene mot SCHEMA.md.

Bruk:
  python3 scripts/validate_data.py                 # valider alt som finnes
  python3 scripts/validate_data.py --strict        # krev at alt finnes
  python3 scripts/validate_data.py data/kapitler/matematikk-03.json  # én fil
Avslutter med kode != 0 ved feil.
"""
import json
import re
import sys
from pathlib import Path

ROT = Path(__file__).resolve().parent.parent
DATA = ROT / "data"

TILLATTE_TAGGER = {"p", "ul", "ol", "li", "strong", "em", "br", "table",
                   "thead", "tbody", "tr", "th", "td", "h4", "sub", "sup"}
TAG_RE = re.compile(r"</?([a-zA-Z][a-zA-Z0-9]*)(?:\s[^>]*)?>")
FAG_IDER = ["matematikk", "fysikk", "kjemi", "biologi"]
FORMELFAG = ["matematikk", "fysikk", "kjemi"]

feil = []
advarsler = []


def err(fil, melding):
    feil.append(f"  FEIL  {fil}: {melding}")


def warn(fil, melding):
    advarsler.append(f"  ADVARSEL {fil}: {melding}")


def sjekk_tagger(fil, sti, tekst, html_tillatt):
    for m in TAG_RE.finditer(tekst):
        tag = m.group(1).lower()
        if not html_tillatt:
            err(fil, f"{sti}: HTML-tagg <{tag}> i rent tekstfelt")
        elif tag not in TILLATTE_TAGGER:
            err(fil, f"{sti}: ikke-tillatt HTML-tagg <{tag}>")


def sjekk_dollar(fil, sti, tekst):
    if tekst.count("$") % 2 != 0:
        err(fil, f"{sti}: ubalansert antall $-tegn ({tekst.count('$')})")


def sjekk_streng(fil, sti, verdi, html_tillatt=False, min_len=1):
    if not isinstance(verdi, str):
        err(fil, f"{sti}: skal være streng, er {type(verdi).__name__}")
        return
    if len(verdi.strip()) < min_len:
        err(fil, f"{sti}: tom/for kort streng")
    sjekk_tagger(fil, sti, verdi, html_tillatt)
    sjekk_dollar(fil, sti, verdi)


def sjekk_liste(fil, sti, verdi, minst, mest):
    if not isinstance(verdi, list):
        err(fil, f"{sti}: skal være liste")
        return False
    if not (minst <= len(verdi) <= mest):
        err(fil, f"{sti}: {len(verdi)} elementer, skal være {minst}-{mest}")
    return True


def valider_kapittel(fil, d, fagdata):
    for felt in ["fag", "nr", "tittel", "intro", "kompakt", "grundig",
                 "begreper", "quiz", "flashcards"]:
        if felt not in d:
            err(fil, f"mangler feltet '{felt}'")
            return
    if d["fag"] not in FAG_IDER:
        err(fil, f"ukjent fag '{d['fag']}'")
    m = re.match(r"([a-z]+)-(\d{2})\.json$", Path(fil).name)
    if not m:
        err(fil, "filnavn matcher ikke <fagid>-<nn>.json")
    else:
        if m.group(1) != d["fag"] or int(m.group(2)) != d["nr"]:
            err(fil, f"filnavn stemmer ikke med fag='{d['fag']}' nr={d['nr']}")
    if fagdata:
        fag = next((f for f in fagdata["fag"] if f["id"] == d["fag"]), None)
        if fag:
            kap = next((k for k in fag["kapitler"] if k["nr"] == d["nr"]), None)
            if not kap:
                err(fil, f"kapittel {d['nr']} finnes ikke i fag.json for {d['fag']}")
            elif kap["tittel"] != d["tittel"]:
                err(fil, f"tittel «{d['tittel']}» ≠ fag.json «{kap['tittel']}»")

    sjekk_streng(fil, "intro", d["intro"])

    k = d["kompakt"]
    if sjekk_liste(fil, "kompakt.punkter", k.get("punkter"), 6, 10):
        for i, p in enumerate(k["punkter"]):
            sjekk_streng(fil, f"kompakt.punkter[{i}]", p)
    if sjekk_liste(fil, "kompakt.formler", k.get("formler", []), 0, 14):
        for i, f in enumerate(k.get("formler", [])):
            sjekk_streng(fil, f"kompakt.formler[{i}].navn", f.get("navn"))
            sjekk_streng(fil, f"kompakt.formler[{i}].latex", f.get("latex"))

    g = d["grundig"]
    if sjekk_liste(fil, "grundig.seksjoner", g.get("seksjoner"), 3, 7):
        for i, s in enumerate(g["seksjoner"]):
            sjekk_streng(fil, f"grundig.seksjoner[{i}].tittel", s.get("tittel"))
            sjekk_streng(fil, f"grundig.seksjoner[{i}].html", s.get("html"),
                         html_tillatt=True, min_len=200)
    if sjekk_liste(fil, "grundig.eksempler", g.get("eksempler"), 2, 4):
        for i, e in enumerate(g["eksempler"]):
            sjekk_streng(fil, f"grundig.eksempler[{i}].tittel", e.get("tittel"))
            sjekk_streng(fil, f"grundig.eksempler[{i}].oppgave", e.get("oppgave"), html_tillatt=True)
            sjekk_streng(fil, f"grundig.eksempler[{i}].losning", e.get("losning"),
                         html_tillatt=True, min_len=100)
    if sjekk_liste(fil, "grundig.vanligeFeil", g.get("vanligeFeil"), 3, 6):
        for i, v in enumerate(g["vanligeFeil"]):
            sjekk_streng(fil, f"grundig.vanligeFeil[{i}]", v)
    if sjekk_liste(fil, "grundig.tips", g.get("tips"), 3, 5):
        for i, t in enumerate(g["tips"]):
            sjekk_streng(fil, f"grundig.tips[{i}]", t)

    if sjekk_liste(fil, "begreper", d["begreper"], 8, 15):
        for i, b in enumerate(d["begreper"]):
            sjekk_streng(fil, f"begreper[{i}].begrep", b.get("begrep"))
            sjekk_streng(fil, f"begreper[{i}].forklaring", b.get("forklaring"))

    if sjekk_liste(fil, "quiz", d["quiz"], 8, 12):
        riktige = []
        for i, q in enumerate(d["quiz"]):
            sjekk_streng(fil, f"quiz[{i}].sporsmal", q.get("sporsmal"))
            alt = q.get("alternativer")
            if not isinstance(alt, list) or len(alt) != 4:
                err(fil, f"quiz[{i}]: skal ha nøyaktig 4 alternativer")
            else:
                for j, a in enumerate(alt):
                    sjekk_streng(fil, f"quiz[{i}].alternativer[{j}]", a)
            r = q.get("riktig")
            if not isinstance(r, int) or not (0 <= r <= 3):
                err(fil, f"quiz[{i}].riktig: skal være heltall 0-3, er {r!r}")
            else:
                riktige.append(r)
            sjekk_streng(fil, f"quiz[{i}].forklaring", q.get("forklaring"), min_len=30)
        if riktige and len(set(riktige)) == 1:
            warn(fil, f"alle quizsvar har samme indeks ({riktige[0]}) — varier plasseringen")

    if sjekk_liste(fil, "flashcards", d["flashcards"], 12, 16):
        for i, c in enumerate(d["flashcards"]):
            sjekk_streng(fil, f"flashcards[{i}].front", c.get("front"))
            sjekk_streng(fil, f"flashcards[{i}].bak", c.get("bak"))


def valider_formler(fil, d):
    if d.get("fag") not in FORMELFAG:
        err(fil, f"formelsamling: ugyldig fag '{d.get('fag')}'")
    if sjekk_liste(fil, "kategorier", d.get("kategorier"), 6, 12):
        for i, kat in enumerate(d["kategorier"]):
            sjekk_streng(fil, f"kategorier[{i}].tittel", kat.get("tittel"))
            if sjekk_liste(fil, f"kategorier[{i}].formler", kat.get("formler"), 3, 12):
                for j, f in enumerate(kat["formler"]):
                    sjekk_streng(fil, f"kategorier[{i}].formler[{j}].navn", f.get("navn"))
                    sjekk_streng(fil, f"kategorier[{i}].formler[{j}].latex", f.get("latex"))
                    if "forklaring" in f:
                        sjekk_streng(fil, f"kategorier[{i}].formler[{j}].forklaring", f["forklaring"])


def valider_studieteknikk(fil, d):
    if sjekk_liste(fil, "metoder", d.get("metoder"), 6, 14):
        for i, mt in enumerate(d["metoder"]):
            sjekk_streng(fil, f"metoder[{i}].id", mt.get("id"))
            if not re.match(r"^[a-z0-9-]+$", mt.get("id", "")):
                err(fil, f"metoder[{i}].id: skal være kebab-case")
            sjekk_streng(fil, f"metoder[{i}].tittel", mt.get("tittel"))
            sjekk_streng(fil, f"metoder[{i}].kort", mt.get("kort"))
            sjekk_streng(fil, f"metoder[{i}].html", mt.get("html"),
                         html_tillatt=True, min_len=300)


def last(fil):
    try:
        with open(fil, encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        err(str(fil.relative_to(ROT)), f"ugyldig JSON: {e}")
        return None


def valider_fil(sti, fagdata):
    rel = str(sti.relative_to(ROT))
    d = last(sti)
    if d is None:
        return
    if sti.parent.name == "kapitler":
        valider_kapittel(rel, d, fagdata)
    elif sti.name.startswith("formler-"):
        valider_formler(rel, d)
    elif sti.name == "studieteknikk.json":
        valider_studieteknikk(rel, d)
    elif sti.name == "fag.json":
        pass  # struktur eies av fag.json selv
    else:
        warn(rel, "ukjent filtype — ikke validert")


def main():
    argv = [a for a in sys.argv[1:]]
    strict = "--strict" in argv
    filer = [Path(a).resolve() for a in argv if not a.startswith("--")]

    fagdata = None
    if (DATA / "fag.json").exists():
        fagdata = last(DATA / "fag.json")

    if not filer:
        filer = sorted((DATA / "kapitler").glob("*.json")) if (DATA / "kapitler").exists() else []
        filer += sorted(DATA.glob("formler-*.json"))
        if (DATA / "studieteknikk.json").exists():
            filer.append(DATA / "studieteknikk.json")

    for sti in filer:
        if not sti.exists():
            err(str(sti), "finnes ikke")
            continue
        valider_fil(sti, fagdata)

    if strict and fagdata:
        for fag in fagdata["fag"]:
            for kap in fag["kapitler"]:
                forventet = DATA / "kapitler" / f"{fag['id']}-{kap['nr']:02d}.json"
                if not forventet.exists():
                    err(str(forventet.relative_to(ROT)), "mangler (–-strict)")
        for fid in FORMELFAG:
            if not (DATA / f"formler-{fid}.json").exists():
                err(f"data/formler-{fid}.json", "mangler (--strict)")
        if not (DATA / "studieteknikk.json").exists():
            err("data/studieteknikk.json", "mangler (--strict)")

    for a in advarsler:
        print(a)
    if feil:
        print(f"\n{len(feil)} FEIL:")
        for f in feil:
            print(f)
        sys.exit(1)
    print(f"OK — {len(filer)} filer validert, {len(advarsler)} advarsler, 0 feil.")


if __name__ == "__main__":
    main()
