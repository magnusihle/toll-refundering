import { createAuthClient } from 'better-auth/react';

// Same-origin auth client (Vercel). HOSTED gates auth + hides the local-only
// Refresh/collection UI; unset locally so `cli.js serve` keeps working openly.
export const authClient = createAuthClient();
export const HOSTED = import.meta.env.VITE_HOSTED === '1';
