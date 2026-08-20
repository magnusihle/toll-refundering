import { parseNoNumber } from '../util.js';

// Fallback line source: read a declaration's goods lines from the app's detail
// "Linjer" grid when the SAD converter yields nothing. Reliable structured data
// with HS, origin, preference (Pref.), article number — but no box47 duty / VAT
// (those only exist in the SAD). Requires the target period already applied.

// Find the Tollnummer auto-filter input by matching the header's horizontal
// position (robust to command-column / colspan offsets). Verified: grid_DXFREditorcol4_I.
async function tollFilterInput(page) {
  return await page.evaluate(() => {
    const main = document.querySelector('#grid_DXMainTable');
    if (!main) return null;
    const head = Array.from(main.querySelectorAll('td[class*="dxgvHeader"]')).find((h) => /Tollnummer/i.test(h.innerText));
    if (!head) return null;
    const hr = head.getBoundingClientRect(); const cx = (hr.left + hr.right) / 2;
    let best = null, bestd = 1e9;
    for (const inp of main.querySelectorAll('input[id^="grid_DXFREditorcol"][id$="_I"]')) {
      const r = inp.getBoundingClientRect(); const d = Math.abs((r.left + r.right) / 2 - cx);
      if (d < bestd) { bestd = d; best = inp.id; }
    }
    return best;
  });
}

async function setFilter(page, inputId, value) {
  await page.fill('#' + inputId, value).catch(() => {});
  await Promise.all([
    page.waitForLoadState('networkidle').catch(() => {}),
    page.locator('#' + inputId).press('Enter').catch(() => {}),
  ]);
  await page.waitForTimeout(1800);
}

// Returns { lines: [...] } read from the Linjer grid for one tollnummer, or {error}.
export async function readLinjerFor(page, tollnummer) {
  const inputId = await tollFilterInput(page);
  if (!inputId) return { error: 'Tollnummer filter input not found' };
  await setFilter(page, inputId, tollnummer);
  // confirm exactly this declaration is row 0, then expand + read
  await page.evaluate(() => { try { ASPx.GVShowDetailRow('grid', 0, {}); } catch (e) {} });
  await page.waitForTimeout(2200);
  const res = await page.evaluate(() => {
    const clean = (s) => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
    const t = document.querySelector('#grid_dxdt0_aspxDetailPageKontroll_gridLinje_DXMainTable');
    if (!t) return { found: false };
    const heads = Array.from(t.querySelectorAll('td[class*="dxgvHeader"]')).map((h) => clean(h.innerText));
    const rows = Array.from(t.querySelectorAll('tr[class*="dxgvDataRow"]'))
      .filter((tr) => !/dxgvDetail|dxgvGroupRow/.test(tr.className))
      .map((tr) => {
        const cells = Array.from(tr.children).filter((c) => c.tagName === 'TD').map((td) => clean(td.innerText));
        const o = {}; heads.forEach((h, i) => { if (h) o[h] = cells[i] ?? ''; });
        return o;
      });
    return { found: true, heads, rows };
  });
  await setFilter(page, inputId, ''); // clear filter to restore the full period view
  if (!res.found) return { error: 'Linjer grid not found for ' + tollnummer };

  const lines = res.rows.map((r) => ({
    item_number: parseInt(r['Linjenr.'] || r['#'] || '0', 10) || null,
    hs_code: (r['Tariffnr.'] || '').trim() || null,
    origin: (r['Opprinnelse'] || '').trim() || null,
    procedure: (r['Pros.'] || '').trim() || null,
    preference_code: (r['Pref.'] || '').trim() || null,
    gross_weight: parseNoNumber(r['Bruttovekt']),
    net_weight: parseNoNumber(r['Nettovekt']),
    statistical_value: parseNoNumber(r['Statistiskverdi']),
    item_value: parseNoNumber(r['Grunnlag']),
    description: (r['Varebeskrivelse'] || '').trim() || null,
    article_number: (r['Artikkel'] || '').trim() || null,
    charges: [], docs: [], origin_proof: 0,
  }));
  return { lines };
}
