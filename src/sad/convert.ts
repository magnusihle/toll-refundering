#!/usr/bin/env tsx
// SAD PDF -> enriched JSON. Wraps the vendored ground-truth extractor (header +
// goods lines + box47 duty) AND parses the SAD's per-line VAT table
// ("ESTIMERT INNFØRSELSMERVERDIAVGIFT / GRUNNLAG PR AVGIFTSSATS"), which is where
// Norwegian import-VAT rate/basis lives per goods line (box47 duty is only filled
// when goods actually incur toll/særavgift).
//   tsx src/sad/convert.ts <pdfPath> [ref]  -> prints enriched JSON to stdout
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { extractSadPdf } from '../../vendor/sad-extractor.ts';

function noNum(s: string): number | null {
  if (s == null) return null;
  const t = s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Parse "Ln# Type Grunnlag Sats" rows from the estimated-VAT summary block.
// Returns per-line entries: { ln, type, base, rate }.
function parseVatPerLine(pdfPath: string): Array<{ ln: number; type: string; base: number | null; rate: number | null }> {
  let text = '';
  try { text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }); }
  catch { return []; }
  const out: Array<{ ln: number; type: string; base: number | null; rate: number | null }> = [];
  const lines = text.split('\n');
  let inBlock = false;
  for (const raw of lines) {
    const line = raw.replace(/ /g, ' ');
    if (/GRUNNLAG\s+PR\s+AVGIFTSSATS/i.test(line)) { inBlock = true; continue; }
    if (!inBlock) continue;
    // stop at the advisory footer / next section
    if (/Vi anbefaler|primærdokumentasjon|Bedriften er selv ansvarlig/i.test(line)) inBlock = false;
    // per-line row: starts with a line number, then a 2-4 letter avgift type, base, rate
    const m = line.match(/^\s*(\d{1,3})\s+([A-ZÆØÅ]{2,4})\s+([\d .]+?)\s+(\d{1,3},\d{2})\s*$/);
    if (m) out.push({ ln: Number(m[1]), type: m[2], base: noNum(m[3]), rate: noNum(m[4]) });
  }
  return out;
}

// Parse the compact one-line-per-item box47 layout (used by e.g. DSVR forms that
// the vendored parser can't read). Each item line ends with one or more avgift
// triples "TYPE base rate amount"; extra avgift for the same item may appear on
// continuation lines. Returns per-line { ln, hs, origin, pref, charges[] }.
const DUTY = /^(TL|FA|RT|SU|FK|MA|GA|GB|MB|GG|MG|GP|MP|FF)$/;
function parseCompactLines(pdfPath: string): Array<{ ln: number; hs: string; origin: string; pref: string; description: string; charges: Array<{ dutyType: string; base: number | null; rate: number | null; amount: number | null }> }> {
  let text = '';
  try { text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }); }
  catch { return []; }
  const ITEM = /^\s*(\d{1,3})\s+(\d{8})\s+(.+?)\s+(?:S\s+)?([A-Z]{2})\s+([A-Z])\s+(\d{2,4})\s+([\d ]+?)\s+(\d+)\s+([A-ZÆØÅ]{2,3})\s+([\d ]+?)\s+(\d{1,3}(?:,\d+)?)%?\s+([\d ]+?)\s*$/;
  const CONT = /^\s+([A-ZÆØÅ]{2,3})\s+([\d ]+?)\s+(\d{1,3}(?:,\d+)?)%?\s+([\d ]+?)\s*$/;
  const out: any[] = []; let cur: any = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/ /g, ' ');
    const m = line.match(ITEM);
    if (m) {
      cur = { ln: Number(m[1]), hs: m[2], description: m[3].trim(), origin: m[4], pref: m[5],
        charges: [{ dutyType: m[9], base: noNum(m[10]), rate: noNum(m[11]), amount: noNum(m[12]) }] };
      out.push(cur); continue;
    }
    if (cur) { const c = line.match(CONT); if (c && DUTY.test(c[1])) cur.charges.push({ dutyType: c[1], base: noNum(c[2]), rate: noNum(c[3]), amount: noNum(c[4]) }); }
  }
  return out;
}

const pdf = process.argv[2];
const ref = process.argv[3] || path.basename(pdf).replace(/\.pdf$/i, '');
if (!pdf) { console.error('usage: tsx src/sad/convert.ts <pdfPath> [ref]'); process.exit(2); }
try {
  const abs = path.resolve(pdf);
  const gt: any = extractSadPdf(abs, ref);
  const vat = parseVatPerLine(abs);
  // attach VAT rows to each goods line by line number
  const byLn = new Map<number, Array<{ type: string; base: number | null; rate: number | null }>>();
  for (const v of vat) { if (!byLn.has(v.ln)) byLn.set(v.ln, []); byLn.get(v.ln)!.push({ type: v.type, base: v.base, rate: v.rate }); }
  for (const li of (gt.lineItems || [])) { li.vat = byLn.get(li.itemNumber) || []; }
  gt.vatSummary = vat;
  gt.compactLines = parseCompactLines(abs); // per-line box47 for layouts extractSadPdf can't read
  process.stdout.write(JSON.stringify(gt));
} catch (e) {
  console.error('convert failed:', (e as Error).message);
  process.exit(1);
}
