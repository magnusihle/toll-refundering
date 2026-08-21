#!/usr/bin/env node
// Headless agent-vurdering av preferanselinjer som ennå ikke har dom.
//
// Lukker gapet dashbordet rapporterer som «ennå ikke agent-vurdert»: grupper
// uten dom sendes i batcher til `claude -p` (headless, med websøk mot
// tolltariffen.toll.no), som feller samme type dom som de eksisterende i
// data/pref-verdicts.json — samme nøkkel, samme skjema. Batchene kjører
// parallelt (pool), og dommene merges/skrives etter hvert som batcher blir
// ferdige — en avbrutt kjøring beholder fremdriften, og analysen
// (src/analysis.js) plukker dem opp på neste innlasting (mtime-cache).
//
//   npm run assess              # vurder alle uvurderte grupper innenfor fristen
//   npm run assess -- --top 10  # kun de 10 største etter betalt toll
//   npm run assess -- --dry-run # vis arbeidslisten og prompten, ikke kjør agent
//   flagg: --batch N (default 5) · --parallel N (default 4) · --model <id>
//
// Beløpsdisiplin (som før): realistisk_belop gjelder HELE gruppen og fordeles
// forholdsmessig per linje i analysen; likelihood «ingen» => 0 kr og posten
// flyttes til «ikke grunnlag»-fanen.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { preferenceOpportunities } from '../src/analysis.js';
import { ROOT } from '../src/config.js';

const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] != null ? args[i + 1] : dflt; };
const TOP = Number(flag('top', Infinity));
const BATCH = Math.max(1, Number(flag('batch', 5)));
const PARALLEL = Math.max(1, Number(flag('parallel', 4)));
const MODEL = flag('model', null);
const DRY = args.includes('--dry-run');

const FILE = path.join(ROOT, 'data', 'pref-verdicts.json');
const store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
store.verdicts = store.verdicts || {};

const pref = preferenceOpportunities();
const groups = (pref.unassessed?.groups || []).filter((g) => !store.verdicts[g.key]).slice(0, TOP === 0 ? 0 : TOP || Infinity);
if (!groups.length) {
  console.log('Ingenting å vurdere — alle uvurderte grupper innenfor fristen har allerede dom.');
  process.exit(0);
}
console.log(`${groups.length} grupper uten dom (av ${pref.unassessed.count} uvurderte linjer), samlet betalt toll ${groups.reduce((s, g) => s + g.paid, 0).toFixed(0)} kr.`);

const LIKELIHOODS = new Set(['høy', 'middels', 'lav', 'ingen']);

function promptFor(batch) {
  const list = batch.map((g, i) => `${i + 1}. key: ${g.key}
   Vare: «${g.description}» · varenummer ${g.hs_code} · opprinnelse ${g.origin} · leverandør ${g.aktor || 'ukjent'}
   Betalt toll (hele gruppen): ${g.paid} kr fordelt på ${g.lines} varelinjer (tollnummer ${g.tollnummers.slice(0, 8).join(', ')}${g.tollnummers.length > 8 ? ', …' : ''})`).join('\n');
  return `Du vurderer norske fortollinger for mulig overbetalt toll. Varene under er LANDBRUKSVARER (HS kap. 1–24) med EØS-opphav der full toll ble betalt. EØS-preferanse gir IKKE tollfritak for kap. 1–24 — gjenvinning krever enten (a) at varenummeret er FEIL og riktig varenummer har lavere/null sats (feilklassifisering), eller (b) en lavere varespesifikk avtalesats. Ikke anta refusjon uten konkret grunnlag.

For HVER gruppe: slå opp det deklarerte varenummeret i tolltariffen (tolltariffen.toll.no) og vurder om varebeskrivelsen plausibelt hører hjemme der. Hvis ikke: finn riktig varenummer og dets ordinære sats, og verifiser satsen i tolltariffen. Regn realistisk gjenvinnbart beløp for HELE gruppen (aldri mer enn betalt toll; 0 hvis tollen er korrekt).

Grupper:
${list}

Svar med KUN gyldig JSON (ingen markdown, ingen forklaring rundt), på formen:
{"verdicts":[{"key":"<nøyaktig key fra listen>","hs_plausibel":true|false,"foreslatt_hs":"xx.xx.xxxx"|null,"foreslatt_sats":<tall kr/kg eller null>,"verifisert_sats":true|false,"likelihood":"høy"|"middels"|"lav"|"ingen","realistisk_belop":<NOK for hele gruppen>,"mekanisme":"feilklassifisering"|"avtalesats"|"ingen","begrunnelse":"<2–5 setninger med kildehenvisning til tolltariffen>","krav_utkast":"<forslag til krav-tekst til speditør, jf. tollavgiftsloven § 9-4, eller null ved likelihood ingen>"}]}
Én verdict per gruppe, i samme rekkefølge.`;
}

