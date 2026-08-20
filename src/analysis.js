import { parseNoNumber } from './util.js';

// Aggregate analysis over normalised declaration rows.
export function analyze(rows) {
  const byCurrency = {};
  let sum25 = 0, sum15 = 0, sum0 = 0, sumMva = 0, sumAvg = 0;
  const discrepancies = [];

  for (const r of rows) {
    const cur = r['Valuta'] || 'UKJENT';
    const inv = r['Faktura (Val)__num'] ?? parseNoNumber(r['Faktura (Val)']);
    if (!byCurrency[cur]) byCurrency[cur] = { count: 0, invoiceSum: 0 };
    byCurrency[cur].count++;
    if (inv != null) byCurrency[cur].invoiceSum += inv;

    sum25 += r['MVA grunnl. 25%__num'] || 0;
    sum15 += r['MVA grunnl. 15%__num'] || 0;
    sum0  += r['MVA grunnl. 0%__num'] || 0;
    sumMva += r['MVA__num'] || 0;
    sumAvg += r['Avg__num'] || 0;

    const avvik = r['Avvik__num'] ?? parseNoNumber(r['Avvik']);
    if (avvik != null && Math.abs(avvik) > 0.001) {
      discrepancies.push({
        godkjent: r['Godkjent'] || r['Godkjent__iso'],
        aktor: r['Aktør'] || r['Aktør'],
        ordrenr: r['Ordrenr.'],
        avvik,
        valuta: r['Valuta'],
      });
    }
  }

  return {
    rowCount: rows.length,
    byCurrency: Object.fromEntries(
      Object.entries(byCurrency).map(([k, v]) => [k, { count: v.count, invoiceSum: round2(v.invoiceSum) }])
    ),
    mvaGrunnlag: { pct25: round2(sum25), pct15: round2(sum15), pct0: round2(sum0) },
    totalMva: round2(sumMva),
    totalAvgift: round2(sumAvg),
    discrepancyCount: discrepancies.length,
    discrepancies: discrepancies.sort((a, b) => Math.abs(b.avvik) - Math.abs(a.avvik)),
  };
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
// Format a NOK amount for written advice (refunds from Tolletaten are always NOK).
function krn(v) { return v == null ? '—' : Math.round(v).toLocaleString('nb-NO') + ' kr'; }

// ---- DB-backed insights (Phase C) ----
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './db.js';
import { ROOT } from './config.js';
import { claimWindow, claimDeadline } from './period.js';
import { standardRateOn, landgrupperFor, nedsettelser } from './raak.js';

// Duty-type code → category (from customs-hs-matcher toll-data/codes/box47-duty-type).
const DUTY_CAT = {
  TL: 'customs',      // Tolltariff — ordinary customs duty
  RT: 'raak',         // Raavareavgift — RÅK raw-material (varies per product; not a flag)
  FA: 'levy',         // Forskningsavgift — research levy
  SU: 'excise', FK: 'excise',
  GA: 'packaging', MA: 'packaging', GB: 'packaging', MB: 'packaging',
  GG: 'packaging', MG: 'packaging', GP: 'packaging', MP: 'packaging',
  FF: 'export',
};
function chargeCategory(source, type) {
  if (source === 'vat') return 'vat';
  return DUTY_CAT[type] || 'other';
}

// Origins eligible for a preferential rate with Norway (EEA/EU + EFTA + GB + common GSP-ish).
const PREF_ELIGIBLE = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','CH','GB']);

// 1) Preferential origin likely not claimed: a line paid customs duty (TL) while
// preference was N/none or J/expected. Strong when a SER origin proof exists on
// the line; softer when the origin is merely preference-eligible.
export function preferenceOpportunities({ win = claimWindow() } = {}) {
  const d = getDb();
  const rows = d.prepare(`
    SELECT gl.tollnummer, dcl.godkjent, dcl.godkjent_iso, dcl.aktor, gl.hs_code, gl.description, gl.origin,
           gl.preference_code, gl.origin_proof, gl.item_number, gl.net_weight, gl.statistical_value,
           c.amount AS tl_amount, c.rate AS tl_rate,
           (SELECT GROUP_CONCAT(ld.code || ':' || ld.reference, ' · ') FROM line_docs ld WHERE ld.goods_line_id = gl.id) AS docs
    FROM goods_lines gl
    JOIN declarations dcl ON dcl.tollnummer = gl.tollnummer
    JOIN line_charges c ON c.goods_line_id = gl.id
    WHERE c.source='box47' AND c.charge_type='TL' AND COALESCE(c.amount,0) > 0
      AND (gl.preference_code IS NULL OR gl.preference_code IN ('N','J'))
  `).all();
  const chapter = (hs) => parseInt(String(hs).slice(0, 2), 10);
  const all = rows.map((r) => {
    const dl = claimDeadline(r.godkjent_iso, win);
    // VIKTIG skille: EØS-preferanse eliminerer toll fullt ut bare for EKTE industrivarer
    // (kap. 25+). For LANDBRUKSVARER (kap. 1–24) — inkl. RÅK/bearbeidede — gir preferanse
    // IKKE full tollfritak; tollen reduseres kun via RÅK-tollnedsettelse (redusert
    // råvaresats) eller den lavere avtalesatsen, som er varespesifikk og krever
    // verifisering. Betalt toll er derfor bare et ØVRE TAK, ikke bekreftet gjenvinnbart.
    const agri = chapter(r.hs_code) <= 24;
    const eligible = PREF_ELIGIBLE.has((r.origin || '').toUpperCase());
    let tier = agri ? (eligible ? 'review' : 'weak') : (r.origin_proof ? 'strong' : (eligible ? 'possible' : 'weak'));
    // FALSK-NEGATIV-VERN: en agri-linje kan ha betalt full toll (bokført TL) selv om
    // PRODUKTET har en INNVILGET RÅK-nedsettelse. Da er dette egentlig et RÅK-krav,
    // ikke bare «til gjennomgang». Finn en gyldig nedsettelse på datoen via samme
    // strenge matcher; regn realistisk overbetaling (ikke full toll). Forbehold:
    // tollen er TL, ikke RT, så DSV må bekrefte at nedsettelsen gjelder denne posten.
    let grant = null;
    if (agri && eligible) {
      const m = matchProduct(r.hs_code, r.description);
      if (m && m.confidence === 'strong') {
        const lg = landgrupperFor(r.origin);
        const date = r.godkjent_iso;
        const valid = (m.group.rows || []).filter((x) => date && x.gyldig_fom <= date && date <= x.gyldig_tom && (!x.landgruppe || lg.includes(x.landgruppe)));
        if (valid.length) {
          const applicable = valid.reduce((a, b) => (b.sats < a.sats ? b : a));
          const base = (r.tl_amount != null && r.tl_rate) ? r.tl_amount / r.tl_rate : null;
          const over = (base != null && r.tl_rate > applicable.sats + 0.02) ? round2(base * (r.tl_rate - applicable.sats)) : 0;
          if (over > 0) {
            const skrivs = [...new Set(valid.filter((x) => x.sats === applicable.sats).map((x) => x.skriv).filter(Boolean))];
            grant = { product: m.group.prod, entitled: applicable.sats, over, skriv: skrivs.slice(0, 3), fom: applicable.gyldig_fom, tom: applicable.gyldig_tom, landgruppe: applicable.landgruppe };
            tier = 'raak_grant';
          }
        }
      }
    }
    return {
      ...r,
      agri, grant,
      tier,
      recoverable: grant ? grant.over : round2(r.tl_amount),   // grant: realistisk overbetaling; ellers øvre tak
      claim_deadline: dl.deadline, days_left: dl.daysLeft,
      // 3-årsfristen løper fra fortollingsdatoen, så eldre linjer er tapt selv om de ligger i basen
      claimable: r.godkjent_iso ? (r.godkjent_iso >= win.from && !dl.expired) : null,
    };
  }).filter((r) => r.tier !== 'weak').sort((a, b) => b.recoverable - a.recoverable);
  const expiredItems = all.filter((r) => r.claimable === false);
  const items = all.filter((r) => r.claimable !== false)
    .map((r) => ({
      ...r, kind: 'preferanse',
      matched_product: r.grant ? r.grant.product : null,
      skrivnummer: r.grant ? r.grant.skriv : null,
      summary: r.grant
        ? `«${(r.description || '').trim()}» (HS ${r.hs_code}) ble fortollet ${r.godkjent} til ${r.tl_rate} kr/kg, men produktet har en INNVILGET RÅK-nedsettelse (${(r.grant.skriv[0] || '—')}) på ${r.grant.entitled} kr/kg (gyldig ${r.grant.fom} – ${r.grant.tom}, landgruppe ${r.grant.landgruppe || '—'}). Tollen ble bokført som TL, ikke RT — nedsettelsen ble ikke brukt. Est. overbetaling ≈ ${krn(r.grant.over)}.`
        : r.agri
        ? `${r.aktor || 'Aktør'} betalte ${krn(r.tl_amount)} toll for landbruksvaren «${(r.description || '').trim()}» (HS ${r.hs_code}) fra ${r.origin}. EØS gir IKKE automatisk tollfritak for landbruks-/RÅK-varer — tollen reduseres bare via RÅK-tollnedsettelse eller den lavere avtalesatsen, som må verifiseres per vare. Beløpet er et øvre tak, ikke bekreftet gjenvinnbart.`
        : `${r.aktor || 'Aktør'} betalte ${krn(r.tl_amount)} ordinær toll for industrivaren «${(r.description || '').trim()}» (HS ${r.hs_code}) fra ${r.origin}. ${r.origin} er preferanseberettiget, men preferanse «${r.preference_code}» ble ikke krevd ved fortolling.`,
      action: r.grant
        ? `Be DSV om omberegning i TVINN og oppgi skrivnummer ${(r.grant.skriv[0] || '—')} (gyldig ${r.grant.fom} – ${r.grant.tom}). Est. refusjon ≈ ${krn(r.grant.over)}. Frist: ${r.claim_deadline || '3 år'}${r.days_left != null ? ` (${r.days_left} dager igjen)` : ''}. Produktmatch agent-verifisert (samme produkt).`
          + `${r.grant.landgruppe === 'TOES' && !r.origin_proof ? ` KREVER opprinnelsesbevis (EØS-nedsettelse, landgruppe TOES): innhent fakturaerklæring/REX fra leverandøren — ligger ikke på deklarasjonen i dag.` : ''}`
          + ` MERK: tollen er bokført som TL (ikke RT) — få DSV til å bekrefte at nedsettelsen gjelder denne tollposten.`
        : r.agri
        ? `Til gjennomgang med DSV: sjekk om varen har (eller kan få) RÅK-tollnedsettelse hos Landbruksdirektoratet, eller om en lavere EØS-avtalesats gjelder — og at opprinnelsesbevis kan skaffes. Først da er noe av de ${krn(r.tl_amount)} gjenvinnbart. Ikke anta full refusjon.`
        : r.origin_proof
        ? `Be DSV (speditør) om omberegning i TVINN med tilbakevirkende preferanse — opprinnelsesbevis (SER/fakturaerklæring) ligger allerede på deklarasjonen. Frist: 3 år fra fortollingsdato. Mulig refusjon ≈ ${krn(r.tl_amount)}. Fremover: be DSV alltid kreve preferanse for ${r.origin}-opphav.`
        : `Innhent opprinnelseserklæring (fakturaerklæring/REX) fra leverandøren, og be DSV om omberegning med preferanse. Frist: ${r.claim_deadline || '3 år fra fortolling'}${r.days_left != null ? ` (${r.days_left} dager igjen)` : ''}. Mulig refusjon ≈ ${krn(r.tl_amount)}.`,
    }));
  const totalRecoverable = round2(items.reduce((s, r) => s + (r.recoverable || 0), 0));
  return {
    window: win, count: items.length, totalRecoverable, items,
    expiredCount: expiredItems.length,
    expiredAmount: round2(expiredItems.reduce((s, r) => s + (r.recoverable || 0), 0)),
    expiredItems,
  };
}

// 2) Same PRODUCT, different treatment. Group by (aktor, product_key) — NOT HS.
// Flag when the same product across shipments got a different HS, a different VAT
// rate, or a different preference code. RÅK/duty rate differences are NOT flagged.
export function productInconsistencies() {
  const d = getDb();
  const lines = d.prepare(`
    SELECT gl.id, gl.tollnummer, dcl.aktor, dcl.godkjent, gl.product_key, gl.hs_code, gl.description,
           gl.preference_code, gl.origin, gl.article_number,
           (SELECT c.rate FROM line_charges c WHERE c.goods_line_id=gl.id AND c.source='vat' ORDER BY c.rate DESC LIMIT 1) AS vat_rate,
           (SELECT c.base FROM line_charges c WHERE c.goods_line_id=gl.id AND c.source='vat' ORDER BY c.rate DESC LIMIT 1) AS vat_base
    FROM goods_lines gl JOIN declarations dcl ON dcl.tollnummer=gl.tollnummer
    WHERE gl.product_key IS NOT NULL
  `).all();
  const groups = new Map();
  for (const l of lines) {
    const key = (l.aktor || '?') + '||' + l.product_key;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  const flags = [];
  for (const [key, g] of groups) {
    if (g.length < 2) continue;
    const hs = [...new Set(g.map((x) => x.hs_code).filter(Boolean))];
    const vat = [...new Set(g.map((x) => x.vat_rate).filter((v) => v != null))];
    const pref = [...new Set(g.map((x) => x.preference_code).filter(Boolean))];
    // STRENGT: hopp over grupper som spenner over ulike tolltariff-posisjoner (4
    // siffer). Da har en generisk beskrivelse slått sammen ULIKE produkter (f.eks.
    // «Manuka Wound Honey» i kap. 04/21/30/33) — upålitelig gruppering.
    if (new Set(hs.map((h) => String(h).slice(0, 4))).size > 1) continue;
    const issues = [];
    if (hs.length > 1) issues.push('hs');   // ulik 8-siffer innen samme posisjon = reell klassifiseringstvil
    if (vat.length > 1) issues.push('vat');
    // «Ulik preferansekode» fjernet: preferanse varierer legitimt per sending.
    if (!issues.length) continue;
    // estimate VAT overpay: lines above the min VAT rate
    let vatOverpay = 0;
    if (vat.length > 1) {
      const minR = Math.min(...vat);
      for (const l of g) if (l.vat_rate != null && l.vat_rate > minR && l.vat_base != null) vatOverpay += l.vat_base * (l.vat_rate - minR) / 100;
    }
    flags.push({
      aktor: g[0].aktor, product_key: key.split('||')[1],
      description: g[0].description, lines: g.length, issues,
      hs_codes: hs, vat_rates: vat, preferences: pref,
      est_vat_overpay: round2(vatOverpay),
      members: g.map((x) => ({ tollnummer: x.tollnummer, godkjent: x.godkjent, hs_code: x.hs_code, origin: x.origin, preference_code: x.preference_code, vat_rate: x.vat_rate, description: x.description, article_number: x.article_number })),
      tollnummers: [...new Set(g.map((x) => x.tollnummer))],
      kind: 'produkt',
      summary: `Produktet «${(g[0].description || '').trim()}» hos ${g[0].aktor || 'aktør'} er behandlet ulikt på tvers av ${g.length} linjer: ${issues.map((i) => i === 'hs' ? 'ulik HS-kode innen samme posisjon (' + hs.join('/') + ')' : 'ulik MVA-sats (' + vat.join('/') + '%)').join('; ')}.`,
      action: `Avklar korrekt ${issues.join(' og ')} med DSV og bruk konsekvent verdi fremover. ${issues.includes('vat') ? 'Der for høy MVA-sats er brukt: vurder omberegning (est. ' + krn(vatOverpay) + '). ' : ''}${issues.includes('hs') ? 'Ulik HS betyr at minst én klassifisering kan være feil — feil HS kan gi feil toll/RÅK. ' : ''}Riktig, konsekvent deklarering hindrer nye avvik.`,
    });
  }
  flags.sort((a, b) => (b.est_vat_overpay - a.est_vat_overpay) || (b.lines - a.lines));
  return { count: flags.length, items: flags };
}

// 3) Charge breakdown by category (customs/RÅK/excise/packaging/levy/VAT) and by supplier.
export function chargeBreakdown() {
  const d = getDb();
  const rows = d.prepare(`
    SELECT dcl.aktor, c.source, c.charge_type, COALESCE(c.amount,0) AS amount, COALESCE(c.base,0) AS base
    FROM line_charges c JOIN goods_lines gl ON gl.id=c.goods_line_id
    JOIN declarations dcl ON dcl.tollnummer=gl.tollnummer
  `).all();
  const byCat = {}; const bySupplier = {};
  for (const r of rows) {
    const cat = chargeCategory(r.source, r.charge_type);
    byCat[cat] = round2((byCat[cat] || 0) + r.amount);
    if (!bySupplier[r.aktor]) bySupplier[r.aktor] = {};
    bySupplier[r.aktor][cat] = round2((bySupplier[r.aktor][cat] || 0) + r.amount);
  }
  return { byCategory: byCat, bySupplier };
}

// 4) Supplier + monthly analytics from the declaration grid fields.
export function supplierAnalytics() {
  const d = getDb();
  const supplier = d.prepare(`
    SELECT aktor, COUNT(*) declarations,
           ROUND(SUM(COALESCE(mva_25,0)+COALESCE(mva_15,0)+COALESCE(mva_0,0)),2) mva_grunnlag,
           ROUND(SUM(COALESCE(avg,0)),2) avgift, COUNT(DISTINCT valuta) currencies
    FROM declarations GROUP BY aktor ORDER BY mva_grunnlag DESC`).all();
  const byCurrency = d.prepare(`SELECT valuta, COUNT(*) n, ROUND(SUM(COALESCE(faktura_val,0)),2) invoice FROM declarations GROUP BY valuta ORDER BY n DESC`).all();
  const incoterms = d.prepare(`SELECT COALESCE(box20_incoterm, levvilk) term, COUNT(*) n FROM declarations GROUP BY term ORDER BY n DESC`).all();
  return { topSuppliers: supplier.slice(0, 15), byCurrency, incoterms };
}

export function monthlyTrend() {
  const d = getDb();
  return d.prepare(`
    SELECT substr(godkjent_iso,1,7) month, COUNT(*) declarations,
           ROUND(SUM(COALESCE(mva_25,0)),2) mva25, ROUND(SUM(COALESCE(mva_15,0)),2) mva15,
           ROUND(SUM(COALESCE(avg,0)),2) avgift
    FROM declarations WHERE godkjent_iso IS NOT NULL GROUP BY month ORDER BY month`).all();
}

// 3b) RÅK-avstemming mot innvilgede tollnedsettelser — DATO-STYRT.
//
// En nedsettelse (skrivnummer) gjelder bare i sitt intervall gyldig f.o.m. –
// t.o.m., og bare for sin landgruppe. Skal historiske deklarasjoner vurderes, må
// vi bruke det som var innvilget PÅ FORTOLLINGSDATOEN: selskapets første
// RÅK-vedtak ble gyldige i august 2023, så en fortolling fra tidligere kan ikke
// kreves omberegnet mot et vedtak som først gjaldt senere. Slike treff
// rapporteres som egen kategori i stedet for å telles som overbetaling.
// Produktmatch gjøres på navn (samme varenummer) fordi deklarasjonene sjelden
// oppgir skrivnummeret; match-styrken rapporteres.
const RAAK_STOP = new Set('kapsler kapsel kaps kap caps tabl tabletter tablett stk pulver spray draaper olje oeko organic bio kosttilskudd tilberedte naeringsmidler mikstur ekstrakt extract forte complex'.split(' '));
// Semi-generiske «kategori»-ord som IKKE er distinktive produktnavn. Et treff som
// bare deler ett av disse (f.eks. «Niacin+ Energy» vs «Guarana Energy») avvises.
const RAAK_GENERIC = new Set('probiotic protein complex forte plus multi mini omega vitamin mineral energy stress balance total olie olje collagen blend daglig daily kompleks kombi extra super premium'.split(' '));
function raakTok(s) {
  s = (s || '').toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z ]/g, ' ');
  return new Set(s.split(/\s+/).filter((t) => t.length >= 4 && !RAAK_STOP.has(t)));
}

