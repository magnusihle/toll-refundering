import pg from 'pg';

// Single shared Postgres pool for the Vercel functions (Better Auth + data reads).
// Neon/Vercel Postgres require TLS; a localhost URL (dev) does not.
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);

export const pool = new pg.Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 3,
});
