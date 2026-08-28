# Designsystem – Declaro-applikasjonen

Denne appen ligger **bak** declaro.no. Den skal føles som en fortsettelse av
landingssiden, ikke som et separat produkt. Kilden til sannhet for merkevaren er
`Documents/Declaro/website/DESIGN.md` og `app/globals.css`; dette dokumentet er
app-tilpasningen. Ved konflikt vinner merkevaredokumentet på farge, typografi og
tone — dette dokumentet vinner på tetthet, tilstander og datavisning, som
landingssiden ikke sier noe om.

Implementasjonen ligger i `web/src/index.css` (tokenlaget) og
`web/tailwind.config.js` (font, radius, farge-mapping). Ikke skriv farger direkte
i komponenter — hvis en farge mangler, legg den til her først.

## Forholdet til landingssiden

| Arves ordrett | Tilpasses appen | Arves IKKE |
|---|---|---|
| Palett, hue-ankre, papirfølelse | Tetthet, radius, tabellrytme | Seksjonsdramaturgien |
| Font-stack og hårfin overskrift-stroke | Statusfarger, tilstander | Illustrasjonslaget |
| Forest som merkevarefelt | Mørk modus | «Kun lys modus» |
| Rolig, presis, etablert tone | Diagrampalett | Scroll-fortellingen |

To bevisste avvik fra landingssiden, begge besluttet av Magnus 2026-08-27:

1. **Mørk modus finnes her.** Landingssiden er kun lys som merkevarevalg. Appen
   er et arbeidsverktøy folk står i hele dagen, så mørk modus beholdes. Den er
   utledet i merkevarens retning: varme grønnsvarte nøytraler fra
   forest-deep-familien, aldri de kjølige slate-tonene shadcn kommer med.
2. **Diagramfarger finnes her.** Landingssiden har ingen. Se eget avsnitt.

## Skallet — navigasjon uten streker, innhold i ett kort

Appen har to flater og én kant mellom dem. Navigasjonen er forest-deep helt ut
til vinduskanten, og innholdet står i ET KORT som flyter i den samme flaten:
0,5rem ramme rundt, `rounded-xl`, hårfin `--border` rundt kanten. Formen er
shadcn sin `dashboard-01`, med Declaros farger — ingen nye tokens, kortflaten er
nøyaktig den `--background` siden hadde før.

**Navigasjonen har ingen streker.** Ingen kant til høyre, ingen skillelinje under
merket, ingen strek over 3-årsvinduet, ingen ramme rundt ordmerket. Gruppene
skilles av luft og eyebrows, slik seksjonene på en side gjør. Kortkanten er den
ENESTE linjen i skallet, og det er den som skiller navigasjon fra innhold.

