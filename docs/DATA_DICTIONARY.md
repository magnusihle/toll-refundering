# EMMA EDOC — Data Dictionary

> **Confirmed against the live app** via the MCP tools (login + `describe_fields`
> + `query_declarations` succeed; extracted 19/19 rows and totals that match the
> UI). Grid control id `grid`, main table `grid_DXMainTable`, DevExpress theme
> `Office2010Blue` (classes are theme-suffixed, matched by substring in `src/grid.js`).
> Still to extend: master-detail line items and the other modules.

## App: EMMA EDOC ("Elektronisk dokumentsenter") — customs-clearance document center
- Login: `/login.aspx` — fields **Brukernavn** (username), **Passord** (password), WebForms postback.
- Main grid: `/Login/oppdragsoversiktNY2.aspx` — import customs declarations (**fortollinger**) for an actor (e.g. *Arnika AS*).
- Tech: ASP.NET WebForms + DevExpress/Telerik-style grid (filter row, master-detail expand, server-side paging).
- Auth note: the `?UserID=<token>` links are **per-session and expire** (observed a Runtime Error on reuse) — use username/password login.

## Top-menu modules (to map in Phase A)
| Menu (no) | Meaning |
|---|---|
| Dato/periode søk | Date/period search |
| Avstemming | Reconciliation |
| Etterlysning | Tracing / follow-up on missing items |
| Administrere | Administration |
| Tilleggsmoduler | Add-on modules |
| Rapporter | Reports |
| Oppsett | Settings/setup |
| Innboks / Meldinger | Inbox / Messages |
| Dashboard / Hjelp / Avslutt | Dashboard / Help / Log out |

## Declarations grid columns (Norwegian header → meaning)
| Column | Meaning | Type |
|---|---|---|
| # | Row index | int |
| Godkjent | Approved date | date (dd.mm.yyyy) |
| I/E | Import/Export (I = innførsel) | enum |
| Eksp. | Expedition/handling code | code |
| Prosedyre | Customs procedure (e.g. "Ordinær innførsel") | text |
| Dekl. | Declaration type/code | code |
| Tollnummer | Customs/declaration number | id |
| Aktør | Carrier/forwarder actor (DHLEX, POSTNO, UPS, FSN, …) | code |
| Faktura informasjon | Invoice info (supplier name) | text |
| Ordrenr. | Order number | id |
| Faktura (Val) | Invoice amount in original currency | number |
| Valuta | Currency (EUR, DKK, USD, NOK, GBP, SEK) | enum |
| LevVilk | Delivery terms / Incoterms (DAP, FCA, DDP, …) | enum |
| Frakt (b) | Freight (billed) | number |
| Frakt (v) | Freight (value) | number |
| Avg | Duty/fee (avgift) | number |
| MVA grunnl. 25% | VAT base at 25% | number |
| MVA grunnl. 15% | VAT base at 15% | number |
| MVA grunnl. 0% | VAT base at 0% | number |
| Avvik | **Discrepancy** (flag for reconciliation) | number |
| OB | (to confirm) opening/booking marker | ? |
| Dok. | Documents attached | count/flag |
| Kilde | Source system | code |
| MVA | VAT amount | number |
| Status | Declaration status | enum |

Number format: `1 385,35` (space thousands, comma decimal). Dates: `18.08.2026`.

## To be completed in Phase A (via the MCP against the live app)
- Master-detail (Expand) line-item fields per declaration.
- Exact ids for the date-range controls and pager (from `debug_dump`).
- Column meanings for `OB`, `Dok.`, `Status` enumerations.
- Fields/columns of Avstemming, Rapporter, Innboks modules.

## Confirmed extraction notes (live)
- 25 data columns + one leading command/expand column (blank header). Row ids `grid_DXDataRow<N>`.
- `Frakt (v)` sometimes holds the freight **currency code** (e.g. `NOK`) — the freight amount is a
  value+currency pair split across `Frakt (b)`/`Frakt (v)` as the grid renders it.
- `OB`, `Dok.`, `Kilde`, `MVA`, `Status` are frequently blank in the current period's rows.
- Footer/totals row is colspan-merged differently from data rows, so footer cell alignment is
  approximate; analysis sums the per-row parsed values instead (verified vs. UI totals:
  MVA-grunnlag 25% = 1 236 163, 15% = 285 576, avgift = 3 840).
- 20 per-row Expand icons present → master-detail is available to scrape next.
## Phase B — SAD enrichment (goods lines + charges)

Each declaration's **fortolling** (SAD) PDF is downloaded from EMMA EDOC (detail row →
"Dokumenter" tab → the `<tollnummer>_fortolling_*.pdf` row) and converted with the vendored
`extractSadPdf` (`vendor/sad-extractor.ts`, from customs-hs-matcher) plus a per-line VAT parser
(`src/sad/convert.ts`).

### SAD boxes used (per goods line)
| Box | Meaning | Column in DB |
|---|---|---|
| box33 | HS / commodity code (varenummer, 8-digit) | `goods_lines.hs_code` |
| box34 | Country of origin (ISO2) | `goods_lines.origin` |
| box31 | Packages / goods description | `goods_lines.description` |
| box35 / box38 | Gross / net weight | `gross_weight` / `net_weight` |
| box37 | Procedure | `procedure` |
| box42 / box46 | Item value / statistical value | `item_value` / `statistical_value` |
| box47[] | Duty/excise calc (dutyType, base, rate, amount) — only when goods incur toll/særavgift | `line_charges(source='box47')` |

### Import VAT (why box47 is often empty)
Since 2017 Norwegian import VAT is **not** computed on the SAD (self-reported via the tax return).
The SAD's "ESTIMERT INNFØRSELSMERVERDIAVGIFT / GRUNNLAG PR AVGIFTSSATS" block gives per-line
`Ln# Type Grunnlag Sats` (VAT basis + rate). Parsed into `line_charges(source='vat', charge_type='MV')`.

### DB schema (`data/emma.db`, node:sqlite)
`declarations` (grid fields + SAD header: direction, declaration_type, box20 incoterm, box22 value/currency, box23 fx)
→ `goods_lines` (per box33/34/…) → `line_charges` (unified box47 duty + VAT rows).
View `goods_rate_comparison` groups by (hs_code, source, charge_type) with min/max/spread of rate —
the basis for the "same goods, different rate" flags.
