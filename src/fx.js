import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Live FX rates (base NOK) from the ECB via Frankfurter — free, no key, updated
// each business day. This is the authoritative source most FX packages wrap; we
// call it directly for reliability. Cached to disk with a TTL + offline fallback.
// NOT the outdated Tolletaten valutakurs dataset.

const SYMBOLS = ['EUR', 'USD', 'DKK', 'SEK', 'GBP'];
const TTL_MS = 6 * 60 * 60 * 1000; // 6h
const cacheFile = () => path.join(config.dataDir, 'fx-cache.json');

let mem = null;

export async function getRates() {
  // in-memory hit
  if (mem && Date.now() - mem.fetchedAt < TTL_MS) return mem.payload;
  // disk cache
  try {
    const c = JSON.parse(fs.readFileSync(cacheFile(), 'utf8'));
    if (c && Date.now() - c.fetchedAt < TTL_MS) { mem = c; return c.payload; }
  } catch {}
  // live fetch
  try {
    const url = `https://api.frankfurter.dev/v1/latest?base=NOK&symbols=${SYMBOLS.join(',')}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('status ' + r.status);
    const j = await r.json();
    const payload = { base: 'NOK', date: j.date, source: 'ECB via Frankfurter', live: true, rates: { NOK: 1, ...j.rates } };
    mem = { fetchedAt: Date.now(), payload };
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(cacheFile(), JSON.stringify(mem));
    return payload;
  } catch (e) {
    // offline fallback: last-known cache regardless of age
    try {
      const c = JSON.parse(fs.readFileSync(cacheFile(), 'utf8'));
      return { ...c.payload, live: false, stale: true, error: String(e.message).slice(0, 120) };
    } catch {
      return { base: 'NOK', date: null, source: 'unavailable', live: false, rates: { NOK: 1 }, error: String(e.message).slice(0, 120) };
    }
  }
}
