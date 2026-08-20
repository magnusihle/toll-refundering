import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';

// BKU/CO — Tolletatens klassifiseringsuttalelser som BEVIS på et krav.
//
// En «bindende klassifiseringsuttalelse» (bku…) er tolletatens egen avgjørelse av
// hvordan en bestemt vare skal klassifiseres; «co…» er WCO/EU-uttalelser. Når vår
// agent hevder at et varenummer er feil, er nærmeste ting til fasit en uttalelse
// der myndigheten selv har plassert en tilsvarende vare.
//
// VIKTIG FORBEHOLD: en uttalelse gjelder VAREN DEN GJELDER. Den er presedens for
// vår vare, ikke et vedtak om den. Derfor merker vi hver treff med hvor godt
// produktteksten faktisk ligner — og skiller «støtter» (samme kode OG lignende
// vare) fra «presedens» (samme kode, annen vare).

let CACHE = null;

function corpus() {
  if (CACHE) return CACHE;
  const file = path.join(ROOT, 'data', 'bku-rulings.json');
  if (!fs.existsSync(file)) { CACHE = { rulings: [], docs: [] }; return CACHE; }

  const rulings = JSON.parse(fs.readFileSync(file, 'utf8')).rulings || [];
  // IDF over hele korpuset: ord som «kosttilskudd» sier lite, «lindeblomst» sier alt.
  // Trigram per uttalelse. Varetypen teller dobbelt — den er varens navn,
  // beskrivelsen er ingredienslista.
  const docs = rulings.map((r) => ({
    r, g: trigrams(`${r.itemType} ${r.itemType} ${r.description}`),
  }));
  CACHE = { rulings, docs };
  return CACHE;
}

const STOP = new Set(('og i av til for som er en et den det på med kan skal ble var fra ved om under over per stk gram kg pose eske pakke '
  + 'innhold ingredienser varen produktet emballasje bruk brukes daglig samt eller ikke har inn ut ca stk').split(' '));

function tokens(s) {
  return String(s || '').toLowerCase().normalize('NFC')
    .replace(/[^a-zæøå0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** «12119000» / «12.11.9000» / «1211.90» → «12.11.9000» (eller null). */
export function normCode(code) {
  const d = String(code || '').replace(/\D/g, '');
  if (d.length < 6) return null;
  const p = d.padEnd(8, '0').slice(0, 8);
  return `${p.slice(0, 2)}.${p.slice(2, 4)}.${p.slice(4, 8)}`;
}

/**
 * Likhet mellom varetekstene, målt på tegn-trigram.
 *
 * Ordoverlapp virker ikke her: norsk setter sammen ord, så «rødkløverblomst» og
 * «lindeblomst» deler ikke ett eneste token — men de deler trigrammene «blo lom
 * oms mst», som er nettopp det som gjør dem til samme slags vare. Rene tall
 * (pakningsstørrelser, artikkelnummer) er tatt ut først; de fikk ellers «100 %
 * kamille» til å matche «100 g rødkløverblomst» perfekt.
 */
function trigrams(s) {
  const t = ' ' + String(s || '').toLowerCase().normalize('NFC')
    .replace(/[^a-zæøå ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  const out = new Set();
  for (let i = 0; i < t.length - 2; i++) {
    const g = t.slice(i, i + 3);
    if (g !== '   ') out.add(g);
  }
  return out;
}

/** Andel av varetekstens trigram som gjenfinnes i uttalelsen. */
function similarity(queryGrams, docGrams) {
  if (!queryGrams.size) return 0;
  let hit = 0;
  for (const g of queryGrams) if (docGrams.has(g)) hit++;
  return hit / queryGrams.size;
}

/**
 * Presedens for ett krav.
 *
 * Vi feller INGEN dom. Et forsøk på å la likhetsscoren avgjøre «støtter/motsier»
 * ga falske avvisninger — «Omelettblanding i pulverform» kom ut som 0,71 lik
 * «PLENT MARINE COLLAGEN», fordi to lange norske varetekster deler trigram uten
 * å være samme vare. Et feilaktig «motsier» ville drept et reelt krav, og det er
 * verre enn å vise ingenting.
 *
 * Så: vi viser hva tolletaten faktisk HAR plassert under de to kodene — den
 * agenten foreslår, og den som ble brukt — sortert etter likhet, og lar
 * mennesket lese. En uttalelse om lindeblomst-te er ekte presedens for tørket
 * rødkløverblomst, men den er ikke et vedtak om den, og skal ikke utgi seg for
 * å være det.
 *
 * @returns { proposed[], declared[] } — uttalelser under hver kode, sterkeste først
 */
export function bkuEvidence({ description, declaredCode, proposedCode, perCode = 3 }) {
  const { docs } = corpus();
  if (!docs.length) return { proposed: [], declared: [] };

  const proposed = normCode(proposedCode);
  const declared = normCode(declaredCode);
  if (!proposed && !declared) return { proposed: [], declared: [] };

  // Artikkelnummer og pakningsstørrelser bærer ingen vareinformasjon.
  const q = trigrams(String(description || '').replace(/[\d.,]+\s*(g|kg|ml|l|stk|mg)?\b/gi, ' '));

  const pick = (code) => {
    if (!code) return [];
    return docs
      .filter((d) => normCode(d.r.code) === code)
      .map((d) => ({ d, score: similarity(q, d.g) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, perCode)
      .map(({ d, score }) => ({
        id: d.r.id,
        code,
        kind: d.r.id.startsWith('co') ? 'co' : 'bku',
        binding: !d.r.id.startsWith('co'),
        itemType: d.r.itemType,
        description: String(d.r.description || '').slice(0, 240),
        publishDate: d.r.publishDate,
        similarity: Math.round(score * 100) / 100,
        link: `https://varenummer.toll.no/?q=${encodeURIComponent(d.r.id)}`,
      }));
  };

  // Når agenten mener koden er riktig men satsen feil, er de to listene like —
  // da er «deklarert» bare støy.
  const same = proposed && declared && proposed === declared;
  return { proposed: pick(proposed), declared: same ? [] : pick(declared) };
}

export function bkuMeta() {
  const { rulings } = corpus();
  return { count: rulings.length, loaded: rulings.length > 0 };
}
