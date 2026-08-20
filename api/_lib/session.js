import { auth } from './auth.js';
import { fromNodeHeaders } from 'better-auth/node';
// Better Auth session for a Vercel Node request (req), or null.
export async function getSession(req) {
  return auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
}
