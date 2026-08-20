# Deploy til Vercel (autentisert dashboard)

Vercel hoster **dashboardet** (statisk frontend + `/api/*` serverless-funksjoner) bak
Google-innlogging begrenset til **@declaro.no**. Datainnsamlingen (Playwright-innlogging
mot emmaedoc.no) kan **ikke** kjøre serverless — den kjøres lokalt og produserer et
snapshot som deployes.

## Arkitektur

| Del | Kjører | Fil |
|-----|--------|-----|
| Frontend (React/Vite) | Vercel static | `web/` → `web/dist` |
| Auth (Better Auth, Google) | Vercel function | `api/auth/[...all].js`, `api/_lib/auth.js` |
| `/api/data`, `/api/status` | Vercel function (session-gated) | `api/data.js`, `api/status.js` |
| Data-snapshot | generert **lokalt**, committes/deployes | `api/_data/snapshot.js` |
| Innsamling (Playwright) | **kun lokalt** | `node src/cli.js build` |

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

## 4. Opprett auth-tabellene (én gang)

Med `DATABASE_URL` satt lokalt (i `.env` eller shell):

```bash
DATABASE_URL="postgres://…" npm run auth:migrate
```

Dette lager Better Auth-tabellene (`user`, `session`, `account`, `verification`) i Postgres.

## 5. Generer snapshot og deploy

```bash
# 1) samle inn / oppdater data lokalt (Playwright)
node src/cli.js build

# 2) skriv snapshot som deployes (api/_data/snapshot.js)
npm run snapshot

# 3) deploy
vercel --prod        # eller push til main hvis Git-integrasjon er koblet
```

**Oppdatere data senere:** kjør `node src/cli.js build` → `npm run snapshot` →
`vercel --prod` (eller commit + push). Dashboardet på Vercel er et statisk øyeblikksbilde
mellom hver slik oppdatering; «Refresh»-knappen vises kun i lokal modus (`cli.js serve`).

## Lokalt (uendret)

```bash
node src/cli.js serve      # åpen, ingen auth, med live Refresh
```
`VITE_HOSTED` er ikke satt lokalt, så auth-gaten er av og innsamlingen fungerer som før.
