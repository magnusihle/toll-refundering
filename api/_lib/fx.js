// Live FX (base NOK) from ECB via Frankfurter, in-memory memo only — the Vercel
// function filesystem is ephemeral, so no disk cache (unlike src/fx.js locally).
const SYMBOLS = ['EUR', 'USD', 'DKK', 'SEK', 'GBP'];
const TTL_MS = 6 * 60 * 60 * 1000;
let mem = null;
export async function getRates() {
  if (mem && Date.now() - mem.at < TTL_MS) return mem.payload;
  try {
    const r = await fetch(`https://api.frankfurter.dev/v1/latest?base=NOK&symbols=${SYMBOLS.join(',')}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('status ' + r.status);
    const j = await r.json();
    const payload = { base: 'NOK', date: j.date, source: 'ECB via Frankfurter', live: true, rates: { NOK: 1, ...j.rates } };
    mem = { at: Date.now(), payload };
    return payload;
  } catch (e) {
    if (mem) return { ...mem.payload, live: false, stale: true };
    return { base: 'NOK', date: null, source: 'unavailable', live: false, rates: { NOK: 1 }, error: String(e.message).slice(0, 120) };
  }
}
