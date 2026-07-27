/* Realfag VG2 — figurmotor.
   Tegner faglige diagrammer som inline SVG ut fra data i kapittelfilene.
   Ingen bilder, ingen eksterne ressurser: figurene skalerer, fungerer offline
   og følger lys/mørk modus gjennom CSS-variabler.

   Figurtyper: graf · fortegnslinje · vektor · tallinje · flyt · syklus ·
               nivaaer · stolper
   Se SCHEMA.md for feltene hver type tar.
*/
(() => {
"use strict";

/* ══════════════════ trygg uttrykksevaluering ══════════════════
   Kapittelfilene er data, ikke kode, så uttrykk som "x^2-2*x" tolkes med en
   egen liten parser. Ingen eval, ingen new Function. */

const FUNKSJONER = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  exp: Math.exp, ln: Math.log, log: Math.log10, lg: Math.log10,
  sqrt: Math.sqrt, abs: Math.abs, floor: Math.floor, ceil: Math.ceil,
};
const KONSTANTER = { pi: Math.PI, e: Math.E };

function tokeniser(s) {
  const t = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      t.push({ k: "tall", v: parseFloat(s.slice(i, j).replace(",", ".")) });
      i = j; continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9]/.test(s[j])) j++;
      t.push({ k: "navn", v: s.slice(i, j) });
      i = j; continue;
    }
    if ("+-*/^(),".includes(c)) { t.push({ k: c }); i++; continue; }
    throw new Error(`ukjent tegn «${c}» i uttrykket`);
  }
  return t;
}

/* uttrykk := ledd (('+'|'-') ledd)*
   ledd    := faktor (('*'|'/') faktor)*
   faktor  := unær ('^' faktor)?           (høyreassosiativ)
   unær    := '-' unær | atom
   atom    := tall | navn ('(' uttrykk ')')? | '(' uttrykk ')'          */
function tolk(kildekode) {
  const t = tokeniser(kildekode);
  let p = 0;
  const kikk = () => t[p];
  const ta = (k) => {
    if (!t[p] || (k && t[p].k !== k)) throw new Error(`forventet ${k}`);
    return t[p++];
  };

  function uttrykk() {
    let v = ledd();
    while (kikk() && (kikk().k === "+" || kikk().k === "-")) {
      const op = ta().k, h = ledd(), f = v;
      v = op === "+" ? (x) => f(x) + h(x) : (x) => f(x) - h(x);
    }
    return v;
  }
  function ledd() {
    let v = faktor();
    while (kikk() && (kikk().k === "*" || kikk().k === "/")) {
      const op = ta().k, h = faktor(), f = v;
      v = op === "*" ? (x) => f(x) * h(x) : (x) => f(x) / h(x);
    }
    return v;
  }
  function faktor() {
    const b = unaer();
    if (kikk() && kikk().k === "^") { ta("^"); const e = faktor(); return (x) => Math.pow(b(x), e(x)); }
    return b;
  }
  function unaer() {
    if (kikk() && kikk().k === "-") { ta("-"); const v = unaer(); return (x) => -v(x); }
    if (kikk() && kikk().k === "+") { ta("+"); return unaer(); }
    return atom();
  }
  function atom() {
    const n = kikk();
    if (!n) throw new Error("uventet slutt på uttrykket");
    if (n.k === "tall") { ta(); return () => n.v; }
    if (n.k === "(") { ta("("); const v = uttrykk(); ta(")"); return v; }
    if (n.k === "navn") {
      ta();
      const navn = n.v;
      if (kikk() && kikk().k === "(") {
        ta("(");
        const arg = uttrykk();
        ta(")");
        const fn = FUNKSJONER[navn];
        if (!fn) throw new Error(`ukjent funksjon «${navn}»`);
        return (x) => fn(arg(x));
      }
      if (navn === "x") return (x) => x;
      if (navn in KONSTANTER) { const k = KONSTANTER[navn]; return () => k; }
      throw new Error(`ukjent navn «${navn}»`);
    }
    throw new Error(`uventet token «${n.k}»`);
  }

  const f = uttrykk();
  if (p !== t.length) throw new Error("overflødige tegn i uttrykket");
  return f;
}

/* ══════════════════ SVG-hjelpere ══════════════════ */

const E = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const N = (v) => (Math.round(v * 100) / 100);
/* norsk tallformat: desimalkomma */
const tall = (v, des = 2) => {
  const r = Math.abs(v) < 1e-10 ? 0 : v;
  let s = (Math.round(r * 10 ** des) / 10 ** des).toString();
  return s.replace(".", ",");
};

function linje(x1, y1, x2, y2, klasse = "f-hjelp") {
  return `<line class="${klasse}" x1="${N(x1)}" y1="${N(y1)}" x2="${N(x2)}" y2="${N(y2)}"/>`;
}
function tekst(x, y, s, klasse = "f-txt", anker = "middle") {
  return `<text class="${klasse}" x="${N(x)}" y="${N(y)}" text-anchor="${anker}">${E(s)}</text>`;
}
/* Pilhode tegnes som polygon i stedet for SVG-marker: da arver den fargeklassen
   og fungerer likt i alle nettlesere. */
function pil(x1, y1, x2, y2, klasse = "f-pil", hode = 7) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const bx = x2 - ux * hode, by = y2 - uy * hode;
  const px = -uy * hode * 0.42, py = ux * hode * 0.42;
  return `${linje(x1, y1, bx, by, klasse)}
    <polygon class="${klasse} f-fyll" points="${N(x2)},${N(y2)} ${N(bx + px)},${N(by + py)} ${N(bx - px)},${N(by - py)}"/>`;
}
function rute(x, y, b, h, klasse, r = 8) {
  return `<rect class="${klasse}" x="${N(x)}" y="${N(y)}" width="${N(b)}" height="${N(h)}" rx="${r}"/>`;
}
/* Tekst som brytes over flere linjer inne i en boks. */
function brytTekst(s, maksTegn) {
  /* Myk bindestrek (U+00AD) brytes ikke i SVG-tekst, så den behandles som en
     bruddmulighet og fjernes fra utskriften. */
  const ord = String(s).replace(/\u00ad/g, " ").split(/\s+/).filter(Boolean);
  const linjer = [];
  let n = "";
  for (const o of ord) {
    if (n && (n + " " + o).length > maksTegn) { linjer.push(n); n = o; }
    else n = n ? n + " " + o : o;
  }
  if (n) linjer.push(n);
  return linjer;
}
function flerlinjeTekst(x, y, s, maksTegn, klasse = "f-boks-txt", linjehoyde = 12) {
  const l = brytTekst(s, maksTegn);
  const start = y - ((l.length - 1) * linjehoyde) / 2;
  return l.map((t, i) => tekst(x, start + i * linjehoyde + 4, t, klasse)).join("");
}

