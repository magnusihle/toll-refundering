import { confLabel, splitByMateriality, SMALL_CLAIM_NOK, type ClaimGroup } from '@/lib/recovery';

// Excel-arbeidsboken er vedlegget 3PL faktisk jobber i — detaljene bor HER,
// ikke i e-posten. Tre faner:
//   «Oversikt»           én rad per sak (produkt × leverandør × type), sortert
//                        haster først, så beløp. Det 3PL prioriterer etter.
//   «Krav per fortolling» én rad per krav — begrunnelse, neste steg og utkast
//                        til kravtekst. Det 3PL omberegner etter.
//   «Småkrav»            saker under materialitetsgrensen — én rad per sak,
//                        tas ved anledning, blander ikke støy inn i hovedlisten.
//   «Om»                 hva kolonnene betyr og hvordan tallene er vurdert.
// exceljs importeres dynamisk: ~1 MB som ikke skal inn i hovedbunten.

// Merkevarefarger og typografi — fra kit/tokens.json / refund/DESIGN.md.
// Arbeidsboken er vedlegget 3PL faktisk jobber i, så den følger appens
// «regnskapsbok»-formspråk, ikke et admin-dashboard: ingen fylt topprad,
// ingen sebrastriper — kolonnetitler er eyebrows, radene skilles av én
// hårfin strek. (Erstatter Tailwind slate-800/red-700, som ikke finnes
// i paletten.)
const FONT_NAME = 'Helvetica Neue'; // DESIGN.md-fontstacken; Office faller tilbake til Arial
const INK = 'FF17231D'; // ink — brødtekst
const INK_SOFT = 'FF4F5B54'; // ink-soft — kolonnetitler
const LINE = 'FFD7D2C7'; // line — hårfin strek under kolonnetitlene
const BORDER_STRONG = 'FFE4DFD3'; // border-strong — hårfin strek per datarad
const DESTRUCTIVE = 'FF9C2A19'; // destructive — reservert for frist som haster
const FOREST = 'FF153E31'; // forest — arkfanefarge

const BODY_FONT = { name: FONT_NAME, size: 12, color: { argb: INK } } as const; // type_pt.body
const HEADER_FONT = { name: FONT_NAME, size: 11, color: { argb: INK_SOFT } } as const; // type_pt.caption, ikke bold
const SUM_FONT = { name: FONT_NAME, size: 12, bold: true, color: { argb: INK } } as const; // bold er kun tillatt i sumlinjer
const URGENT_FONT = { name: FONT_NAME, size: 12, color: { argb: DESTRUCTIVE } } as const;
const TITLE_FONT = { name: FONT_NAME, size: 24, color: { argb: INK } } as const; // type_pt.h2 — «Om»-tittel

const HEADER_BORDER = { bottom: { style: 'hair', color: { argb: LINE } } } as const;
const ROW_BORDER = { bottom: { style: 'hair', color: { argb: BORDER_STRONG } } } as const;
const SUM_BORDER = { top: { style: 'hair', color: { argb: INK } } } as const;

// Statusfarge alene er forbudt (DESIGN.md) — en fargeblind leser skal se
// hastegraden uten fargesyn, derfor en tekstmarkør foran verdien.
const URGENT_MARK = '! ';

const NOK_FMT = '#,##0 "kr"';

const likLabel = (v: any) => (v ? String(v) : '');
// Kolonnetitler er eyebrows — versaler, håndterer æøå riktig.
const H = (s: string) => s.toLocaleUpperCase('nb-NO');

// Setter grunnfont + hårfin bunnkant på alle celler i en datarad.
function styleDataRow(row: any) {
  row.eachCell({ includeEmpty: true }, (cell: any) => {
    cell.font = { ...BODY_FONT };
    cell.border = ROW_BORDER;
  });
}

