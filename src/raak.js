// RÅK-oppslag MED gyldighetsdatoer.
//
// Både innvilgede tollnedsettelser og de offisielle standardsatsene gjelder i et
// datointervall (gyldig f.o.m. / t.o.m.). Skal en historisk deklarasjon vurderes,
// må satsen som var gyldig PÅ FORTOLLINGSDATOEN brukes — ikke dagens. Alle
// oppslag her tar derfor dato som argument, og sier fra når datagrunnlaget ikke
// dekker datoen (i stedet for å sammenligne mot feil sats).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';
import { validOn } from './period.js';

function load(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', file), 'utf8')); }
  catch { return fallback; }
}

let NED = null, SATS = null;
export function nedsettelser() { return (NED ||= load('raak-nedsettelser.json', { byVarenummer: {}, meta: null })); }
export function standardsatser() { return (SATS ||= load('raak-satser.json', { byHs: {}, meta: null })); }

// Landgrupper i tolltariffen: TALL = alle land (ordinær sats), TOES = EØS-avtalen.
// Preferanseberettiget opphav kan bruke EØS-raden; øvrige land kun TALL.
const EEA = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO']);
export function landgrupperFor(origin) {
  return EEA.has(String(origin || '').toUpperCase()) ? ['TOES', 'TALL'] : ['TALL'];
}

// Standardsats (råvaretollavgift) for HS + landgruppe på gitt dato.
// status: 'gyldig' | 'kun_nyere_sats' (vårt uttrekk starter etter datoen)
//       | 'ukjent' (varenummeret/landgruppen finnes ikke i uttrekket)
export function standardRateOn(hs, origin, dateIso) {
  const entry = standardsatser().byHs?.[hs];
  if (!entry) return { status: 'ukjent', rate: null };
  for (const lg of landgrupperFor(origin)) {
    const list = entry.byLandgruppe?.[lg];
    if (!list?.length) continue;
    const hit = list.find((s) => validOn(dateIso, s.fom, s.tom));
    if (hit) return { status: 'gyldig', rate: hit.sats, landgruppe: lg, fom: hit.fom, tom: hit.tom || null, enhet: entry.enhet };
    const newest = list[list.length - 1];
    return { status: 'kun_nyere_sats', rate: null, landgruppe: lg, knownFrom: newest.fom, knownRate: newest.sats, enhet: entry.enhet };
  }
  return { status: 'ukjent', rate: null };
}