/* Pene aksemerker: 1, 2, 2.5 eller 5 ganger en tierpotens. */
function pentSteg(spenn, maksAntall = 8) {
  const raa = spenn / maksAntall;
  const p = Math.pow(10, Math.floor(Math.log10(raa)));
  for (const m of [1, 2, 2.5, 5, 10]) if (p * m >= raa) return p * m;
  return p * 10;
}

const svgRamme = (innhold, b, h, tittel) =>
  `<svg class="figur-svg" viewBox="0 0 ${b} ${h}" role="img"${tittel ? ` aria-label="${E(tittel)}"` : ""}
     preserveAspectRatio="xMidYMid meet">${innhold}</svg>`;

/* ══════════════════ type: graf ══════════════════ */

function tegnGraf(f) {
  const B = 400, H = 265;
  const M = { v: 34, h: 14, o: 16, u: 30 };
  const xmin = f.xmin ?? -5, xmax = f.xmax ?? 5;
  let ymin = f.ymin, ymax = f.ymax;

  const kurver = (f.kurver || []).map((k) => {
    try { return { ...k, fn: tolk(k.uttrykk) }; }
    catch (e) { console.warn("figur/graf:", k.uttrykk, e.message); return null; }
  }).filter(Boolean);

  /* automatisk y-område hvis det ikke er oppgitt */
  if (ymin == null || ymax == null) {
    const ys = [];
    for (const k of kurver) {
      for (let i = 0; i <= 200; i++) {
        const y = k.fn(xmin + ((xmax - xmin) * i) / 200);
        if (Number.isFinite(y) && Math.abs(y) < 1e5) ys.push(y);
      }
    }
    for (const p of f.punkter || []) ys.push(p.y);
    if (ys.length) {
      const lo = Math.min(...ys), hi = Math.max(...ys);
      const pad = (hi - lo || 2) * 0.15;
      ymin = ymin ?? Math.min(0, lo - pad);
      ymax = ymax ?? Math.max(0, hi + pad);
    } else { ymin = ymin ?? -5; ymax = ymax ?? 5; }
  }
  if (ymax - ymin < 1e-9) { ymax = ymin + 1; }

  const X = (x) => M.v + ((x - xmin) / (xmax - xmin)) * (B - M.v - M.h);
  const Y = (y) => H - M.u - ((y - ymin) / (ymax - ymin)) * (H - M.o - M.u);
  const innenfor = (y) => y >= ymin - (ymax - ymin) * 3 && y <= ymax + (ymax - ymin) * 3;

  let s = "";

  /* rutenett og merker */
  const sx = pentSteg(xmax - xmin, 7), sy = pentSteg(ymax - ymin, 6);
  for (let x = Math.ceil(xmin / sx) * sx; x <= xmax + 1e-9; x += sx) {
    s += linje(X(x), Y(ymax), X(x), Y(ymin), "f-grid");
    if (Math.abs(x) > 1e-9) s += tekst(X(x), Y(Math.max(ymin, Math.min(0, ymax))) + 15, tall(x), "f-tick");
  }
  for (let y = Math.ceil(ymin / sy) * sy; y <= ymax + 1e-9; y += sy) {
    s += linje(X(xmin), Y(y), X(xmax), Y(y), "f-grid");
    if (Math.abs(y) > 1e-9) s += tekst(M.v - 6, Y(y) + 4, tall(y), "f-tick", "end");
  }

  /* Asymptoter (under kurvene). Vannrette etiketter settes ved VENSTRE ende:
     høyre side er reservert for kurvenavnene, og de kolliderte. */
  for (const a of f.asymptoter || []) {
    if (a.retning === "vertikal") {
      s += linje(X(a.verdi), Y(ymax), X(a.verdi), Y(ymin), "f-asymptote");
      s += tekst(X(a.verdi), Y(ymax) - 4, a.navn ?? `x = ${tall(a.verdi)}`, "f-tick");
    } else {
      s += linje(X(xmin), Y(a.verdi), X(xmax), Y(a.verdi), "f-asymptote");
      s += tekst(X(xmin) + 4, Y(a.verdi) - 6, a.navn ?? `y = ${tall(a.verdi)}`, "f-tick", "start");
    }
  }

  /* skravert område under en kurve */
  if (f.omraade) {
    try {
      const fn = tolk(f.omraade.uttrykk);
      const a = f.omraade.fra, b = f.omraade.til;
      const pts = [];
      for (let i = 0; i <= 120; i++) {
        const x = a + ((b - a) * i) / 120, y = fn(x);
        if (Number.isFinite(y)) pts.push(`${N(X(x))},${N(Y(Math.max(ymin, Math.min(ymax, y))))}`);
      }
      if (pts.length) {
        const y0 = Y(Math.max(ymin, Math.min(0, ymax)));
        s += `<polygon class="f-omraade" points="${N(X(a))},${N(y0)} ${pts.join(" ")} ${N(X(b))},${N(y0)}"/>`;
      }
    } catch (e) { console.warn("figur/omraade:", e.message); }
  }

  /* Akser. Aksetitlene settes UTENFOR plottflaten — nede til høyre under
     tallmerkene, og oppe til venstre — ellers legger de seg oppå merkene. */
  if (ymin <= 0 && ymax >= 0) s += pil(X(xmin), Y(0), X(xmax), Y(0), "f-akse");
  else s += linje(X(xmin), H - M.u, X(xmax), H - M.u, "f-akse");

  if (xmin <= 0 && xmax >= 0) s += pil(X(0), Y(ymin), X(0), Y(ymax), "f-akse");
  else s += linje(M.v, Y(ymin), M.v, Y(ymax), "f-akse");

  s += tekst(B - M.h, H - 5, f.xlabel ?? "x", "f-akselabel", "end");
  s += tekst(M.v - 26, M.o - 3, f.ylabel ?? "y", "f-akselabel", "start");

  /* Rette linjer (tangenter, sekanter, normaler).
     Etiketten settes 82 % ut langs linja og forskyves LODDRETT PÅ den, ikke ved
     midtpunktet: midten er der punktene og berøringspunktene oftest ligger, og
     der kolliderte etikettene med punktnavnene. */
  for (const l of f.linjer || []) {
    const kl = `f-linje s${l.farge ?? 2}${l.stiplet === false ? "" : " stiplet"}`;
    const x1 = X(l.fra[0]), y1 = Y(l.fra[1]), x2 = X(l.til[0]), y2 = Y(l.til[1]);
    s += linje(x1, y1, x2, y2, kl);
    if (l.navn) {
      const t = l.merkeplass ?? 0.82;
      const px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t;
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      /* normalen peker alltid oppover i bildet, så etiketten legger seg over linja */
      const nx = -dy / len, ny = dx / len;
      const retn = ny > 0 ? -1 : 1;
      const lx = Math.max(M.v + 12, Math.min(B - M.h - 12, px + nx * 13 * retn));
      s += tekst(lx, py + ny * 13 * retn + 4, l.navn, `f-serielabel s${l.farge ?? 2}`);
    }
  }

  /* kurver */
  kurver.forEach((k, ki) => {
    const steg = 400;
    let d = "", forrige = null;
    for (let i = 0; i <= steg; i++) {
      const x = xmin + ((xmax - xmin) * i) / steg;
      const y = k.fn(x);
      if (!Number.isFinite(y) || !innenfor(y)) { forrige = null; continue; }
      /* bryt kurven ved store sprang (asymptoter) */
      if (forrige !== null && Math.abs(y - forrige) > (ymax - ymin) * 1.2) { d += ` M ${N(X(x))} ${N(Y(y))}`; }
      else d += `${forrige === null ? " M" : " L"} ${N(X(x))} ${N(Y(y))}`;
      forrige = y;
    }
    s += `<path class="f-kurve s${k.farge ?? (ki + 1)}" d="${d.trim()}"/>`;
    if (k.navn) {
      /* sett navnet ved høyre ende av kurven, der den er innenfor */
      for (let i = steg; i >= 0; i--) {
        const x = xmin + ((xmax - xmin) * i) / steg, y = k.fn(x);
        if (Number.isFinite(y) && y >= ymin && y <= ymax) {
          s += tekst(Math.min(X(x) + 5, B - 4), Y(y) - 7, k.navn,
                     `f-serielabel s${k.farge ?? (ki + 1)}`, X(x) > B - 60 ? "end" : "start");
          break;
        }
      }
    }
  });

  /* punkter */
  for (const p of f.punkter || []) {
    s += `<circle class="f-punkt" cx="${N(X(p.x))}" cy="${N(Y(p.y))}" r="4.5"/>`;
    if (p.navn) {
      const over = p.plassering !== "under";
      s += tekst(X(p.x), Y(p.y) + (over ? -11 : 19), p.navn, "f-punkt-txt");
    }
    if (p.hjelpelinjer) {
      s += linje(X(p.x), Y(p.y), X(p.x), Y(Math.max(ymin, Math.min(0, ymax))), "f-hjelp stiplet");
      s += linje(X(p.x), Y(p.y), X(Math.max(xmin, Math.min(0, xmax))), Y(p.y), "f-hjelp stiplet");
    }
  }

  return svgRamme(s, B, H, f.tittel);
}

