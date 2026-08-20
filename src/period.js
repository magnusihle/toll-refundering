// Foreldelsesfrist / claim window.
//
// Krav om tilbakebetaling av toll og avgifter må fremmes innen **3 år** (jf.
// tolloven/skatteforvaltningslovens foreldelsesregler, regnet fra fortollings-
// tidspunktet). Alt vi henter og analyserer skal derfor være begrenset til de
// siste 3 årene, og "i dag" skal alltid regnes i **norsk tid** (Europe/Oslo) —
// ikke i serverens/maskinens lokale sone og ikke i UTC. En maskin satt til
// UTC ville rundt midnatt ellers regne feil dag og dermed feil frist.

export const TZ = 'Europe/Oslo';
export const CLAIM_YEARS = 3;

const FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

// Dagens dato i Norge som ISO yyyy-mm-dd (en-CA gir nettopp dette formatet).
export function osloToday(now = new Date()) {
  return FMT.format(now);
}

// Trekk fra n år på en ISO-dato. 29.02 klemmes til 28.02 (Date ville rullet til 01.03).
export function minusYears(iso, years) {
  const [y, m, d] = iso.split('-').map(Number);
  const ty = y - years;
  const last = new Date(Date.UTC(ty, m, 0)).getUTCDate(); // siste dag i måned m i år ty
  const td = Math.min(d, last);
  return `${ty}-${String(m).padStart(2, '0')}-${String(td).padStart(2, '0')}`;
}

export function addYears(iso, years) { return minusYears(iso, -years); }

// 3-årsvinduet: fra og med (i dag − 3 år) til og med i dag, norsk tid.
// Grensedagen tas MED: en deklarasjon fortollet nøyaktig 3 år siden har i dag
// sin siste frist for å kreve omberegning.
export function claimWindow({ years = CLAIM_YEARS, now = new Date() } = {}) {
  const to = osloToday(now);
  const from = minusYears(to, years);
  return { from, to, years, tz: TZ, computedAt: now.toISOString() };
}

const dayMs = 86400000;
function utcOf(iso) { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); }

// Siste dag et krav kan fremmes for en deklarasjon, og dager igjen.
export function claimDeadline(godkjentIso, win = claimWindow()) {
  if (!godkjentIso) return { deadline: null, daysLeft: null, expired: null };
  const deadline = addYears(godkjentIso, win.years);
  const daysLeft = Math.round((utcOf(deadline) - utcOf(win.to)) / dayMs);
  return { deadline, daysLeft, expired: daysLeft < 0 };
}

// Gyldig f.o.m./t.o.m.-sjekk for satser og nedsettelser (tomme grenser = åpne).
export function validOn(dateIso, fom, tom) {
  if (!dateIso) return null;
  if (fom && dateIso < fom) return false;
  if (tom && dateIso > tom) return false;
  return true;
}
