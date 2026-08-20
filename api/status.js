import snapshot from './_data/snapshot.js';
import { requireSession } from './_lib/session.js';
export default async function handler(request) {
  const { session, res } = await requireSession(request);
  if (!session) return res;
  return Response.json({ db: { declarations: snapshot.meta.declarations, goodsLines: snapshot.meta.goodsLines }, hosted: true, snapshotAt: snapshot.meta.snapshotAt, period: snapshot.meta.claimWindow });
}
