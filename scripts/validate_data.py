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


FIGURTYPER = {"graf", "fortegnslinje", "vektor", "tallinje", "flyt",
              "syklus", "nivaaer", "stolper", "hierarki", "sammenlikning",
              "atom", "molekyl", "krets", "spektrum"}
GEOMETRIER = {"lineaer", "trigonal-plan", "tetraedrisk", "vinklet",
              "trigonal-pyramide", "oktaedrisk"}
# antall bindingsretninger hver geometri tegner
GEOMETRI_PLASSER = {"lineaer": 2, "trigonal-plan": 3, "tetraedrisk": 4,
                    "vinklet": 2, "trigonal-pyramide": 3, "oktaedrisk": 6}
# uttrykksparseren i figurer.js kjenner bare disse navnene
UTTRYKK_NAVN = {"x", "pi", "e", "sin", "cos", "tan", "asin", "acos", "atan",
                "sinh", "cosh", "tanh", "exp", "ln", "log", "lg", "sqrt",
                "abs", "floor", "ceil"}


def sjekk_uttrykk(fil, sti, u):
    """Speiler tokeniseringen i figurer.js så en ugyldig formel fanges her."""
    if not isinstance(u, str) or not u.strip():
        err(fil, f"{sti}: tomt uttrykk")
        return
    ulovlig = re.sub(r"[0-9a-zA-Z.+\-*/^(),\s]", "", u)
    if ulovlig:
        err(fil, f"{sti}: ulovlige tegn i uttrykket: {ulovlig!r}")
    for navn in re.findall(r"[a-zA-Z][a-zA-Z0-9]*", u):
        if navn not in UTTRYKK_NAVN:
            err(fil, f"{sti}: ukjent navn «{navn}» i uttrykket "
                     f"(kjente: x, pi, e og standardfunksjonene)")
    if u.count("(") != u.count(")"):
        err(fil, f"{sti}: ubalanserte parenteser i uttrykket")
    if re.search(r"\d\s*[a-zA-Z(]", u.replace("e", "").replace("x", "x")) and \
            re.search(r"\d\s*x", u):
        err(fil, f"{sti}: implisitt multiplikasjon — skriv «2*x», ikke «2x»")


