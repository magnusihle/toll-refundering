export async function getData() { const r = await fetch('/api/data'); if (!r.ok) throw new Error('data ' + r.status); return r.json(); }
export async function getStatus() { const r = await fetch('/api/status'); return r.json(); }
export async function postRefresh() { const r = await fetch('/api/refresh', { method: 'POST' }); return r.json(); }
export async function getRefreshStatus() { const r = await fetch('/api/refresh/status'); return r.json(); }
// Sendeloggen («avvent svar»-leddet). Kan feile mot en eldre lokal server
// uten /api/sent — kallerne har localStorage-fallback.
export async function getSent() { const r = await fetch('/api/sent'); if (!r.ok) throw new Error('sent ' + r.status); return r.json(); }
export async function postSent(entry: { count: number; amount: number; filter?: string }) {
  const r = await fetch('/api/sent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
  if (!r.ok) throw new Error('sent ' + r.status);
  return r.json();
}