// Grupper vedtakene per varenummer + produktnavn. Radene beholdes med datoer og
// landgruppe, slik at gyldigheten kan avgjøres per fortollingsdato.
let RAAK_GROUPS = null;
function raakGroups() {
  if (RAAK_GROUPS) return RAAK_GROUPS;
  const file = nedsettelser();
  const byVn = {};
  for (const [vn, rows] of Object.entries(file.byVarenummer || {})) {
    const byProd = new Map();
    for (const r of rows) {
      const key = (r.prod || '').trim();
      if (!byProd.has(key)) byProd.set(key, { prod: r.prod, tok: raakTok(r.prod), rows: [] });
      byProd.get(key).rows.push(r);
    }
    byVn[vn] = [...byProd.values()];
  }
  RAAK_GROUPS = { byVn, meta: file.meta, source: file.source };
  return RAAK_GROUPS;
}

// Vitaminbokstav (A/B/C/D/E/K) fra et produktnavn, i begge rekkefølger
// («A-vitamin», «vitamin d»). Brukes til å avvise feilmatch der bare ordet
// «vitamin» er felles, men vitaminet er ulikt (A- vs D-vitamin).
function vitLetter(s) {
  const m = (s || '').toLowerCase().match(/\b([a-k])\s*-?\s*vitamin\b|\bvitamin\s*-?\s*([a-k])\b/);
  return m ? (m[1] || m[2]) : null;
}
// Agent-verifiserte dommer (data/raak-verdicts.json) overstyrer token-heuristikken:
// «ulikt» avviser matchen, «usikker»/«trolig» → svak. Se agent-workflow verify-raak.
let RAAK_VERDICTS = null;
function raakVerdicts() {
  if (RAAK_VERDICTS) return RAAK_VERDICTS;
  try { RAAK_VERDICTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'raak-verdicts.json'), 'utf8')).verdicts || {}; }
  catch { RAAK_VERDICTS = {}; }
  return RAAK_VERDICTS;
}
const verdictFor = (description, prod) => raakVerdicts()[(description || '').trim() + '||' + (prod || '').trim()] || null;

