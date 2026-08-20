// Hent hele 3-årsvinduet fra EMMA EDOC, delt i halvårs-bolker (holder grid-
// sidene små og gir delresultater underveis). Inkrementelt: allerede lagrede
// tollnummer hoppes over.
import { claimWindow } from '../src/period.js';
import { buildDataset } from '../src/pipeline.js';
import { closeSession } from '../src/session.js';

const win = claimWindow();
console.log(`Kravvindu (${win.tz}): ${win.from} .. ${win.to}  (${win.years} år)`);

function chunks(from, to) {
  const out = [];
  let cur = from;
  while (cur <= to) {
    const y = Number(cur.slice(0, 4));
    const h2 = cur.slice(5) >= '07-01';
    let end = h2 ? `${y}-12-31` : `${y}-06-30`;
    if (end > to) end = to;
    out.push([cur, end]);
    const [ny, nm] = h2 ? [y + 1, '01-01'] : [y, '07-01'];
    cur = `${ny}-${nm}`;
  }
  return out;
}

const parts = chunks(win.from, win.to);
const reports = [];
for (const [from, to] of parts) {
  console.log(`\n=== ${from} .. ${to} ===`);
  try {
    const r = await buildDataset({ from, to, onProgress: (m) => console.log('  ' + m) });
    console.log(`  -> i EMMA: ${r.inEmma}, hadde: ${r.alreadyHave}, nye: ${r.newCollected}, via Linjer: ${r.viaLinjer}, feilet: ${(r.failed || []).length}`);
    reports.push({ from, to, ...r, failed: (r.failed || []).length });
  } catch (e) {
    console.log('  FEIL: ' + (e.stack || e.message));
    reports.push({ from, to, error: String(e.message) });
  }
}
console.log('\n=== OPPSUMMERING ===');
console.log(JSON.stringify({ window: win, reports: reports.map(({ db, ...r }) => r) }, null, 2));
await closeSession();
