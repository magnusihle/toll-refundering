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
- **BKU-presedens** (`src/bku.js`): når agenten foreslår et annet varenummer,
  hentes tolletatens egne klassifiseringsuttalelser for BÅDE foreslått og
  deklarert kode fra `data/bku-rulings.json` (8 969 uttalelser, lokal ressurs —
  `data/` er gitignored; mangler den, degraderer analysen stille til ingen
  presedens). Modulen feller ingen dom: den viser hva myndigheten HAR plassert
  under hver kode og lar leseren vurdere. Presedens, ikke vedtak.
- **E-post til 3PL** (`web/src/lib/email.ts` + `web/src/lib/xlsx.ts`): ett klikk
  på Gjenvinning-siden laster ned en formatert Excel-arbeidsbok (fanene
  «Oversikt» — prioritert per sak, «Krav per fortolling» — begrunnelse og
  kravtekst per krav, og «Om»), og åpner e-postprogrammet via `mailto:` med et
  kort følgebrev (totaler per type, hastefrister, de tre anmodningene).
  Detaljene bor i vedlegget, ikke i e-posten. Brukeren fyller inn 3PL-adressen,
  drar inn filen og sender.
- **Headless agent-vurdering** (`scripts/assess-pref.mjs`, `npm run assess`):
  vurderer preferanse-gruppene som ennå ikke har dom ved å kjøre `claude -p`
  (websøk mot tolltariffen, batcher i parallell — `--batch`/`--parallel`) og
  merge nye dommer inn i `data/pref-verdicts.json` — samme nøkkel og skjema som
  de eksisterende. Skriver etter hver ferdige batch, så avbrudd koster maks én
  batch, og verdict-cachene er mtime-invalidert så et kjørende dashbord ser nye
  dommer uten restart. Rutine etter ny innsamling: `build` → `assess` →
  `publish`.
- **Dashboard** (`web/`, React + Vite + shadcn/ui + react-router): sidebar-navigasjon
  med egne ruter — `/` dashbord · `/gjenvinning` · `/avgifter` · `/varer` ·
  `/deklarasjoner` · `/leverandorer`. Filtre ligger i URL-en (`?type=`, `?frist=haster`,
  `?kat=`), så toppkortene er ekte lenker inn i det filtrerte utvalget.

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
npm run assess                   # agent-vurder uvurderte preferanse-grupper (headless claude)
node src/cli.js publish          # push lokal data → prod-DB (Neon/Vercel Postgres)
node src/cli.js window           # vis 3-årsfristen (Europe/Oslo)
node src/cli.js login|dump|fields  # smoke-test / selektor-tuning
```

`build` er inkrementell: deklarasjoner som allerede ligger i basen hentes ikke på
nytt. 3-årsvinduet regnes i norsk tid per kjøring.

## Deploy til Vercel (autentisert dashboard)

Dashboardet kan hostes på Vercel bak **Google-innlogging begrenset til @declaro.no**
(Better Auth + Vercel Postgres). Playwright-innsamlingen kan ikke kjøre serverless, så
den kjøres lokalt og dataene **publiseres til prod-databasen** — den deployede appen
leser live derfra, uten ny deploy per dataoppdatering. Full oppskrift:
**[DEPLOY.md](DEPLOY.md)**.

```bash
node src/cli.js build      # inkrementell innsamling til lokal SQLite (ingen re-scrape)
npm run publish            # push lokal data → prod-DB (Neon/Vercel Postgres)
```

## Prosjektstruktur

```
src/            innsamling, analyse, lokal server, MCP-server (src/server.js)
  sad/          SAD-PDF → JSON (box47 toll + per-linje MVA)
  modules/      EMMA-grid + Linjer + SAD-fetch
api/            Vercel serverless-funksjoner (auth, data, status)
  _lib/         Better Auth + delt Postgres-pool, FX, snapshot-leser, session-guard
web/            React-dashboard (Vite + shadcn/ui)
data/           SQLite-base + RÅK-register (lokalt, gitignorert)
docs/           datamodell + utviklingshistorikk
```

## Dokumentasjon

- **[DEPLOY.md](DEPLOY.md)** — Vercel + Better Auth + Google-oppsett.
- **[docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md)** — felt og kolonner.
- **[docs/HISTORY.md](docs/HISTORY.md)** — fase A–D utviklingsnotater.
