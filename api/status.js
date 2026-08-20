import { getSnapshotMeta } from './_lib/snapshot.js';
import { getSession } from './_lib/session.js';
export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'unauthenticated' });
  const m = await getSnapshotMeta();
  return res.status(200).json({ hosted: true, db: { declarations: m?.declarations ?? 0, goodsLines: m?.goods_lines ?? 0 }, updatedAt: m?.updated_at ?? null });
}
