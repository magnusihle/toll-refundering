import { getSnapshot } from './_lib/snapshot.js';
import { getRates } from './_lib/fx.js';
import { requireSession } from './_lib/session.js';
export default async function handler(request) {
  const { session, res } = await requireSession(request);
  if (!session) return res;
  const snap = await getSnapshot();
  if (!snap) return Response.json({ error: 'no data published yet — run `npm run publish` locally' }, { status: 503 });
  const fx = await getRates();
  return Response.json({ ...snap, meta: { ...snap.meta, fx } });
}
