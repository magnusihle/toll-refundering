import type { ClaimGroup } from '@/lib/recovery';
import { plural } from '@/lib/format';

// E-posten til 3PL er et KORT følgebrev — detaljene bor i Excel-vedlegget
// (lib/xlsx.ts), ikke i e-posten. Brukerens eneste jobb er å fylle inn
// mottaker, dra inn den nedlastede filen og trykke send.
//
// mailto: kan ikke legge ved filer; derfor lastes arbeidsboken ned i samme
// klikk, og teksten legges også på utklippstavlen som fallback.

const nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
const kr = (v: any) => `${nf.format(Math.round(Number(v) || 0))} kr`;

export type ClaimEmail = { subject: string; body: string; href: string };

export function buildClaimEmail(
  rows: any[],
  groups: ClaimGroup[],
  opts: { fileName: string; likely: number; ceiling: number; count: number; urgentCount: number },
): ClaimEmail {
  const days = rows.map((r) => r.dager_igjen).filter((d): d is number => d != null);
  const subject = `Anmodning om omberegning i TVINN — ${plural(opts.count, 'krav', 'krav')}, est. ${kr(opts.likely)}`
    + (opts.urgentCount ? ` (${opts.urgentCount} haster, korteste frist ${Math.min(...days)} dager)` : '');

  // Én linje per type — Produkt er datakvalitet (MVA er fradragsført), aldri «refusjon».
  const byKind = new Map<string, { count: number; amount: number }>();
  for (const r of rows) {
    const t = byKind.get(r.kind) || { count: 0, amount: 0 };
    t.count++; t.amount += r.amount_nok || 0;
    byKind.set(r.kind, t);
  }
  const kindLines = [...byKind.entries()].map(([kind, t]) =>
    kind === 'Produkt'
      ? `  • Produkt: ${plural(t.count, 'linje', 'linjer')} med inkonsekvent deklarering — datakvalitet som bes rettet fremover, ikke refusjonskrav.`
      : `  • ${kind}: ${plural(t.count, 'krav', 'krav')}, ${kr(t.amount)}${kind === 'RÅK' ? ' — vedtak finnes allerede, skrivnummer står i arket' : ''}.`);

  const body = [
    'Hei,',
    '',
    `vi har gjennomgått fortollingene våre for de siste tre årene og ber om omberegning i TVINN for ${plural(opts.count, 'krav', 'krav')} fordelt på ${plural(groups.length, 'sak', 'saker')}. Estimert gjenvinnbart beløp: ${kr(opts.likely)} (øvre tak ${kr(opts.ceiling)}).`,
    '',
    ...kindLines,
    ...(opts.urgentCount ? [`  • ${plural(opts.urgentCount, 'fortolling', 'fortollinger')} har under 90 dager igjen av 3-årsfristen — ta disse først (rød frist i arket).`] : []),
    '',
    `Alt underlag ligger i vedlagte ${opts.fileName}: fanen «Oversikt» prioriterer sakene, «Krav per fortolling» har én rad per krav med begrunnelse og utkast til kravtekst.`,
    '',
    'Vi ber om:',
    '  1. Bekreftelse på mottak, og hvilke poster dere tar videre.',
    '  2. Omberegning per fortolling — kravene kan ikke slås sammen.',
    '  3. At preferanse og RÅK-skrivnummer legges inn ved fremtidige fortollinger av disse varene.',
    '',
    'SAD-dokumenter og produktspesifikasjoner fremskaffes på forespørsel.',
    '',
    'Vennlig hilsen',
  ].join('\n');

  return { subject, body, href: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}
