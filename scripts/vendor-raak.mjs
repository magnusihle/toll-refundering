// Re-vendor RÅK-datagrunnlaget MED gyldighetsdatoer.
//
//   node scripts/vendor-raak.mjs [tollnedsettelser.xlsx] [raavaretollavgiftssats.json]
//
// 1) Innvilgede tollnedsettelser (RÅK) fra Tolletatens uttrekk (xlsx)
//    -> data/raak-nedsettelser.json  (nå med gyldig_fom i tillegg til gyldig_tom)
// 2) Offisielle standardsatser (råvaretollavgift) fra customs-hs-matcher
//    -> data/raak-satser.json (nå med fom/tom pr. landgruppe, ikke bare tallet)
//
// Uten datoene kan man ikke vite om satsen vi sammenligner mot faktisk gjaldt
// på fortollingsdatoen — derfor er begge feltene obligatoriske her.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/config.js';

const XLSX = process.argv[2] || '/Users/ihle/Downloads/tollnedsettelser-filtrert.xlsx';
const SATSER = process.argv[3]
  || '/Users/ihle/Downloads/customs-hs-matcher/_legacy/src/toll-data/sample-data/raavaretollavgiftssats.json';

// --- minimal xlsx-leser (zip via unzip(1), regex-XML; ingen avhengigheter) ---
const unz = (entry) => execFileSync('unzip', ['-p', XLSX, entry], { encoding: 'utf8', maxBuffer: 64 << 20 });
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function sharedStrings() {
  let xml; try { xml = unz('xl/sharedStrings.xml'); } catch { return []; }
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decode(t[1])).join(''));
}

function sheetRows() {
  const ss = sharedStrings();
  const xml = unz('xl/worksheets/sheet1.xml');
  const rows = [];
  for (const r of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const [, col, attrs, body] = c;
      // tre varianter: delt streng (t="s"), inline streng (t="inlineStr"), tall/dato (<v>)
      if (/t="inlineStr"/.test(attrs)) {
        cells[col] = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decode(t[1])).join('');
        continue;
      }
      const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      if (v == null) continue;
      cells[col] = /t="s"/.test(attrs) ? ss[Number(v)] : decode(v);
    }
    rows.push(cells);
  }
  return rows;
}

// dd-mm-yyyy (og dd.mm.yyyy) -> yyyy-mm-dd
function isoDate(s) {
  const m = String(s || '').trim().match(/^(\d{2})[-.](\d{2})[-.](\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// ---------- 1) nedsettelser ----------
const rows = sheetRows();
const head = rows[0];
const colOf = (label) => Object.keys(head).find((k) => (head[k] || '').trim().toLowerCase() === label.toLowerCase());
const C = {
  vn: colOf('Tollvarenummer'), prod: colOf('Fakturabetegnelse'), saksnr: colOf('Saksnummer'),
  ordning: colOf('Ordning'), skriv: colOf('Skrivnummer'), fom: colOf('Gyldig f.o.m.'),
  tom: colOf('Gyldig t.o.m.'), sats: colOf('Tollavgiftssats'), enhet: colOf('Enhet'), land: colOf('Opprinnelse'),
};
for (const [k, v] of Object.entries(C)) if (!v) throw new Error(`Fant ikke kolonnen for "${k}" i ${path.basename(XLSX)}`);

const byVarenummer = {};
let missingDates = 0;
for (const r of rows.slice(1)) {
  const vn = (r[C.vn] || '').trim();
  if (!vn) continue;
  const fom = isoDate(r[C.fom]);
  const tom = isoDate(r[C.tom]);
  if (!fom || !tom) missingDates++;
  (byVarenummer[vn] ||= []).push({
    prod: (r[C.prod] || '').trim(),
    sats: Number(String(r[C.sats] ?? '').replace(',', '.')),
    enhet: (r[C.enhet] || '').trim() || null,
    skriv: (r[C.skriv] || '').trim() || null,
    saksnr: (r[C.saksnr] || '').trim() || null,
    landgruppe: (r[C.land] || '').trim() || null,
    ordning: (r[C.ordning] || '').trim() || null,
    gyldig_fom: fom, gyldig_tom: tom,
  });
}
const all = Object.values(byVarenummer).flat();
const nedsettelser = {
  source: path.basename(XLSX),
  ordning: 'RÅK — innvilgede tollnedsettelser (Tolletaten)',
  generatedAt: new Date().toISOString(),
  meta: {
    rows: all.length,
    varenumre: Object.keys(byVarenummer).length,
    gyldig_fom_range: [all.map((r) => r.gyldig_fom).filter(Boolean).sort()[0], all.map((r) => r.gyldig_fom).filter(Boolean).sort().at(-1)],
    gyldig_tom_range: [all.map((r) => r.gyldig_tom).filter(Boolean).sort()[0], all.map((r) => r.gyldig_tom).filter(Boolean).sort().at(-1)],
    rowsMissingDates: missingDates,
    note: 'Hver rad er ett vedtak (skrivnummer) for ett varenummer + landgruppe, gyldig i et datointervall. Sammenlign alltid mot fortollingsdato.',
  },
  byVarenummer,
};
fs.writeFileSync(path.join(ROOT, 'data', 'raak-nedsettelser.json'), JSON.stringify(nedsettelser, null, 1));

// ---------- 2) standardsatser ----------
const src = JSON.parse(fs.readFileSync(SATSER, 'utf8'));
const byHs = {};
const fomSeen = new Set();
for (const v of src.varer || []) {
  const entry = { enhet: v.enhet || null, byLandgruppe: {} };
  for (const a of v.avtalesatser || []) {
    entry.byLandgruppe[a.landgruppe] = (a.sats || []).map((s) => {
      if (s.fomdato) fomSeen.add(s.fomdato);
      return { sats: Number(String(s.satsVerdi).replace(',', '.')), enhet: s.satsEnhet || null, fom: s.fomdato || null, tom: s.tomdato || null };
    }).sort((x, y) => String(x.fom).localeCompare(String(y.fom)));
  }
  byHs[v.id] = entry;
}
const satser = {
  source: path.basename(SATSER),
  versjon: src.versjon || null,
  generatedAt: new Date().toISOString(),
  meta: {
    varenumre: Object.keys(byHs).length,
    newestFomdato: [...fomSeen].sort().at(-1),
    note: 'Øyeblikksbilde: inneholder kun satser som gjelder NÅ (tomdato er tom). '
        + 'Rader med fom-dato etter en fortollingsdato kan derfor IKKE brukes til å '
        + 'vurdere den fortollingen — da må historisk sats hentes fra tolltariffen.',
  },
  byHs,
};
fs.writeFileSync(path.join(ROOT, 'data', 'raak-satser.json'), JSON.stringify(satser, null, 1));

console.log(JSON.stringify({ nedsettelser: nedsettelser.meta, satser: satser.meta }, null, 2));