/* ══════════════════ type: fortegnslinje ══════════════════
   Norsk konvensjon: heltrukken strek der uttrykket er positivt, stiplet der
   det er negativt, liten ring i nullpunktene. */

function tegnFortegnslinje(f) {
  const rader = [...(f.linjer || [])];
  if (f.resultat) rader.push({ ...f.resultat, erResultat: true });
  const B = 400, radH = 44, topp = 14;
  const H = topp + rader.length * radH + 16;
  const M = { v: 74, h: 22 };
  const xmin = f.xmin ?? -4, xmax = f.xmax ?? 4;
  const X = (x) => M.v + ((x - xmin) / (xmax - xmin)) * (B - M.v - M.h);

  let s = "";
  /* felles x-akse med verdiene som forekommer */
  const alle = [...new Set(rader.flatMap((r) => r.nullpunkt || []))].sort((a, b) => a - b);
  for (const v of alle) {
    s += linje(X(v), topp - 6, X(v), H - 12, "f-grid stiplet");
    s += tekst(X(v), H - 1, tall(v), "f-tick");
  }

  rader.forEach((r, i) => {
    const y = topp + i * radH + radH / 2 - 6;
    if (r.erResultat) s += linje(M.v - 62, y - 16, B - 6, y - 16, "f-akse");
    s += tekst(M.v - 8, y + 4, r.navn, r.erResultat ? "f-rad-navn sterk" : "f-rad-navn", "end");

    const grenser = [xmin, ...(r.nullpunkt || []), xmax];
    const fortegn = r.fortegn || [];
    for (let j = 0; j < grenser.length - 1; j++) {
      const a = X(grenser[j]), b = X(grenser[j + 1]);
      const pos = fortegn[j] !== "-";
      s += linje(a + (j === 0 ? 0 : 5), y, b - (j === grenser.length - 2 ? 0 : 5), y,
                 `f-fortegn ${pos ? "positiv" : "negativ"}`);
      s += tekst((a + b) / 2, y - 9, pos ? "+" : "−", `f-fortegn-txt ${pos ? "positiv" : "negativ"}`);
    }
    for (const v of r.nullpunkt || []) {
      s += `<circle class="f-nullpunkt" cx="${N(X(v))}" cy="${N(y)}" r="4"/>`;
    }
  });
  return svgRamme(s, B, H, f.tittel);
}

/* ══════════════════ type: vektor ══════════════════
   Brukes både til vektorregning og til kraftdiagram (sett «kropp»). */

