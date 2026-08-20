import { pool } from './pool.js';

// The dashboard payload lives in Postgres (table dashboard_snapshot, one row),
// pushed by `node src/cli.js publish`. We check the cheap updated_at first and
// only re-fetch/parse the big payload when it actually changed.
let cache = null; // { stamp, payload }

export async function getSnapshotMeta() {
  const { rows } = await pool.query('SELECT declarations, goods_lines, updated_at FROM dashboard_snapshot WHERE id = 1');
  return rows[0] || null;
}

export async function getSnapshot() {
  const meta = await getSnapshotMeta();
  if (!meta) return null;
  const stamp = new Date(meta.updated_at).getTime();
  if (cache && cache.stamp === stamp) return cache.payload;
  const { rows } = await pool.query('SELECT payload FROM dashboard_snapshot WHERE id = 1');
  cache = { stamp, payload: rows[0].payload };
  return cache.payload;
}
