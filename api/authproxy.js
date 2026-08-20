import { auth } from './_lib/auth.js';
import { toNodeHandler } from 'better-auth/node';
// All /api/auth/* requests are rewritten here (see vercel.json). Better Auth reads
// the original request URL to dispatch sign-in / callback / get-session / sign-out.
export default toNodeHandler(auth);