function tegnVektor(f) {
  const B = 400, H = 270;
  const M = { v: 32, h: 16, o: 16, u: 28 };
  const xmin = f.xmin ?? -1, xmax = f.xmax ?? 5;
  const ymin = f.ymin ?? -1, ymax = f.ymax ?? 4;
  const X = (x) => M.v + ((x - xmin) / (xmax - xmin)) * (B - M.v - M.h);
  const Y = (y) => H - M.u - ((y - ymin) / (ymax - ymin)) * (H - M.o - M.u);

  let s = "";
  if (f.rutenett !== false) {
    const sx = pentSteg(xmax - xmin, 8), sy = pentSteg(ymax - ymin, 6);
    for (let x = Math.ceil(xmin / sx) * sx; x <= xmax + 1e-9; x += sx) {
      s += linje(X(x), Y(ymax), X(x), Y(ymin), "f-grid");
      if (Math.abs(x) > 1e-9) s += tekst(X(x), Y(Math.max(ymin, Math.min(0, ymax))) + 15, tall(x), "f-tick");
    }
    for (let y = Math.ceil(ymin / sy) * sy; y <= ymax + 1e-9; y += sy) {
      s += linje(X(xmin), Y(y), X(xmax), Y(y), "f-grid");
      if (Math.abs(y) > 1e-9) s += tekst(M.v - 6, Y(y) + 4, tall(y), "f-tick", "end");
    }
    if (ymin <= 0 && ymax >= 0) s += pil(X(xmin), Y(0), X(xmax), Y(0), "f-akse");
    if (xmin <= 0 && xmax >= 0) s += pil(X(0), Y(ymin), X(0), Y(ymax), "f-akse");
  }

  /* parallellogram utspent av to vektorer */
  if (f.parallellogram) {
    const [i, j] = f.parallellogram;
    const a = f.vektorer[i], b = f.vektorer[j];
    if (a && b) {
      const o = a.fra ?? [0, 0];
      const av = [a.til[0] - o[0], a.til[1] - o[1]];
      const bv = [b.til[0] - o[0], b.til[1] - o[1]];
      const p = [o, [o[0] + av[0], o[1] + av[1]],
                 [o[0] + av[0] + bv[0], o[1] + av[1] + bv[1]],
                 [o[0] + bv[0], o[1] + bv[1]]];
      s += `<polygon class="f-omraade" points="${p.map((q) => `${N(X(q[0]))},${N(Y(q[1]))}`).join(" ")}"/>`;
      s += p.map((q, k) => linje(X(q[0]), Y(q[1]), X(p[(k + 1) % 4][0]), Y(p[(k + 1) % 4][1]), "f-hjelp stiplet")).join("");
    }
  }

  /* legeme (kraftdiagram) */
  if (f.kropp) {
    const kx = X(f.kropp.x ?? 0), ky = Y(f.kropp.y ?? 0);
    if (f.kropp.form === "sirkel") {
      s += `<circle class="f-kropp" cx="${N(kx)}" cy="${N(ky)}" r="16"/>`;
    } else {
      s += rute(kx - 19, ky - 15, 38, 30, "f-kropp", 5);
    }
    if (f.kropp.navn) s += tekst(kx, ky + 4, f.kropp.navn, "f-kropp-txt");
  }
  if (f.underlag) {
    const y0 = Y(f.underlag.y ?? 0);
    s += linje(X(xmin), y0, X(xmax), y0, "f-akse sterk");
    for (let x = X(xmin); x < X(xmax); x += 9) {
      s += linje(x, y0, x + 5, y0 + 6, "f-skravur");
    }
  }

  (f.vektorer || []).forEach((v, i) => {
    const fra = v.fra ?? [0, 0];
    const kl = `f-vektor s${v.farge ?? ((i % 3) + 1)}`;
    s += pil(X(fra[0]), Y(fra[1]), X(v.til[0]), Y(v.til[1]), kl, 9);
    if (v.navn) {
      const mx = (fra[0] + v.til[0]) / 2, my = (fra[1] + v.til[1]) / 2;
      const dx = v.til[0] - fra[0], dy = v.til[1] - fra[1];
      const len = Math.hypot(dx, dy) || 1;
      s += tekst(X(mx) - (dy / len) * 14, Y(my) - (dx / len) * 14 + 4, v.navn,
                 `f-serielabel s${v.farge ?? ((i % 3) + 1)}`);
    }
  });

  if (f.vinkel && f.vektorer?.length >= 2) {
    const [i, j] = f.vinkel.mellom ?? [0, 1];
    const a = f.vektorer[i], b = f.vektorer[j];
    if (a && b) {
      const o = a.fra ?? [0, 0];
      const v1 = Math.atan2(-(a.til[1] - o[1]), a.til[0] - o[0]);
      const v2 = Math.atan2(-(b.til[1] - o[1]), b.til[0] - o[0]);
      const r = 28, ox = X(o[0]), oy = Y(o[1]);
      const stor = Math.abs(v2 - v1) > Math.PI ? 1 : 0;
      const retning = v2 > v1 ? 1 : 0;
      s += `<path class="f-vinkel" d="M ${N(ox + r * Math.cos(v1))} ${N(oy + r * Math.sin(v1))}
        A ${r} ${r} 0 ${stor} ${retning} ${N(ox + r * Math.cos(v2))} ${N(oy + r * Math.sin(v2))}"/>`;
      const vm = (v1 + v2) / 2;
      s += tekst(ox + (r + 13) * Math.cos(vm), oy + (r + 13) * Math.sin(vm) + 4,
                 f.vinkel.navn ?? "α", "f-punkt-txt");
    }
  }
  return svgRamme(s, B, H, f.tittel);
}

/* ══════════════════ type: tallinje ══════════════════ */

function tegnTallinje(f) {
  const B = 400, H = 92;
  const M = { v: 22, h: 22 };
  const min = f.min ?? -5, max = f.max ?? 5;
  const X = (x) => M.v + ((x - min) / (max - min)) * (B - M.v - M.h);
  const y = 46;
  let s = pil(M.v - 14, y, B - 4, y, "f-akse");

  const sx = pentSteg(max - min, 9);
  for (let v = Math.ceil(min / sx) * sx; v <= max + 1e-9; v += sx) {
    s += linje(X(v), y - 5, X(v), y + 5, "f-akse");
    s += tekst(X(v), y + 21, tall(v), "f-tick");
  }

  (f.intervaller || []).forEach((iv, i) => {
    const yy = y - 16 - i * 17;
    const lukket = iv.lukket ?? [true, true];
    const a = iv.fra == null ? min : iv.fra, b = iv.til == null ? max : iv.til;
    s += linje(X(a), yy, X(b), yy, `f-intervall s${iv.farge ?? 1}`);
    for (const [v, l] of [[a, lukket[0]], [b, lukket[1]]]) {
      s += `<circle class="f-intervall-ende s${iv.farge ?? 1}${l ? " fylt" : ""}" cx="${N(X(v))}" cy="${N(yy)}" r="4.5"/>`;
    }
    if (iv.navn) s += tekst(X(b) + 8, yy + 4, iv.navn, `f-serielabel s${iv.farge ?? 1}`, "start");
  });

  for (const p of f.punkter || []) {
    s += `<circle class="f-punkt${p.fylt === false ? " apen" : ""}" cx="${N(X(p.verdi))}" cy="${N(y)}" r="5"/>`;
    if (p.navn) s += tekst(X(p.verdi), y - 13, p.navn, "f-punkt-txt");
  }
  return svgRamme(s, B, H, f.tittel);
}

/* ══════════════════ type: flyt ══════════════════ */

