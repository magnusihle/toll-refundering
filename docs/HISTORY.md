# EMMA EDOC agent (headless MCP server)

Logs into **EMMA EDOC** (`emmaedoc.no`) with your username/password, reads its
ASP.NET WebForms declarations grid via a headless browser, and exposes MCP tools
to map fields, extract data to CSV, and analyse it. No visible browser, no Chrome
extension — headless Playwright Chromium.

## Setup
```bash
npm install
npx playwright install chromium      # one-time: download the headless browser
cp .env.example .env                 # then edit .env with your real credentials
```
`.env` is gitignored. Credentials are read from it at runtime and never logged.

## Smoke test (no MCP client needed)
```bash
node src/cli.js login                 # confirms login reaches the app
node src/cli.js dump > docs/grid-dump.html   # snapshot grid HTML to tune selectors
node src/cli.js fields                # lists grid columns + affordances
node src/cli.js query                 # current period rows (JSON)
node src/cli.js analyze               # aggregates for current period
```
Tip: set `EMMA_HEADLESS=false` in `.env` to watch the browser while debugging.

## Register with Claude Code
```bash
claude mcp add emma-edoc -- node /Users/ihle/Downloads/aspx-agent/src/server.js
```
Then, in a normal session, the tools appear: `login_test`, `describe_fields`,
`query_declarations`, `analyze`, `export_csv`, `debug_dump`.

## Tools
| Tool | Purpose |
|---|---|
| `login_test` | Authenticate and confirm the app loads |
| `describe_fields` | Grid columns, numeric/date columns, filter/expand affordances |
| `query_declarations {from,to,maxPages}` | Paginated declaration rows (ISO dates) |
| `analyze {from,to}` | Totals per currency, MVA-grunnlag sums, Avvik discrepancies |
| `export_csv {from,to,filename}` | Write an Excel-ready `;`-delimited CSV to `data/` |
| `debug_dump` | Trimmed grid HTML for selector tuning |
| `claim_window` | The 3-year refund-claim window (Europe/Oslo) + how much of it the DB covers |

## Status / next steps
**Phase A working & verified live:** login + session persistence, DevExpress grid
reader (targets `grid_DXMainTable`, theme-agnostic classes), declarations
query/analyze/export. Extracted 19/19 current-period rows; aggregates match the UI
totals. Data dictionary confirmed in `docs/DATA_DICTIONARY.md`.

Next (Phase B):
- **Date-range filter** — `applyPeriod` (`src/modules/declarations.js`) is still
  best-effort; wire it to the real "Dato/periode søk" controls so `from`/`to` work.
- **Master-detail** — scrape line items behind each row's Expand icon.
- **Other modules** — Avstemming (reconciliation), Rapporter (reports).

## Phase B — SAD-enriched goods-line dashboard

Fetches each declaration's SAD directly from EMMA EDOC's merge endpoint
(`EmmaPDFMerge.aspx?tadref=<tollnummer>&deklkode=<Dekl>`, keyed by fields already in the grid),
processes it in a temp file (not persisted by default), converts it to goods-line JSON
(HS code, origin, value, box47 duty + per-line VAT), stores it in SQLite (`data/emma.db`), and
builds a local dashboard.

```bash
# one-shot: query current period (August), download 19 SADs, convert, populate DB, build dashboard
node src/cli.js build
node src/cli.js build 2026-08-01 2026-08-31 5   # optional from/to + limit
node src/cli.js compare        # print same-goods-different-rate flags
node src/cli.js dashboard      # regenerate dashboard/index.html from the DB
open dashboard/index.html      # self-contained; opens in Chrome (no server needed)
```
Requires **Poppler** (`pdftotext`,`pdfinfo`) on PATH (used by the SAD converter). SQLite is Node's
built-in `node:sqlite` (no native build). SAD PDFs + `emma.db` + the generated dashboard are
gitignored (customer data).

New MCP tools: `build_dataset {from,to,limit}`, `goods_comparison`, `build_dashboard`, `dataset_summary`.

### Known limitation
The **date filter is not yet wired to the app's "Dato/periode søk" controls** — `queryDeclarations`
currently reads whatever period EMMA EDOC shows (its default "this month", i.e. August). The `from`/`to`
params are plumbed through but not yet applied in the UI; wiring them is the next task.

## Phase C — full-2026, incremental, insight dashboard, live Refresh

- **Period**: driven via the app's "Dato/periode søk → Manuelt søk" range (global calendar objects
  `aspxKalenderFra`/`aspxKalenderTil` + Søk). `applyPeriod()` in `src/modules/declarations.js`.
- **Incremental**: `buildDataset` skips tollnummers already in the DB (`existingTollnummers()`); only
  new declarations are fetched. Re-running collects nothing new.
- **Line source**: SAD converter (fast, gives box47 duty + VAT) with a **Linjer-grid fallback**
  (`src/modules/linjer.js`) for the ~46% of declarations the SAD parser can't read — so no
  declaration is ever empty. Linjer lines carry HS/origin/preference/article but no box47/VAT.
- **Insights** (`src/analysis.js`, product-level — never grouped by HS; RÅK/`RT` never flagged):
  `preferenceOpportunities` (TL duty paid + preference N/J + SER proof → recoverable),
  `productInconsistencies` (same product → different HS/VAT/preference), `chargeBreakdown`,
  `supplierAnalytics`, `monthlyTrend`.
