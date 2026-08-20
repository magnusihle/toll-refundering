import pg from 'pg';
import { dashboardData } from './dashboard.js';

// Publish local data to the prod database (Neon / Vercel Postgres — the same DB
// Better Auth uses). Computes the dashboard payload from the LOCAL SQLite base
// (no EMMA re-scrape) and upserts it as the single dashboard_snapshot row. The
// deployed app reads this live, so refreshing prod data never needs a redeploy.
const MIGRATE = `
CREATE TABLE IF NOT EXISTS dashboard_snapshot (
  id           integer PRIMARY KEY DEFAULT 1,
  payload      jsonb NOT NULL,
  declarations integer NOT NULL,
  goods_lines  integer NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_snapshot_single CHECK (id = 1)
);`;

export async function publish({ onProgress = (m) => process.stderr.write(m + '\n') } = {}) {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!raw) throw new Error('Mangler DATABASE_URL. Sett den i .env (samme Neon/Vercel Postgres som Better Auth).');
  let connectionString = raw;
  try { const u = new URL(raw); u.searchParams.delete('sslmode'); u.searchParams.delete('channel_binding'); connectionString = u.toString(); } catch {}
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const client = new pg.Client({ connectionString, ssl: isLocal ? false : { rejectUnauthorized: false } });
  await client.connect();
  try {
    onProgress('Migrerer prod-skjema (dashboard_snapshot)…');
    await client.query(MIGRATE);

    onProgress('Beregner dashboard-payload fra lokal base (ingen EMMA-henting)…');
    const data = dashboardData();
    data.meta = { ...data.meta, snapshotAt: new Date().toISOString() };
    delete data.meta.fx; // FX hentes live i serverless-funksjonen
    const json = JSON.stringify(data);

    onProgress(`Publiserer ${(json.length / 1024 / 1024).toFixed(1)} MB til prod…`);
    await client.query(
      `INSERT INTO dashboard_snapshot (id, payload, declarations, goods_lines, updated_at)
       VALUES (1, $1::jsonb, $2, $3, now())
       ON CONFLICT (id) DO UPDATE
         SET payload = EXCLUDED.payload,
             declarations = EXCLUDED.declarations,
             goods_lines = EXCLUDED.goods_lines,
             updated_at = now()`,
      [json, data.meta.declarations, data.meta.goodsLines]
    );
    const { rows } = await client.query('SELECT updated_at FROM dashboard_snapshot WHERE id = 1');
    return { declarations: data.meta.declarations, goodsLines: data.meta.goodsLines, bytes: json.length, updatedAt: rows[0].updated_at };
  } finally {
    await client.end();
  }
}
