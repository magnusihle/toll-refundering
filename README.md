# toll-refundering

Finner **overbetalt toll og avgift** i Arnika AS sine fortollinger og viser hva som
kan kreves tilbake innenfor 3-årsfristen. Data hentes fra **EMMA EDOC**
(`emmaedoc.no`) — deklarasjonsgrid + SAD-dokumenter — analyseres per varelinje, og
presenteres i et dashboard.

Tre gjenvinningssignaler:

| Signal | Hva det finner |
|--------|----------------|
| **RÅK** | Varer med innvilget RÅK-tollnedsettelse som likevel betalte standardsats. Produktmatch mot nedsettelsesregisteret er **agent-verifisert** (`data/raak-verdicts.json`). |
| **Preferanse** | Linjer som betalte toll med EØS-berettiget opphav uten at preferanse ble krevd. Landbruksvarer (HS kap. 1–24) flagges som «til gjennomgang» (EØS gir ikke full tollfritak — kun reduksjon via nedsettelse); ekte industrivarer (kap. 25+) som full preferanse. |
| **Produkt** | Samme produkt fortollet ulikt (HS/MVA/preferansekode) — klassifiseringsflagg. |

Alle beløp er i NOK (Tolletaten beregner i NOK); dashboardet kan vise andre valutaer
med **live ECB-kurs** (Frankfurter). «Sannsynlig (vektet)» er det ærlige tallet —
hvert signal vektes etter hvor sikker gjenvinningen er.

## Arkitektur

```
Playwright (login emmaedoc.no) ─▶ SQLite (data/emma.db) ─▶ analyse ─▶ dashboard
   src/pipeline.js                  src/db.js              src/analysis.js   web/
```

- **Innsamling** (`src/pipeline.js`, `src/modules/*`): headless Playwright henter
  deklarasjonsgrid + hver SADs `EmmaPDFMerge.aspx`, konverterer til varelinjer med
  box47-avgifter (`src/sad/`), og lagrer i SQLite. Kun lokalt.
- **Analyse** (`src/analysis.js`): datovalid RÅK-avstemming (`src/raak.js`,
  `src/period.js`) + preferanse + produkt → `insights()`.
- **Dashboard** (`web/`, React + Vite + shadcn/ui): Oversikt · Gjenvinning ·
  Deklarasjoner · Varer.

## Kom i gang (lokalt)

```bash
npm install
npx playwright install chromium        # engangs: headless nettleser
cp .env.example .env                    # fyll inn EMMA_USER / EMMA_PASS
node src/cli.js serve                   # dashboard på http://127.0.0.1:8899
```
`.env` er gitignorert; kredentialer leses ved kjøring og logges aldri. Krever
**Node 22+** (`node:sqlite`).

## CLI

```bash
node src/cli.js serve [port]     # kjør dashboardet lokalt (med live Refresh)
node src/cli.js build [from to]  # inkrementell innsamling (default: hele 3-årsvinduet)
node src/cli.js insights         # skriv gjenvinningsanalysen som JSON
node src/cli.js snapshot         # skriv api/_data/snapshot.js for Vercel-deploy
node src/cli.js window           # vis 3-årsfristen (Europe/Oslo)
node src/cli.js login|dump|fields  # smoke-test / selektor-tuning
```

`build` er inkrementell: deklarasjoner som allerede ligger i basen hentes ikke på
nytt. 3-årsvinduet regnes i norsk tid per kjøring.

## Deploy til Vercel (autentisert dashboard)

Dashboardet kan hostes på Vercel bak **Google-innlogging begrenset til @declaro.no**
(Better Auth + Vercel Postgres). Playwright-innsamlingen kan ikke kjøre serverless,
så den deployede appen leser et **snapshot** (`api/_data/snapshot.js`) som genereres
lokalt. Full oppskrift: **[DEPLOY.md](DEPLOY.md)**.

```bash
node src/cli.js build      # oppdater data lokalt
npm run snapshot           # skriv snapshot som deployes
vercel --prod
```

## Prosjektstruktur

```
src/            innsamling, analyse, lokal server, MCP-server (src/server.js)
  sad/          SAD-PDF → JSON (box47 toll + per-linje MVA)
  modules/      EMMA-grid + Linjer + SAD-fetch
api/            Vercel serverless-funksjoner (auth, data, status)
  _lib/         Better Auth-instans, FX, session-guard
  _data/        generert snapshot
web/            React-dashboard (Vite + shadcn/ui)
data/           SQLite-base + RÅK-register (lokalt, gitignorert)
docs/           datamodell + utviklingshistorikk
```

## Dokumentasjon

- **[DEPLOY.md](DEPLOY.md)** — Vercel + Better Auth + Google-oppsett.
- **[docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md)** — felt og kolonner.
- **[docs/HISTORY.md](docs/HISTORY.md)** — fase A–D utviklingsnotater.
