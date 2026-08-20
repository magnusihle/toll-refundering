import snapshot from './_data/snapshot.js';
import { getRates } from './_lib/fx.js';
import { requireSession } from './_lib/session.js';
export default async function handler(request) {
  const { session, res } = await requireSession(request);
  if (!session) return res;
  const fx = await getRates();
  return Response.json({ ...snapshot, meta: { ...snapshot.meta, fx } });
}
