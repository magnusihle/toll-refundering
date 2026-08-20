#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { stringify } from 'csv-stringify/sync';
import { config } from './config.js';
import { ensureLoggedIn, closeSession, getPage } from './session.js';
import { queryDeclarations, describeFields, debugDump } from './modules/declarations.js';
import { analyze } from './analysis.js';
import { buildDataset } from './pipeline.js';
import { dashboardData } from './dashboard.js';
import { insights, dataCoverage } from './analysis.js';
import { claimWindow } from './period.js';

const server = new McpServer({ name: 'emma-edoc-agent', version: '0.1.0' });

const ok = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] });
const fail = (e) => ({ isError: true, content: [{ type: 'text', text: 'Error: ' + (e?.stack || e?.message || String(e)) }] });

server.registerTool(
  'login_test',
  { title: 'Test login', description: 'Log into EMMA EDOC with EMMA_USER/EMMA_PASS and confirm the app loads.', inputSchema: {} },
  async () => {
    try {
      await getPage();
      await ensureLoggedIn();
      const page = await getPage();
      return ok({ ok: true, url: page.url(), title: await page.title() });
    } catch (e) { return fail(e); }
  }
);

server.registerTool(
  'describe_fields',
  { title: 'Describe declaration fields', description: 'Return the declarations grid columns, numeric/date columns, and filter/expand affordances. Feeds the data dictionary.', inputSchema: {} },
  async () => { try { return ok(await describeFields()); } catch (e) { return fail(e); } }
);

server.registerTool(
  'query_declarations',
  {
    title: 'Query declarations',
    description: 'Query import customs declarations (fortollinger). Optional ISO date range (from/to); paginates all pages. Returns normalised rows.',
    inputSchema: {
      from: z.string().optional().describe('ISO date yyyy-mm-dd (start of period)'),
      to: z.string().optional().describe('ISO date yyyy-mm-dd (end of period)'),
      maxPages: z.number().int().positive().max(200).optional(),
    },
  },
  async ({ from, to, maxPages }) => { try { return ok(await queryDeclarations({ from, to, maxPages })); } catch (e) { return fail(e); } }
);

server.registerTool(
  'analyze',
  {
    title: 'Analyse declarations',
    description: 'Query declarations for a period and return aggregates: totals per currency, MVA-grunnlag sums, and Avvik (discrepancy) list.',
    inputSchema: {
      from: z.string().optional().describe('ISO date yyyy-mm-dd'),
      to: z.string().optional().describe('ISO date yyyy-mm-dd'),
    },
  },
  async ({ from, to }) => {
    try {
      const q = await queryDeclarations({ from, to });
      if (q.error) return ok(q);
      return ok({ period: q.period, reportedTotal: q.reportedTotal, analysis: analyze(q.rows) });
    } catch (e) { return fail(e); }
  }
);

server.registerTool(
  'export_csv',
  {
    title: 'Export declarations to CSV',
    description: 'Query declarations for a period and write a CSV file (Excel-ready) into the data/ dir. Returns the file path and row count.',
    inputSchema: {
      from: z.string().optional(),
      to: z.string().optional(),
      filename: z.string().optional().describe('Output filename (defaults to declarations-<from>_<to>.csv)'),
    },
  },
  async ({ from, to, filename }) => {
    try {
      const q = await queryDeclarations({ from, to });
      if (q.error) return ok(q);
      const cols = (q.headers || []).filter((h) => h && h !== '#');
      const records = q.rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? ''])));
      const csv = stringify(records, { header: true, columns: cols, delimiter: ';' });
      fs.mkdirSync(config.dataDir, { recursive: true });
      const name = filename || `declarations-${from || 'start'}_${to || 'end'}.csv`.replace(/[^\w.\-]/g, '_');
      const out = path.join(config.dataDir, name);
      fs.writeFileSync(out, '﻿' + csv, 'utf8'); // BOM for Excel + nb-NO
      return ok({ file: out, rowCount: q.rowCount, columns: cols });
    } catch (e) { return fail(e); }
  }
);

server.registerTool(
  'debug_dump',
  { title: 'Dump grid HTML', description: 'Return a trimmed HTML snapshot of the declarations grid, for tuning selectors against the live DOM.', inputSchema: {} },
  async () => { try { return ok(await debugDump()); } catch (e) { return fail(e); } }
);


server.registerTool(
  'build_dataset',
  {
    title: 'Build SAD-enriched dataset',
    description: 'Incremental pipeline for a period. Defaults to — and is capped at — the 3-year refund-claim window computed in Norwegian time (Europe/Oslo); older periods are time-barred and are clamped unless allowOlder is set. only fetches declarations not already stored, downloads each SAD (fortolling) PDF from EMMA EDOC, convert to JSON (HS/origin/value + box47 duty + per-line VAT), persist to SQLite, and regenerate the dashboard. Optional ISO from/to and a limit for testing.',
    inputSchema: {
      from: z.string().optional().describe('ISO yyyy-mm-dd; default = today−3y in Europe/Oslo'),
      to: z.string().optional().describe('ISO yyyy-mm-dd; default = today in Europe/Oslo'),
      limit: z.number().int().positive().optional(),
      allowOlder: z.boolean().optional().describe('Allow fetching outside the 3-year claim window (time-barred data)'),
    },
  },
  async ({ from, to, limit, allowOlder }) => {
    try {
      const report = await buildDataset({ from, to, limit, allowOlder });
      const dashboard = buildDashboard();
      return ok({ report, dashboard });
    } catch (e) { return fail(e); }
  }
);

server.registerTool(
  'insights',
  { title: 'Product-level insights', description: 'Return actionable insights from the stored data: preferential-origin-not-claimed opportunities (recoverable duty), same-product-different-treatment flags, duty/RÅK/VAT breakdown, and supplier/monthly analytics. Reads the SQLite store built by build_dataset.', inputSchema: {} },
  async () => { try { return ok(insights()); } catch (e) { return fail(e); } }
);


server.registerTool(
  'claim_window',
  {
    title: 'Refund claim window (3 years, Norwegian time)',
    description: 'Return the 3-year refund-claim window (foreldelsesfrist) computed from today in Europe/Oslo, plus how much of it the stored data covers.',
    inputSchema: {},
  },
  async () => { try { return ok({ window: claimWindow(), coverage: dataCoverage() }); } catch (e) { return fail(e); } }
);

server.registerTool(
  'dataset_summary',
  { title: 'Dataset summary', description: 'Return the current dashboard dataset (declarations with goods lines and charges, plus comparison flags) as JSON.', inputSchema: {} },
  async () => { try { return ok(dashboardData()); } catch (e) { return fail(e); } }
);

process.on('SIGINT', async () => { await closeSession(); process.exit(0); });
process.on('SIGTERM', async () => { await closeSession(); process.exit(0); });

const transport = new StdioServerTransport();
await server.connect(transport);
// stderr is safe for logs; stdout is the MCP channel.
console.error('emma-edoc-agent MCP server running on stdio');
