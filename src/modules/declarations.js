import { withSession } from '../session.js';
import { urls } from '../config.js';
import { readGrid, dumpGridHtml } from '../grid.js';
import { parseNoNumber, parseNoDate, toNoDate } from '../util.js';

// Numeric columns we normalise for analysis (Norwegian labels as rendered).
const NUMERIC_COLS = [
  'Faktura (Val)', 'Frakt (b)', 'Frakt (v)', 'Avg',
  'MVA grunnl. 25%', 'MVA grunnl. 15%', 'MVA grunnl. 0%', 'Avvik', 'MVA',
];
const DATE_COLS = ['Godkjent'];

function normalizeRow(row) {
  const out = { ...row };
  for (const c of NUMERIC_COLS) if (c in out) out[c + '__num'] = parseNoNumber(out[c]);
  for (const c of DATE_COLS) if (c in out) out[c + '__iso'] = parseNoDate(out[c]);
  return out;
}

async function gotoDeclarations(page) {
  await page.goto(urls.declarations, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
}

// Real period filter: "Dato/periode søk → Manuelt søk" exposes two global
// DevExpress calendar objects (aspxKalenderFra / aspxKalenderTil, instantiated
// on page load) and a Søk button. We set both dates via the client API and click
// Søk (a WebForms postback). Verified live: sets header "Manuelt søk (dd.mm.yyyy
// - dd.mm.yyyy)".
const SOK_BTN = '#aspxMeny_MTCNT1i1_ASPxRoundPanel4_ASPxButton4_CD, #aspxMeny_MTCNT1i1_ASPxRoundPanel4_ASPxButton4';
async function applyPeriod(page, fromIso, toIso) {
  if (!fromIso && !toIso) return { applied: false, reason: 'no period requested' };
  const set = await page.evaluate(({ f, t }) => {
    if (typeof aspxKalenderFra === 'undefined' || typeof aspxKalenderTil === 'undefined')
      return { ok: false, reason: 'calendar objects not found' };
    const p = (s) => s.split('-').map(Number);
    if (f) { const [y, m, d] = p(f); aspxKalenderFra.SetSelectedDate(new Date(y, m - 1, d, 12, 0, 0)); }
    if (t) { const [y, m, d] = p(t); aspxKalenderTil.SetSelectedDate(new Date(y, m - 1, d, 12, 0, 0)); }
    return { ok: true };
  }, { f: fromIso, t: toIso });
  if (!set.ok) return { applied: false, reason: set.reason };
  // Trigger Søk via a JS click on the button input — works whether or not the
  // picker popup is visible (Playwright's click would wait for visibility).
  await Promise.all([
    page.waitForLoadState('networkidle').catch(() => {}),
    page.evaluate(() => {
      const b = document.querySelector('#aspxMeny_MTCNT1i1_ASPxRoundPanel4_ASPxButton4_I')
        || document.querySelector('#aspxMeny_MTCNT1i1_ASPxRoundPanel4_ASPxButton4_CD');
      if (b) b.click();
    }),
  ]);
  await page.waitForTimeout(2500);
  const header = await page.evaluate(() => ((document.body.innerText || '').match(/Manuelt søk \([^)]*\)/) || [''])[0]);
  return { applied: !!header, header, from: fromIso, to: toIso };
}

// Raise "Antall pr.side" via the DevExpress client grid object so the whole
// result fits one page (avoids paginating). Falls back to false if unavailable.
async function setPageSize(page, size = 500) {
  const ok = await page.evaluate((sz) => {
    if (window.grid && typeof grid.SetPageSize === 'function') { grid.SetPageSize(sz); return true; }
    return false;
  }, size);
  if (ok) { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2500); }
  return ok;
}

// Advance one page via the DevExpress client grid object.
async function goToNextPage(page) {
  const res = await page.evaluate(() => {
    if (!window.grid || typeof grid.GetPageIndex !== 'function') return { moved: false };
    const cur = grid.GetPageIndex(), cnt = grid.GetPageCount();
    if (cur >= cnt - 1) return { moved: false };
    grid.NextPage();
    return { moved: true };
  });
  if (res.moved) { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1500); }
  return res.moved;
}

export async function queryDeclarations({ from = null, to = null, maxPages = 50 } = {}) {
  return await withSession(async (page) => {
    await gotoDeclarations(page);
    const period = await applyPeriod(page, from, to);
    await setPageSize(page, 500);

    const all = [];
    let meta = null;
    let seenPages = 0;
    let lastSignature = '';
    for (let i = 0; i < maxPages; i++) {
      const g = await readGrid(page);
      if (g.error) return { error: g.error, period };
      meta = g;
      // stop if this page is identical to the previous (pager didn't advance)
      const sig = (g.rows[0]?._cells || []).join('|') + '#' + g.rowCount;
      if (sig === lastSignature) break;
      lastSignature = sig;
      all.push(...g.rows.map(normalizeRow));
      seenPages++;
      if (g.pages && g.page && g.page >= g.pages) break;
      if (!g.pages && g.rowCount === 0) break;
      const moved = await goToNextPage(page);
      if (!moved) break;
    }

    return {
      period,
      headers: meta?.headers || [],
      totalsRow: meta?.totals || null,
      reportedTotal: meta?.total ?? null,
      pagesRead: seenPages,
      rowCount: all.length,
      rows: all,
    };
  });
}

export async function describeFields() {
  return await withSession(async (page) => {
    await gotoDeclarations(page);
    const g = await readGrid(page);
    const filterInputs = await page.locator('input[type="text"]').count();
    const expandIcons = await page.locator('img[alt*="Expand" i], .dxgvCommandColumn img').count();
    return {
      module: 'declarations (oppdragsoversikt)',
      url: urls.declarations,
      gridId: g.gridId,
      columns: g.headers,
      numericColumns: NUMERIC_COLS.filter((c) => g.headers.includes(c)),
      dateColumns: DATE_COLS.filter((c) => g.headers.includes(c)),
      filterRowInputs: filterInputs,
      expandableRows: expandIcons,
      note: 'Column labels are the app\'s Norwegian headers as rendered. See docs/DATA_DICTIONARY.md for meanings.',
    };
  });
}

export async function debugDump() {
  return await withSession(async (page) => {
    await gotoDeclarations(page);
    return await dumpGridHtml(page);
  });
}

// Read Linjer lines for a set of tollnummers within a period (fallback source
// when the SAD converter yields no lines). Applies the period, then filters the
// grid to each tollnummer and reads its detail Linjer grid.
export async function collectLinjer({ from = null, to = null, tollnummers = [], onProgress } = {}) {
  const { readLinjerFor } = await import('./linjer.js');
  return await withSession(async (page) => {
    await gotoDeclarations(page);
    await applyPeriod(page, from, to);
    await setPageSize(page, 500);
    const out = {};
    for (let i = 0; i < tollnummers.length; i++) {
      onProgress?.(`Linjer ${i + 1}/${tollnummers.length} — ${tollnummers[i]}`);
      out[tollnummers[i]] = await readLinjerFor(page, tollnummers[i]);
    }
    return out;
  });
}
