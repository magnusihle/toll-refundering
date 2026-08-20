export async function getData() { const r = await fetch('/api/data'); if (!r.ok) throw new Error('data ' + r.status); return r.json(); }
export async function getStatus() { const r = await fetch('/api/status'); return r.json(); }
export async function postRefresh() { const r = await fetch('/api/refresh', { method: 'POST' }); return r.json(); }
export async function getRefreshStatus() { const r = await fetch('/api/refresh/status'); return r.json(); }
