import 'dotenv/config';
import { getMigrations } from 'better-auth/db/migration';
import { auth } from '../api/_lib/auth.js';

// Runs the Better Auth schema migration using the LOCALLY installed better-auth,
// so the DB always matches the runtime (avoids the @better-auth/cli@latest version
// skew that once left the account table without the 1.7 `issuer` column).
const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);
if (toBeCreated.length || toBeAdded.length) {
  if (toBeCreated.length) console.log('Creating tables:', toBeCreated.map((t) => t.table).join(', '));
  if (toBeAdded.length) console.log('Adding columns:', toBeAdded.map((t) => `${t.table}.{${Object.keys(t.fields).join(',')}}`).join(', '));
  await runMigrations();
  console.log('✅ auth schema migrated');
} else {
  console.log('auth schema already in sync');
}
process.exit(0);
