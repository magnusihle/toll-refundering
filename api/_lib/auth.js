import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import pg from 'pg';

// Better Auth for the Vercel deployment. Google sign-in ONLY, restricted to a
// single email domain (default declaro.no). Users/sessions live in Vercel
// Postgres / Neon (the serverless functions can't use the app's local SQLite).
const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || 'declaro.no').toLowerCase();
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
const baseURL = process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

export const auth = betterAuth({
  appName: 'EMMA EDOC Fortollingsanalyse',
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [baseURL, process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`].filter(Boolean),
  database: new pg.Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false }, // Neon/Vercel Postgres require TLS
  }),
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      prompt: 'select_account',
    },
  },
  // Domain gate: a Google account is only ever provisioned if its verified email
  // ends in @declaro.no. Because non-domain users can never be created, every
  // subsequent sign-in is inherently restricted too.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = String(user.email || '').toLowerCase();
          if (!email.endsWith('@' + ALLOWED_DOMAIN)) {
            throw new APIError('FORBIDDEN', { message: `Kun @${ALLOWED_DOMAIN}-kontoer har tilgang.` });
          }
          return { data: user };
        },
      },
    },
  },
});
