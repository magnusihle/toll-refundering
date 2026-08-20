#!/usr/bin/env node
// CLI for one-shot runs and the local dashboard server.
//   node src/cli.js login | dump | fields
//   node src/cli.js build [from] [to] [limit]  -> incremental extract (default: hele 3-årsvinduet)
//   node src/cli.js window                     -> vis 3-årsfristen (norsk tid)
//   node src/cli.js serve [port]               -> run the local dashboard (Refresh button)
//   node src/cli.js insights                    -> print product-level insights
import { getPage, ensureLoggedIn, closeSession } from './session.js';
import { describeFields, debugDump } from './modules/declarations.js';
import { insights } from './analysis.js';
import { buildDataset } from './pipeline.js';
import { ensureWebBuilt } from './dashboard.js';
import { serve } from './serve.js';
import { claimWindow } from './period.js';
import { writeSnapshot } from './snapshot.js';

const [cmd, a, b, c] = process.argv.slice(2);
try {
  if (cmd === 'login') {
    await getPage(); await ensureLoggedIn(); const p = await getPage();
    console.log(JSON.stringify({ ok: true, url: p.url(), title: await p.title() }, null, 2));
  } else if (cmd === 'dump') { console.log((await debugDump()).html); await closeSession(); }
  else if (cmd === 'fields') { console.log(JSON.stringify(await describeFields(), null, 2)); await closeSession(); }
  else if (cmd === 'build') {
    const report = await buildDataset({ from: a || null, to: b || null, limit: c ? Number(c) : null });
    console.log(JSON.stringify({ report }, null, 2));
    await closeSession();
  } else if (cmd === 'insights') { console.log(JSON.stringify(insights(), null, 2)); }
  else if (cmd === 'snapshot') { const r = writeSnapshot(); console.log('Snapshot written: ' + r.out + ` (${r.declarations} decl, ${r.goodsLines} lines, ${(r.bytes/1024).toFixed(0)} KB)`); }
  else if (cmd === 'window') { console.log(JSON.stringify(claimWindow(), null, 2)); }
  else if (cmd === 'serve') {
    const { url } = await serve(a ? Number(a) : 8899); // serve() builds web/dist if needed
    console.log('Dashboard: ' + url + '  (Ctrl+C to stop)');
    // keep process alive; do NOT closeSession — refresh needs the browser
  } else { console.log('usage: node src/cli.js <login|dump|fields|build|serve|insights> [from] [to] [limit]'); }
} catch (e) { console.error('FAILED:', e.stack || e.message); process.exitCode = 1; if (cmd !== 'serve') await closeSession(); }
