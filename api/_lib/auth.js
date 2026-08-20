import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { pool } from './pool.js';

// Better Auth for the Vercel deployment. Google sign-in ONLY, restricted to a
// single email domain (default declaro.no). Users/sessions live in Vercel
// Postgres / Neon (the serverless functions can't use the app's local SQLite).
const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || 'declaro.no').trim().toLowerCase().replace(/^@+/, '');
const baseURL = process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

export const auth = betterAuth({
  appName: 'EMMA EDOC Fortollingsanalyse',
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [baseURL, process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`].filter(Boolean),
  database: pool,
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
          const email = String(user?.email || '').trim().toLowerCase();
          const ok = !!email && email.endsWith('@' + ALLOWED_DOMAIN);
          // Visible in Vercel runtime logs — the authoritative diagnostic.
          console.log(`[domain-gate] email="${email}" allowed="@${ALLOWED_DOMAIN}" -> ${ok ? 'ALLOW' : 'REJECT'}`);
          if (!ok) {
            throw new APIError('FORBIDDEN', { message: `Kun @${ALLOWED_DOMAIN}-kontoer har tilgang.` });
          }
          return { data: user };
        },
      },
    },
  },
});
