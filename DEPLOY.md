# Deploy til Vercel (autentisert dashboard)

Vercel hoster **dashboardet** (statisk frontend + `/api/*` serverless-funksjoner) bak
Google-innlogging begrenset til **@declaro.no**. Datainnsamlingen (Playwright-innlogging
mot emmaedoc.no) kan **ikke** kjøre serverless — den kjøres lokalt, og dataene
**publiseres til prod-databasen** (Neon/Vercel Postgres) med `npm run publish`. Den
deployede appen leser live fra databasen, så oppdatering av data krever ingen ny deploy.

## Arkitektur

| Del | Kjører | Fil |
|-----|--------|-----|
| Frontend (React/Vite) | Vercel static | `web/` → `web/dist` |
| Auth (Better Auth, Google) | Vercel function | `api/auth/[...all].js`, `api/_lib/auth.js` |
| `/api/data`, `/api/status` | Vercel function (session-gated, leser Postgres) | `api/data.js`, `api/status.js` |
| Data i prod | `dashboard_snapshot`-rad i Postgres, pushet med `publish` | `src/pgsync.js` |
| Innsamling (Playwright) → lokal SQLite | **kun lokalt** | `node src/cli.js build` |

## 1. Vercel Postgres / Neon

Opprett en Postgres (Vercel → Storage → Postgres, eller Neon). Kopier
connection-stringen (med `sslmode=require`).

## 2. Google OAuth

Google Cloud Console → APIs & Services → Credentials → **OAuth client ID** (Web):
- **Authorized JavaScript origins:** `https://DITT-DOMENE.vercel.app`
- **Authorized redirect URIs:** `https://DITT-DOMENE.vercel.app/api/auth/callback/google`

(Valgfritt, for å bare vise Workspace-kontoer: sett opp OAuth-samtykke som Internal i
declaro.no-organisasjonen. Domenegrensen håndheves uansett server-side.)

## 3. Miljøvariabler i Vercel (Project → Settings → Environment Variables)

| Variabel | Verdi |
|----------|-------|
| `DATABASE_URL` | Postgres connection-string (Neon/Vercel Postgres) |
| `BETTER_AUTH_SECRET` | tilfeldig, f.eks. `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | `https://DITT-DOMENE.vercel.app` (produksjonsdomenet) |
| `GOOGLE_CLIENT_ID` | fra Google OAuth |
| `GOOGLE_CLIENT_SECRET` | fra Google OAuth |
| `ALLOWED_EMAIL_DOMAIN` | `declaro.no` (default hvis utelatt) |
| `VITE_HOSTED` | `1` — skrur på auth-gate + skjuler lokal Refresh-knapp (build-time) |

## 4. Opprett tabellene

**Auth-tabeller** (én gang) — med `DATABASE_URL` satt lokalt:
```bash
DATABASE_URL="postgres://…" npm run auth:migrate
```
**Data-tabellen** (`dashboard_snapshot`) opprettes automatisk første gang du kjører
`npm run publish` (se steg 5) — ingen egen migrering nødvendig.

## 5. Publiser data og deploy

Første gang:
```bash
vercel --prod                       # deploy frontend + funksjoner (koden)
```
Deretter, hver gang du vil oppdatere dataene i prod:
```bash
node src/cli.js build               # inkrementell innsamling til lokal SQLite (henter
                                    # kun deklarasjoner som IKKE allerede ligger i basen)
DATABASE_URL="postgres://…" npm run publish   # push lokal data → prod-DB (ingen re-scrape)
```
`publish` beregner dashboard-payloaden fra den lokale basen og upserter den til
`dashboard_snapshot`-raden i Postgres. **Ingen ny `vercel`-deploy trengs** for å
oppdatere data — det deployede dashboardet leser raden live og auto-oppdaterer åpne
faner innen ~15 s. Ny `vercel --prod` trengs kun når du endrer selve koden.

> `DATABASE_URL` må være satt lokalt for `publish` (legg den i `.env`, som er gitignorert).

## Lokalt (uendret)

```bash
node src/cli.js serve      # åpen, ingen auth, med live Refresh
```
`VITE_HOSTED` er ikke satt lokalt, så auth-gaten er av og innsamlingen fungerer som før.