function tegnFlyt(f) {
  const steg = f.steg || [];
  const vannrett = f.retning === "hoyre";
  const B = 400;
  if (vannrett) {
    const n = steg.length;
    const bredde = Math.min(110, (B - 20 - (n - 1) * 26) / n);
    const H = 130;
    let s = "";
    steg.forEach((st, i) => {
      const x = 10 + i * (bredde + 26), y = 34;
      s += rute(x, y, bredde, 56, "f-flytboks");
      s += flerlinjeTekst(x + bredde / 2, y + 28, st.tekst, Math.floor(bredde / 6.6));
      if (st.note) s += flerlinjeTekst(x + bredde / 2, y + 74, st.note, Math.floor(bredde / 5.4), "f-boks-note", 11);
      if (i < n - 1) s += pil(x + bredde + 4, y + 28, x + bredde + 22, y + 28, "f-pil");
    });
    return svgRamme(s, B, H, f.tittel);
  }

  const boksH = 46, mellom = 30;
  const bredde = f.tilbakekopling ? 250 : 300;
  const x0 = f.tilbakekopling ? 22 : (B - bredde) / 2;
  const H = 12 + steg.length * boksH + (steg.length - 1) * mellom + 12;
  let s = "";
  steg.forEach((st, i) => {
    const y = 12 + i * (boksH + mellom);
    s += rute(x0, y, bredde, boksH, "f-flytboks");
    s += `<circle class="f-flytnr" cx="${N(x0 + 17)}" cy="${N(y + boksH / 2)}" r="12"/>`;
    s += tekst(x0 + 17, y + boksH / 2 + 4, i + 1, "f-flytnr-txt");
    const tx = x0 + 34 + (bredde - 44) / 2;
    if (st.note) {
      s += flerlinjeTekst(tx, y + boksH / 2 - 7, st.tekst, Math.floor((bredde - 46) / 6.6), "f-boks-txt", 12);
      s += flerlinjeTekst(tx, y + boksH / 2 + 12, st.note, Math.floor((bredde - 46) / 5.4), "f-boks-note", 11);
    } else {
      s += flerlinjeTekst(tx, y + boksH / 2 + 1, st.tekst, Math.floor((bredde - 46) / 6.6));
    }
    if (i < steg.length - 1) {
      s += pil(x0 + bredde / 2, y + boksH + 4, x0 + bredde / 2, y + boksH + mellom - 4, "f-pil", 8);
    }
  });

  if (f.tilbakekopling) {
    const tk = f.tilbakekopling;
    const yFra = 12 + tk.fra * (boksH + mellom) + boksH / 2;
    const yTil = 12 + tk.til * (boksH + mellom) + boksH / 2;
    const xh = x0 + bredde + 26;
    s += `<path class="f-tilbake" d="M ${N(x0 + bredde)} ${N(yFra)} H ${N(xh)} V ${N(yTil)} H ${N(x0 + bredde + 10)}"/>`;
    s += pil(x0 + bredde + 12, yTil, x0 + bredde + 2, yTil, "f-tilbake-pil", 8);
    if (tk.tekst) {
      s += `<text class="f-tilbake-txt" transform="translate(${N(xh + 13)},${N((yFra + yTil) / 2)}) rotate(90)"
        text-anchor="middle">${E(tk.tekst)}</text>`;
    }
  }
  return svgRamme(s, B, H, f.tittel);
}

/* ══════════════════ type: syklus ══════════════════ */

function tegnSyklus(f) {
  const faser = f.faser || [];
  const B = 400, H = 340;
  const cx = B / 2, cy = H / 2, R = 93;
  const n = faser.length || 1;
  let s = "";

  /* buede piler mellom fasene, med klokka */
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * 2 * Math.PI - Math.PI / 2 + 0.34;
    const a2 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2 - 0.34;
    const p1 = [cx + R * Math.cos(a1), cy + R * Math.sin(a1)];
    const p2 = [cx + R * Math.cos(a2), cy + R * Math.sin(a2)];
    s += `<path class="f-syklusbue" d="M ${N(p1[0])} ${N(p1[1])} A ${R} ${R} 0 0 1 ${N(p2[0])} ${N(p2[1])}"/>`;
    /* pilhode langs tangenten */
    const t = [-Math.sin(a2), Math.cos(a2)];
    s += `<polygon class="f-syklusbue f-fyll" points="${N(p2[0] + t[0] * 7)},${N(p2[1] + t[1] * 7)}
      ${N(p2[0] - t[0] * 2 + Math.cos(a2) * 4.5)},${N(p2[1] - t[1] * 2 + Math.sin(a2) * 4.5)}
      ${N(p2[0] - t[0] * 2 - Math.cos(a2) * 4.5)},${N(p2[1] - t[1] * 2 - Math.sin(a2) * 4.5)}"/>`;
  }

  if (f.senter) {
    s += `<circle class="f-syklussenter" cx="${N(cx)}" cy="${N(cy)}" r="46"/>`;
    s += flerlinjeTekst(cx, cy + 1, f.senter, 13, "f-senter-txt", 13);
  }

  faser.forEach((fase, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    s += `<circle class="f-syklusnode" cx="${N(x)}" cy="${N(y)}" r="25"/>`;
    s += flerlinjeTekst(x, y + 1, fase.navn, 8, "f-syklusnode-txt", 11);
    if (fase.note) {
      const ut = 1 + 40 / R;
      const nx = cx + R * ut * Math.cos(a), ny = cy + R * ut * Math.sin(a);
      const anker = Math.abs(Math.cos(a)) < 0.3 ? "middle" : (Math.cos(a) > 0 ? "start" : "end");
      /* bryt etter plassen som faktisk er til høyre/venstre, ellers klippes teksten */
      const plass = anker === "start" ? B - 6 - nx : anker === "end" ? nx - 6 : 90;
      const l = brytTekst(fase.note, Math.max(8, Math.floor(plass / 5.4)));
      s += l.map((t, k) => tekst(nx, ny + (k - (l.length - 1) / 2) * 11 + 4, t, "f-boks-note", anker)).join("");
    }
  });
  return svgRamme(s, B, H, f.tittel);
}

/* ══════════════════ type: nivaaer (energinivåer) ══════════════════ */

function tegnNivaaer(f) {
  const niv = [...(f.nivaaer || [])];
  const B = 400;
  /* Høyremargen må romme det LENGSTE navnet, ellers klippes det. Navn brytes
     til to linjer ved behov, og margen settes etter faktisk behov. */
  const MAKS_TEGN = 15;
  const navnLinjer = niv.map((n) => (n.navn ? brytTekst(n.navn, MAKS_TEGN) : []));
  const bredeste = Math.max(0, ...navnLinjer.flat().map((l) => l.length));
  const H = 275;
  const M = { v: 58, h: Math.min(150, Math.max(60, bredeste * 5.6 + 16)), o: 22, u: 26 };
  const verdier = niv.map((n) => n.verdi);
  const lo = f.min ?? Math.min(...verdier, 0), hi = f.max ?? Math.max(...verdier, 0);
  const spenn = (hi - lo) || 1;
  const Y = (v) => H - M.u - ((v - lo) / spenn) * (H - M.o - M.u);
  let s = "";

  s += linje(M.v - 12, Y(lo), M.v - 12, Y(hi), "f-akse");
  if (f.enhet) s += `<text class="f-akselabel" transform="translate(14,${N((Y(lo) + Y(hi)) / 2)}) rotate(-90)" text-anchor="middle">${E(f.enhet)}</text>`;

  /* Tett liggende nivåer (f.eks. n = 3 og n = 4 i hydrogen) får overlappende
     navn. Etikettene skyves fra hverandre og knyttes til streken med en tynn
     hjelpelinje, slik at det fortsatt er tydelig hvilken de hører til. */
  const etiketter = niv.map((n, i) => ({
    i, y: Y(n.verdi), h: Math.max(1, navnLinjer[i].length) * 11,
  })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < etiketter.length; k++) {
    const forr = etiketter[k - 1], den = etiketter[k];
    const minAvstand = (forr.h + den.h) / 2 + 2;
    if (den.y - forr.y < minAvstand) den.y = forr.y + minAvstand;
  }
  const flyttet = new Map(etiketter.map((e) => [e.i, e.y]));

  niv.forEach((n, i) => {
    const y = Y(n.verdi);
    s += linje(M.v, y, B - M.h, y, `f-niva${n.grunn ? " sterk" : ""}`);
    s += tekst(M.v - 18, y + 4, tall(n.verdi, f.desimaler ?? 2), "f-tick", "end");
    const l = navnLinjer[i];
    if (!l.length) return;
    const ty = flyttet.get(i);
    if (Math.abs(ty - y) > 1.5) s += linje(B - M.h, y, B - M.h + 5, ty, "f-hjelp");
    s += l.map((t, k) => tekst(B - M.h + 7, ty + 4 + (k - (l.length - 1) / 2) * 11,
                               t, "f-niva-txt", "start")).join("");
  });

  for (const o of f.overganger || []) {
    const a = niv[o.fra], b = niv[o.til];
    if (!a || !b) continue;
    const x = M.v + 26 + (o.x ?? 0) * 46;
    s += pil(x, Y(a.verdi), x, Y(b.verdi), `f-overgang s${o.farge ?? 1}`, 8);
    if (o.navn) {
      s += tekst(x + 6, (Y(a.verdi) + Y(b.verdi)) / 2 + 4, o.navn, `f-serielabel s${o.farge ?? 1}`, "start");
    }
  }
  return svgRamme(s, B, H, f.tittel);
}

