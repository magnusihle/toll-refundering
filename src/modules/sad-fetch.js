import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.js';
import { withSession } from '../session.js';

// Fetch each declaration's SAD directly from EMMA EDOC's merge endpoint instead
// of driving the grid UI. The endpoint returns the merged fortolling PDF
// (SAD + attachments) as application/pdf, keyed by tadref (tollnummer) and
// deklkode (the grid "Dekl." code). Uses the authenticated session cookies.
//
//   https://emmaedoc.no/Login/EmmaPDFMerge.aspx?tadref=<tollnummer>&deklkode=<dekl>
//
// By default we DO NOT keep the PDFs — each is written to a temp file only long
// enough for the converter (pdftotext needs a path), then deleted. Set
// persist:true (or EMMA_KEEP_SAD=true) to archive them under data/sad/.

export function sadUrl(tadref, deklkode) {
  const q = new URLSearchParams({ tadref: String(tadref), deklkode: String(deklkode || '') });
  return `${config.baseUrl}/Login/EmmaPDFMerge.aspx?${q.toString()}`;
}

// items: [{ tollnummer, deklkode }]. Returns [{ tollnummer, path, bytes, persisted, error }].
// The caller processes each `path` then calls cleanup(result) to remove temp files.
export async function fetchSads(items, { persist = process.env.EMMA_KEEP_SAD === 'true', onProgress } = {}) {
  const tmpBase = persist ? path.join(config.dataDir, 'sad') : fs.mkdtempSync(path.join(os.tmpdir(), 'emma-sad-'));
  fs.mkdirSync(tmpBase, { recursive: true });
  return await withSession(async (page) => {
    const ctx = page.context();
    const results = [];
    for (let i = 0; i < items.length; i++) {
      const { tollnummer, deklkode } = items[i];
      onProgress?.(`SAD ${i + 1}/${items.length} — ${tollnummer}`);
      const out = { tollnummer, path: null, bytes: 0, persisted: persist, error: null, url: sadUrl(tollnummer, deklkode) };
      try {
        const resp = await ctx.request.get(out.url, { timeout: 45000 });
        const ct = resp.headers()['content-type'] || '';
        const buf = await resp.body();
        if (resp.status() !== 200 || !buf.slice(0, 5).toString('latin1').startsWith('%PDF')) {
          out.error = `not a PDF (status ${resp.status()}, ct ${ct}, ${buf.length}b)`;
        } else {
          const dest = path.join(tmpBase, `${tollnummer}.pdf`);
          fs.writeFileSync(dest, buf);
          out.path = dest; out.bytes = buf.length;
        }
      } catch (e) {
        out.error = String(e && e.message ? e.message : e).slice(0, 200);
      }
      results.push(out);
    }
    return results;
  });
}

// Remove temp SAD files (no-op for persisted files).
export function cleanupSads(results) {
  for (const r of results || []) {
    if (r && r.path && !r.persisted) { try { fs.rmSync(r.path, { force: true }); } catch {} }
  }
  // remove the temp dir if empty
  const dirs = new Set((results || []).filter((r) => r && r.path && !r.persisted).map((r) => path.dirname(r.path)));
  for (const d of dirs) { try { fs.rmdirSync(d); } catch {} }
}
