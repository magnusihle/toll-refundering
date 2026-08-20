import { getSnapshotMeta } from './_lib/snapshot.js';
import { requireSession } from './_lib/session.js';
export default async function handler(request) {
  const { session, res } = await requireSession(request);
  if (!session) return res;
  const m = await getSnapshotMeta();
  return Response.json({
    hosted: true,
    db: { declarations: m?.declarations ?? 0, goodsLines: m?.goods_lines ?? 0 },
    updatedAt: m?.updated_at ?? null,
  });
}