// Beste produktgruppe for en varelinje (token-overlapp innen samme varenummer).
// STRENGT: en match krever minst ett DISTINKTIVT (ikke-generisk) fellesord. Deler
// de bare generiske ord (vitamin/probiotic/protein/…), avvises matchen — med ett
// unntak: to vitaminprodukter godtas kun hvis vitaminbokstaven er den samme.
// Til slutt overstyrer en evt. agent-dom heuristikken.
function matchProduct(hs, description) {
  const cands = raakGroups().byVn[hs] || [];
  const dt = raakTok(description);
  let best = null, shared = [];
  for (const c of cands) {
    const sh = [...dt].filter((t) => c.tok.has(t) && !RAAK_GENERIC.has(t)); // ranger på distinktive treff
    if (sh.length > shared.length) { shared = sh; best = c; }
  }
  if (best && shared.length) {
    const v = verdictFor(description, best.prod);
    if (v === 'ulikt') return null; // agent: ulikt produkt — avvis
    return { group: best, shared, confidence: (v === 'usikker' || v === 'trolig') ? 'weak' : 'strong', verdict: v };
  }
  // Ingen distinktive fellesord: godta bare vitamin=vitamin med SAMME bokstav.
  const va = vitLetter(description);
  if (va) {
    for (const c of cands) {
      const vb = vitLetter(c.prod);
      if (vb && vb === va) {
        const v = verdictFor(description, c.prod);
        if (v === 'ulikt') continue; // agent: ulikt merke (A-vitamin vs Nutrisorb) — hopp over
        return { group: c, shared: [va + '-vitamin'], confidence: 'weak', verdict: v };
      }
    }
  }
  return null;
}

