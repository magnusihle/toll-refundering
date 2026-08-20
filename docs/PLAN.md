# Plan: vareidentitet og datakvalitet

Skrevet 2026-08-20 etter konsistensrevisjon av hele kravgrunnlaget. Hver oppgave
er liten, isolert og kan løses uavhengig — avhengigheter er markert. Beløp og
antall er målt mot dagens datagrunnlag (933 deklarasjoner, 257 krav, 71 862 kr
sannsynlig).

## Rotårsaken (funn A)

Samme fysiske vare splittes i flere grupper fordi leverandøren skriver varenavnet
ulikt per sending — «4618,100 Rødkløverblomst 100 g», «RØDKLØVERBLOMST»,
«4618 Rødkløverblomst 1 kg» er én vare, men blir 4–5 grupper. Målt omfang:

- 2 323 av 4 976 `desc:`-nøklede varelinjer starter med innbakt artikkelnummer
- 2 470 inneholder pakningsstørrelse («100 g», «120 stk»)
- normalisering ville slått sammen ~260 av 1 870 (aktør, vare)-grupper (14 %)
- konsekvens i dag: største mulighet vises som 20 083 kr, men varefamilien er
  25 428 kr fordelt på 3 kravgrupper

Det finnes **fire** identitetsregler som må bli én:

| Regel | Fil | Brukes til |
|---|---|---|
| `productKey` (`art:`/`desc:`) | `src/pipeline.js` | lagres i DB, styrer Varer-siden |
| `prefKey` (`HS\|DESC\|ORIGIN`) | `src/analysis.js` | oppslag i pref-verdicts.json — **må IKKE endres** (45 agentdommer er nøklet på rå beskrivelse) |
| `normProd` | `web/src/lib/recovery.ts` | gruppering av krav i UI |
| `identity`-fallback | `web/src/lib/group.ts` | fallback når product_key mangler |

`prefKey` og `raak-verdicts`-nøklene bruker RÅ beskrivelse — identitetsfiksen
rører dem ikke. Det er verifisert, og det er derfor planen er trygg.

---

## Arbeidsstrøm A — én vareidentitet

**A1. Felles normalisering, backend.** Ny `src/identity.js` med én eksportert
`normalizeProductText(desc)`: fjern ledende artikkelnummer-prefiks (`^\d[\d ,.]*`),
fjern pakningsstørrelser (`\d+ (g|gr|kg|ml|l|stk|mg|kaps?|tabl)\b`), senk/strippt
tegnsetting, kollaps whitespace. Unit-tester på reelle eksempler:
rødkløver-variantene → samme nøkkel; «22983 Rødkløver kap 400 mg» → EGEN nøkkel
(kapsler er en annen vare). *Liten. Ingen avhengigheter.*

**A2. Bruk den i `productKey` + re-nøkle DB.** `desc:`-grenen i
`productKey` går via A1 (behold `art:`-grenen urørt). Nytt script
`scripts/rekey-products.mjs` som UPDATER `goods_lines.product_key` i SQLite —
ingen EMMA-henting. Akseptanse: rødkløverblomst = 1 gruppe (25 linjer), kapsler
separat; (aktør, vare)-grupper ~1 870 → ~1 610; `totalLikely`/`count` UENDRET
(71 862,12 / 257). *Liten. Avhenger av A1.*

**A3. Samme regel i web.** Ny `web/src/lib/identity.ts` som speiler A1, brukt av
`normProd` i `recovery.ts`. Paritetstest: begge implementasjoner kjøres mot samme
JSON-fikstur (`test/fixtures/identity.json`) så de aldri glir fra hverandre.
Akseptanse: Gjenvinning viser rødkløverblomst som ÉN rad, 8 krav, 25 428 kr.
*Liten. Avhenger av A1 (fiksturen).*

**A4. Rydd fallback i `group.ts`.** `identity`-fallbacken (kun linjer uten
product_key) bruker samme regel. Nesten gratis etter A2. *Triviell.*

