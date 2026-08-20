import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';
import { getDb } from './db.js';
import { insights } from './analysis.js';
import { claimWindow, claimDeadline } from './period.js';

// Assemble the API payload the React dashboard renders from. All money is NOK
// (customs computes in NOK); value_nok is the customs value (summed MVA-grunnlag)
// per declaration so multi-currency invoices become comparable without any FX.
export function dashboardData() {
  const d = getDb();
  const decls = d.prepare('SELECT * FROM declarations ORDER BY godkjent_iso DESC, tollnummer').all();
  const linesByToll = new Map();
  const lineById = new Map();
  for (const g of d.prepare('SELECT * FROM goods_lines').all()) {
    const l = { ...g, charges: [], docs: [] };
    if (!linesByToll.has(g.tollnummer)) linesByToll.set(g.tollnummer, []);
    linesByToll.get(g.tollnummer).push(l); lineById.set(g.id, l);
  }
  for (const c of d.prepare('SELECT * FROM line_charges').all()) { const l = lineById.get(c.goods_line_id); if (l) l.charges.push(c); }
  for (const doc of d.prepare('SELECT * FROM line_docs').all()) { const l = lineById.get(doc.goods_line_id); if (l) l.docs.push(doc); }

  const declarations = decls.map((x) => ({
    ...x,
    ...claimDeadlineFields(x.godkjent_iso),
    value_nok: Math.round(((x.mva_25 || 0) + (x.mva_15 || 0) + (x.mva_0 || 0)) * 100) / 100,
    lines: (linesByToll.get(x.tollnummer) || []).sort((a, b) => (a.item_number || 0) - (b.item_number || 0)),
  }));
  const goods = [];
  for (const dec of declarations) for (const l of dec.lines) goods.push({ tollnummer: dec.tollnummer, godkjent: dec.godkjent, godkjent_iso: dec.godkjent_iso, aktor: dec.aktor, ...l });

  const win = claimWindow();
  const meta = {
    generatedAt: new Date().toISOString(),
    // 3-årsfristen for tilbakebetaling, regnet i norsk tid
    claimWindow: win,
    inWindow: declarations.filter((x) => x.godkjent_iso && x.godkjent_iso >= win.from && x.godkjent_iso <= win.to).length,
    outsideWindow: declarations.filter((x) => x.godkjent_iso && x.godkjent_iso < win.from).length,
    declarations: declarations.length, goodsLines: goods.length,
    valueNok: sum(declarations.map((x) => x.value_nok)),
    mva25: sum(declarations.map((x) => x.mva_25)), mva15: sum(declarations.map((x) => x.mva_15)), mva0: sum(declarations.map((x) => x.mva_0)),
    processed: declarations.filter((x) => x.lines.length).length,
    empty: declarations.filter((x) => !x.lines.length).length,
    viaLinjer: declarations.filter((x) => x.line_source === 'linjer').length,
  };
  return { meta, declarations, goods, insights: insights() };
}
function claimDeadlineFields(godkjentIso) {
  const dl = claimDeadline(godkjentIso);
  return { claim_deadline: dl.deadline, days_left: dl.daysLeft, claim_expired: dl.expired };
}
const sum = (a) => Math.round(a.reduce((s, x) => s + (Number(x) || 0), 0) * 100) / 100;

// Ensure the React app is built (web/dist). Builds on first serve / when missing.
export function ensureWebBuilt({ force = false } = {}) {
  const web = path.join(ROOT, 'web');
  const dist = path.join(web, 'dist', 'index.html');
  if (!force && fs.existsSync(dist)) return { built: false, dist };
  if (!fs.existsSync(path.join(web, 'node_modules'))) {
    execFileSync('npm', ['install', '--silent', '--no-fund', '--no-audit'], { cwd: web, stdio: 'inherit' });
  }
  execFileSync('npm', ['run', 'build'], { cwd: web, stdio: 'inherit' });
  return { built: true, dist };
}