export function raakReconciliation({ win = claimWindow() } = {}) {
  const d = getDb();
  const rows = d.prepare(`
    SELECT gl.tollnummer, dcl.godkjent, dcl.godkjent_iso, dcl.aktor, gl.hs_code, gl.description,
           gl.origin, gl.preference_code, gl.origin_proof, gl.article_number,
           c.rate, c.base, c.amount
    FROM line_charges c
    JOIN goods_lines gl ON gl.id = c.goods_line_id
    JOIN declarations dcl ON dcl.tollnummer = gl.tollnummer
    WHERE c.source='box47' AND c.charge_type='RT' AND c.rate IS NOT NULL
  `).all();

  const items = [];        // faktiske krav (overbetalt mot gyldig nedsettelse)
  const notYetGranted = []; // produktmatch, men ingen gyldig nedsettelse på fortollingsdatoen
  const expired = [];       // krav som er utenfor 3-årsfristen
  let cntNoMatch = 0, cntOk = 0, outsideWindow = 0;

  for (const r of rows) {
    const date = r.godkjent_iso;
    const dl = claimDeadline(date, win);
    const inWindow = date ? date >= win.from && date <= win.to : null;
    if (inWindow === false) outsideWindow++;

    // Betalt sats vs. offisiell standardsats som gjaldt PÅ DATOEN
    const std = standardRateOn(r.hs_code, r.origin, date);
    const paidIsStandard = std.status === 'gyldig' ? Math.abs(r.rate - std.rate) <= 0.02 : null;

    const m = matchProduct(r.hs_code, r.description);
    if (!m) { cntNoMatch++; continue; }

    const lg = landgrupperFor(r.origin);
    const decisions = m.group.rows;
    const validRows = decisions.filter((x) => date && x.gyldig_fom <= date && date <= x.gyldig_tom && (!x.landgruppe || lg.includes(x.landgruppe)));

    if (!validRows.length) {
      // Produktet har vedtak, men ingen som gjaldt på fortollingsdatoen (eller for denne landgruppen).
      const relevant = decisions.filter((x) => !x.landgruppe || lg.includes(x.landgruppe));
      const firstFom = relevant.map((x) => x.gyldig_fom).filter(Boolean).sort()[0] || null;
      const lastTom = relevant.map((x) => x.gyldig_tom).filter(Boolean).sort().at(-1) || null;
      const why = !relevant.length ? 'annen_landgruppe' : (date && firstFom && date < firstFom ? 'ikke_innvilget_enda' : 'utlopt');
      notYetGranted.push({
        tollnummer: r.tollnummer, godkjent: r.godkjent, godkjent_iso: date, aktor: r.aktor,
        hs_code: r.hs_code, description: r.description, origin: r.origin, landgrupper: lg,
        applied_rate: r.rate, base_kg: r.base, raak_amount: round2(r.amount || 0),
        matched_product: m.group.prod, confidence: m.confidence, status: why,
        granted_fom: firstFom, granted_tom: lastTom,
        paid_is_standard: paidIsStandard, standard_rate: std.rate ?? null, standard_rate_status: std.status,
        kind: 'raak-info',
        summary: why === 'ikke_innvilget_enda'
          ? `«${(r.description || '').trim()}» ble fortollet ${r.godkjent} til ${r.rate} kr/kg. Nedsettelsen for dette produktet var først gyldig f.o.m. ${firstFom} — den kan derfor ikke brukes på denne fortollingen.`
          : why === 'utlopt'
            ? `«${(r.description || '').trim()}» ble fortollet ${r.godkjent} til ${r.rate} kr/kg, etter at nedsettelsen utløp ${lastTom}.`
            : `«${(r.description || '').trim()}» (opphav ${r.origin || '—'}) treffer ingen nedsettelse for landgruppe ${lg.join('/')}.`,
        action: why === 'ikke_innvilget_enda'
          ? `Ingen refusjon å kreve her. Vurder om det kunne vært søkt nedsettelse tidligere; sjekk at senere sendinger av samme produkt (etter ${firstFom}) faktisk bruker vedtaket.`
          : why === 'utlopt'
            ? `Søk fornyet tollnedsettelse for produktet — vedtaket utløp ${lastTom}, og sendinger etter den datoen betaler standardsats.`
            : `Sjekk om det finnes/kan søkes nedsettelse for landgruppen som gjelder dette opphavet (${r.origin || '—'}).`,
      });
      continue;
    }

    const applicable = validRows.reduce((a, b) => (b.sats < a.sats ? b : a));
    const entitled = applicable.sats;
    const over = (r.rate > entitled + 0.02 && r.base != null) ? r.base * (r.rate - entitled) : 0;
    if (over <= 0) { cntOk++; continue; }

    const skrivs = [...new Set(validRows.filter((x) => x.sats === entitled).map((x) => x.skriv).filter(Boolean))];
    const skriv0 = skrivs[0] || '—';
    const item = {
      tollnummer: r.tollnummer, godkjent: r.godkjent, godkjent_iso: date, aktor: r.aktor,
      hs_code: r.hs_code, description: r.description, origin: r.origin, landgruppe: applicable.landgruppe,
      applied_rate: r.rate, granted_rate: entitled, matched_product: m.group.prod,
      skrivnummer: skrivs.slice(0, 3), gyldig_fom: applicable.gyldig_fom, gyldig_tom: applicable.gyldig_tom,
      saksnr: applicable.saksnr || null, enhet: applicable.enhet || 'Kr/kg',
      confidence: m.confidence, shared: m.shared, agent_verdict: m.verdict || null, base_kg: r.base, raak_amount: round2(r.amount || 0),
      preference_code: r.preference_code, origin_proof: r.origin_proof,
      // en EØS-nedsettelse (TOES) forutsetter gyldig opprinnelsesbevis på linjen
      needs_origin_proof: applicable.landgruppe === 'TOES' && !r.origin_proof ? 1 : 0,
      est_overpay: round2(over),
      paid_is_standard: paidIsStandard, standard_rate: std.rate ?? null, standard_rate_status: std.status,
      claim_deadline: dl.deadline, days_left: dl.daysLeft, claimable: inWindow !== false && !dl.expired,
      kind: 'raak',
      summary: `«${(r.description || '').trim()}» (HS ${r.hs_code}) ble fortollet ${r.godkjent} til ${r.rate} kr/kg`
        + `${paidIsStandard ? ' — standardsatsen som gjaldt på den datoen' : ''}, mens vedtak ${skriv0} ga ${entitled} kr/kg`
        + ` (gyldig ${applicable.gyldig_fom} – ${applicable.gyldig_tom}, landgruppe ${applicable.landgruppe || '—'}). Nedsettelsen ble ikke brukt.`,
      action: `Be DSV om omberegning i TVINN og oppgi skrivnummer ${skriv0} (gyldig ${applicable.gyldig_fom} – ${applicable.gyldig_tom}).`
        + ` Est. refusjon ≈ ${krn(over)}.`
        + ` Frist: ${dl.deadline}${dl.daysLeft != null ? ` (${dl.daysLeft} dager igjen)` : ''}.`
        + `${m.verdict === 'samme' ? ' Agent-verifisert: samme produkt.' : (m.verdict === 'usikker' || m.verdict === 'trolig') ? ' MERK: agent flagget produktmatch som ' + m.verdict + ' — verifiser mot vedtaket.' : m.confidence === 'weak' ? ' MERK: svak produktmatch — verifiser mot vedtaket før krav sendes.' : ''}`
        + `${std.status === 'kun_nyere_sats' ? ' MERK: vårt satsuttrekk starter etter fortollingsdatoen, så betalt sats er ikke verifisert mot historisk standardsats.' : ''}`
        + `${applicable.landgruppe === 'TOES' && !r.origin_proof ? ' MERK: vedtaket gjelder landgruppe TOES (EØS) — omberegningen krever gyldig opprinnelsesbevis på linjen.' : ''}`,
    };
    if (item.claimable) items.push(item); else expired.push(item);
  }

  items.sort((a, b) => b.est_overpay - a.est_overpay);
  expired.sort((a, b) => b.est_overpay - a.est_overpay);
  notYetGranted.sort((a, b) => (b.raak_amount || 0) - (a.raak_amount || 0));
  const sum = (arr, f) => round2(arr.reduce((s, x) => s + (f(x) || 0), 0));
  return {
    window: win,
    fileMeta: raakGroups().meta, count: items.length,
    totalStrong: sum(items.filter((i) => i.confidence === 'strong'), (i) => i.est_overpay),
    totalWeak: sum(items.filter((i) => i.confidence === 'weak'), (i) => i.est_overpay),
    matchedStrong: items.filter((i) => i.confidence === 'strong').length,
    matchedWeak: items.filter((i) => i.confidence === 'weak').length,
    alreadyOk: cntOk, noMatch: cntNoMatch, raakLines: rows.length,
    outsideWindow,
    expiredCount: expired.length, expiredAmount: sum(expired, (i) => i.est_overpay), expiredItems: expired,
    notGrantedOnDate: notYetGranted.length, notGrantedItems: notYetGranted,
    items,
  };
}