// Markerer «frist»/«dager igjen» når fristen haster: destructive-farge +
// tekstmarkør, aldri farge alene.
function markUrgent(row: any) {
  const frist = row.getCell('frist');
  if (frist.value !== '' && frist.value != null) {
    frist.value = `${URGENT_MARK}${frist.value}`;
    frist.font = { ...URGENT_FONT };
  }
  const dager = row.getCell('dager');
  if (dager.value !== '' && dager.value != null) {
    dager.value = `${URGENT_MARK}${dager.value} dager`;
    dager.font = { ...URGENT_FONT };
  }
}

export async function buildClaimWorkbook(rows: any[], groups: ClaimGroup[]) {
  // exceljs er CJS — avhengig av bundler/runtime ligger Workbook på modulen
  // eller på default. Håndter begge, ellers smeller det i den ene av dem.
  const mod: any = await import('exceljs');
  const Workbook = mod.Workbook ?? mod.default?.Workbook ?? mod.default;
  const wb = new Workbook();
  wb.creator = 'toll-refundering';
  wb.created = new Date();

  // Hovedfanene inneholder bare de materielle sakene; småkravene får egen fane.
  const { material, small } = splitByMateriality(groups);
  const materialRows = material.flatMap((g) => g.claims);

  // ---- Fane 1: Oversikt (én rad per sak) ----
  const ov = wb.addWorksheet('Oversikt', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  ov.properties.tabColor = { argb: FOREST };
  ov.columns = [
    { header: H('Prioritet'), key: 'pri', width: 9 },
    { header: H('Produkt'), key: 'produkt', width: 36 },
    { header: H('Leverandør'), key: 'aktor', width: 24 },
    { header: H('Type'), key: 'kind', width: 11 },
    { header: H('Fortollinger'), key: 'antall', width: 12 },
    { header: H('Beløp (NOK)'), key: 'belop', width: 13, style: { numFmt: NOK_FMT } },
    { header: H('Første frist'), key: 'frist', width: 12 },
    { header: H('Dager igjen'), key: 'dager', width: 11 },
    { header: H('Vurdering'), key: 'match', width: 22 },
    { header: H('Sannsynlighet'), key: 'lik', width: 13 },
    { header: H('Tollnummer'), key: 'tollnummer', width: 40 },
  ];
  const ordered = [...material].sort((a, b) => {
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
    styleDataRow(row);
    if (urgent) markUrgent(row);
  });
  const sumRow = ov.addRow({ produkt: 'SUM', belop: Math.round(material.reduce((s, g) => s + g.amount_nok, 0)) });
  sumRow.eachCell({ includeEmpty: true }, (cell: any) => { cell.font = { ...SUM_FONT }; cell.border = SUM_BORDER; });

  // ---- Fane 2: Krav per fortolling (flat — det som omberegnes) ----
  const kr = wb.addWorksheet('Krav per fortolling', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  kr.properties.tabColor = { argb: FOREST };
  kr.columns = [
    { header: H('Type'), key: 'kind', width: 11 },
    { header: H('Tollnummer'), key: 'tollnummer', width: 18 },
    { header: H('Fortollet'), key: 'godkjent', width: 11 },
    { header: H('Leverandør'), key: 'aktor', width: 24 },
    { header: H('Produkt'), key: 'produkt', width: 34 },
    { header: H('Beløp (NOK)'), key: 'belop', width: 13, style: { numFmt: NOK_FMT } },
    { header: H('Frist'), key: 'frist', width: 12 },
    { header: H('Dager igjen'), key: 'dager', width: 11 },
    { header: H('Vurdering'), key: 'match', width: 20 },
    { header: H('Sannsynlighet'), key: 'lik', width: 13 },
    { header: H('Hva det er'), key: 'summary', width: 70, style: { alignment: { wrapText: true, vertical: 'top' } } },
    { header: H('Neste steg'), key: 'action', width: 70, style: { alignment: { wrapText: true, vertical: 'top' } } },
    { header: H('Utkast til kravtekst'), key: 'draft', width: 70, style: { alignment: { wrapText: true, vertical: 'top' } } },
  ];
  const flat = [...materialRows].sort((a, b) => (a.dager_igjen ?? Infinity) - (b.dager_igjen ?? Infinity) || (b.amount_nok || 0) - (a.amount_nok || 0));
  for (const r of flat) {
    const row = kr.addRow({
      kind: r.kind, tollnummer: r.tollnummer ?? '', godkjent: r.godkjent ?? '', aktor: r.aktor ?? '',
      produkt: r.produkt, belop: Math.round(r.amount_nok || 0), frist: r.frist ?? '', dager: r.dager_igjen ?? '',
      match: confLabel(r.confidence), lik: likLabel(r.likelihood),
      summary: r.summary ?? '', action: r.action ?? '', draft: r.claim_draft ?? '',
    });
    styleDataRow(row);
    if (r.dager_igjen != null && r.dager_igjen <= 90) markUrgent(row);
  }

  // ---- Fane 3: Småkrav (under materialitetsgrensen — tas ved anledning) ----
  let sm: any = null;
  if (small.length) {
    sm = wb.addWorksheet('Småkrav', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
    sm.properties.tabColor = { argb: FOREST };
    sm.columns = [
      { header: H('Produkt'), key: 'produkt', width: 36 },
      { header: H('Leverandør'), key: 'aktor', width: 24 },
      { header: H('Type'), key: 'kind', width: 11 },
      { header: H('Fortollinger'), key: 'antall', width: 12 },
      { header: H('Beløp (NOK)'), key: 'belop', width: 13, style: { numFmt: NOK_FMT } },
      { header: H('Første frist'), key: 'frist', width: 12 },
      { header: H('Neste steg'), key: 'action', width: 70, style: { alignment: { wrapText: true, vertical: 'top' } } },
      { header: H('Tollnummer'), key: 'tollnummer', width: 40 },
    ];
    for (const g of [...small].sort((a, b) => b.amount_nok - a.amount_nok)) {
      const row = sm.addRow({
        produkt: g.produkt, aktor: g.aktor ?? '', kind: g.kind,
        antall: g.tollnummers.length || g.count, belop: Math.round(g.amount_nok), frist: g.frist ?? '',
        action: g.shared.action || 'Se vurderingen i dashbordet — varierer per fortolling.',
        tollnummer: g.tollnummers.join(', '),
      });
      styleDataRow(row);
    }
    const smSum = sm.addRow({ produkt: 'SUM', belop: Math.round(small.reduce((s, g) => s + g.amount_nok, 0)) });
    smSum.eachCell({ includeEmpty: true }, (cell: any) => { cell.font = { ...SUM_FONT }; cell.border = SUM_BORDER; });
  }

  // ---- Fane 4: Om ----
  const om = wb.addWorksheet('Om', { views: [{ showGridLines: false }] });
  om.properties.tabColor = { argb: FOREST };
  om.columns = [{ width: 110 }];
  const omTitle = om.addRow(['Om arbeidsboken']);
  omTitle.getCell(1).font = { ...TITLE_FONT };
  om.addRow([]).getCell(1).font = { ...BODY_FONT }; // luft under tittelen — også denne cellen trenger fonten
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
    ...(small.length ? [
      '',
      `«Småkrav»: saker under ${SMALL_CLAIM_NOK} kr samlet. De er reelle, men håndteringskosten kan overstige beløpet —`,
      'ta dem ved anledning, gjerne samtidig med en hovedsak mot samme fortolling. De telles ikke i hovedfanenes SUM.',
    ] : []),
  ].forEach((t) => { om.addRow([t]).getCell(1).font = { ...BODY_FONT }; });

  for (const ws of [ov, kr, ...(sm ? [sm] : [])]) {
    ws.getRow(1).eachCell({ includeEmpty: true }, (cell: any) => {
      cell.font = { ...HEADER_FONT };
      cell.border = HEADER_BORDER;
    });
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