**Kanten på kortet betyr mest i mørk modus.** Der ligger kortflaten (#101A15) og
rammen (#0B1712) tett, og uten kanten flyter de sammen. I lys modus gjør papir
mot forest-deep jobben alene, men kanten står i begge moduser — én form, ikke to.

**Kortet står stille, innholdet ruller.** Kortet er nøyaktig vinduet høyt minus
rammen, topplinjen er første rad i det, og rullingen ligger i kortets egen flate
(`SidebarScroll`, `data-app-scroll`). Vinduet ruller ikke i det hele tatt.
Topplinjen trenger derfor ingen `sticky` for å bli stående, og rammen rundt
kortet forsvinner aldri under den.

*Merk:* kortet er SKALLET, ikke seksjonene. Regelen «seksjoner er åpne, ikke
kort» under «Formspråk» står uendret — inne i kortet skiller avstand fortsatt
seksjonene, og det er ingen kort i rutenett.

## Tetthetsbudsjett — arbeidsflate, ikke kundeflate

Landingssiden og appen deler palett, typografi og tone. Det som skiller dem er
TETTHET og MENGDE — hvor mye som vises samtidig. Tabellen over sier at
seksjonsdramaturgien ikke arves, men dramaturgiens minste enhet er
**ingress-under-overskrift**, og den lakk inn likevel: én per side og én per
seksjon, med landingssidens tekstmål (`80ch`, `78ch`).

Målt 2026-08-28: landingssidens hero bruker 35 ord på hele førsteskjermen. Varer
brukte 118 ord før første tall; Gjenvinning 88 ord og 25 fokuserbare kontroller —
filtrert ned til ETT krav. Arbeidsflaten var mer redaksjonell enn den
redaksjonelle flaten.

Budsjettet, per side, over første datarad:

- **Høyst 25 ord stående forklaring.**
- **Høyst 7 sidenivå-kontroller**, og de ligger i ETT bånd. Én kontroll er én
  beslutning: en fanegruppe med fire valg teller som ÉN, ikke fire. Krom i
  topplinjen teller ikke med, og heller ikke ⓘ-forklaringene — de endrer ikke
  hva du ser, og å telle dem ville presse forklaringen tilbake til prosa.
- **Én forklaring per begrep, ett sted.**

Tre regler som holder budsjettet:

- **Ingress.** En side har ingen ingress. Trenger den en linje, bærer den
  TILSTAND, ikke definisjon. «Arnika AS · 2023-08-28 – 2026-08-28» er tilstand.
  «Én rad per leverandør, med hele fortollingshistorikken» er en definisjon
  tabellen viser i ett blikk — og som ikke skal leses på nytt hver dag.
- **Hint under et tall.** Kan bære nevner, enhet, andel eller en affordanse —
  aldri en definisjon.
- **Forklaring bor på begrepet den forklarer**, ikke i et avsnitt over tabellen:
  «Gruppert» forklares på Gruppert-bryteren, minstebeløpet på minstebeløp-filteret.

Budsjettet gjelder TEKST, aldri tall. Regelen under «Minstebeløp» står uendret: et
tall som filtreres bort viser alltid antall og beløp.

Den motsatte feilen er like ille. Kort ned prosaen, ikke stemmen — «rolig, presis,
etablert tone» står i «Arves ordrett», og «Ingen rader» er ikke en tomtilstand.

### Fire bånd — fast rekkefølge på hver arbeidsliste

| Bånd | Innhold | Regel |
|---|---|---|
| 1 · Identitet | Sidenavn, én gang. Krom til høyre. | Topplinjen eier navnet — ingen `<h1>` i sidekroppen. Krom er aldri fylt eller innrammet. |
| 2 · Tilstand | Tallene. | Lesetall, og de beskriver DET DATASETTET SOM VISES. |
| 3 · Omfang | Datasett → filtre → søk → telling. | Alt som endrer hvilke rader du ser, i ÉN rad rett over listen. |
| 4 · Listen | Tabellen, og handlinger på utvalget. | Handlingslinjen finnes bare når noe er valgt. |

**Et tall kan navigere, men aldri filtrere siden det står på.** `StatCard` støtter
både `to` og `onClick`. `to` er en lenke til en annen side; `onClick` som filter
lager en andre kontroll for en tilstand som allerede har én i bånd 3.

**Én fylt knapp per side, og aldri i kromet.** Fyll er reservert for handlingen som
sender noe ut av appen. Alt annet er outline eller ghost.

Oversiktssider (Dashbordet) har bånd 1 og 2, men ikke bånd 3.

**Hver arbeidsliste starter med tallene.** Bånd 2 kommer alltid før bånd 3, på
alle sider. En side som åpner med en kontrollrad ser ut som et annet produkt enn
de andre.

### Verktøylinjen — én form, alle tabeller

```
[⌕ Søk … ] [Filter 2] Preferanse × ≥ 500 kr × 42 av 321 krav Tøm alle   [Visning ⌄]
──────────────────────────────────────────────────────────────────────────────────
 ☐  Produkt          Aktør        Frist      Beløp
```

**Alt står på ÉN linje.** Brikkene hører til knappen de kommer fra og står rett
etter den — ikke som en egen rad under, som kostet en full linjehøyde på hver
side hver gang et filter var aktivt. Linjen brytes bare når plassen faktisk tar
slutt.

VENSTRE er HVA — søk og filtre, altså hvilke rader som finnes.
HØYRE er HVORDAN — visning, altså samme rader i en annen form.
Linear formulerer skillet slik: filtre avgrenser listen, visningsvalg endrer hva
som vises på hver rad. Blandes de, betyr verken filterknappen eller brikkene
én ting.

1. **Søk først, helt til venstre.** Aldri midt på linjen.
2. **Filterknapp rett etter**, med teller når noe er aktivt. Ingen andre
   kontroller på linjen — ingen faner, ingen løse nedtrekk.
3. **Brikker rett etter filterknappen**, kun når noe er aktivt, med «Tøm alle».
4. **Visning ytterst til høyre.** Hver tabell har minst «Tetthet», så knappen
   står samme sted også der siden ikke har gruppering.
5. **Telling bare når filtreringen har gjort noe**, og den sier hva den teller:
   «42 av 321 krav», ikke «42 rader», som bare gjentok et nøkkeltall.
   Paginering nederst sier «Viser 1–25 av 933 fortollinger».
6. **Brikker er forbeholdt filtre.** Visningsvalg gir aldri brikke og teller
   aldri på filterknappen.

**Filtre er DATA, ikke JSX.** Hver side deklarerer en `FilterDef[]`
(`lib/filters.ts`); panelet, brikkene, telleren og URL-synkingen bygges av
deklarasjonen. Det er dette som gjør at filter nummer tretti koster like lite som
filter nummer tre — og som hindrer at en side finner på sin egen rekkefølge.

**Ett filter er aktivt nøyaktig når verdien ikke er `fallback`** — samme
betingelse som avgjør om det står i URL-en. Én regel styrer brikke, teller og
delbar lenke. Filtertilstand hører i URL-en (delbar, overlever refresh);
visningsvalg hører i localStorage (en preferanse, ikke et utvalg).

**Bevisst avvik fra kildene.** Polaris anbefaler «no more than 2 or 3 promoted
filters» og Pajamas «3-5 … when more are required, consider the filter
component». Her ligger ALT bak knappen, også når en side har ett filter. Grunnen
er at appen har fire tabellsider som skal føles like — et hensyn de dokumentene
ikke veier, siden de beskriver produkter med én tabelltype. Prisen er ett klikk
ekstra på de rolige sidene. Kilder:
<https://helios.hashicorp.design/patterns/filter-patterns>,
<https://carbondesignsystem.com/patterns/filtering/>,
<https://design.gitlab.com/patterns/filtering/>.

**Faner er ikke et filter.** En fane fortjener plassen bare når delmengdene er
en status-partisjon av samme ting, gjensidig utelukkende, varige og navngitte, og
når de endrer FLATEN under seg — andre kolonner, andre handlinger. «Krav / Ikke
grunnlag / RÅK-kontroll» besto ingen av testene: to av dem er belegg man ikke
handler på, ingen lenker i appen pekte inn i dem, og fanene forsvant idet man
brukte dem. De ligger nå som utvidbare bolker under tabellen, i «Slik ble tallet
kontrollert».

Oversiktssider (Dashbordet) har bånd 1 og 2, men ikke bånd 3.

**Hver arbeidsliste starter med tallene.** Bånd 2 kommer alltid før bånd 3, på
alle sider. En side som åpner med en kontrollrad ser ut som et annet produkt enn
de andre.

### Omfangsbåndet — fast rekkefølge, fast kontrolltype

Båndet er én rad rett over listen, og slottene står i samme rekkefølge overalt:

| Slot | Rolle | Kontroll |
|---|---|---|
| `datasets` | Hvilke rader finnes — et annet datasett, andre kolonner | Linjerte faner, med tall per valg |
| `filters` | Avgrens innenfor datasettet | **Select**, med gjeldende verdi i triggeren og tall i alternativene |
| `view` | Samme rader, annen form (gruppert/flat) | Linjerte faner |
| søk | Fritekst | Inputfelt |
| telling | Hvor mye som vises | Tekst, høyrestilt |

Regelen bak: **faner bærer STRUKTUR, Select bærer FILTER.** Faner tar bredde per
alternativ og roper — det skal bare det som endrer hva slags rader du ser.
Et filter skal kunne kombineres med andre filtre og vise valgt verdi uten å
bruke en hel rad. Uten regelen ble samme rolle uttrykt tre ulike måter: årstall
var faner på Deklarasjoner, kravtype var faner på Gjenvinning, og avviksutvalget
var en Select på Varer.

Slottene ligger på `DataTable`s `scope`-prop, ikke som fri JSX, nettopp så en
side ikke kan finne på sin egen rekkefølge. `datasets` skilles fra resten med en
hårfin loddrett strek, som i control margin.

### Rulling — én sone om gangen, aldri to

En side har tall på toppen og en lang tabell under. Uten en regel er det to
rullesoner som konkurrerer: står markøren over tabellen ruller tabellen, står
den to centimeter til venstre ruller siden. Samme håndbevegelse gjør to ting, og
du må sikte for å komme videre.

Modellen har tre faser, og gjelder ALLE tabeller (`lib/tablescroll.ts`):

1. **Siden ruller** til tabellens overkant treffer linjen under topplinjen.
   Rullingen stoppes nøyaktig der — et raskt hjuldrag kan ikke kaste tabellen
   forbi og hoppe over innholdet i den.
2. **Hjulet tilhører tabellen**, uansett hvor markøren står.
3. **Siden ruller videre** når tabellen er tømt — paginering, og det som står
   under.

Oppover er det det samme i revers, så veien ned og veien opp er den samme veien.
«Siden» er kortets egen rulleflate (`data-app-scroll`), ikke vinduet — vinduet
ruller ikke. Tabellen er derfor nøyaktig så høy som den flaten:
`--page-scroll` i `index.css`, som er vinduet minus topplinjen, og fra `md` også
minus rammen og kanten rundt kortet. Når tabellen ligger på linjen fyller den
flaten, og fase 2 har en synlig grunn — det er ikke noe annet på skjermen.
Endrer du rammen rundt kortet, endrer du `--page-scroll` i samme slengen.

Vi tar bare over hjulet der nettleseren ville gjort noe annet enn dette. Ruller
siden mot en tabell langt nede, gjør den allerede det riktige, og beholder sin
egen glidning. **Nær linjen styrer vi alltid selv** — nettleseren ruller mykt, og
et hjuldrag ligger og animerer etter at hendelsen er behandlet, så en måling rett
før linjen er alltid litt bakpå og tabellen lander forbi. Marginen er
`NATIVE_MARGIN`, og et absolutt hopp avbryter animasjonen som ligger i luften.
Menyer og paneler med egen rulling rører vi aldri.

**En åpen rad står fast.** Sammendragslinjen kleber rett under kolonnetitlene så
lenge detaljen er på skjermen: du skal aldri lese en begrunnelse uten å se
hvilken vare den gjelder. Hver rad er sin egen `<tbody>`, og når detaljen er
passert slipper linjen taket — det siste er målt i JS, fordi en klebrig celle i
Chrome er bundet av HELE tabellen og ellers blir hengende over rader den ikke
har noe med.

**Samme regel én etasje ned.** En kildetabell inne i detaljen kleber sine egne
kolonnetitler rett under varelinjen — hundre fortollinger uten kolonnenavn er
ikke lesbare. De tre lagene stables: sidens kolonnetitler, varelinjen,
kildetabellens kolonnetitler. Høyden på varelinjen er `--row-bottom`, satt av
`DataTable`, som er den eneste som vet hva den er. En kildetabell får ALDRI
`overflow` — da hadde titlene klebet til boksen i stedet for til sidens tabell,
og siden hadde fått en tredje rullesone. Er den bred, ruller den vannrett sammen
med tabellen den står i.

## Farger

Tokenene er merkevarens hex-verdier oversatt til HSL-tripler, fordi shadcn-laget
konsumerer dem som `hsl(var(--x))`. Kommentaren bak hver linje i `index.css`
oppgir originalen.

**Lys modus:** `background` = canvas `#F7F4ED` · `card`/`popover` = paper
`#FFFDF8` · `foreground` = ink `#17231D` · `muted-foreground` = ink-soft
`#4F5B54` · `primary` = forest `#153E31` · `secondary`/`accent` = sage `#DCE5DC`
· `border`/`input` = line `#D7D2C7`.

**Trinn, ikke nye farger.** Paletten gir én verdi per rolle; en tett app trenger
en trapp. `--surface-sunken`, `--secondary-strong` og `--border-strong` finnes
derfor som ekte tokens for nedsenket panel, hover/valgt og lette skillelinjer.
Uten dem ender alt som opasitets-triks (`secondary/20`, `/25`, `/40`) som drifter
mellom komponenter. Trenger appen mer variasjon: legg til flere TRINN i disse
hue-familiene — aldri en ny hue, som ville brutt både merkevaren og
fargeblindhets-arbeidet i diagrampaletten.

**Sidebaren er forest-deep `#0D2D23` i BEGGE moduser.** Det er et bevisst grep:
sidebaren bærer merkevarefeltet, og lar innholdsflaten være papir. Den skal ikke
følge modus.

**Mørk modus** er egne trinn, ikke en invertering: `background #101A15` ·
`card #16221C` · `popover #1B2822` · `border #2C3A33` · `primary #8FB49A`
(lysere, så den er synlig som fyll) · `sidebar #0B1712`.

### Statusfarger — reservert

Merkevarepaletten har ingen rød eller varselfarge. Disse er utledet i den varme
retningen og er **reservert for tilstand**. De skal aldri gjenbrukes som serie i
et diagram.

| Token | Lys | Mørk | Bruk |
|---|---|---|---|
| `destructive` | `#9C2A19` | `#CE5540` | Feil, sletting |
| `success` | `#2C6B4A` | `#6FA980` | Bekreftet, fullført |
| `warning` | `#8A6520` | `#C9A24A` | «Til gjennomgang», frist nærmer seg |

`warning` **er** mineral — palettens definerte sjeldne signalaksent — dyphet til
4.8:1 som liten tekst på elfenben. Den erstattet Tailwinds `amber-*`, som var den
eneste hardkodede fargen igjen i komponentene.

Fordi paletten i praksis bare har to hue-ankre, ligger `destructive` nær
`chart-3` og `success`/`warning` nær `chart-1`/`chart-2`. **Derfor: statusfarger
opptrer alltid med ikon + tekst, aldri farge alene.** Det er mitigeringen — ikke
en detalj som kan droppes.

## Diagrampalett

Utledet fra merkevarens hue-ankre — grønn H158, bronse H80 — pluss ett
terrakotta-anker H28, og **verifisert med validatoren**, ikke øyemålt.

| Slot | Lys | Mørk | Signal |
|---|---|---|---|
| `--chart-1` | `#2c8157` | `#34ab72` | Preferanse / primærserie |
| `--chart-2` | `#bd8708` | `#bd8708` | RÅK |
| `--chart-3` | `#8e2b24` | `#964940` | Produkt |

Resultat (all-pairs, mot kortflaten `#FFFDF8` lys / `#16221C` mørk):

- Lys: verste par ΔE **9.9** (protan), normalsyn **19.4**, kontrast PASS.
- Mørk: verste par ΔE **9.3** (deutan), normalsyn **17.0**, `#964940` ligger på
  2.6:1 og krever derfor synlig etikett eller tabellvisning — som
  Gjenvinning-siden allerede gir.

Til sammenligning scoret den generiske blå/oransje/aqua-trioen som lå her før
ΔE 9.2. Den nye paletten er altså både mer på merkevaren og bedre separert.

**Hvorfor ikke bare bruke merkevarefargene rått:** forest, moss og sage måler
metning C≈0.04–0.08 mot validatorens gulv på 0.10 og «leser som grått» som
identitetsfarge. Rå tokens feiler tre av seks sjekker — moss mot mineral havner
på ΔE 7.8 i normalsyn, altså vanskelig å skille selv med fullt fargesyn.
Slektskapet til merkevaren går derfor gjennom **hue-familien**, ikke gjennom
tokenverdien.

**Regler:** slottrekkefølgen ER fargeblindhets-mekanismen — aldri re-ordne, aldri
generer en fjerde hue. En fjerde serie folder til «Annet» eller blir små
multipler. Ingen dobbel y-akse. Tekst bærer alltid teksttokens, aldri seriefargen.

Skal paletten endres, kjør validatoren på nytt for begge moduser:

```bash
node scripts/validate_palette.js "#2c8157,#bd8708,#8e2b24" --mode light --surface "#FFFDF8" --pairs all
node scripts/validate_palette.js "#34ab72,#bd8708,#964940" --mode dark  --surface "#16221C" --pairs all
```

(fra `dataviz`-skillets katalog)

## Typografi

Skalaen ligger som klasser i `index.css` (`t-page`, `t-section`, `t-lead`,
`t-body`, `t-small`, `t-eyebrow`) og er hele skalaen appen har. Komponenter
plukker fra dem og finner aldri opp en ny `text-[…]`-verdi. Hierarkiet kommer fra
SKALA og LUFT, ikke fra at alt er halvfeitt.

Samme stack som landingssiden, så typografien flytter seg inn uten
font-loading-risiko:
`"Helvetica Neue", "Neue Haas Grotesk", Helvetica, Arial, sans-serif`.

`h1–h3` bærer `-webkit-text-stroke: 0.007em currentColor`. Systemstacken har
ingen vekt mellom Medium (500) og Bold (700) — CSS 600 rendres som full Bold — så
«litt tykkere» overskrifter løses med stroken. **Ikke kompenser med 600/700.**

Hold deg til den etablerte skalaen. Fremhev med snitt, farge og luft, ikke med
nye størrelser. Tall som skal sammenlignes vertikalt får `.tabnum`.

Ingen AI-typiske formateringsgrep: ingen kursiv kontrastlinje, ingen blandede
snitt for effekt, ingen uppercase eyebrow over en overskrift. «Blandede snitt»
gjelder også **brødtekst** — ingen `<b>` inne i et løpende avsnitt for å framheve
et ord. Trenger en setning uthevet, er den som regel for lang.

## Minstebeløp — grensen for hva som vises

Hver fortolling må omberegnes for seg i TVINN, så ARBEIDET ligger per kravlinje.
Et krav på 4 kr koster mer å hente enn det gir. I dagens grunnlag er 104 av 321
linjer under 5 kr — til sammen 52 kroner — og 75 % av linjene er under 100 kr og
utgjør 5 % av verdien. Med grensen på 500 kr står 42 linjer igjen som holder
94 % av verdien.

Grensen bor i `lib/threshold.ts`, standard 500 kr, justerbar på Gjenvinning og
delt med dashbordet. Verdien ligger i URL-en (delbar lenke) med localStorage som
fallback.

**Den er et visningsfilter, aldri en sletting.** Der noe filtreres bort skal
antallet og beløpet alltid stå, med ett klikk for å vise det likevel. Et tall som
forsvinner uten forklaring er verre enn støyen det fjernet.

## Formspråk

Dette er hoveddelen av tilpasningen. shadcn er fortsatt grunnlaget — Radix,
komponent-API-ene og variantene står urørt — men uttrykket er lagt om fra
«admin-dashboard» til landingssidens redaksjonelle språk.

**Seksjoner er åpne, ikke kort.** Dette gjelder INNHOLDET; skallet er et kort,
se «Skallet». DESIGN.md: «open sections and ruled rows over
grids of generic cards». Magnus fjernet dessuten hairline-topplinjene mellom
stegene på landingssiden med begrunnelsen at overskrift og luft skal lage
strukturen. Seksjoner separeres derfor av AVSTAND alene, og avstanden eies av
`Layout` (`space-y-10 md:space-y-12`) — ikke av seksjonen — slik at et bart
element på en side får nøyaktig samme rytme som en seksjon.

*Historikk:* kortversjonen ble prøvd og forkastet 2026-08-28. Det er verdt å vite
at kortet i seg selv ikke var problemet — de opprinnelige kortene var
shadcn-grå med `shadow-sm`, `text-sm` overskrifter og 20px luft. Den åpne
varianten ble likevel valgt fordi den leser som ett dokument i stedet for som
celler i et rutenett.

**Control margin.** Nøkkeltall står side ved side skilt av hårfine VERTIKALE
streker (`border-strong`), ikke i bokser — DESIGN.md sin «control margin: thin
vertical rules, small markers, and one highlighted detail». Valgt tilstand er en
forest-strek i margen, ikke en ring rundt en boks. Den uthevede detaljen er en
liten strek som vokser ut under tallet når det kan klikkes. Samme logikk gjelder
alle flerkolonne-rutenett på en side, inkludert de sidene bygger selv.

**Tabellen er en regnskapsbok.** Kolonnetitler som eyebrows, én hårfin strek per
rad, ingen fylt topprad, ingen sebrastriper, ingen ramme rundt. Ytterste kolonner
går ut til tekstkanten — og DEN kanten er sidens egen spalte: tabellen står i
samme spalte som overskriften og nøkkeltallene over den, med begge kanter
linjert. Ingen negative marger. Utbruddet stammet fra en 1280 px lesespalte som
en fortollingstabell ikke fikk plass i; innholdsflaten er 1680 px nå, og
utbruddet gjorde bare at tabellen stakk forbi resten av siden og ble kuttet mot
vinduskanten. Er tabellen fortsatt bredere enn spalten, ruller den vannrett i sin
egen sone — den vokser aldri ut av siden.

**Rullehintet må stemme.** Tonet ut mot høyre kant males bare når det faktisk
står en kolonne utenfor, og forsvinner når du har rullet helt ut. Et hint som
alltid ligger der, demper den siste kolonnen på sider der ingenting er skjult, og
får en hel tabell til å se avkuttet ut.

**Filtre er linjerte faner**, ikke piller i et trau: kun den aktive fanen har en
forest-strek under seg. Ingen gjennomgående grunnlinje — gruppen brukes både
sidebredt og som liten bryter i en seksjonstittel, og en strek som stopper i
vilkårlig lengde ser ut som en feil.

**Badges er små markører**, ikke fargede piller: 4px radius, hårfin kant, dempet
flate. Kun statusvariantene har prikk foran teksten.

**Alle diagrammer er shadcn-diagrammer.** Grunnlaget er
`ui/chart.tsx` fra shadcn-registeret (`new-york`, Recharts 2.15) — ikke
håndtegnet SVG per side. Et diagram som er bygget for seg selv blir aldri helt
likt naboen, og forskjellene samler seg: én akse med egne tikk, én tooltip som
ligner den andre uten å være den. Et nytt diagram skal være en `config` og en
Recharts-serie, ikke en ny bunke SVG.

*Historikk:* dashbordets to første diagram ble tegnet for hånd fordi «én linje og
et titalls punkter forsvarer ikke en avhengighet». Magnus snudde 2026-08-28:
konsistens på tvers av appen er verdt de ~110 kB. Argumentet holdt for ÉN side og
falt på den andre.

Avvikene fra shadcn er bare hud, og alle står i denne filen: avlesningen er en
popover-flate med `shadow-overlay` på popover-radius, tall står i `.tabnum` i
appens egen stack (aldri mono), swatch-radius er `rounded-xxs`. `item.value &&`
ble `item.value != null`, fordi en 0 %-måned er en verdi og oppstrøms slukte den
i stillhet. `ChartTooltipPanel` og `ChartTooltipRow` er eksportert, slik at et
diagram med egne rader maler SAMME boks — ikke en som ligner.

**Alle diagram er like høye.** `CHART_HEIGHT` i `ui/chart.tsx`, og den er en fast
høyde, ikke et sideforhold: diagrammene står i spalter av ulik bredde, og et
sideforhold ville gjort det smale diagrammet lavt. To diagram side om side med
ulik høyde leser som en feil, ikke som en layout.

**Seriefarger kommer fra `--chart-1..3` gjennom `config`** — aldri fra en
Tailwind-palett. Ett måltall på tvers av kategorier er ÉN farge: lengden er
sammenligningen, og en farge nummer to ville påstått at søylene tilhører hver sin
serie.

**Ingen innfyllingsanimasjon.** Recharts sveiper serien inn over 1,5 s. Det er
langt utenfor bevegelsesbudsjettet, og `requestAnimationFrame` struper i en
bakgrunnsfane — laster du dashbordet i en fane du ikke ser på, kommer du tilbake
til et diagram som står frosset halvtegnet. `isAnimationActive={false}`.

**Et diagram skal kunne nås uten mus.** `accessibilityLayer` på diagrammet gir
fokus og piltaster; avlesningen følger etter, og tallene ligger dessuten som
`sr-only`-liste under diagrammet. Den som ikke ser grafen skal kunne lese tallene
— ikke få vite at det finnes en graf.

**En søyle bærer navn, andel og kroner på ÉN linje over søylen:**
«Feil klassifisering — 34 % · 22 261 NOK». Andel og kroner svarer på hvert sitt
spørsmål (hvor stor del av problemet, og hva er det verdt), og ingen av dem skal
kreve hover. Over søylen, ikke inni: navnet er svaret på spørsmålet seksjonen
stiller og skal aldri forkortes, og et fylt felt med lys tekst i leser som en
knapp.

## Årsak, ikke symptom

En årsaksfordeling må være gjensidig utelukkende, ellers summerer den en årsak og
dens egen konsekvens. Første versjon av «Hvor pengene lekker» hadde «feil
vareklassifisering» og «feil tollsats» som to søyler — men feil varenummer er
nettopp det som GIR feil sats. Magnus tok den 2026-08-28.

Løsningen er en RANGERING, ikke penere ord. Hvert krav havner under det FØRSTE
som treffer, så bøttene er utelukkende av konstruksjon:

1. innvilget tollnedsettelse gjaldt på fortollingsdagen og ble ikke brukt
2. agenten foreslår et ANNET varenummer → feil klassifisering
3. preferanse ble aldri krevd
4. varenummeret står, satsen som ble brukt gjaldt ikke

Skillet på punkt 2 er `foreslatt_hs` mot deklarert `hs_code`, sammenlignet på
sifre alene — to lagrede felt, ikke agentens fritekst `mekanisme`. Fritekstet
holder ikke nivåene fra hverandre: av 14 krav merket `feil_sats` foreslår 13
ikke noe nytt varenummer i det hele tatt, mens ett merket `avtalesats` foreslår
et annet nummer og ER en omklassifisering.

**Ikke tving frem en kategori datamodellen ikke bærer.** «Feil grunnlag/verdi»
finnes i grunnlaget — noen dommer beskriver toll regnet ad valorem der tariffen
setter kr/kg — men det står bare i agentens prosa, og `foreslatt_sats` kan ikke
skille 0 kr/kg fra 0 %. Da blir det inne i «feil sats på riktig varenummer» til
en vurderingsrunde skriver en LUKKET mekanismeliste. En gjetning i kategoriens
klær er verre enn én bøtte for mye.

## Merkevareressurser deles med nettsiden

En lenke til appen skal forhåndsvises nøyaktig som en lenke til declaro.no —
samme merke, samme bilde, samme stemme. Derfor er filene KOPIER, ikke
gjenskapninger:

| Her | Fra `Documents/Declaro/website` |
|---|---|
| `web/public/icon.svg` | `app/icon.svg` |
| `web/public/social/declaro-og-v3.png` | `public/social/declaro-og-v3.png` |

De skal være byteidentiske. Endres de i website-repoet, kopieres de hit på nytt —
ikke tegn dem på nytt, og ikke lag en «app-variant». Tittelen følger nettsidens
mønster «%s – Declaro» og settes per side i `layout/Layout.tsx`.

To ting skiller seg fra nettsiden, med vilje:

- **Appen er `noindex, nofollow`.** Den er innlogget; nettsiden er den
  offentlige flaten. Det stopper søkemotorer, men ikke Slack, iMessage og
  LinkedIn — de leser og-taggene og forhåndsviser som før.
- **`og:image` må være ABSOLUTT.** Unfurlere dropper en relativ sti uten å si
  fra, og lenken previewer som naken URL. Domenet er bare kjent ved deploy, så
  `vite.config.ts` stempler inn origin fra `BETTER_AUTH_URL` (samme variabel som
  auth allerede krever — ikke en ny å holde synkronisert) og advarer høyt i
  bygget hvis den mangler.

**Sidebaren** bærer ordmerket «Declaro.» (DESIGN.md — aldri et oppfunnet symbol),
gruppetitler som eyebrows, og aktiv rad markert med en strek i margen.

### Skalaene — én av hver

Alt nedenfor er definert i `tailwind.config.js`. Det finnes ingen vilkårlige
`text-[…]`- eller `rounded-[…]`-verdier i kildetreet, og det skal det fortsette
å ikke gjøre.

- **Typografi:** `2xs 11 · xs 12 · sm 14 · base 15 · lg 17 · xl 20 · 2xl 24 ·
  3xl 28 · 4xl 34 · 5xl 44 · 6xl 52`. Fast rem, ikke flytende — produkt-UI leses
  på konsistent DPI. `t-*`-klassene i `index.css` peker på de samme stegene, så
  `text-sm` og `t-small` er samme verdi.
- **Radius:** `xxs 2 · xs 4 · sm 6 · md 8 · lg 11 · xl 14 · 2xl 18`.
- **Kontrollhøyder:** `sm h-8` (tett, i tabeller) · `default h-9` (standard —
  SAMME høyde som Input og SelectTrigger, så en verktøylinje aldri får tre ulike
  høyder ved siden av hverandre) · `lg h-11` (sidens primærhandling, og den
  eneste som er 44px) · `icon size-9` · `icon-sm size-8`. Sider overstyrer aldri
  høyden — hver side har en `size`.
- **Radius følger høyden, ikke komponenttypen.** `h-8` → `rounded-md`,
  `h-9` og `h-11` → `rounded-lg`. En Input, en SelectTrigger og en Button på
  samme høyde har samme radius, samme kant og samme bevegelse (200 ms
  `ease-out-strong`), og hover gir samme flatetrinn. Står to kontroller ved siden
  av hverandre med ulik radius, er det denne regelen som er brutt — det skjedde
  både i søkefeltet og i pagineringens «Rader per side».
- **Elevasjon:** ÉN skygge, `shadow-overlay`, og bare på ting som faktisk svever
  (meny, popover, tooltip, ark, toast). Alt annet får dybde av flatekontrast og
  1px kant. Berøringsmål minst 44px.

### Tilstander og tilgjengelighet

- Hver interaktiv komponent har default, hover, focus, active og disabled.
  Fokus er en ring fra `--ring`; `index.css` har en fallback-ring så en komponent
  uten egen ring aldri mister markeringen.
- Alt som kan klikkes er et ekte element: sorterbare kolonnetitler er `<button>`,
  radutvidelse er en `<button>` med `aria-expanded`. Et `onClick` på `<tr>` eller
  `<th>` er et tastaturbrudd, ikke en snarvei.
- Tomtilstander forklarer hva som skjedde og tilbyr veien videre. «Ingen rader»
  er ikke en tomtilstand.
- Skjelettet i `App.tsx` må tegne DEN layouten som lastes — mål, bredder og
  avstander speiler `Layout`, `Header` og `AppSidebar`.
- Tabellen har sin egen rullesone (`wrapperClassName` på `Table`). Det er et krav
  for at det klebrige hodet skal virke: `position: sticky` fester seg til
  nærmeste rullebeholder. Tabellen bruker dessuten `border-separate` — med
  `border-collapse: collapse` males et sticky hode UNDER radene.

### Ikoner og nettleserflater

Ikoner kommer fra lucide, i én strek og vekt. Unicode-glyfer (`↗`, `→`) er ikke
et ikonsystem. Tekstmarkering, caret, scrollbars, fokusring og understrekings-
avstand er temaet fra paletten i `index.css` — de flatene bærer designet like
mye som det du tegnet selv.

## Bevegelse

160–260ms for kontroller. Ingen parallax, ingen markøreffekter, ingen
tech-demo-spektakel. Respekter `prefers-reduced-motion`.

## Sjekkliste — forkast iterasjonen hvis noe er «ja»

- Ser det ut som standard shadcn eller en generisk fintech-app?
- Er det en mettet farge som ikke står i dette dokumentet?
- Gjentas det samme avsnittet én gang per rad? Forklaringer som er like når
  beløp og datoer normaliseres bort, hører hjemme ÉN gang over tabellen med
  «gjelder N av M fortollinger» — ikke i en kolonne. Se `normalise` og
  `distinctTexts` i `Recovery.tsx`; de rører aldri varenumre eller satser, fordi
  to saker som skiller seg på varenummer er to forskjellige saker.
- Er en statusfarge brukt som dataserie, eller en serie brukt som status?
  (Kravtypene Preferanse/RÅK/Produkt er KATEGORIER og bruker `KIND_COLOR` fra
  diagrampaletten — ikke success/warning.)
- Er en statusfarge det eneste som skiller to tilstander, uten ikon og tekst?
- Er en diagramfarge endret uten at validatoren er kjørt på nytt?
- Er mørk modus en invertering i stedet for egne, varme trinn?
- Kompenserer en overskrift med font-weight 600/700 i stedet for stroken?
- Er mobilhierarkiet svakere enn desktop?
- Har en komponent fått en egen `text-[…]`-størrelse utenfor skalaen?
- Er en flate skilt med `shadow`, eller med en opasitetsverdi i stedet for et trinn?
- Ligger et rutenett med tall i bokser i stedet for i control margin?
- Er det mer enn 25 ord stående forklaring, eller mer enn 7 sidenivå-kontroller
  (beslutninger, ikke enkeltvalg), over første datarad? Mål det — ikke vurder det.
- Har en side fått en ingress som forklarer hva en rad ER, i stedet for å si noe
  om tilstanden?
- Bærer et hint under et tall en definisjon i stedet for en nevner, en enhet,
  en andel eller en affordanse?
- Står en forklaring to steder — over tabellen OG på kontrollen den gjelder?
- Er et tall gjort til et filter for siden det selv står på?
- Starter en arbeidsliste med noe annet enn tallene?
- Har en tabell fått sin egen rulleoppførsel, eller ruller siden forbi en
  tabell uten at innholdet i den var innom skjermen?
- Ruller en åpen rad ut av syne mens begrunnelsen dens fortsatt står der?
- Står en kildetabell uten kolonnenavn når du har rullet et stykke ned i den,
  eller har den fått sin egen rullesone?
- Er et filter uttrykt som faner, eller et datasett-/visningsvalg som Select?
- Har en side funnet på sin egen verktøylinje, eller lagt en kontroll utenfor
  søk / Filter / Visning?
- Er et visningsvalg vist som brikke, eller telt på filterknappen?
- Er brikkene lagt på en egen rad under verktøylinjen i stedet for på den?
- Har to kontroller på samme høyde ulik radius, kant eller hover?
- Står det et tall i verktøylinjen uten at det sier hva det teller?
- Er en delmengde gjort til fane uten å bestå fane-testen?
- Er et filter skrevet som JSX i en side i stedet for deklarert i `FilterDef[]`?
- Er `<b>` brukt inne i et løpende avsnitt?
- Er prosaen kortet ned ved å bytte stemme — er «Ingen rader» blitt svaret der
  det før sto en forklaring?
- Er et kundevendt uttrykk brukt der noen skal jobbe i tallene hele dagen?
