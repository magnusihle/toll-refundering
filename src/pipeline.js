import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { ROOT } from './config.js';
import { queryDeclarations, collectLinjer } from './modules/declarations.js';
import { fetchSads, cleanupSads } from './modules/sad-fetch.js';
import { upsertDeclaration, summary, existingTollnummers } from './db.js';
import { parseNoNumber, parseNoDate } from './util.js';
import { claimWindow } from './period.js';

const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');
const CONVERT = path.join(ROOT, 'src', 'sad', 'convert.ts');
const num = (v) => (v == null || v === '' ? null : (typeof v === 'number' ? v : parseNoNumber(v)));

function convertSad(pdfPath, ref) {
  const json = execFileSync(TSX, [CONVERT, pdfPath, ref], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(json);
}

function gridFields(row) {
  return {
    godkjent: row['Godkjent'] || null, godkjent_iso: parseNoDate(row['Godkjent']),
    ie: row['I/E'] || null, prosedyre: row['Prosedyre'] || null,
    aktor_kode: row['Dekl.'] || null, aktor: row['Aktør'] || null,
    faktura_info: row['Faktura informasjon'] || null, ordrenr: row['Ordrenr.'] || null,
    faktura_val: num(row['Faktura (Val)']), valuta: row['Valuta'] || null, levvilk: row['LevVilk'] || null,
    frakt_b: num(row['Frakt (b)']), frakt_v: row['Frakt (v)'] || null, avg: num(row['Avg']),
    mva_25: num(row['MVA grunnl. 25%']), mva_15: num(row['MVA grunnl. 15%']), mva_0: num(row['MVA grunnl. 0%']),
    avvik: num(row['Avvik']), mva: num(row['MVA']), status: row['Status'] || null,
  };
}

function lineDesc(box31) {
  if (!box31) return null;
  if (typeof box31 === 'string') return box31;
  return box31.description || box31.marks || null;
}
const normKey = (s) => (s || '').toLowerCase().replace(/[^a-z0-9æøå ]/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
export function productKey({ article_number, description }) {
  if (article_number && String(article_number).trim()) return 'art:' + String(article_number).trim();
  if (description) return 'desc:' + normKey(description);
  return null;
}

function mapSadLines(gt) {
  return (gt.lineItems || []).map((li) => {
    const article = li.articleNumber || null;
    const desc = lineDesc(li.box31);
    const box44 = li.box44 || [];
    return {
      item_number: li.itemNumber, hs_code: li.box33 || null, origin: li.box34 || null, description: desc,
      article_number: article, preference_code: li.box36 || null,
      origin_proof: box44.some((d) => /^SER$/i.test(d.code)) ? 1 : 0,
      product_key: productKey({ article_number: article, description: desc }),
      gross_weight: num(li.box35), net_weight: num(li.box38), procedure: li.box37 || null,
      item_value: num(li.box42), statistical_value: num(li.box46),
      charges: [
        ...(li.box47 || []).map((d) => ({ source: 'box47', charge_type: d.dutyType, base: num(d.base), rate: num(d.rate), amount: num(d.amount), payment_method: d.paymentMethod || null })),
        ...(li.vat || []).map((v) => ({ source: 'vat', charge_type: v.type, base: num(v.base), rate: num(v.rate), amount: null, payment_method: null })),
      ],
      docs: box44.map((d) => ({ code: d.code, reference: d.reference })),
    };
  });
}

function finishLinjerLines(lines) {
  return (lines || []).map((li) => ({ ...li, product_key: productKey({ article_number: li.article_number, description: li.description }) }));
}

// Full incremental pipeline for a period. Only fetches declarations not already
// in the DB. Returns a rich report.
//
// Perioden er som standard, og maksimalt, 3-årsvinduet for tilbakebetalingskrav
// regnet i norsk tid (se src/period.js). Eldre fortollinger er foreldet, så vi
// henter dem ikke — be eksplisitt om `allowOlder` hvis de likevel trengs.
export async function buildDataset({ from = null, to = null, limit = null, force = false, allowOlder = false, onProgress = (m) => process.stderr.write(m + '\n') } = {}) {
  const win = claimWindow();
  const clamped = { from: false, to: false };
  if (!from) from = win.from;
  if (!allowOlder && from < win.from) { clamped.from = { requested: from, applied: win.from }; from = win.from; }
  if (!to) to = win.to;
  else if (!allowOlder && to > win.to) { clamped.to = { requested: to, applied: win.to }; to = win.to; }
  if (clamped.from) onProgress(`Perioden begrenset til 3-årsfristen: ${clamped.from.requested} → ${clamped.from.applied} (${win.tz})`);
  onProgress(`Listing declarations ${from}..${to}`);
  const q = await queryDeclarations({ from, to });
  if (q.error) return { error: q.error };
  let rows = q.rows.filter((r) => r['Tollnummer']);
  const inEmma = rows.length;

  const have = force ? new Set() : existingTollnummers();
  let targets = rows.filter((r) => !have.has(r['Tollnummer']));
  const alreadyHave = inEmma - targets.length;
  if (limit) targets = targets.slice(0, limit);
  onProgress(`In EMMA: ${inEmma} · already stored: ${alreadyHave} · to collect: ${targets.length}`);

  const report = { period: q.period, claimWindow: win, requested: { from, to }, clamped, inEmma, alreadyHave, toCollect: targets.length, newCollected: 0, viaLinjer: 0, failed: [] };
  if (targets.length === 0) { report.db = summary(); return report; }

  // 1) fetch SADs by direct URL (fast), convert
  const sadResults = await fetchSads(targets.map((r) => ({ tollnummer: r['Tollnummer'], deklkode: r['Dekl.'] })), { onProgress });
  const sadByToll = new Map(sadResults.map((s) => [s.tollnummer, s]));
  const recs = new Map();
  const sadExtra = new Map(); // toll -> { compact, vat } for charge attachment
  const needLinjer = [];
  for (const r of targets) {
    const toll = r['Tollnummer'];
    const sad = sadByToll.get(toll);
    const rec = {
      tollnummer: toll, grid: gridFields(r),
      sad_url: sad?.url || null, sad_source: sad?.path ? 'EmmaPDFMerge.aspx' : null, line_source: null,
      documents: sad?.url ? [{ doc_type: 'fortolling (merged)', filename: `${toll}.pdf`, url: sad.url }] : [],
      lines: [], warnings: null, extracted_at: new Date().toISOString(),
    };
    if (sad?.path && fs.existsSync(sad.path)) {
      try {
        const gt = convertSad(sad.path, toll);
        rec.direction = gt.direction || null; rec.declaration_type = gt.declarationType || null;
        rec.box20_incoterm = gt.header?.box20 || null; rec.box22_value = num(gt.header?.box22?.value);
        rec.box22_currency = gt.header?.box22?.currency || null; rec.box23_fx = num(gt.header?.box23);
        rec.lines = mapSadLines(gt); rec.line_source = 'sad';
        sadExtra.set(toll, { compact: gt.compactLines || [], vat: gt.vatSummary || [] });
      } catch (e) { rec.warnings = 'convert: ' + String(e.message).slice(0, 140); }
    } else {
      rec.warnings = sad?.error || 'no SAD';
    }
    if (rec.lines.length === 0) needLinjer.push(toll);
    recs.set(toll, rec);
  }
  cleanupSads(sadResults);

  // 2) Linjer fallback for declarations the SAD converter couldn't parse
  if (needLinjer.length) {
    onProgress(`Linjer fallback for ${needLinjer.length} declarations (SAD parsed 0 lines)…`);
    const linjer = await collectLinjer({ from, to, tollnummers: needLinjer, onProgress });
    for (const toll of needLinjer) {
      const res = linjer[toll];
      const rec = recs.get(toll);
      if (res && res.lines && res.lines.length) {
        // attach per-line box47 + VAT from the SAD's compact layout (by item number)
        const extra = sadExtra.get(toll);
        if (extra) {
          const compactByLn = new Map(extra.compact.map((c) => [c.ln, c]));
          const vatByLn = new Map();
          for (const v of extra.vat) { if (!vatByLn.has(v.ln)) vatByLn.set(v.ln, []); vatByLn.get(v.ln).push(v); }
          for (const li of res.lines) li.charges = chargesForItem(compactByLn, vatByLn, li.item_number);
        }
        rec.lines = finishLinjerLines(res.lines); rec.line_source = 'linjer';
        const hasCharges = rec.lines.some((l) => l.charges && l.charges.length);
        rec.warnings = (rec.warnings ? rec.warnings + '; ' : '') + 'lines from Linjer grid' + (hasCharges ? ' (charges from SAD box47)' : ' (no box47/VAT)');
        report.viaLinjer++;
      } else {
        rec.warnings = (rec.warnings ? rec.warnings + '; ' : '') + 'linjer: ' + (res?.error || 'no lines');
      }
    }
  }

  // 3) upsert
  for (const [toll, rec] of recs) {
    try { upsertDeclaration(rec); report.newCollected++; if (rec.lines.length === 0) report.failed.push({ tollnummer: toll, error: rec.warnings }); }
    catch (e) { report.failed.push({ tollnummer: toll, error: String(e.message).slice(0, 140) }); }
  }
  report.db = summary();
  return report;
}

// Charges (box47 + per-line VAT) for one item, from a converted SAD's compact/vat data.
function chargesForItem(compactByLn, vatByLn, ln) {
  const box47 = (compactByLn.get(ln)?.charges || []).map((c) => ({ source: 'box47', charge_type: c.dutyType, base: num(c.base), rate: num(c.rate), amount: num(c.amount), payment_method: null }));
  const vat = (vatByLn.get(ln) || []).map((v) => ({ source: 'vat', charge_type: v.type, base: num(v.base), rate: num(v.rate), amount: null, payment_method: null }));
  return [...box47, ...vat];
}
