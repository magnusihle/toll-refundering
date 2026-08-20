import pg from 'pg';

// Single shared Postgres pool for the Vercel functions (Better Auth + data reads).
// We strip sslmode/channel_binding from the URL and set TLS explicitly via `ssl`
// below — this keeps the connection encrypted while silencing pg's noisy
// "sslmode ... treated as verify-full" deprecation warning.
const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
function cleanUrl(cs) {
  try { const u = new URL(cs); u.searchParams.delete('sslmode'); u.searchParams.delete('channel_binding'); return u.toString(); }
  catch { return cs; }
}
const connectionString = cleanUrl(raw);
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);

export const pool = new pg.Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 3,
});