def valider_figur(fil, sti, f):
    if not isinstance(f, dict):
        err(fil, f"{sti}: figur skal være et objekt")
        return
    t = f.get("type")
    if t not in FIGURTYPER:
        err(fil, f"{sti}.type: ukjent figurtype {t!r} "
                 f"(gyldige: {', '.join(sorted(FIGURTYPER))})")
        return
    if "tittel" in f:
        sjekk_streng(fil, f"{sti}.tittel", f["tittel"])
    if "forklaring" in f:
        sjekk_streng(fil, f"{sti}.forklaring", f["forklaring"])

    def liste(navn, minst, mest):
        v = f.get(navn)
        if not isinstance(v, list) or not (minst <= len(v) <= mest):
            err(fil, f"{sti}.{navn}: skal være liste med {minst}-{mest} elementer, "
                     f"fikk {len(v) if isinstance(v, list) else type(v).__name__}")
            return []
        return v

    if t == "graf":
        if not (f.get("kurver") or f.get("linjer") or f.get("punkter")):
            err(fil, f"{sti}: graf må ha minst én av kurver, linjer eller punkter")
        for i, k in enumerate(f.get("kurver") or []):
            sjekk_uttrykk(fil, f"{sti}.kurver[{i}].uttrykk", k.get("uttrykk"))
        if len(f.get("kurver") or []) > 3:
            err(fil, f"{sti}.kurver: maks 3 kurver (fargepaletten er validert for 3)")
        if f.get("omraade"):
            sjekk_uttrykk(fil, f"{sti}.omraade.uttrykk", f["omraade"].get("uttrykk"))
        for i, l in enumerate(f.get("linjer") or []):
            for felt in ("fra", "til"):
                p = l.get(felt)
                if not (isinstance(p, list) and len(p) == 2
                        and all(isinstance(v, (int, float)) for v in p)):
                    err(fil, f"{sti}.linjer[{i}].{felt}: skal være [x, y] med tall")
    elif t == "fortegnslinje":
        rader = liste("linjer", 1, 4)
        if f.get("resultat"):
            rader = rader + [f["resultat"]]
        for i, r in enumerate(rader):
            n = r.get("nullpunkt")
            fo = r.get("fortegn")
            if not isinstance(n, list) or not isinstance(fo, list):
                err(fil, f"{sti}: rad {i} mangler nullpunkt eller fortegn")
                continue
            if len(fo) != len(n) + 1:
                err(fil, f"{sti}: rad {i} har {len(n)} nullpunkt og {len(fo)} fortegn "
                         f"— fortegn skal ha ett element mer")
            for v in fo:
                if v not in ("+", "-"):
                    err(fil, f"{sti}: rad {i} har ugyldig fortegn {v!r} (bruk «+» eller «-»)")
    elif t == "vektor":
        for i, v in enumerate(liste("vektorer", 1, 5)):
            p = v.get("til")
            if not (isinstance(p, list) and len(p) == 2):
                err(fil, f"{sti}.vektorer[{i}].til: skal være [x, y]")
    elif t == "tallinje":
        if not (f.get("intervaller") or f.get("punkter")):
            err(fil, f"{sti}: tallinje må ha intervaller eller punkter")
    elif t == "flyt":
        maks = 4 if f.get("retning") == "hoyre" else 6
        for i, st in enumerate(liste("steg", 2, maks)):
            sjekk_streng(fil, f"{sti}.steg[{i}].tekst", st.get("tekst"))
            if len(str(st.get("tekst", ""))) > 52:
                err(fil, f"{sti}.steg[{i}].tekst: for lang ({len(st['tekst'])} tegn, maks 52)")
        tk = f.get("tilbakekopling")
        if tk:
            n = len(f.get("steg") or [])
            for felt in ("fra", "til"):
                if not isinstance(tk.get(felt), int) or not (0 <= tk[felt] < n):
                    err(fil, f"{sti}.tilbakekopling.{felt}: skal være stegindeks 0-{n - 1}")
    elif t == "syklus":
        for i, fa in enumerate(liste("faser", 3, 6)):
            sjekk_streng(fil, f"{sti}.faser[{i}].navn", fa.get("navn"))
            if len(str(fa.get("navn", ""))) > 8:
                err(fil, f"{sti}.faser[{i}].navn: for langt (maks 8 tegn)")
    elif t == "nivaaer":
        niv = liste("nivaaer", 2, 7)
        for i, n in enumerate(niv):
            if not isinstance(n.get("verdi"), (int, float)):
                err(fil, f"{sti}.nivaaer[{i}].verdi: skal være et tall")
        for i, o in enumerate(f.get("overganger") or []):
            for felt in ("fra", "til"):
                if not isinstance(o.get(felt), int) or not (0 <= o[felt] < len(niv)):
                    err(fil, f"{sti}.overganger[{i}].{felt}: skal være nivåindeks 0-{len(niv) - 1}")
    elif t == "stolper":
        for i, r in enumerate(liste("data", 2, 6)):
            sjekk_streng(fil, f"{sti}.data[{i}].navn", r.get("navn"))
            if not isinstance(r.get("verdi"), (int, float)):
                err(fil, f"{sti}.data[{i}].verdi: skal være et tall")
    elif t == "hierarki":
        for i, n in enumerate(liste("nivaaer", 3, 8)):
            sjekk_streng(fil, f"{sti}.nivaaer[{i}].navn", n.get("navn"))
            if len(str(n.get("navn", ""))) > 22:
                err(fil, f"{sti}.nivaaer[{i}].navn: for langt (maks 22 tegn)")
            if n.get("eksempel") and len(str(n["eksempel"])) > 26:
                err(fil, f"{sti}.nivaaer[{i}].eksempel: for langt (maks 26 tegn)")
    elif t == "sammenlikning":
        kol = f.get("kolonner")
        if not (isinstance(kol, list) and len(kol) == 2):
            err(fil, f"{sti}.kolonner: skal være to kolonnenavn")
        for i, r in enumerate(liste("rader", 2, 7)):
            for felt in ("venstre", "hoyre"):
                sjekk_streng(fil, f"{sti}.rader[{i}].{felt}", r.get(felt))
                if len(str(r.get(felt, ""))) > 90:
                    err(fil, f"{sti}.rader[{i}].{felt}: for lang (maks 90 tegn)")
    elif t == "atom":
        sk = liste("skall", 1, 5)
        for i, n in enumerate(sk):
            if not isinstance(n, int) or not (1 <= n <= 32):
                err(fil, f"{sti}.skall[{i}]: skal være antall elektroner 1-32, fikk {n!r}")
        navn = f.get("skallnavn")
        if navn is not None and (not isinstance(navn, list) or len(navn) != len(sk)):
            err(fil, f"{sti}.skallnavn: skal ha like mange navn som skall ({len(sk)})")
        for felt in ("protoner", "noytroner", "valens"):
            if felt in f and not isinstance(f[felt], int):
                err(fil, f"{sti}.{felt}: skal være et heltall")
        if isinstance(f.get("protoner"), int) and sk and sum(sk) != f["protoner"]:
            err(fil, f"{sti}: summen av elektroner i skallene ({sum(sk)}) er ikke lik "
                     f"protontallet ({f['protoner']}) — et nøytralt atom skal ha like mange")
    elif t == "molekyl":
        g = f.get("geometri")
        if g not in GEOMETRIER:
            err(fil, f"{sti}.geometri: ukjent {g!r} (gyldige: {', '.join(sorted(GEOMETRIER))})")
        sjekk_streng(fil, f"{sti}.sentral", f.get("sentral"))
        lig = f.get("ligander")
        if not isinstance(lig, list) or not lig:
            err(fil, f"{sti}.ligander: skal være en liste med minst ett atom")
        elif g in GEOMETRI_PLASSER and len(lig) > GEOMETRI_PLASSER[g]:
            err(fil, f"{sti}.ligander: {len(lig)} ligander, men «{g}» tegner bare "
                     f"{GEOMETRI_PLASSER[g]} plasser — de siste blir ikke tegnet")
        b = f.get("bindinger")
        if b is not None:
            if not isinstance(b, list) or len(b) != len(lig or []):
                err(fil, f"{sti}.bindinger: skal ha ett tall per ligand")
            else:
                for i, v in enumerate(b):
                    if v not in (1, 2, 3):
                        err(fil, f"{sti}.bindinger[{i}]: skal være 1, 2 eller 3")
    elif t == "krets":
        gr = liste("grener", 1, 3)
        for i, g in enumerate(gr):
            if not isinstance(g, list) or not (1 <= len(g) <= 4):
                err(fil, f"{sti}.grener[{i}]: skal være 1-4 komponenter i serie")
                continue
            for j, k in enumerate(g):
                sjekk_streng(fil, f"{sti}.grener[{i}][{j}].navn", k.get("navn"))
    elif t == "spektrum":
        band = liste("band", 2, 7)
        if f.get("log") and (f.get("min", 0) <= 0):
            err(fil, f"{sti}: med log=true må min være større enn 0")
        for i, b in enumerate(band):
            for felt in ("fra", "til"):
                if not isinstance(b.get(felt), (int, float)):
                    err(fil, f"{sti}.band[{i}].{felt}: skal være et tall")
            sjekk_streng(fil, f"{sti}.band[{i}].navn", b.get("navn"))
            if isinstance(b.get("fra"), (int, float)) and isinstance(b.get("til"), (int, float)) \
                    and b["til"] < b["fra"]:
                err(fil, f"{sti}.band[{i}]: til ({b['til']}) er mindre enn fra ({b['fra']})")


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
    if "figur" in k:
        valider_figur(fil, "kompakt.figur", k["figur"])
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
            if "figur" in s:
                valider_figur(fil, f"grundig.seksjoner[{i}].figur", s["figur"])
    if sjekk_liste(fil, "grundig.eksempler", g.get("eksempler"), 2, 4):
        for i, e in enumerate(g["eksempler"]):
            sjekk_streng(fil, f"grundig.eksempler[{i}].tittel", e.get("tittel"))
            sjekk_streng(fil, f"grundig.eksempler[{i}].oppgave", e.get("oppgave"), html_tillatt=True)
            sjekk_streng(fil, f"grundig.eksempler[{i}].losning", e.get("losning"),
                         html_tillatt=True, min_len=100)
            if "figur" in e:
                valider_figur(fil, f"grundig.eksempler[{i}].figur", e["figur"])
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
