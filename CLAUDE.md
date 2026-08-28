# Declaro-applikasjonen — arbeidsregler for design

Dette repoet er applikasjonen bak declaro.no. Alt visuelt arbeid følger
`DESIGN.md` i dette repoet. Les det før du endrer noe i `web/`.

Kortversjonen — brudd på disse krever ny beslutning fra Magnus, ikke skjønn:

- **Ikke finn på farger.** Alle farger er tokens i `web/src/index.css`. Mangler
  en farge, legg den til der og dokumenter den i `DESIGN.md` først. Ingen
  Tailwind-paletter (`amber-500`, `slate-700`, …) i komponenter.
- **Diagramfarger er validert, ikke valgt.** Endrer du `--chart-*`, kjør
  validatoren for begge moduser og oppdater tallene i `DESIGN.md`. Slot-
  rekkefølgen er fargeblindhets-mekanismen og skal aldri re-ordnes.
- **Statusfarger er reservert** og opptrer alltid med ikon + tekst. De ligger
  hue-messig nær seriefargene, så etiketten er det som skiller dem.
- **Sidebaren er forest-deep i begge moduser.** Den følger ikke tema.
- **Mørk modus er egne trinn**, ikke en invertering, og bruker varme grønnsvarte
  nøytraler — aldri kjølig slate.
- **Overskrifter står i vekt 500** med hårfin `-webkit-text-stroke`. Ikke bruk
  600/700 for å gjøre dem tyngre.
- **Bruk skalaene.** Ingen nye `text-[…]`- eller `rounded-[…]`-verdier, ingen
  egne kontrollhøyder, ingen skygge utenom `shadow-overlay`. Mangler et steg,
  legg det i `tailwind.config.js` og dokumenter det.
- **Alt klikkbart er et ekte element** med synlig fokus. `onClick` på `<tr>`,
  `<th>` eller en `<div>` er et tastaturbrudd.
- **Skjul aldri tall i stillhet.** Filtrerer du bort noe, vis antall og beløp
  som ble utelatt, og en vei til å se det likevel.
- Norsk mot bruker. Enkelt, presist, uten byråkratspråk. Ikke «optimaliser»,
  «sømløs», «datadrevet innsikt».

Etter endringer i `web/`: `cd web && npm run build`, og se på resultatet i
`node src/cli.js serve` før du kaller det ferdig.

---

# Kodestandard

Reglene under er ikke smakssak. De gjelder all kode i repoet — `src/`,
`scripts/`, `api/` og `web/`.

## Språk i koden er amerikansk engelsk

Koden skrives på **amerikansk engelsk**, uansett hvilket språk utvikleren eller
en LLM samtaler på. Samtalespråket er irrelevant for filinnholdet.

Dette gjelder identifikatorer, filnavn, kommentarer, commit-meldinger,
loggmeldinger, feilmeldinger til utvikler, tester og testnavn. Amerikansk
staving: `color`, `normalize`, `analyze`, `canceled` — ikke `colour`,
`normalise`, `analyse`, `cancelled`.

To unntak, og bare disse:

1. **Tekst brukeren ser er norsk.** UI-strenger, e-postmaler, PDF- og
   Excel-etiketter, brukerrettede feilmeldinger. Tonefallet står i
   `DESIGN.md`. Koden rundt strengen er fortsatt engelsk.
2. **Felt som speiler en ekstern kilde beholder kildens staving.** Kommer
   navnet fra EMMA EDOC, Tolletaten eller tolltariffen, skriver vi det som
   kilden skriver det: `tollnummer`, `varenummer`, `raak`, `mva_25`. Da er
   navnet en referanse til et felt som finnes, ikke en oversettelse.

Alt annet oversettes. Interne begreper skal være engelske:

| Ikke                    | Bruk                    |
| ----------------------- | ----------------------- |
| `linjer`, `varelinje`   | `lines`, `lineItem`     |
| `beløp`, `belop`        | `amount`                |
| `dom`, `dommer`         | `verdict`, `verdicts`   |
| `vurdert`, `vurdering`  | `assessed`, `assessment`|
| `sats`, `satser`        | `rate`, `rates`         |
| `leverandør`            | `supplier`              |
| `opphav`                | `origin`                |

Rører du en funksjon med et norsk internt navn, gi den engelsk navn i samme
slengen — inkludert kallstedene. Ikke gjør det som egen opprydding uten at
Magnus har bedt om det.

Ingen `æ`, `ø` eller `å` i identifikatorer eller filnavn. Aldri.

Repoet er ikke i mål ennå: testnavnene i `test/` og enkelte kommentarer i
`src/analysis.js` er norske. De rettes når filen likevel er åpen, ikke som
et eget oppryddingspass.

## Navngivning

| Ting                       | Form              | Eksempel                          |
| -------------------------- | ----------------- | --------------------------------- |
| Variabler, funksjoner      | `camelCase`       | `chargeBreakdown`, `getRates`     |
| React-komponenter, typer   | `PascalCase`      | `DataTable`, `RecoveryRow`        |
| Konstanter (modulnivå)     | `UPPER_SNAKE`     | `DEFAULT_THRESHOLD`               |
| Private modulhjelpere      | `camelCase`       | `round2`, `trigrams`              |
| Moduler i `src/`, `api/`   | ett ord, små      | `analysis.js`, `pipeline.js`      |
| Skript i `scripts/`        | `kebab-case.mjs`  | `assess-pref.mjs`                 |
| React-sider og -komponenter| `PascalCase.tsx`  | `Dashboard.tsx`, `StatCard.tsx`   |
| Primitiver i `ui/`         | `kebab-case.tsx`  | `dropdown-menu.tsx`               |
| Moduler i `web/src/lib/`   | ett ord, små      | `format.ts`, `threshold.ts`       |

Bøyning er også konvensjon: flertall betyr flere (`rates`, ikke `rateList`),
`is`/`has` foran boolske verdier (`isEligible`, `hasProof`), `get` foran noe
som henter, `compute`/`build` foran noe som regner ut. En funksjon som
returnerer en verdi heter det den returnerer — ikke `doX`, ikke `handleX`
utenom eventhåndterere.

## Kommentarer

Kommentarer forklarer **hvorfor**, ikke hva. Koden sier allerede hva den gjør.
En kommentar som gjentar linja under er støy og skal bort.

Skriv kommentar når regelen kommer utenfra og ikke kan leses ut av koden — en
tollregel, en særhet i EMMA EDOC, en beslutning som ser feil ut til man kjenner
domenet. Vis gjerne regnestykket, som i `analysis.js`, der en dom gjelder en
gruppe og ikke en linje.

`TODO` uten navn og dato er forbudt. Skriv `// TODO(magnus, 2026-03-01): …`
eller la være.

## Struktur

- Én modul, ett ansvar. `analysis.js` regner, `pipeline.js` orkestrerer,
  `db.js` snakker med basen. Ikke bland.
- Regnelogikk hører hjemme i `src/`, ikke i en React-komponent. Kan tallet
  regnes ut to steder, er det allerede feil ett av dem.
- Ingen `default export` utenom React-sider. Navngitte eksporter lar seg
  søke opp.
- Nye avhengigheter krever en grunn. Repoet er bevisst tynt.

Etter endringer: `cd web && npm run build` for `web/`, `node --test test/*.test.js` for
`src/`. Begge skal være grønne før du kaller det ferdig.
