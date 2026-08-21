#!/usr/bin/env node
// Andregangsvurdering (adversarial) av headless-dommer i data/pref-verdicts.json.
//
// assess-pref er én enkelt agent-pass per gruppe. Før noen signerer kravtekst
// på en «høy»/«middels»-dom bør en UAVHENGIG skeptiker ha forsøkt å felle den:
// dette scriptet sender hver slik dom (source: 'assess-pref', uten
// second_opinion) til `claude -p` med instruks om å MOTBEVISE — slå opp begge
// varenumre i tolltariffen og finne feilen. Utfall:
//   opprettholdes  -> second_opinion lagres (bekreftet, med kommentar)
//   felles         -> likelihood/beløp NEDGRADERES (aldri oppgraderes),
//                     kommentaren legges synlig i begrunnelsen
// Kun dommer med source-stempel røres — de opprinnelige 45 (multi-agent-
// vurdert) er utenfor målgruppen. Skrives etter hver ferdige batch.
//
//   npm run verify               # alle uverifiserte høy/middels headless-dommer
//   npm run verify -- --dry-run  # vis arbeidslisten og prompten
//   flagg: --batch N (default 4) · --parallel N (default 4) · --model <id>

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT } from '../src/config.js';

const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] != null ? args[i + 1] : dflt; };
const BATCH = Math.max(1, Number(flag('batch', 4)));
const PARALLEL = Math.max(1, Number(flag('parallel', 4)));
const MODEL = flag('model', null);
const DRY = args.includes('--dry-run');

const FILE = path.join(ROOT, 'data', 'pref-verdicts.json');
const store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
store.verdicts = store.verdicts || {};

const targets = Object.values(store.verdicts).filter((v) =>
  v.source === 'assess-pref' && ['høy', 'middels'].includes(v.likelihood) && !v.second_opinion);
if (!targets.length) {
  console.log('Ingenting å verifisere — alle headless høy/middels-dommer har andregangsvurdering.');
  process.exit(0);
}
console.log(`${targets.length} høy/middels-dommer uten andregangsvurdering (${targets.reduce((s, v) => s + (v.realistisk_belop || 0), 0)} kr påstått gjenvinnbart).`);

function promptFor(batch) {
  const list = batch.map((v, i) => {
    const [hs, desc, origin] = v.key.split('|');
    return `${i + 1}. key: ${v.key}
   Vare: «${desc}» · deklarert varenummer ${hs} · opprinnelse ${origin}
   Dommen som skal etterprøves: likelihood ${v.likelihood}, realistisk beløp ${v.realistisk_belop} kr, mekanisme ${v.mekanisme}${v.foreslatt_hs ? `, foreslått varenummer ${v.foreslatt_hs} (${v.foreslatt_sats ?? '?'} kr/kg)` : ''}.
   Begrunnelsen dommen ga: ${v.begrunnelse}`;
  }).join('\n');
  return `Du er en SKEPTISK andregangsvurderer av krav om tollrefusjon i Norge. En første agent har konkludert med at varene under trolig er feilklassifisert og at toll kan kreves tilbake. Din jobb er å FORSØKE Å FELLE hver dom: slå opp BÅDE det deklarerte og det foreslåtte varenummeret i tolltariffen (tolltariffen.toll.no), kontroller satsene, og let aktivt etter grunner til at dommen er feil — f.eks. at HS-forklarende anmerkninger plasserer varen der den ble deklarert (typisk: kosttilskudd i detaljpakning hører i 21.06 uansett urteinnhold), at foreslått sats er feil, eller at beløpet er urealistisk. Vær streng: ved reell tvil skal dommen felles eller nedgraderes. En dom skal bare opprettholdes når klassifiseringsargumentet tåler motargumentene.

Dommer:
${list}

Svar med KUN gyldig JSON (ingen markdown), på formen:
{"reviews":[{"key":"<nøyaktig key>","opprettholdes":true|false,"ny_likelihood":"høy"|"middels"|"lav"|"ingen"|null,"ny_belop":<tall NOK eller null>,"kommentar":"<1–3 setninger: hva du kontrollerte og hvorfor dommen står/faller, med kildehenvisning>"}]}
Én review per dom, i samme rekkefølge. ny_likelihood/ny_belop settes bare når opprettholdes=false (null ellers).`;
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
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return reject(new Error('Fant ingen JSON i agent-svaret: ' + text.slice(0, 300)));
      try { resolve(JSON.parse(m[0])); } catch (e) { reject(e); }
    });
  });
}