/* ══════════════════ type: stolper ══════════════════ */

function tegnStolper(f) {
  const d = f.data || [];
  const B = 400;
  const bandRaa = (B - 60) / (d.length || 1);
  /* Lange navn får ikke plass under stolpen. Da roteres de, slik som i vanlige
     diagramverktøy, i stedet for å bli klippet eller lagt oppå hverandre. */
  const lengsteOrd = Math.max(0, ...d.flatMap((r) =>
    String(r.navn ?? "").replace(/­/g, " ").split(/\s+/).map((o) => o.length)));
  const roter = lengsteOrd * 6 > bandRaa;
  const lengsteNavn = Math.max(0, ...d.map((r) => String(r.navn ?? "").length));
  const H = roter ? 250 + Math.min(56, lengsteNavn * 2.6) : 250;
  const M = { v: f.enhet ? 60 : 46, h: 14, o: 20,
               u: roter ? 52 + Math.min(56, lengsteNavn * 2.6) : 52 };
  const maks = f.max ?? Math.max(...d.map((x) => x.verdi), 0);
  const skala = maks > 0 ? maks * 1.12 : 1;
  const Y = (v) => H - M.u - (v / skala) * (H - M.o - M.u);
  const bandB = (B - M.v - M.h) / (d.length || 1);
  const stolpeB = Math.min(24, bandB * 0.55);
  let s = "";

  const sy = pentSteg(skala, 5);
  for (let v = 0; v <= skala + 1e-9; v += sy) {
    s += linje(M.v, Y(v), B - M.h, Y(v), "f-grid");
    s += tekst(M.v - 7, Y(v) + 4, tall(v, sy < 1 ? 2 : 0), "f-tick", "end");
  }
  s += linje(M.v, Y(0), B - M.h, Y(0), "f-akse");
  if (f.enhet) s += `<text class="f-akselabel" transform="translate(13,${N((Y(0) + Y(skala)) / 2)}) rotate(-90)" text-anchor="middle">${E(f.enhet)}</text>`;

  d.forEach((rad, i) => {
    const x = M.v + i * bandB + (bandB - stolpeB) / 2;
    const h = Math.max(0, Y(0) - Y(rad.verdi));
    /* 4 px avrunding i toppen, rett av mot grunnlinja */
    s += `<path class="f-stolpe" d="M ${N(x)} ${N(Y(0))} V ${N(Y(rad.verdi) + Math.min(4, h))}
      Q ${N(x)} ${N(Y(rad.verdi))} ${N(x + Math.min(4, stolpeB / 2))} ${N(Y(rad.verdi))}
      H ${N(x + stolpeB - Math.min(4, stolpeB / 2))} Q ${N(x + stolpeB)} ${N(Y(rad.verdi))} ${N(x + stolpeB)} ${N(Y(rad.verdi) + Math.min(4, h))}
      V ${N(Y(0))} Z"/>`;
    s += tekst(x + stolpeB / 2, Y(rad.verdi) - 7, tall(rad.verdi, rad.verdi % 1 ? 1 : 0), "f-stolpe-txt");
    const cx = x + stolpeB / 2;
    if (roter) {
      s += `<text class="f-tick" transform="translate(${N(cx)},${N(Y(0) + 12)}) rotate(-38)"
        text-anchor="end">${E(String(rad.navn).replace(/­/g, ""))}</text>`;
    } else {
      const l = brytTekst(rad.navn, Math.max(7, Math.floor(bandB / 6.2)));
      s += l.slice(0, 3).map((t, k) => tekst(cx, Y(0) + 16 + k * 11, t, "f-tick")).join("");
    }
  });
  return svgRamme(s, B, H, f.tittel);
}

/* ══════════════════ type: hierarki ══════════════════
   Nivåstige: bokser som smalner nedover for å vise at hvert nivå ligger inni
   det over. Standardfiguren for systematikk og organisasjonsnivåer. */

function tegnHierarki(f) {
  const niv = f.nivaaer || [];
  const B = 400, radH = 34, mellom = 6;
  const H = 12 + niv.length * (radH + mellom);
  const maksB = B - 30, minB = 150;
  let s = "";
  niv.forEach((n, i) => {
    const bredde = niv.length > 1
      ? maksB - ((maksB - minB) * i) / (niv.length - 1)
      : maksB;
    const x = (B - bredde) / 2, y = 12 + i * (radH + mellom);
    s += rute(x, y, bredde, radH, "f-hierarkiboks", 7);
    if (n.eksempel) {
      s += tekst(x + 12, y + radH / 2 + 4, n.navn, "f-boks-txt", "start");
      s += tekst(x + bredde - 12, y + radH / 2 + 4, n.eksempel, "f-boks-note", "end");
    } else {
      s += tekst(B / 2, y + radH / 2 + 4, n.navn, "f-boks-txt");
    }
    if (i < niv.length - 1) {
      s += pil(B / 2, y + radH + 0.5, B / 2, y + radH + mellom - 0.5, "f-pil", 5);
    }
  });
  return svgRamme(s, B, H, f.tittel);
}