function runAgent(prompt) {
  return new Promise((resolve, reject) => {
    const cliArgs = ['-p', prompt, '--output-format', 'json', '--allowedTools', 'WebSearch', 'WebFetch'];
    if (MODEL) cliArgs.push('--model', MODEL);
    const child = spawn('claude', cliArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => reject(e.code === 'ENOENT' ? new Error('Fant ikke `claude` i PATH') : e));
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`claude avsluttet med kode ${code}: ${err.slice(0, 400)}`));
      let text = out.trim();
      try { const env = JSON.parse(text); if (env && typeof env.result === 'string') text = env.result; } catch {}
      const m = text.match(/\{[\s\S]*\}/); // tåler ```json-gjerder og småprat rundt
      if (!m) return reject(new Error('Fant ingen JSON i agent-svaret: ' + text.slice(0, 300)));
      try { resolve(JSON.parse(m[0])); } catch (e) { reject(e); }
    });
  });
}

function validate(v, byKey) {
  const g = byKey.get(v?.key);
  if (!g) return `ukjent key «${v?.key}»`;
  if (!LIKELIHOODS.has(v.likelihood)) return `ugyldig likelihood «${v.likelihood}»`;
  if (typeof v.begrunnelse !== 'string' || v.begrunnelse.length < 40) return 'begrunnelse mangler/for kort';
  let belop = Number(v.realistisk_belop) || 0;
  if (v.likelihood === 'ingen') belop = 0;
  v.realistisk_belop = Math.min(Math.max(0, belop), Math.ceil(g.paid)); // aldri over betalt toll
  return null;
}

const batches = [];
for (let i = 0; i < groups.length; i += BATCH) batches.push(groups.slice(i, i + BATCH));
let saved = 0, noBasis = 0, doneBatches = 0;

// Merging og skriving skjer i hoved-tråden (én om gangen), så parallelle
// batcher kan ikke overskrive hverandres dommer.
function mergeBatch(batch, out) {
  const byKey = new Map(batch.map((g) => [g.key, g]));
  for (const v of out?.verdicts || []) {
    const err = validate(v, byKey);
    if (err) { console.error(`  Forkastet dom: ${err}`); continue; }
    // `source` gjør dommene sporbare til headless-kjøringen — scripts/verify-pref.mjs
    // andregangsvurderer høy/middels-dommer med denne stemplingen.
    store.verdicts[v.key] = { key: v.key, hs_plausibel: !!v.hs_plausibel, foreslatt_hs: v.foreslatt_hs || null, foreslatt_sats: v.foreslatt_sats ?? null, verifisert_sats: !!v.verifisert_sats, likelihood: v.likelihood, realistisk_belop: v.realistisk_belop, mekanisme: v.mekanisme || (v.likelihood === 'ingen' ? 'ingen' : 'ukjent'), begrunnelse: v.begrunnelse, krav_utkast: v.krav_utkast || null, source: 'assess-pref' };
    saved++; if (v.likelihood === 'ingen') noBasis++;
    console.log(`  ${v.likelihood === 'ingen' ? '∅' : '✓'} ${byKey.get(v.key).description.slice(0, 45)} → ${v.likelihood}${v.realistisk_belop ? `, ${v.realistisk_belop} kr` : ''}`);
  }
  store.generatedAt = new Date().toISOString().slice(0, 10);
  if (!/headless assess-pref/.test(store.method || '')) store.method = (store.method || '') + ' + headless assess-pref (scripts/assess-pref.mjs)';
  fs.writeFileSync(FILE, JSON.stringify(store, null, 1) + '\n');
}

if (DRY) {
  console.log(`\n${batches.length} batcher à ≤${BATCH} grupper, ${PARALLEL} parallelt. Første prompt:\n`);
  console.log(promptFor(batches[0]));
  process.exit(0);
}

let next = 0;
async function worker(id) {
  while (next < batches.length) {
    const idx = next++;
    const batch = batches[idx];
    try {
      const out = await runAgent(promptFor(batch));
      mergeBatch(batch, out);
    } catch (e) {
      console.error(`  Batch ${idx + 1} feilet, hopper videre: ${e.message}`);
    }
    doneBatches++;
    console.log(`— ${doneBatches}/${batches.length} batcher ferdig (${saved} dommer lagret)`);
  }
}
await Promise.all(Array.from({ length: Math.min(PARALLEL, batches.length) }, (_, i) => worker(i)));

console.log(`\nLagret ${saved} nye dommer i data/pref-verdicts.json (${noBasis} uten grunnlag).`);
console.log('Dashbordet plukker dem opp ved neste innlasting; kjør `npm run publish` for å oppdatere prod.');