const DOWN = ['høy', 'middels', 'lav', 'ingen']; // rekkefølgen definerer «ned»
let confirmed = 0, downgraded = 0, doneBatches = 0;

function mergeBatch(batch, out) {
  const byKey = new Map(batch.map((v) => [v.key, v]));
  for (const r of out?.reviews || []) {
    const v = byKey.get(r?.key);
    if (!v) { console.error(`  Forkastet review: ukjent key «${r?.key}»`); continue; }
    if (typeof r.kommentar !== 'string' || r.kommentar.length < 20) { console.error(`  Forkastet review for ${r.key}: kommentar mangler`); continue; }
    const today = new Date().toISOString().slice(0, 10);
    if (r.opprettholdes) {
      v.second_opinion = { at: today, opprettholdes: true, kommentar: r.kommentar };
      confirmed++;
      console.log(`  ✓ opprettholdt: ${v.key.split('|')[1].slice(0, 45)} (${v.likelihood}, ${v.realistisk_belop} kr)`);
    } else {
      // Kun nedgradering: ny likelihood må ligge lenger ned i DOWN, beløp aldri opp.
      const cur = DOWN.indexOf(v.likelihood);
      const nyIdx = DOWN.indexOf(r.ny_likelihood);
      const lik = nyIdx > cur ? r.ny_likelihood : 'lav';
      const belop = Math.min(Number(r.ny_belop) || 0, v.realistisk_belop || 0);
      v.second_opinion = { at: today, opprettholdes: false, kommentar: r.kommentar, forrige: { likelihood: v.likelihood, realistisk_belop: v.realistisk_belop } };
      v.likelihood = lik;
      v.realistisk_belop = lik === 'ingen' ? 0 : belop;
      v.begrunnelse += ` Andregangsvurdering (${today}): ${r.kommentar}`;
      downgraded++;
      console.log(`  ▼ nedgradert: ${v.key.split('|')[1].slice(0, 45)} → ${lik}${v.realistisk_belop ? `, ${v.realistisk_belop} kr` : ''}`);
    }
  }
  fs.writeFileSync(FILE, JSON.stringify(store, null, 1) + '\n');
}

const batches = [];
for (let i = 0; i < targets.length; i += BATCH) batches.push(targets.slice(i, i + BATCH));

if (DRY) {
  console.log(`\n${batches.length} batcher à ≤${BATCH} dommer, ${PARALLEL} parallelt. Første prompt:\n`);
  console.log(promptFor(batches[0]));
  process.exit(0);
}

let next = 0;
async function worker() {
  while (next < batches.length) {
    const idx = next++;
    const batch = batches[idx];
    try { mergeBatch(batch, await runAgent(promptFor(batch))); }
    catch (e) { console.error(`  Batch ${idx + 1} feilet, hopper videre: ${e.message}`); }
    doneBatches++;
    console.log(`— ${doneBatches}/${batches.length} batcher ferdig (${confirmed} opprettholdt, ${downgraded} nedgradert)`);
  }
}
await Promise.all(Array.from({ length: Math.min(PARALLEL, batches.length) }, () => worker()));

console.log(`\nFerdig: ${confirmed} dommer opprettholdt, ${downgraded} nedgradert (data/pref-verdicts.json).`);
console.log('Dashbordet plukker endringene opp ved neste innlasting; kjør `npm run publish` for prod.');