// Consolidated action list across all finding types — one row per hit with a
// written summary and a concrete next step, for review/export and handoff to DSV.
export function actionList(pref, raak, prod) {
  const rows = [];
  for (const r of pref.items) rows.push({ kind: 'Preferanse', tollnummer: r.tollnummer, godkjent: r.godkjent, aktor: r.aktor, produkt: (r.description || '').trim(), confidence: r.tier, amount_nok: r.recoverable, frist: r.claim_deadline, dager_igjen: r.days_left, summary: r.summary, action: r.action });
  for (const r of raak.items) rows.push({ kind: 'RÅK', tollnummer: r.tollnummer, godkjent: r.godkjent, aktor: r.aktor, produkt: (r.description || '').trim(), confidence: r.confidence, amount_nok: r.est_overpay, frist: r.claim_deadline, dager_igjen: r.days_left, summary: r.summary, action: r.action });
  for (const r of prod.items) rows.push({ kind: 'Produkt', tollnummer: (r.tollnummers || [])[0], godkjent: null, aktor: r.aktor, produkt: (r.description || '').trim(), confidence: 'info', amount_nok: r.est_vat_overpay, frist: null, dager_igjen: null, summary: r.summary, action: r.action });
  rows.sort((a, b) => (b.amount_nok || 0) - (a.amount_nok || 0));
  const totalStrong = round2(rows.filter((r) => r.confidence === 'strong' || r.tier === 'strong').reduce((s, r) => s + (r.amount_nok || 0), 0));
  // Hastesaker: krav som foreldes innen 90 dager
  const urgent = rows.filter((r) => r.dager_igjen != null && r.dager_igjen <= 90).sort((a, b) => a.dager_igjen - b.dager_igjen);
  return {
    count: rows.length, totalPotential: round2(rows.reduce((s, r) => s + (r.amount_nok || 0), 0)), totalStrong,
    urgentCount: urgent.length, urgentAmount: round2(urgent.reduce((s, r) => s + (r.amount_nok || 0), 0)),
    expired: {
      preference: { count: pref.expiredCount || 0, amount: pref.expiredAmount || 0 },
      raak: { count: raak.expiredCount || 0, amount: raak.expiredAmount || 0 },
    },
    rows,
  };
}