/* ══════════════════ type: spektrum ══════════════════
   Merket bånd langs en skala. Til pH-skalaen, det elektromagnetiske
   spekteret og andre inndelinger av et kontinuum. Fargen er en ordnet
   tint av fagfargen, ikke kategorisk — båndene har alltid navn. */

function tegnSpektrum(f) {
  const band = f.band || [];
  const B = 400, H = 136;
  const M = { v: 16, h: 16 };
  const log = !!f.log;
  const min = f.min ?? 0, maks = f.max ?? 14;
  const skala = (v) => {
    const t = log
      ? (Math.log10(v) - Math.log10(min)) / (Math.log10(maks) - Math.log10(min))
      : (v - min) / (maks - min);
    return M.v + Math.max(0, Math.min(1, t)) * (B - M.v - M.h);
  };
  const y = 42, hoyde = 30;
  let s = "";
  band.forEach((b, i) => {
    const x1 = skala(b.fra), x2 = skala(b.til);
    const bredde = Math.max(2, x2 - x1);
    /* ordnet tint: lysere til mørkere fra venstre mot høyre */
    const del = band.length > 1 ? i / (band.length - 1) : 0;
    const tint = Math.round(22 + del * 56);
    s += `<rect class="f-spektrumband" x="${N(x1 + (i ? 1 : 0))}" y="${y}"
      width="${N(bredde - (i ? 1 : 0))}" height="${hoyde}"
      style="fill:color-mix(in srgb, var(--f-strek) ${tint}%, var(--surface-1))"/>`;
    const l = brytTekst(b.navn, Math.max(6, Math.floor(bredde / 5.6)));
    s += l.slice(0, 2).map((t, k) =>
      tekst(x1 + bredde / 2, y + hoyde + 15 + k * 11, t, "f-tick")).join("");
    /* verdi settes bare der båndet faktisk er bredt nok til teksten */
    if (b.verdi != null && bredde > String(b.verdi).length * 5.6 + 6) {
      s += tekst(x1 + bredde / 2, y - 8, b.verdi, "f-boks-note");
    }
  });
  s += linje(M.v, y + hoyde, B - M.h, y + hoyde, "f-akse");
  /* enheten står over alt annet, ikke i samme rad som verdiene */
  s += tekst(M.v, 15, f.enhet ?? "", "f-akselabel", "start");
  s += tekst(M.v, y + hoyde + 15 + 24, tall(min, min % 1 ? 1 : 0), "f-tick", "start");
  s += tekst(B - M.h, y + hoyde + 15 + 24, tall(maks, maks % 1 ? 1 : 0), "f-tick", "end");
  return svgRamme(s, B, H, f.tittel);
}

/* ══════════════════ type: atom ══════════════════
   Skallmodell: kjerne med protoner og nøytroner, og elektroner fordelt på
   skall. Brukes til elektronkonfigurasjon i kjemi og Bohrs modell i fysikk. */

function tegnAtom(f) {
  const skall = f.skall || [];
  const B = 400, H = 300;
  const cx = B / 2, cy = H / 2;
  const rKjerne = 26;
  const maksR = 116;
  let s = "";

  skall.forEach((antall, i) => {
    const r = rKjerne + 22 + (skall.length > 1 ? (maksR - rKjerne - 22) * i / (skall.length - 1) : 0);
    s += `<circle class="f-skall" cx="${cx}" cy="${cy}" r="${N(r)}"/>`;
    for (let e = 0; e < antall; e++) {
      /* start øverst og fordel jevnt, forskjøvet per skall så de ikke står i linje */
      const a = (e / antall) * 2 * Math.PI - Math.PI / 2 + i * 0.4;
      s += `<circle class="f-elektron" cx="${N(cx + r * Math.cos(a))}"
        cy="${N(cy + r * Math.sin(a))}" r="4.6"/>`;
    }
    /* skallnavn ute til venstre */
    s += tekst(cx - r, cy - 7, f.skallnavn?.[i] ?? `${i + 1}`, "f-tick");
  });

  s += `<circle class="f-kjerne" cx="${cx}" cy="${cy}" r="${rKjerne}"/>`;
  if (f.grunnstoff) s += tekst(cx, cy - 1, f.grunnstoff, "f-kjerne-txt");
  const under = [];
  if (f.protoner != null) under.push(`${f.protoner} p`);
  if (f.noytroner != null) under.push(`${f.noytroner} n`);
  if (under.length) s += tekst(cx, cy + 13, under.join(" · "), "f-boks-note");

  if (f.valens != null) {
    s += tekst(B - 8, H - 8, `${f.valens} valenselektroner`, "f-tick", "end");
  }
  return svgRamme(s, B, H, f.tittel);
}

/* ══════════════════ type: molekyl ══════════════════
   VSEPR-geometri i to dimensjoner: sentralatom, bindinger i riktige vinkler,
   og ledige elektronpar som punktpar. */

const GEOMETRI = {
  "lineaer": { vinkler: [0, 180], navn: "lineær", vinkel: "180°" },
  "trigonal-plan": { vinkler: [-90, 30, 150], navn: "trigonal plan", vinkel: "120°" },
  "tetraedrisk": { vinkler: [-90, -20, 160, 90], navn: "tetraedrisk", vinkel: "109,5°" },
  "vinklet": { vinkler: [-140, -40], navn: "vinklet", vinkel: "104,5°" },
  "trigonal-pyramide": { vinkler: [-150, -30, 90], navn: "trigonal pyramide", vinkel: "107°" },
  "oktaedrisk": { vinkler: [-90, -30, 30, 90, 150, 210], navn: "oktaedrisk", vinkel: "90°" },
};

function tegnMolekyl(f) {
  const g = GEOMETRI[f.geometri] || GEOMETRI["tetraedrisk"];
  const lig = f.ligander || [];
  const B = 400, H = 260;
  const cx = B / 2, cy = H / 2 - 6;
  const L = 74;
  let s = "";

  lig.slice(0, g.vinkler.length).forEach((navn, i) => {
    const a = (g.vinkler[i] * Math.PI) / 180;
    const x = cx + L * Math.cos(a), y = cy + L * Math.sin(a);
    const antall = (f.bindinger && f.bindinger[i]) || 1;
    /* enkel-, dobbelt- eller trippelbinding som parallelle streker */
    const nx = -Math.sin(a), ny = Math.cos(a);
    for (let b = 0; b < antall; b++) {
      const d = (b - (antall - 1) / 2) * 4;
      s += linje(cx + 20 * Math.cos(a) + nx * d, cy + 20 * Math.sin(a) + ny * d,
                 x - 15 * Math.cos(a) + nx * d, y - 15 * Math.sin(a) + ny * d, "f-binding");
    }
    s += `<circle class="f-atom" cx="${N(x)}" cy="${N(y)}" r="15"/>`;
    s += tekst(x, y + 4.5, navn, "f-atom-txt");
  });

  /* ledige elektronpar som to punkter på motsatt side av bindingene */
  const ledige = f.ledigePar || 0;
  for (let p = 0; p < ledige; p++) {
    const a = ((ledige === 1 ? 90 : 60 + p * 60) * Math.PI) / 180;
    for (const off of [-5, 5]) {
      const nx = -Math.sin(a), ny = Math.cos(a);
      s += `<circle class="f-ledigpar" cx="${N(cx + 27 * Math.cos(a) + nx * off)}"
        cy="${N(cy + 27 * Math.sin(a) + ny * off)}" r="2.8"/>`;
    }
  }

  s += `<circle class="f-atom sentral" cx="${cx}" cy="${cy}" r="20"/>`;
  s += tekst(cx, cy + 5, f.sentral ?? "", "f-atom-txt sentral");
  s += tekst(B / 2, H - 8, `${g.navn}${f.vinkel || g.vinkel ? " · bindingsvinkel " + (f.vinkel ?? g.vinkel) : ""}`,
             "f-boks-note");
  return svgRamme(s, B, H, f.tittel);
}

