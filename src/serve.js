import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';
import { dashboardData, ensureWebBuilt } from './dashboard.js';
import { getRates } from './fx.js';
import { buildDataset } from './pipeline.js';
import { summary, existingTollnummers, addSentLog, sentLog } from './db.js';
import { claimWindow } from './period.js';

// Local served app: serves the React (web/dist) build and the /api endpoints,
// including live FX rates and an async /api/refresh incremental collection.

// Refresh henter alltid hele 3-årsvinduet (norsk tid), regnet på nytt per kall
// slik at en server som står oppe over midnatt/årsskiftet ikke blir hengende
// igjen på gårsdagens frist.
const DIST = path.join(ROOT, 'web', 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.png': 'image/png' };

let job = null;
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 65536) reject(new Error('body too large')); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
  });
}

async function startRefresh() {
  if (job && job.state === 'running') return job;
  job = { id: 't' + Date.now(), state: 'running', message: 'Starter…', log: [], report: null };
  const onProgress = (m) => { job.message = m; job.log.push(m); if (job.log.length > 200) job.log.shift(); };
  (async () => {
    try {
      const win = claimWindow();
      const report = await buildDataset({ from: win.from, to: win.to, onProgress });
      job.report = report; job.state = 'done'; job.message = `Ferdig: ${report.newCollected} nye samlet inn (${report.viaLinjer} via Linjer)`;
    } catch (e) { job.state = 'error'; job.message = 'Feil: ' + String(e.message || e).slice(0, 200); }
  })();
  return job;
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  let file = path.join(DIST, rel);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html'); // SPA fallback
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (p === '/api/data') { const data = dashboardData(); data.meta.fx = await getRates(); return json(res, 200, data); }
    if (p === '/api/fx') return json(res, 200, await getRates());
    if (p === '/api/status') return json(res, 200, { db: summary(), have: existingTollnummers().size, period: claimWindow(), job: job && { state: job.state, message: job.message } });
    // Sendeloggen: hva som er forberedt/sendt til 3PL — delt tilstand i SQLite,
    // så «avventer svar» ikke bor i én enkelt nettlesers localStorage.
    if (p === '/api/sent' && req.method === 'POST') {
      const b = await readBody(req);
      if (!Number.isFinite(Number(b.count)) || !Number.isFinite(Number(b.amount))) return json(res, 400, { error: 'count/amount mangler' });
      addSentLog({ count: Number(b.count), amount: Number(b.amount), filter: typeof b.filter === 'string' ? b.filter.slice(0, 100) : null });
      return json(res, 200, { items: sentLog() });
    }
    if (p === '/api/sent') return json(res, 200, { items: sentLog() });
    if (p === '/api/refresh' && req.method === 'POST') { const j = await startRefresh(); return json(res, 202, { id: j.id, state: j.state }); }
    if (p === '/api/refresh/status') { if (!job) return json(res, 200, { state: 'idle' }); return json(res, 200, { state: job.state, message: job.message, log: job.log.slice(-8), report: job.state === 'done' ? job.report : null }); }
    if (p.startsWith('/api/')) return json(res, 404, { error: 'not found' });
    return serveStatic(req, res, p);
  } catch (e) { json(res, 500, { error: String(e.message || e) }); }
});

export function serve(port = 8899) {
  ensureWebBuilt();
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => { const url = `http://127.0.0.1:${port}/`; console.error(`emma-edoc dashboard on ${url}`); resolve({ url, server }); });
  });
}
