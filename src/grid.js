// Reader for the DevExpress ASPxGridView on the declarations page.
//
// Confirmed against the live DOM: the declarations grid is control id "grid"
// with main table id "grid_DXMainTable"; DevExpress applies THEME-SUFFIXED
// classes (e.g. dxgvDataRow_Office2010Blue), so we match by class *substring*
// (dxgvDataRow, dxgvHeader, dxgvFooter) to stay theme-independent. There are
// several other _DXMainTable grids on the page (hidden popups / other modules),
// so we target #grid_DXMainTable first and fall back to the visible main table
// with the most data rows.

function gridSpec() {
  // returned as a string to run in-page
  return `(() => {
    const clean = (t) => (t || '').replace(/\\u00a0/g, ' ').replace(/\\s+/g, ' ').trim();
    const isVisible = (el) => !!(el && (el.offsetParent !== null || el.getClientRects().length));

    // 1) locate the grid main table
    let main = document.querySelector('#grid_DXMainTable');
    if (!main || !isVisible(main)) {
      const candidates = Array.from(document.querySelectorAll('table[id$="_DXMainTable"]'))
        .filter(isVisible)
        .map(t => ({ t, n: t.querySelectorAll('tr[class*="dxgvDataRow"]').length }))
        .sort((a,b) => b.n - a.n);
      main = candidates.length ? candidates[0].t : null;
    }
    if (!main) return { error: 'declarations grid (#grid_DXMainTable) not found' };

    // 2) headers
    const headerCells = Array.from(main.querySelectorAll('td[class*="dxgvHeader"]'));
    const headers = headerCells.map(td => clean(td.innerText));

    // 3) data rows (exclude detail/preview/group rows)
    const dataRows = Array.from(main.querySelectorAll('tr[class*="dxgvDataRow"]'))
      .filter(tr => !/dxgvDetail|dxgvPreview|dxgvGroupRow|dxgvEditingRow/.test(tr.className));
    const rows = dataRows.map(tr => {
      const cells = Array.from(tr.children).filter(c => c.tagName === 'TD').map(td => clean(td.innerText));
      const row = { _rowId: tr.id || null };
      headers.forEach((h, i) => { if (h) row[h] = cells[i] ?? ''; });
      // keep unlabeled leading cells (e.g. command/expand col) out of the map
      row._cells = cells;
      return row;
    });

    // 4) footer / totals
    const footer = main.querySelector('tr[class*="dxgvFooter"]');
    const totals = footer ? Array.from(footer.querySelectorAll('td')).map(td => clean(td.innerText)) : null;

    // 5) pager text — matches "Side 1 of 1 (19 fortollinger)"
    const bodyText = clean(document.body.innerText);
    const m = bodyText.match(/Side\\s+(\\d+)\\s+of\\s+(\\d+)\\s*\\((\\d+)\\s+\\w+\\)/i);

    return {
      gridId: main.id,
      headers,
      rowCount: rows.length,
      rows,
      totals,
      page: m ? Number(m[1]) : null,
      pages: m ? Number(m[2]) : null,
      total: m ? Number(m[3]) : null,
    };
  })()`;
}

export async function readGrid(page) {
  return await page.evaluate(gridSpec());
}

// Dump the real declarations grid's HTML for selector debugging.
export async function dumpGridHtml(page, maxChars = 60000) {
  return await page.evaluate((maxChars) => {
    const isVisible = (el) => !!(el && (el.offsetParent !== null || el.getClientRects().length));
    let main = document.querySelector('#grid_DXMainTable');
    if (!main || !isVisible(main)) {
      main = Array.from(document.querySelectorAll('table[id$="_DXMainTable"]'))
        .filter(isVisible)
        .sort((a,b)=>b.querySelectorAll('tr[class*="dxgvDataRow"]').length - a.querySelectorAll('tr[class*="dxgvDataRow"]').length)[0];
    }
    const el = main || document.body;
    const html = el.outerHTML;
    return { url: location.href, title: document.title, gridId: main?.id || null, length: html.length, html: html.slice(0, maxChars) };
  }, maxChars);
}