/* ══════════════════ type: krets ══════════════════
   Enkel likestrømkrets: spenningskilde til venstre, parallelle grener til
   høyre, hver gren med komponenter i serie. */

function tegnKrets(f) {
  const grener = f.grener || [[]];
  const B = 400;
  const grenH = 54;
  const H = 40 + grener.length * grenH + 24;
  const xV = 46, xH = B - 34;
  const yTopp = 30, yBunn = H - 26;
  let s = "";

  /* ytre ledning */
  s += `<path class="f-ledning" d="M ${xV} ${yTopp} H ${xH} V ${yBunn} H ${xV} Z"/>`;

  /* spenningskilde midt på venstre side */
  const yK = (yTopp + yBunn) / 2;
  s += `<rect class="f-flate" x="${xV - 13}" y="${N(yK - 15)}" width="26" height="30"/>`;
  s += linje(xV - 11, yK - 9, xV + 11, yK - 9, "f-akse sterk");
  s += linje(xV - 6, yK - 3, xV + 6, yK - 3, "f-akse");
  s += linje(xV - 11, yK + 3, xV + 11, yK + 3, "f-akse sterk");
  s += linje(xV - 6, yK + 9, xV + 6, yK + 9, "f-akse");
  s += tekst(xV - 18, yK + 4, f.kilde?.navn ?? "", "f-boks-txt", "end");

  /* grener mellom venstre og høyre ledning */
  const xStart = xV + 46, xSlutt = xH - 26;
  grener.forEach((gren, gi) => {
    const y = yTopp + 24 + gi * grenH;
    if (grener.length > 1) {
      s += linje(xStart - 24, yTopp, xStart - 24, y, "f-ledning");
      s += linje(xStart - 24, y, xStart, y, "f-ledning");
      s += linje(xSlutt, y, xSlutt + 20, y, "f-ledning");
      s += linje(xSlutt + 20, y, xSlutt + 20, yBunn, "f-ledning");
    }
    const n = Math.max(1, gren.length);
    const bredde = (xSlutt - xStart) / n;
    gren.forEach((komp, ki) => {
      const cx0 = xStart + ki * bredde + bredde / 2;
      const kb = Math.min(46, bredde - 14);
      if (ki > 0) s += linje(xStart + ki * bredde - bredde / 2 + kb / 2, y, cx0 - kb / 2, y, "f-ledning");
      s += rute(cx0 - kb / 2, y - 10, kb, 20, "f-motstand", 3);
      s += tekst(cx0, y - 15, komp.navn ?? "", "f-boks-txt");
      if (komp.verdi) s += tekst(cx0, y + 24, komp.verdi, "f-boks-note");
    });
    if (grener.length === 1) {
      s += linje(xStart - 24, yTopp, xStart, yTopp, "f-ledning");
    }
  });
  if (f.strom) s += tekst(B / 2, yBunn + 17, f.strom, "f-tick");
  return svgRamme(s, B, H, f.tittel);
}

/* ══════════════════ type: sammenlikning ══════════════════
   To kolonner side om side. Rendres som HTML, ikke SVG: sammenlikninger er
   tekstrike, og da er ekte tekstombrekking, markering og skjermleser bedre
   enn SVG-tekst med håndregnet linjebrytning. */

function tegnSammenlikning(f) {
  const [a, b] = f.kolonner || ["", ""];
  const rader = f.rader || [];
  return `<div class="samlikn">
    <div class="samlikn-hode"><span>${E(a)}</span><span>${E(b)}</span></div>
    ${rader.map((r) => `<div class="samlikn-rad">
      ${r.egenskap ? `<div class="samlikn-egenskap">${E(r.egenskap)}</div>` : ""}
      <div class="samlikn-par">
        <div class="samlikn-celle v">${E(r.venstre)}</div>
        <div class="samlikn-celle h">${E(r.hoyre)}</div>
      </div>
    </div>`).join("")}
  </div>`;
}

/* ══════════════════ dispatcher ══════════════════ */

const TEGNERE = {
  graf: tegnGraf,
  hierarki: tegnHierarki,
  spektrum: tegnSpektrum,
  atom: tegnAtom,
  molekyl: tegnMolekyl,
  krets: tegnKrets,
  sammenlikning: tegnSammenlikning,
  fortegnslinje: tegnFortegnslinje,
  vektor: tegnVektor,
  tallinje: tegnTallinje,
  flyt: tegnFlyt,
  syklus: tegnSyklus,
  nivaaer: tegnNivaaer,
  stolper: tegnStolper,
};

/* Returnerer ferdig HTML for en figur, eller tom streng hvis den ikke kan
   tegnes. En ødelagt figur skal aldri velte kapittelet. */
function figurHTML(f, fagId) {
  if (!f || typeof f !== "object") return "";
  const tegner = TEGNERE[f.type];
  if (!tegner) { console.warn("ukjent figurtype:", f.type); return ""; }
  let innhold;
  try { innhold = tegner(f); }
  catch (e) { console.warn("figur feilet:", f.type, e.message); return ""; }
  if (!innhold) { console.warn("figur ga tomt resultat:", f.type); return ""; }
  /* sammenlikning rendres som HTML — da skal ikke figurflaten ha SVG-padding */
  const erHTML = f.type === "sammenlikning";
  return `<figure class="figur${fagId ? " fag-" + fagId : ""}">
    ${f.tittel ? `<figcaption class="figur-tittel">${E(f.tittel)}</figcaption>` : ""}
    <div class="figur-flate${erHTML ? " html" : ""}">${innhold}</div>
    ${f.forklaring ? `<figcaption class="figur-forklaring">${E(f.forklaring)}</figcaption>` : ""}
  </figure>`;
}

window.VG2Figur = { figurHTML, tolkUttrykk: tolk, typer: Object.keys(TEGNERE) };
})();