**A5. Publiser og verifiser.** `npm run publish`, deretter revisjonsskriptet fra
2026-08-20: totaler identiske lokal/prod, gruppeantall endret som forutsagt i A2.
*Triviell. Avhenger av A2+A3.*

## Arbeidsstrøm B — kravtekster som er tarifftekst

41 av 257 krav (1 000 kr) har tolltariffens overskrift som «produktnavn»
(«Tilberedte næringsmidler. ikke nevnt…»). De kan ikke matches mot noe og ser
like ut i listen.

**B1. Undersøk hvor ekte varetekst finnes.** For 3–5 av disse: sammenlign
`description`, `article_number`, SAD-boks 31 og Linjer-griden. Konkluder om bedre
tekst er tilgjengelig eller om EMMA rett og slett ikke har den. *Liten,
ren undersøkelse.*

**B2. Merk generiske tekster i UI.** Uavhengig av B1: krav der beskrivelsen
matcher tariffoverskrift-mønsteret får etikett «(tarifftekst)» og vis
`article_number` når det finnes. Ingen beløpsendring. *Liten.*

## Arbeidsstrøm C — avgiftsgapet på 332 025 kr

440 deklarasjoner med linjer fra Linjer-griden mangler avgifter per linje
(målt: 332 025 kr deklarert som ikke er fordelt på type). Vises i dag ærlig som
dekning-varsel — men burde tettes.

**C1. Diagnose.** Velg 3 Linjer-deklarasjoner, hent SAD-en manuelt, avgjør om
box 47-avgiftene finnes i kilden men tapes i ekstraksjonen, eller om Linjer-
griden faktisk ikke bærer dem. *Liten, ren undersøkelse. Trenger EMMA-tilgang.*

**C2. Implementer henting** (kun hvis C1 sier «finnes i kilden»): utvid
ekstraksjonen og kjør inkrementell re-innsamling for de 440. *Middels. Avhenger
av C1.*

## Arbeidsstrøm D — drift og tilgang

**D1. Alias-redirect.** `toll-refundering.vercel.app` gir `state_mismatch` ved
innlogging (OAuth-callback er bundet til `refund.declaro.no`). Legg redirect
i `vercel.json` fra alias til kanonisk domene. *Triviell.*

**D2. Mobilverifisering.** Responsive breakpoints er aldri visuelt verifisert.
Manuell sjekk på telefon: sidebar-skuff, horisontal rulling i tabellene,
KPI-stabling, utvidede rader. *Manuell, 10 min.*

**D3. Vurder restpartiet.** 214 uvurderte preferanselinjer (10 700 kr betalt
toll) holdes utenfor totalene. Kjør agentvurderingen på nytt (samme prosess som
ga pref-verdicts.json) og publiser. *Operatøroppgave — nye varer må
agent-vurderes, heuristikken skal ikke gjette.*

## Arbeidsstrøm E — BKU-vedlikehold

**E1. Oppfrisk-script for korpuset.** `data/bku-rulings.json` er et øyeblikks-
bilde fra 2026-02-19. Lag `scripts/refresh-bku.mjs` mot varenummer.toll.no-API-et
(hentelogikken finnes i customs-hs-matcher). Kjøres manuelt ved behov. *Liten.
Lav prioritet.*

---

## Rekkefølge

```
A1 ──► A2 ──► A4 ─┐
  └──► A3 ────────┼──► A5
B1 (uavhengig)    │
B2 (uavhengig)    │
C1 ──► C2         │
D1, D2, D3, E1 (uavhengige)
```

Størst verdi per innsats: **A-strømmen** (retter det brukersynlige løftet «én
rad per vare» og viser 25 428 kr-saken samlet), deretter **C1** (størst
pengebeløp bak et ubesvart spørsmål).

## Invariantene som IKKE skal endres

1. `prefKey`/`raak-verdicts`-nøkler (rå beskrivelse) — dommene må fortsette å slå til.
2. `totalLikely` = 71 862,12 og `count` = 257 gjennom hele A-strømmen — identitet
   endrer visning, aldri beløp.
3. Beløp/CSV regnes alltid på flate krav, aldri på grupper.
