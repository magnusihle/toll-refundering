// Felles vareidentitet for desc:-grenen av productKey (src/pipeline.js), normProd
// (web/src/lib/recovery.ts) og identity-fallback (web/src/lib/group.ts). Rører
// ALDRI prefKey/raak-verdicts-nøkler (de bruker rå beskrivelse, se docs/PLAN.md).

const ARTICLE_PREFIX = /^\d[\d ,.]*/;
const PACKAGING_SIZE = /\d+\s*(g|gr|kg|ml|l|stk|mg|kaps?|tabl)\b/gi;
const PUNCTUATION = /[.,;:/\\()[\]"'!?]/g;

export function normalizeProductText(desc) {
  if (!desc) return '';
  let s = String(desc).trim();
  s = s.replace(ARTICLE_PREFIX, '');
  s = s.toLowerCase();
  s = s.replace(PACKAGING_SIZE, ' ');
  s = s.replace(PUNCTUATION, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}
