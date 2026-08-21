import { pool } from './_lib/pool.js';
import { getSession } from './_lib/session.js';

// Sendeloggen («avvent svar»-leddet) for det hostede dashbordet: hva som er
// forberedt/sendt til 3PL, delt mellom alle innloggede — ikke per nettleser.
// Lokal tvilling: sent_log i SQLite (src/db.js) via src/serve.js. Tabellen
// opprettes lat ved første kall og er uavhengig av publish-snapshotet.

let ensured = false;
async function ensure() {
  if (ensured) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS sent_log (
    id SERIAL PRIMARY KEY,
    at TIMESTAMPTZ NOT NULL DEFAULT now(),
    count INTEGER NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    filter TEXT,
    sender TEXT
  )`);
  ensured = true;
}

async function list() {
  const { rows } = await pool.query('SELECT at, count, amount, filter, sender FROM sent_log ORDER BY id DESC LIMIT 20');
  return rows;
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  let b = '';
  for await (const c of req) { b += c; if (b.length > 65536) throw new Error('body too large'); }
  return b ? JSON.parse(b) : {};
}

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'unauthenticated' });
  await ensure();
  if (req.method === 'POST') {
    let b;
    try { b = await readBody(req); } catch { return res.status(400).json({ error: 'ugyldig body' }); }
    if (!Number.isFinite(Number(b.count)) || !Number.isFinite(Number(b.amount))) return res.status(400).json({ error: 'count/amount mangler' });
    await pool.query('INSERT INTO sent_log (count, amount, filter, sender) VALUES ($1, $2, $3, $4)',
      [Math.round(Number(b.count)), Math.round(Number(b.amount)), typeof b.filter === 'string' ? b.filter.slice(0, 100) : null, session.user?.email ?? null]);
    return res.status(200).json({ items: await list() });
  }
  return res.status(200).json({ items: await list() });
}
