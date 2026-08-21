import { confLabel, type ClaimGroup } from '@/lib/recovery';

// Excel-arbeidsboken er vedlegget 3PL faktisk jobber i — detaljene bor HER,
// ikke i e-posten. Tre faner:
//   «Oversikt»           én rad per sak (produkt × leverandør × type), sortert
//                        haster først, så beløp. Det 3PL prioriterer etter.
//   «Krav per fortolling» én rad per krav — begrunnelse, neste steg og utkast
//                        til kravtekst. Det 3PL omberegner etter.
//   «Om»                 hva kolonnene betyr og hvordan tallene er vurdert.
// exceljs importeres dynamisk: ~1 MB som ikke skal inn i hovedbunten.

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } as const;
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } } as const;
const URGENT_FONT = { color: { argb: 'FFB91C1C' }, bold: true } as const;
const NOK_FMT = '#,##0 "kr"';

const likLabel = (v: any) => (v ? String(v) : '');

export async function buildClaimWorkbook(rows: any[], groups: ClaimGroup[]) {
  // exceljs er CJS — avhengig av bundler/runtime ligger Workbook på modulen
  // eller på default. Håndter begge, ellers smeller det i den ene av dem.
  const mod: any = await import('exceljs');
  const Workbook = mod.Workbook ?? mod.default?.Workbook ?? mod.default;
  const wb = new Workbook();
  wb.creator = 'toll-refundering';
  wb.created = new Date();

  // ---- Fane 1: Oversikt (én rad per sak) ----
  const ov = wb.addWorksheet('Oversikt', { views: [{ state: 'frozen', ySplit: 1 }] });
  ov.columns = [
    { header: 'Prioritet', key: 'pri', width: 9 },
    { header: 'Produkt', key: 'produkt', width: 36 },
    { header: 'Leverandør', key: 'aktor', width: 24 },
    { header: 'Type', key: 'kind', width: 11 },
    { header: 'Fortollinger', key: 'antall', width: 12 },
    { header: 'Beløp (NOK)', key: 'belop', width: 13, style: { numFmt: NOK_FMT } },
    { header: 'Første frist', key: 'frist', width: 12 },
    { header: 'Dager igjen', key: 'dager', width: 11 },
    { header: 'Vurdering', key: 'match', width: 22 },
    { header: 'Sannsynlighet', key: 'lik', width: 13 },
    { header: 'Tollnummer', key: 'tollnummer', width: 40 },
  ];
  const ordered = [...groups].sort((a, b) => {
    const ua = a.dager_igjen != null && a.dager_igjen <= 90 ? 1 : 0;
    const ub = b.dager_igjen != null && b.dager_igjen <= 90 ? 1 : 0;
    return ub - ua || b.amount_nok - a.amount_nok;
  });
  ordered.forEach((g, i) => {
    const urgent = g.dager_igjen != null && g.dager_igjen <= 90;
    const row = ov.addRow({
      pri: i + 1, produkt: g.produkt, aktor: g.aktor ?? '', kind: g.kind,
      antall: g.tollnummers.length || g.count, belop: Math.round(g.amount_nok),
      frist: g.frist ?? '', dager: g.dager_igjen ?? '',
      match: g.confidences.map(confLabel).join(', '), lik: g.likelihoods.map(likLabel).filter(Boolean).join(', '),
      tollnummer: g.tollnummers.join(', '),
    });
    if (urgent) { row.getCell('frist').font = URGENT_FONT; row.getCell('dager').font = URGENT_FONT; }
  });
  const sumRow = ov.addRow({ produkt: 'SUM', belop: Math.round(groups.reduce((s, g) => s + g.amount_nok, 0)) });
  sumRow.font = { bold: true };

  // ---- Fane 2: Krav per fortolling (flat — det som omberegnes) ----
  const kr = wb.addWorksheet('Krav per fortolling', { views: [{ state: 'frozen', ySplit: 1 }] });
  kr.columns = [
    { header: 'Type', key: 'kind', width: 11 },
    { header: 'Tollnummer', key: 'tollnummer', width: 18 },
    { header: 'Fortollet', key: 'godkjent', width: 11 },
    { header: 'Leverandør', key: 'aktor', width: 24 },
    { header: 'Produkt', key: 'produkt', width: 34 },
    { header: 'Beløp (NOK)', key: 'belop', width: 13, style: { numFmt: NOK_FMT } },
    { header: 'Frist', key: 'frist', width: 12 },
    { header: 'Dager igjen', key: 'dager', width: 11 },
    { header: 'Vurdering', key: 'match', width: 20 },
    { header: 'Sannsynlighet', key: 'lik', width: 13 },
    { header: 'Hva det er', key: 'summary', width: 70, style: { alignment: { wrapText: true, vertical: 'top' } } },
    { header: 'Neste steg', key: 'action', width: 70, style: { alignment: { wrapText: true, vertical: 'top' } } },
    { header: 'Utkast til kravtekst', key: 'draft', width: 70, style: { alignment: { wrapText: true, vertical: 'top' } } },
  ];
  const flat = [...rows].sort((a, b) => (a.dager_igjen ?? Infinity) - (b.dager_igjen ?? Infinity) || (b.amount_nok || 0) - (a.amount_nok || 0));
  for (const r of flat) {
    const row = kr.addRow({
      kind: r.kind, tollnummer: r.tollnummer ?? '', godkjent: r.godkjent ?? '', aktor: r.aktor ?? '',
      produkt: r.produkt, belop: Math.round(r.amount_nok || 0), frist: r.frist ?? '', dager: r.dager_igjen ?? '',
      match: confLabel(r.confidence), lik: likLabel(r.likelihood),
      summary: r.summary ?? '', action: r.action ?? '', draft: r.claim_draft ?? '',
    });
    if (r.dager_igjen != null && r.dager_igjen <= 90) { row.getCell('frist').font = URGENT_FONT; row.getCell('dager').font = URGENT_FONT; }
  }

  // ---- Fane 3: Om ----
  const om = wb.addWorksheet('Om');
  om.columns = [{ width: 110 }];
  [
    `Generert ${new Date().toISOString().slice(0, 10)} av toll-refundering (EMMA EDOC-analyse).`,
    '',
    '«Oversikt» har én rad per sak (samme produkt fra samme leverandør). «Krav per fortolling» har én rad per krav —',
    'hver fortolling må omberegnes for seg i TVINN, og radene der har begrunnelse og utkast til kravtekst.',
    '',
    'Vurdering: «agent-vurdert» betyr at varenummer og sats er slått opp i tolltariffen og beløpet er satt til det',
    'realistisk gjenvinnbare (ikke hele den betalte tollen). Sannsynlighet (høy/middels/lav) er den vurderte sjansen',
    'for at kravet fører frem. Rød frist = under 90 dager igjen av 3-årsfristen — ta disse først.',
    '',
    'Type: RÅK = innvilget tollnedsettelse ble ikke brukt (skrivnummer står i «Neste steg»). Preferanse = EØS-opphav',
    'uten at preferanse/riktig klassifisering ble krevd. Produkt = samme vare deklarert ulikt (datakvalitet — rettes',
    'fremover, ikke refusjonskrav).',
  ].forEach((t) => om.addRow([t]));

  for (const ws of [ov, kr]) {
    ws.getRow(1).font = { ...HEADER_FONT };
    ws.getRow(1).fill = { ...HEADER_FILL } as any;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  }

  return wb;
}

export async function exportXlsx(rows: any[], groups: ClaimGroup[], fileName: string) {
  const wb = await buildClaimWorkbook(rows, groups);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = fileName; a.click();
  URL.revokeObjectURL(a.href);
}
