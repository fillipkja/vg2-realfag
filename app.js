/* Realfag VG2 — studieverktøy
   Ruting via hash: #/, #/fag/<id>, #/kap/<fag>/<nr>, #/formler[/<fag>],
   #/metoder[/<id>], #/sok
   Skjermbildeverifisering: legg på ?theme=dark, ?v=<visning> f.eks.
   index.html?theme=dark#/kap/matematikk/3 · ?v=grundig
*/
(() => {
"use strict";

/* ─────────────────────────── konstanter ─────────────────────────── */

const FAGFARGE = {
  matematikk: "var(--fag-matematikk)",
  fysikk: "var(--fag-fysikk)",
  kjemi: "var(--fag-kjemi)",
  biologi: "var(--fag-biologi)",
};
const FORMELFAG = ["matematikk", "fysikk", "kjemi"];
const VISNINGER = [
  ["kompakt", "Kompakt"],
  ["grundig", "Grundig"],
  ["begreper", "Begreper"],
  ["quiz", "Quiz"],
  ["kort", "Kort"],
];
/* Leitner-bokser: dager til neste repetisjon */
const BOKS_DAGER = [0, 1, 3, 7, 16, 35];
const DAG = 86400000;

const IKON = {
  hjem: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/>',
  bok: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v18H5.5A1.5 1.5 0 0 1 4 19.5z"/><path d="M8 3v18"/>',
  formel: '<path d="M5 20c2.5 0 3-1.2 3.4-3.4L11 4.4C11.4 2.2 12 1 14.5 1"/><path d="M6 9h8"/><path d="M15 12l6 8M21 12l-6 8"/>',
  hjerne: '<path d="M12 4.5a3 3 0 0 0-5.9-.7A3 3 0 0 0 3.6 8a3 3 0 0 0 .5 4.6A3 3 0 0 0 6 17.6 3 3 0 0 0 12 19z"/><path d="M12 4.5a3 3 0 0 1 5.9-.7A3 3 0 0 1 20.4 8a3 3 0 0 1-.5 4.6A3 3 0 0 1 18 17.6 3 3 0 0 1 12 19z"/><path d="M12 4.5V19"/>',
  sok: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  tilbake: '<path d="m15 5-7 7 7 7"/>',
  fram: '<path d="m9 5 7 7-7 7"/>',
  sol: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/>',
  mane: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
  hake: '<path d="m4 12.5 5 5L20 6.5"/>',
  kryss: '<path d="M6 6l12 12M18 6L6 18"/>',
  sirkel: '<circle cx="12" cy="12" r="8.5"/>',
};
const svg = (navn, str = 20) =>
  `<svg viewBox="0 0 24 24" width="${str}" height="${str}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IKON[navn]}</svg>`;

/* ─────────────────────────── tilstand ─────────────────────────── */

const S = {
  fag: null,          // fag.json
  kapCache: new Map(),// "matematikk-3" -> kapitteldata
  formlerCache: new Map(),
  metoder: null,
  sokIndeks: null,
};

/* ─────────────────────────── lagring ─────────────────────────── */

const NOKKEL = "vg2realfag:v1";
let lager = null;

function lastLager() {
  if (lager) return lager;
  try { lager = JSON.parse(localStorage.getItem(NOKKEL)) || {}; }
  catch { lager = {}; }
  lager.kap ||= {};     // "matematikk-3": {kompakt:1, grundig:1, quiz:{best,antall,dato}}
  lager.kort ||= {};    // "matematikk-3:4": {boks, forfall}
  lager.tema ||= "auto";
  lager.sist ||= null;  // {fag, nr, v} — sist åpnede kapittel
  return lager;
}
function lagre() {
  try { localStorage.setItem(NOKKEL, JSON.stringify(lager)); } catch { /* full/privat modus */ }
}
const kapNokkel = (fag, nr) => `${fag}-${nr}`;
function kapState(fag, nr) {
  const k = kapNokkel(fag, nr);
  return (lastLager().kap[k] ||= {});
}

/* Fremdrift per kapittel: 3 deler à 1/3 — lest kompakt, lest grundig, bestått quiz (≥70 %) */
function kapProsent(fag, nr) {
  const st = lastLager().kap[kapNokkel(fag, nr)];
  if (!st) return 0;
  let p = 0;
  if (st.kompakt) p += 34;
  if (st.grundig) p += 33;
  if (st.quiz && st.quiz.antall && st.quiz.best / st.quiz.antall >= 0.7) p += 33;
  return Math.min(100, p);
}
function fagProsent(fagId) {
  const f = S.fag.find((x) => x.id === fagId);
  if (!f) return 0;
  const sum = f.kapitler.reduce((a, k) => a + kapProsent(fagId, k.nr), 0);
  return Math.round(sum / f.kapitler.length);
}
function totalProsent() {
  if (!S.fag) return 0;
  const alle = S.fag.flatMap((f) => f.kapitler.map((k) => kapProsent(f.id, k.nr)));
  return alle.length ? Math.round(alle.reduce((a, b) => a + b, 0) / alle.length) : 0;
}

/* ─────────────────────────── hjelpere ─────────────────────────── */

const $ = (sel, rot = document) => rot.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Rens HTML fra datafilene: kun hvitelistede tagger, ingen attributter. */
const HVITELISTE = new Set(["P","UL","OL","LI","STRONG","EM","BR","TABLE","THEAD",
  "TBODY","TR","TH","TD","H4","SUB","SUP"]);
function rens(html) {
  const mal = document.createElement("template");
  mal.innerHTML = String(html ?? "");
  const gaGjennom = (node) => {
    for (const barn of [...node.childNodes]) {
      if (barn.nodeType === 1) {
        if (!HVITELISTE.has(barn.tagName)) { barn.replaceWith(...barn.childNodes); continue; }
        for (const a of [...barn.attributes]) barn.removeAttribute(a.name);
        gaGjennom(barn);
      } else if (barn.nodeType !== 3) {
        barn.remove();
      }
    }
  };
  gaGjennom(mal.content);
  return mal.innerHTML;
}

/* KaTeX på et element, etter innsetting */
function mat(rot) {
  if (!window.renderMathInElement) return;
  try {
    window.renderMathInElement(rot, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
      strict: false,
      trust: false,
      ignoredTags: ["script", "noscript", "style", "textarea", "option"],
    });
  } catch (e) { console.warn("KaTeX:", e); }
}
function latex(kode, display = false) {
  if (!window.katex) return esc(kode);
  try {
    return window.katex.renderToString(String(kode), {
      displayMode: display, throwOnError: false, strict: false, trust: false,
    });
  } catch { return esc(kode); }
}

async function hent(sti) {
  const r = await fetch(sti, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${sti}: ${r.status}`);
  return r.json();
}
async function hentKapittel(fag, nr) {
  const k = kapNokkel(fag, nr);
  if (S.kapCache.has(k)) return S.kapCache.get(k);
  const d = await hent(`data/kapitler/${fag}-${String(nr).padStart(2, "0")}.json`);
  S.kapCache.set(k, d);
  return d;
}
async function hentFormler(fag) {
  if (S.formlerCache.has(fag)) return S.formlerCache.get(fag);
  const d = await hent(`data/formler-${fag}.json`);
  S.formlerCache.set(fag, d);
  return d;
}

const fagAv = (id) => S.fag.find((f) => f.id === id);
const kapAv = (fagId, nr) => fagAv(fagId)?.kapitler.find((k) => k.nr === Number(nr));

/* måler med tekstalternativ i tabellvisningen lenger nede på siden */
function meter(pst, fagId, tynn = false) {
  const aksent = FAGFARGE[fagId] || "var(--text-primary)";
  return `<div class="meter${tynn ? " thin" : ""}" role="img" aria-label="${pst} prosent fullført"
    style="--accent:${aksent};--track:color-mix(in srgb, ${aksent} 18%, var(--grid))">
    <i style="width:${pst}%"></i></div>`;
}

/* ─────────────────────────── ruting ─────────────────────────── */

function rute() {
  const h = location.hash.replace(/^#/, "") || "/";
  const [sti, sporr] = h.split("?");
  const deler = sti.split("/").filter(Boolean);
  const q = new URLSearchParams(sporr || "");
  return { deler, q };
}
function gaTil(sti, erstatt = false) {
  if (erstatt) location.replace("#" + sti);
  else location.hash = sti;
}

/* ─────────────────────────── toppbar & tabbar ─────────────────────────── */

function tegnTopp({ tittel, under, tilbake }) {
  const mork = erMork();
  $("#topbar").innerHTML = `
    ${tilbake
      ? `<button class="iconbtn" id="tilbake" aria-label="Tilbake">${svg("tilbake")}</button>`
      : ""}
    <div style="flex:1;min-width:0">
      <div class="top-title">${esc(tittel)}</div>
      ${under ? `<div class="top-sub">${esc(under)}</div>` : ""}
    </div>
    <button class="iconbtn" id="temabryter" aria-label="Bytt mellom lyst og mørkt tema">
      ${svg(mork ? "sol" : "mane")}</button>`;
  const tb = $("#tilbake");
  if (tb) tb.onclick = () => (tilbake === true ? history.back() : gaTil(tilbake));
  $("#temabryter").onclick = byttTema;
}

function erMork() {
  const t = lastLager().tema;
  if (t === "dark") return true;
  if (t === "light") return false;
  return matchMedia("(prefers-color-scheme: dark)").matches;
}
function settTema() {
  const t = lastLager().tema;
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = t;
}
function byttTema() {
  lastLager().tema = erMork() ? "light" : "dark";
  lagre(); settTema(); tegn();
}

function tegnTabbar() {
  const { deler } = rute();
  const rot = deler[0] || "";
  const lenker = [
    ["/", "hjem", "Hjem", rot === ""],
    ["/fag/matematikk", "bok", "Fag", rot === "fag" || rot === "kap"],
    ["/formler", "formel", "Formler", rot === "formler"],
    ["/metoder", "hjerne", "Metoder", rot === "metoder"],
    ["/sok", "sok", "Søk", rot === "sok"],
  ];
  $("#tabbar").innerHTML = lenker.map(([sti, ikon, navn, aktiv]) =>
    `<a href="#${sti}"${aktiv ? ' aria-current="page"' : ""}>${svg(ikon, 22)}<span>${navn}</span></a>`
  ).join("");
}

/* ─────────────────────────── visning: hjem ─────────────────────────── */

/* Forfalte flashcards på tvers av alle fag — «hva bør du repetere i dag» */
function forfalteKort() {
  const lag = lastLager(), naa = Date.now();
  let n = 0;
  for (const t of Object.values(lag.kort)) if ((t.forfall || 0) <= naa && t.boks > 1) n++;
  return n;
}

function visHjem(el) {
  tegnTopp({ tittel: "Realfag VG2", under: "Studiespesialisering — realfag" });
  const tot = totalProsent();
  const ferdige = S.fag.flatMap((f) => f.kapitler.map((k) => kapProsent(f.id, k.nr)))
    .filter((p) => p === 100).length;
  const antKap = S.fag.reduce((a, f) => a + f.kapitler.length, 0);
  const sist = lastLager().sist;
  const sistKap = sist && kapAv(sist.fag, sist.nr) ? sist : null;
  const forfalt = forfalteKort();

  el.innerHTML = `
    <div class="card hero" style="margin-top:16px">
      <div class="fig">${tot}<small>%</small></div>
      <div class="lbl">av pensum gjennomgått<br>
        <b>${ferdige}</b> av <b>${antKap}</b> kapitler er ferdige</div>
    </div>

    ${sistKap ? `
      <div class="section-label">Fortsett der du var</div>
      <a class="card kapkort" href="#/kap/${sistKap.fag}/${sistKap.nr}?v=${sistKap.v || "kompakt"}"
         style="--accent:${FAGFARGE[sistKap.fag]};--track:color-mix(in srgb, ${FAGFARGE[sistKap.fag]} 18%, var(--grid))">
        <span class="kapnum">${sistKap.nr}</span>
        <span class="kapbody">
          <h4>${esc(kapAv(sistKap.fag, sistKap.nr).tittel)}</h4>
          <div class="undertema">${esc(fagAv(sistKap.fag).navn)}</div>
          ${kapProsent(sistKap.fag, sistKap.nr) > 0
            ? `<div style="margin-top:7px">${meter(kapProsent(sistKap.fag, sistKap.nr), sistKap.fag, true)}</div>` : ""}
        </span>
        <span class="chev">${svg("fram", 16)}</span>
      </a>` : ""}

    ${forfalt > 0 ? `<div class="notat" style="margin-top:12px">
      Du har <b>${forfalt}</b> ${forfalt === 1 ? "kort" : "kort"} som er klare for repetisjon.
      Åpne «Kort» i et kapittel du har øvd på før.</div>` : ""}

    <div class="section-label">Fagene dine</div>
    <div class="fagliste">
      ${S.fag.map((f) => {
        const p = fagProsent(f.id);
        const a = FAGFARGE[f.id];
        return `<a class="card fagkort" href="#/fag/${f.id}"
          style="--accent:${a};--track:color-mix(in srgb, ${a} 18%, var(--grid))">
          <div class="fagkort-top"><h3>${esc(f.navn)}</h3><span class="pct">${p} %</span></div>
          <p>${esc(f.beskrivelse)}</p>
          ${meter(p, f.id)}
        </a>`;
      }).join("")}
    </div>

    <details class="tabellvisning">
      <summary>Fremdrift som tabell</summary>
      <table><thead><tr><th>Fag</th><th>Kapitler ferdig</th><th>Fremdrift</th></tr></thead>
      <tbody>${S.fag.map((f) => {
        const ferd = f.kapitler.filter((k) => kapProsent(f.id, k.nr) === 100).length;
        return `<tr><td>${esc(f.navn)}</td><td>${ferd} / ${f.kapitler.length}</td>
          <td>${fagProsent(f.id)} %</td></tr>`;
      }).join("")}</tbody></table>
    </details>

    <div class="section-label">Kom i gang</div>
    <div class="stack">
      <a class="card metode" href="#/metoder">
        <h4>Læringsmetoder</h4>
        <p>Studieteknikker som faktisk virker — aktiv gjenkalling, spaced repetition, Feynman-metoden og flere.</p>
      </a>
      <a class="card metode" href="#/formler">
        <h4>Formelsamling</h4>
        <p>Alle formlene i R1, fysikk og kjemi samlet, sortert etter tema. Rask å slå opp i før prøver.</p>
      </a>
      <a class="card metode" href="#/sok">
        <h4>Søk i alt</h4>
        <p>Finn et begrep, en formel eller et kapittel på tvers av alle fire fag.</p>
      </a>
    </div>

    <p class="tom" style="padding:26px 10px 10px;font-size:12.5px">
      Fremdriften lagres bare på denne enheten.</p>`;
}

/* ─────────────────────────── visning: fag ─────────────────────────── */

function visFag(el, fagId) {
  const f = fagAv(fagId);
  if (!f) return visIkkeFunnet(el);
  tegnTopp({ tittel: f.navn, under: `${f.kapitler.length} kapitler`, tilbake: "/" });
  const a = FAGFARGE[f.id];

  el.innerHTML = `
    <div class="chips" style="margin-top:14px">
      ${S.fag.map((x) => `<a class="chip${x.id === fagId ? " aktiv" : ""}" href="#/fag/${x.id}">
        <i class="dot" style="--accent:${FAGFARGE[x.id]}"></i>${esc(x.kort)}</a>`).join("")}
    </div>

    <div class="card" style="padding:14px 16px;--accent:${a};--track:color-mix(in srgb, ${a} 18%, var(--grid))">
      <div class="rad" style="margin-bottom:9px">
        <span style="font-size:13.5px;color:var(--text-secondary);font-weight:550">Fremdrift i faget</span>
        <span class="spacer"></span>
        <span class="pct mono-tall" style="font-size:14px;font-weight:620">${fagProsent(fagId)} %</span>
      </div>
      ${meter(fagProsent(fagId), fagId)}
    </div>

    ${FORMELFAG.includes(fagId) ? `<div class="chips">
      <a class="chip" href="#/formler/${fagId}">${svg("formel", 14)} Formelsamling</a>
    </div>` : ""}

    ${f.kildenote ? `<div class="notat" style="margin-top:12px">${esc(f.kildenote)}</div>` : ""}

    <div class="section-label">Kapitler</div>
    <div class="kaplist">
      ${f.kapitler.map((k) => {
        const p = kapProsent(fagId, k.nr);
        return `<a class="card kapkort${p === 100 ? " ferdig" : ""}" href="#/kap/${fagId}/${k.nr}"
            style="--accent:${a};--track:color-mix(in srgb, ${a} 18%, var(--grid))">
          <span class="kapnum">${p === 100 ? svg("hake", 16) : k.nr}</span>
          <span class="kapbody">
            <h4>${esc(k.tittel)}</h4>
            <div class="undertema">${esc((k.undertema || []).join(" · "))}</div>
            ${p > 0 && p < 100 ? `<div style="margin-top:7px">${meter(p, fagId, true)}</div>` : ""}
          </span>
          <span class="chev">${svg("fram", 16)}</span>
        </a>`;
      }).join("")}
    </div>`;
}

/* ─────────────────────────── visning: kapittel ─────────────────────────── */

async function visKapittel(el, fagId, nr, ønsketVisning) {
  const f = fagAv(fagId), kMeta = kapAv(fagId, nr);
  if (!f || !kMeta) return visIkkeFunnet(el);
  tegnTopp({ tittel: `${nr}. ${kMeta.tittel}`, under: f.navn, tilbake: `/fag/${fagId}` });
  /* bare vis lasteteksten hvis kapittelet ikke ligger i minnet — ellers blinker
     visningen hver gang du bytter fane */
  if (!S.kapCache.has(kapNokkel(fagId, nr))) {
    el.innerHTML = `<div class="laster">Laster kapittel …</div>`;
  }

  let d;
  try { d = await hentKapittel(fagId, nr); }
  catch {
    el.innerHTML = `<div class="card" style="padding:20px;margin-top:16px">
      <h3 style="font-size:16px;margin-bottom:8px">Innholdet er ikke klart ennå</h3>
      <p style="color:var(--text-secondary);font-size:14.5px">
        Kapittelet «${esc(kMeta.tittel)}» finnes i oversikten, men innholdsfilen mangler.</p>
      <div class="section-label">Undertemaer i kapittelet</div>
      <ul class="punkter" style="--accent:${FAGFARGE[fagId]}">
        ${(kMeta.undertema || []).map((u) => `<li>${esc(u)}</li>`).join("")}</ul>
    </div>`;
    return;
  }

  const v = VISNINGER.some(([id]) => id === ønsketVisning) ? ønsketVisning : "kompakt";
  const a = FAGFARGE[fagId];
  lastLager().sist = { fag: fagId, nr: Number(nr), v };
  lagre();

  el.innerHTML = `
    <div class="seg" role="tablist">
      ${VISNINGER.map(([id, navn]) =>
        `<button role="tab" aria-selected="${id === v}" data-v="${id}">${navn}</button>`).join("")}
    </div>
    <div id="kapinnhold" style="--accent:${a};--track:color-mix(in srgb, ${a} 18%, var(--grid))"></div>`;

  /* Fanebytte går via ruten, så adressen alltid kan deles og «sist åpnet»
     stemmer. Hash-endringen trigger tegn() som rendrer kapittelet på nytt. */
  el.querySelectorAll(".seg button").forEach((b) => {
    b.onclick = () => gaTil(`/kap/${fagId}/${nr}?v=${b.dataset.v}`, true);
  });
  tegnKapInnhold($("#kapinnhold"), fagId, nr, d, v);
}

function tegnKapInnhold(vert, fagId, nr, d, v) {
  const fns = { kompakt: visKompakt, grundig: visGrundig, begreper: visBegreper,
                quiz: visQuiz, kort: visKort };
  (fns[v] || visKompakt)(vert, fagId, nr, d);
  mat(vert);
}

/* ── kompakt ── */
function visKompakt(vert, fagId, nr, d) {
  const st = kapState(fagId, nr);
  const formler = d.kompakt.formler || [];
  vert.innerHTML = `
    <p style="color:var(--text-secondary);font-size:14.5px;margin:16px 0 4px">${esc(d.intro)}</p>

    <div class="section-label">Det viktigste</div>
    <div class="card blokk">
      <ul class="punkter">${d.kompakt.punkter.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
    </div>

    ${formler.length ? `
      <div class="section-label">Formler i kapittelet</div>
      <div class="card blokk">
        ${formler.map((f) => `<div class="formelrad">
          <span class="navn">${esc(f.navn)}</span>
          <span class="ltx">${latex(f.latex)}</span></div>`).join("")}
      </div>` : ""}

    <button class="knapp${st.kompakt ? " sekundar" : ""}" id="merk">
      ${st.kompakt ? "✓ Lest — trykk for å angre" : "Marker som lest"}</button>

    <div class="chips" style="margin-top:14px;justify-content:center">
      <a class="chip" href="#/kap/${fagId}/${nr}?v=grundig">Les grundig versjon ${svg("fram", 13)}</a>
    </div>`;
  $("#merk", vert).onclick = () => {
    st.kompakt = st.kompakt ? 0 : 1; lagre();
    visKompakt(vert, fagId, nr, d); mat(vert);
  };
}

/* ── grundig ── */
function visGrundig(vert, fagId, nr, d) {
  const st = kapState(fagId, nr);
  const g = d.grundig;
  vert.innerHTML = `
    <p style="color:var(--text-secondary);font-size:14.5px;margin:16px 0 4px">${esc(d.intro)}</p>

    ${g.seksjoner.map((s, i) => `
      <div class="section-label">${esc(s.tittel)}</div>
      <div class="card blokk"><div class="prose">${rens(s.html)}</div></div>`).join("")}

    <div class="section-label">Gjennomgåtte eksempler</div>
    <div class="card blokk">
      ${g.eksempler.map((e, i) => `
        <div class="eksempel">
          <h4>Eksempel ${i + 1}: ${esc(e.tittel)}</h4>
          <div class="prose oppg">${rens(e.oppgave)}</div>
          <button class="losning-btn" data-los="${i}" aria-expanded="false">Vis løsning</button>
          <div class="losning prose" id="los-${i}" hidden>${rens(e.losning)}</div>
        </div>`).join("")}
    </div>

    <div class="section-label">Vanlige feil</div>
    <div class="card blokk">
      <ul class="punkter">${g.vanligeFeil.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    </div>

    <div class="section-label">Tips til prøven</div>
    <div class="card blokk">
      <ul class="punkter">${g.tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    </div>

    <button class="knapp${st.grundig ? " sekundar" : ""}" id="merk">
      ${st.grundig ? "✓ Lest — trykk for å angre" : "Marker som lest"}</button>

    <div class="chips" style="margin-top:14px;justify-content:center">
      <a class="chip" href="#/kap/${fagId}/${nr}?v=quiz">Test deg selv ${svg("fram", 13)}</a>
    </div>`;

  vert.querySelectorAll("[data-los]").forEach((b) => {
    b.onclick = () => {
      const box = $("#los-" + b.dataset.los, vert);
      const apen = !box.hidden;
      box.hidden = apen;
      b.textContent = apen ? "Vis løsning" : "Skjul løsning";
      b.setAttribute("aria-expanded", String(!apen));
      if (!apen) mat(box);
    };
  });
  $("#merk", vert).onclick = () => {
    st.grundig = st.grundig ? 0 : 1; lagre();
    visGrundig(vert, fagId, nr, d); mat(vert);
  };
}

/* ── begreper ── */
function visBegreper(vert, fagId, nr, d) {
  vert.innerHTML = `
    <div class="section-label">Begreper du må kunne</div>
    <div class="card blokk">
      <dl style="margin:0">
        ${d.begreper.map((b) => `<div class="begrep">
          <dt>${esc(b.begrep)}</dt><dd>${esc(b.forklaring)}</dd></div>`).join("")}
      </dl>
    </div>
    <div class="chips" style="margin-top:14px;justify-content:center">
      <a class="chip" href="#/kap/${fagId}/${nr}?v=kort">Øv med kort ${svg("fram", 13)}</a>
    </div>`;
}

/* ── quiz ── */
function visQuiz(vert, fagId, nr, d) {
  const st = kapState(fagId, nr);
  const sporsmal = d.quiz;
  let i = 0, riktige = 0, svart = false;

  const tegnResultat = () => {
    const pst = Math.round((riktige / sporsmal.length) * 100);
    const best = st.quiz?.best ?? 0;
    if (!st.quiz || riktige > best) {
      st.quiz = { best: riktige, antall: sporsmal.length, dato: new Date().toISOString().slice(0, 10) };
      lagre();
    }
    const godkjent = pst >= 70;
    vert.innerHTML = `
      <div class="card resultat" style="margin-top:16px">
        <div class="fig">${riktige}<small> / ${sporsmal.length}</small></div>
        <p>${pst} % riktig — ${godkjent
          ? "godkjent! Kapittelet telles som gjennomgått."
          : "under 70 %. Les kapittelet en gang til og prøv på nytt."}</p>
        ${st.quiz.best !== riktige ? `<p style="font-size:13px">Beste resultat: ${st.quiz.best} / ${st.quiz.antall}</p>` : ""}
      </div>
      <button class="knapp" id="omigjen">Ta quizen på nytt</button>
      <button class="knapp sekundar" id="tilbakekap">Tilbake til kapittelet</button>`;
    $("#omigjen", vert).onclick = () => { i = 0; riktige = 0; svart = false; tegnSporsmal(); };
    $("#tilbakekap", vert).onclick = () => gaTil(`/kap/${fagId}/${nr}?v=kompakt`);
  };

  const tegnSporsmal = () => {
    if (i >= sporsmal.length) return tegnResultat();
    const q = sporsmal[i];
    svart = false;
    vert.innerHTML = `
      <div style="margin-top:16px">
        <div class="quiz-head">
          <span class="teller">${i + 1} / ${sporsmal.length}</span>
          ${meter(Math.round((i / sporsmal.length) * 100), fagId, true)}
          <span class="teller">${riktige} riktige</span>
        </div>
        <div class="card blokk">
          <div class="q-tekst">${esc(q.sporsmal)}</div>
          <div class="alt-liste">
            ${q.alternativer.map((alt, j) => `
              <button class="alt" data-j="${j}">
                <span class="bokstav">${"ABCD"[j]}</span>
                <span>${esc(alt)}</span></button>`).join("")}
          </div>
          <div id="fasit"></div>
        </div>
      </div>`;
    mat(vert);

    vert.querySelectorAll(".alt").forEach((b) => {
      b.onclick = () => {
        if (svart) return;
        svart = true;
        const valgt = Number(b.dataset.j);
        const ok = valgt === q.riktig;
        if (ok) riktige++;
        vert.querySelectorAll(".alt").forEach((x) => {
          const j = Number(x.dataset.j);
          x.disabled = true;
          if (j === q.riktig) x.dataset.svar = "riktig";
          else if (j === valgt) x.dataset.svar = "galt";
        });
        const fasit = $("#fasit", vert);
        fasit.innerHTML = `
          <div class="forklaring">
            <div class="fasit ${ok ? "ok" : "feil"}">
              ${svg(ok ? "hake" : "kryss", 16)}${ok ? "Riktig" : "Ikke riktig"}</div>
            <div>${esc(q.forklaring)}</div>
          </div>
          <button class="knapp" id="neste">
            ${i + 1 >= sporsmal.length ? "Se resultatet" : "Neste spørsmål"}</button>`;
        mat(fasit);
        $("#neste", vert).onclick = () => { i++; tegnSporsmal(); };
        $("#neste", vert).scrollIntoView({ block: "nearest", behavior: "smooth" });
      };
    });
  };
  tegnSporsmal();
}

/* ── flashcards (Leitner) ── */
function visKort(vert, fagId, nr, d) {
  const lag = lastLager();
  const naa = Date.now();
  const kortNokkel = (j) => `${fagId}-${nr}:${j}`;
  const tilstand = (j) => (lag.kort[kortNokkel(j)] ||= { boks: 1, forfall: 0 });

  const forfalt = d.flashcards.map((_, j) => j).filter((j) => tilstand(j).forfall <= naa);
  let ko = forfalt.length ? forfalt : d.flashcards.map((_, j) => j);
  const helRunde = !forfalt.length;
  let p = 0, snudd = false;

  const tegn = () => {
    if (p >= ko.length) {
      const boksTelling = [0, 0, 0, 0, 0];
      d.flashcards.forEach((_, j) => { boksTelling[Math.min(4, tilstand(j).boks - 1)]++; });
      vert.innerHTML = `
        <div class="card resultat" style="margin-top:16px">
          <div class="fig">${svg("hake", 46)}</div>
          <p>Du er gjennom alle ${ko.length} kortene i denne runden.</p>
        </div>
        <div class="card blokk">
          <h3><span class="kicker">Fordeling</span></h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            ${boksTelling.map((n, b) => `<tr>
              <td style="padding:5px 0;color:var(--text-secondary)">Boks ${b + 1}
                <span style="color:var(--text-muted);font-size:12.5px">
                  (repeteres etter ${BOKS_DAGER[b + 1]} ${BOKS_DAGER[b + 1] === 1 ? "dag" : "dager"})</span></td>
              <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600">${n}</td>
            </tr>`).join("")}
          </table>
        </div>
        <button class="knapp" id="alle">Gå gjennom alle kortene igjen</button>
        <button class="knapp sekundar" id="tilbakekap">Tilbake til kapittelet</button>`;
      $("#alle", vert).onclick = () => {
        ko = d.flashcards.map((_, j) => j); p = 0; snudd = false; tegn();
      };
      $("#tilbakekap", vert).onclick = () => gaTil(`/kap/${fagId}/${nr}?v=kompakt`);
      return;
    }

    const j = ko[p];
    const kort = d.flashcards[j];
    const t = tilstand(j);
    vert.innerHTML = `
      <div class="quiz-head" style="margin-top:16px">
        <span class="teller">${p + 1} / ${ko.length}</span>
        ${meter(Math.round((p / ko.length) * 100), fagId, true)}
        <span class="teller">Boks ${t.boks}</span>
      </div>
      ${helRunde ? `<div class="notat" style="margin-bottom:12px">Ingen kort er forfalt akkurat nå
        — dette er en full repetisjonsrunde.</div>` : ""}
      <div class="kort-scene">
        <div class="kort" id="kort" role="button" tabindex="0" aria-label="Snu kortet">
          <div class="side"><div>${esc(kort.front)}</div><span class="hint">Trykk for å snu</span></div>
          <div class="side bak"><div>${esc(kort.bak)}</div><span class="hint">Hvordan gikk det?</span></div>
        </div>
      </div>
      <div class="kort-knapper" id="knapper" hidden>
        <button class="knapp sekundar" id="feil">Ikke sikker</button>
        <button class="knapp" id="riktig">Kunne det</button>
      </div>
      <div class="boks-info">
        <span>Kortene gjentas etter Leitner-systemet</span>
        <span>${d.flashcards.length} kort i kapittelet</span>
      </div>`;
    mat(vert);

    const kortEl = $("#kort", vert);
    const snu = () => {
      snudd = !snudd;
      kortEl.classList.toggle("snudd", snudd);
      $("#knapper", vert).hidden = !snudd;
    };
    kortEl.onclick = snu;
    kortEl.onkeydown = (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); snu(); } };

    const svar = (ok) => {
      t.boks = ok ? Math.min(5, t.boks + 1) : 1;
      t.forfall = naa + BOKS_DAGER[t.boks] * DAG;
      lagre();
      p++; snudd = false; tegn();
    };
    $("#riktig", vert).onclick = () => svar(true);
    $("#feil", vert).onclick = () => svar(false);
  };
  tegn();
}

/* ─────────────────────────── visning: formler ─────────────────────────── */

async function visFormler(el, fagId) {
  const valgt = FORMELFAG.includes(fagId) ? fagId : "matematikk";
  tegnTopp({ tittel: "Formelsamling", under: fagAv(valgt)?.navn, tilbake: "/" });
  el.innerHTML = `
    <div class="chips" style="margin-top:14px">
      ${FORMELFAG.map((id) => `<a class="chip${id === valgt ? " aktiv" : ""}" href="#/formler/${id}">
        <i class="dot" style="--accent:${FAGFARGE[id]}"></i>${esc(fagAv(id).kort)}</a>`).join("")}
    </div>
    <div id="formelinnhold"><div class="laster">Laster formler …</div></div>`;

  const vert = $("#formelinnhold", el);
  let d;
  try { d = await hentFormler(valgt); }
  catch {
    vert.innerHTML = `<div class="tom">Formelsamlingen for ${esc(fagAv(valgt).navn)}
      er ikke lagt inn ennå.</div>`;
    return;
  }
  vert.innerHTML = d.kategorier.map((kat) => `
    <div class="section-label">${esc(kat.tittel)}</div>
    <div class="card blokk">
      ${kat.formler.map((f) => `<div class="formelrad">
        <span class="navn">${esc(f.navn)}${f.forklaring ? `<em>${esc(f.forklaring)}</em>` : ""}</span>
        <span class="ltx">${latex(f.latex)}</span></div>`).join("")}
    </div>`).join("");
  mat(vert);
}

/* ─────────────────────────── visning: metoder ─────────────────────────── */

async function visMetoder(el, id) {
  if (!S.metoder) {
    tegnTopp({ tittel: "Læringsmetoder", tilbake: "/" });
    el.innerHTML = `<div class="laster">Laster …</div>`;
    try { S.metoder = (await hent("data/studieteknikk.json")).metoder; }
    catch {
      el.innerHTML = `<div class="tom">Læringsmetodene er ikke lagt inn ennå.</div>`;
      return;
    }
  }
  if (id) {
    const m = S.metoder.find((x) => x.id === id);
    if (!m) return visMetoder(el, null);
    tegnTopp({ tittel: m.tittel, under: "Læringsmetode", tilbake: "/metoder" });
    el.innerHTML = `
      <div class="card blokk" style="margin-top:16px">
        <p style="font-size:16px;color:var(--text-secondary);margin-bottom:12px">${esc(m.kort)}</p>
        <div class="prose">${rens(m.html)}</div>
      </div>`;
    mat(el);
    return;
  }
  tegnTopp({ tittel: "Læringsmetoder", under: `${S.metoder.length} metoder`, tilbake: "/" });
  el.innerHTML = `
    <p style="color:var(--text-secondary);font-size:14.5px;margin:16px 0 4px">
      Hvordan du leser betyr mer enn hvor lenge du leser. Her er metodene som har best
      dokumentert effekt — og hvordan du bruker dem i realfag.</p>
    <div class="section-label">Metoder</div>
    <div class="stack">
      ${S.metoder.map((m) => `<a class="card metode" href="#/metoder/${esc(m.id)}">
        <h4>${esc(m.tittel)}</h4><p>${esc(m.kort)}</p></a>`).join("")}
    </div>`;
}

/* ─────────────────────────── visning: søk ─────────────────────────── */

async function byggSokIndeks() {
  if (S.sokIndeks) return S.sokIndeks;
  const ix = [];
  for (const f of S.fag) {
    for (const k of f.kapitler) {
      ix.push({ type: "kapittel", fag: f.id, fagNavn: f.navn, tittel: `${k.nr}. ${k.tittel}`,
        tekst: (k.undertema || []).join(" · "), url: `/kap/${f.id}/${k.nr}` });
      try {
        const d = await hentKapittel(f.id, k.nr);
        for (const b of d.begreper || []) {
          ix.push({ type: "begrep", fag: f.id, fagNavn: f.navn, tittel: b.begrep,
            tekst: b.forklaring, url: `/kap/${f.id}/${k.nr}?v=begreper`,
            sted: `${f.kort} · kap. ${k.nr}` });
        }
        for (const fm of d.kompakt?.formler || []) {
          ix.push({ type: "formel", fag: f.id, fagNavn: f.navn, tittel: fm.navn,
            tekst: fm.latex, url: `/kap/${f.id}/${k.nr}?v=kompakt`,
            sted: `${f.kort} · kap. ${k.nr}`, latex: fm.latex });
        }
      } catch { /* kapittelet finnes ikke ennå */ }
    }
  }
  for (const id of FORMELFAG) {
    try {
      const d = await hentFormler(id);
      for (const kat of d.kategorier) for (const fm of kat.formler) {
        ix.push({ type: "formel", fag: id, fagNavn: fagAv(id).navn, tittel: fm.navn,
          tekst: fm.forklaring || fm.latex, url: `/formler/${id}`,
          sted: `Formelsamling · ${kat.tittel}`, latex: fm.latex });
      }
    } catch { /* ikke lagt inn */ }
  }
  if (S.metoder === null) {
    try { S.metoder = (await hent("data/studieteknikk.json")).metoder; } catch { S.metoder = []; }
  }
  for (const m of S.metoder || []) {
    ix.push({ type: "metode", fag: null, tittel: m.tittel, tekst: m.kort,
      url: `/metoder/${m.id}`, sted: "Læringsmetode" });
  }
  S.sokIndeks = ix;
  return ix;
}

function visSok(el) {
  tegnTopp({ tittel: "Søk", tilbake: "/" });
  el.innerHTML = `
    <div class="sokefelt">${svg("sok", 17)}
      <input id="sokinput" type="search" placeholder="Søk etter begrep, formel eller kapittel"
        autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
    </div>
    <div id="sokresultat"><div class="tom">Skriv minst to tegn for å søke.</div></div>`;

  const inn = $("#sokinput", el), ut = $("#sokresultat", el);
  inn.focus({ preventScroll: true });
  let indeks = null, tidsavbrudd;

  const utfor = async () => {
    const q = inn.value.trim().toLowerCase();
    if (q.length < 2) { ut.innerHTML = `<div class="tom">Skriv minst to tegn for å søke.</div>`; return; }
    if (!indeks) { ut.innerHTML = `<div class="laster">Bygger søkeindeks …</div>`; indeks = await byggSokIndeks(); }
    const ord = q.split(/\s+/).filter(Boolean);
    const treff = indeks.map((p) => {
      const hei = (p.tittel + " " + p.tekst).toLowerCase();
      if (!ord.every((o) => hei.includes(o))) return null;
      let s = 0;
      const t = p.tittel.toLowerCase();
      if (t === q) s += 100;
      else if (t.startsWith(q)) s += 50;
      else if (t.includes(q)) s += 25;
      if (p.type === "begrep") s += 6;
      if (p.type === "formel") s += 4;
      if (p.type === "kapittel") s += 3;
      return { p, s };
    }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 40);

    if (!treff.length) {
      ut.innerHTML = `<div class="tom">Ingen treff på «${esc(inn.value.trim())}».</div>`;
      return;
    }
    const uthev = (tekst) => {
      let s = esc(tekst);
      for (const o of ord) {
        s = s.replace(new RegExp(`(${o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>");
      }
      return s;
    };
    const merkelapp = { kapittel: "Kapittel", begrep: "Begrep", formel: "Formel", metode: "Metode" };
    ut.innerHTML = `<div class="trefflist">${treff.map(({ p }) => `
      <a class="card treff" href="#${p.url}">
        <div class="kilde">
          ${p.fag ? `<i class="dot" style="--accent:${FAGFARGE[p.fag]}"></i>` : ""}
          ${merkelapp[p.type]}${p.sted ? " · " + esc(p.sted) : p.fagNavn ? " · " + esc(p.fagNavn) : ""}
        </div>
        <div class="tittel">${uthev(p.tittel)}</div>
        <div class="utdrag">${p.latex ? latex(p.latex) : uthev(p.tekst)}</div>
      </a>`).join("")}</div>
      <p class="tom" style="padding:16px;font-size:12.5px">${treff.length} treff</p>`;
    mat(ut);
  };
  inn.oninput = () => { clearTimeout(tidsavbrudd); tidsavbrudd = setTimeout(utfor, 160); };
  inn.onsearch = utfor;
}

function visIkkeFunnet(el) {
  tegnTopp({ tittel: "Ikke funnet", tilbake: "/" });
  el.innerHTML = `<div class="tom">Denne siden finnes ikke.
    <br><br><a class="chip" href="#/">Til forsiden</a></div>`;
}

/* ─────────────────────────── tegn ─────────────────────────── */

function tegn() {
  const el = $("#visning");
  const { deler, q } = rute();
  tegnTabbar();
  const [rot, a, b] = deler;
  if (!rot) return visHjem(el);
  if (rot === "fag") return visFag(el, a);
  if (rot === "kap") return visKapittel(el, a, Number(b), q.get("v"));
  if (rot === "formler") return visFormler(el, a);
  if (rot === "metoder") return visMetoder(el, a);
  if (rot === "sok") return visSok(el);
  return visIkkeFunnet(el);
}

/* ─────────────────────────── oppstart ─────────────────────────── */

async function start() {
  lastLager();
  /* ?theme=… for skjermbildeverifisering — overstyrer ikke lagret valg */
  const url = new URLSearchParams(location.search);
  const tvungetTema = url.get("theme");
  if (tvungetTema === "dark" || tvungetTema === "light") {
    document.documentElement.dataset.theme = tvungetTema;
  } else {
    settTema();
  }

  try {
    S.fag = (await hent("data/fag.json")).fag;
  } catch (e) {
    $("#visning").innerHTML = `<div class="tom">Klarte ikke å laste innholdet.<br>
      Sjekk nettforbindelsen og last siden på nytt.</div>`;
    console.error(e);
    return;
  }

  addEventListener("hashchange", () => {
    tegn();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (lastLager().tema === "auto") tegn();
  });

  tegn();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
}

if (document.readyState === "loading") addEventListener("DOMContentLoaded", start);
else start();
})();
