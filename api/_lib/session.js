import { auth } from './auth.js';
// Returns the session, or null after writing a 401 Response (caller returns it).
export async function requireSession(request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { session: null, res: Response.json({ error: 'unauthenticated' }, { status: 401 }) };
  return { session, res: null };
}
