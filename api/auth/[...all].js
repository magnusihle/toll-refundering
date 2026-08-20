import { auth } from '../_lib/auth.js';
// Handles /api/auth/* (Google OAuth start, callback, session, sign-out).
export default async function handler(request) {
  return auth.handler(request);
}