- **Served dashboard with live Refresh**:
  ```bash
  node src/cli.js build            # full incremental 2026 extract (first run ~12 min; 46% via Linjer)
  node src/cli.js serve            # http://127.0.0.1:8899  — Oversikt / Muligheter / Deklarasjoner / Varer
  ```
  The **↻ Oppdater** button POSTs `/api/refresh` (async job → `/api/refresh/status`), which checks EMMA
  for new declarations for 2026-01-01→today and collects only the missing ones, then reloads.

MCP tools: `build_dataset`, `insights`, `build_dashboard`, `dataset_summary` (+ Phase A/B tools).

### Known limitations
- The SAD text-parser fails on ~46% of declarations (compact/scanned layouts); those use the Linjer
  fallback and therefore lack per-line box47 duty / VAT (declaration-level totals still come from the
  grid). Improving the SAD parser (or reading duty from another app view) would recover that detail.
- Preference/product savings are **estimates for broker review**, not guaranteed recoveries. A precise
  expected-duty oracle (offline datasets in customs-hs-matcher) is a documented follow-up.

## Frontend: React + shadcn/ui (web/)

The dashboard is a **Vite + React + TypeScript + Tailwind + shadcn/ui** app under `web/`, served by
`src/serve.js`. All tables are paginated/sortable/filterable via one reusable `@tanstack/react-table`
DataTable (`web/src/components/DataTable.tsx`); Declarations rows expand to goods lines.

```bash
node src/cli.js serve       # builds web/dist on first run, serves http://127.0.0.1:8899
# dev (hot reload): terminal 1 -> node src/cli.js serve ; terminal 2 -> npm --prefix web run dev
```

**Currency**: all stored money is NOK (customs computes in NOK); `value_nok` standardises the invoice
using the customs NOK value (no FX dataset). The header currency switcher (NOK + EUR/USD/DKK/SEK/GBP)
converts displayed figures using **live ECB rates via Frankfurter** (`src/fx.js`, cached 6h + offline
fallback) — a today's-rate display, clearly labelled; canonical values stay NOK.

Note: the shadcn MCP is only registered on the sibling `customs-hs-matcher` project. It isn't needed
here (components are vendored under `web/src/components/ui/`); to use it in this project add
`{"type":"http","url":"https://www.shadcn.io/api/mcp"}` to this project's MCP config.


## Phase D — 3-årsvinduet (foreldelsesfrist) og dato-gyldige RÅK-satser

Krav om tilbakebetaling må fremmes innen **3 år** fra fortollingen, så både
uttrekket og analysene er nå bundet til det vinduet — og til **norsk tid**:

* `src/period.js` — `claimWindow()` regner `i dag` i `Europe/Oslo` (ikke UTC, ikke
  maskinens sone) og gir `{from: i dag − 3 år, to: i dag}`. Grensedagen er med.
  `claimDeadline(fortollingsdato)` gir siste kravdag + dager igjen.
* **Cap:** `buildDataset()` bruker vinduet som standard *og* som maksimum. En
  eldre `from` klemmes opp til `win.from` og rapporteres i `report.clamped`
  (`allowOlder: true` overstyrer bevisst). Samme vindu brukes av `node src/cli.js
  build`, dashbordets Refresh (`/api/refresh`) og MCP-verktøyet `build_dataset`.
  `node src/cli.js window` skriver ut vinduet.
* **Uttrekk:** `node scripts/backfill.mjs` henter hele vinduet i halvårsbolker
  (inkrementelt — lagrede tollnummer hoppes over).

### Gyldig f.o.m./t.o.m. ved RÅK-testing mot historiske deklarasjoner

En innvilget tollnedsettelse gjelder bare i sitt datointervall og for sin
landgruppe, og standardsatsene endres over tid. Å teste en 2023-deklarasjon mot
dagens vedtak gir derfor feil svar. Derfor:

* `scripts/vendor-raak.mjs` re-vendrer begge datagrunnlagene **med datoer**:
  `data/raak-nedsettelser.json` har nå `gyldig_fom` *og* `gyldig_tom` (+ saksnr,
  enhet, landgruppe) fra `tollnedsettelser-filtrert.xlsx`, og
  `data/raak-satser.json` har `{sats, fom, tom}` per landgruppe.
* `src/raak.js` slår opp **per dato**: `grantedOn(varenummer, dato)` og
  `standardRateOn(hs, opphav, dato)`. Landgruppe velges av opphavet (EØS → `TOES`,
  ellers `TALL`).
* `raakReconciliation()` krever nå at vedtaket var gyldig **på fortollingsdatoen**.
  Treff der produktet finnes, men vedtaket ikke gjaldt, havner i egen kategori
  (`notGrantedItems`: `ikke_innvilget_enda` / `utlopt` / `annen_landgruppe`) uten
  beløp — de er ikke krav, men viser hvilke vedtak som må fornyes.
* Satsuttrekket er et øyeblikksbilde av gjeldende satser. Er en sats' `fom` etter
  fortollingsdatoen, rapporteres `standard_rate_status: 'kun_nyere_sats'` i stedet
  for en sammenligning mot feil sats.
* Funn som har passert 3-årsfristen skilles ut (`expiredItems`), og
  handlingslisten markerer hastesaker (`urgentCount`, ≤ 90 dager igjen).