// Hvor mye av 3-årsvinduet dekker databasen faktisk? Gjør det synlig når data mangler.
export function dataCoverage(win = claimWindow()) {
  const d = getDb();
  const r = d.prepare(`SELECT COUNT(*) n, MIN(godkjent_iso) first, MAX(godkjent_iso) last,
    SUM(CASE WHEN godkjent_iso >= ? AND godkjent_iso <= ? THEN 1 ELSE 0 END) inWindow,
    SUM(CASE WHEN godkjent_iso < ? THEN 1 ELSE 0 END) beforeWindow
    FROM declarations WHERE godkjent_iso IS NOT NULL`).get(win.from, win.to, win.from);
  const byYear = d.prepare(`SELECT substr(godkjent_iso,1,4) year, COUNT(*) n FROM declarations
    WHERE godkjent_iso IS NOT NULL GROUP BY year ORDER BY year`).all();
  return { ...r, byYear, window: win };
}

export function insights({ win = claimWindow() } = {}) {
  const preference = preferenceOpportunities({ win });
  const prodInc = productInconsistencies();
  const raak = raakReconciliation({ win });
  return {
    window: win,
    coverage: dataCoverage(win),
    preference, productInconsistencies: prodInc, raak,
    actions: actionList(preference, raak, prodInc),
    chargeBreakdown: chargeBreakdown(),
    suppliers: supplierAnalytics(),
    trend: monthlyTrend(),
  };
}
