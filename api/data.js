import { getSnapshot } from './_lib/snapshot.js';
import { getRates } from './_lib/fx.js';
import { getSession } from './_lib/session.js';
export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'unauthenticated' });
  const snap = await getSnapshot();
  if (!snap) return res.status(503).json({ error: 'no data published yet — run `npm run publish` locally' });
  const fx = await getRates();
  return res.status(200).json({ ...snap, meta: { ...snap.meta, fx } });
}
