import * as React from "react";
import { Search, SlidersHorizontal, X, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Explain } from "@/components/ui/explain";
import type { FilterDef, FilterState } from "@/lib/filters";
import { cn } from "@/lib/utils";

export type DisplayGroup = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
};

/**
 * Tabellens ENE verktøylinje.
 *
 *   [⌕ Søk …]  [Filter n]                              [Visning ⌄]
 *    Preferanse ×   ≥ 500 kr ×   ·  42 av 321 krav  ·  Tøm alle
 *   ────────────────────────────────────────────────────────────
 *
 * Formen er den samme på alle sider, uansett om siden har null filtre eller
 * tolv. Før lå kontrollene som fri JSX i hver side, og da fant hver side sin
 * egen rekkefølge og sitt eget uttrykk.
 *
 * VENSTRE er HVA (søk, filtre — hvilke rader finnes), HØYRE er HVORDAN (visning
 * — samme rader, annen form). Linear formulerer skillet slik: filtre avgrenser
 * listen, visningsvalg endrer hva som vises på hver rad. Å blande dem gjør at
 * verken filterknappen eller brikkeraden betyr én ting.
 *
 * Avvik fra kildene, bevisst: Polaris anbefaler 2–3 filtre synlig og resten bak
 * en knapp, Pajamas 3–5. Her ligger ALT bak knappen, også når siden bare har ett
 * filter. Begrunnelsen er at appen har fire tabellsider som skal føles like —
 * et hensyn de dokumentene ikke veier, siden de beskriver produkter med én
 * tabelltype. Prisen er ett klikk ekstra på de rolige sidene.
 */
export function TableToolbar<Row>({
  search,
  onSearch,
  searchPlaceholder,
  defs,
  filters,
  display,
  countLabel,
}: {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder: string;
  defs: FilterDef<Row>[];
  filters: FilterState<Row>;
  /**
   * Visningsvalg, som grupper. Hver tabell har minst «Tetthet», så knappen står
   * på samme plass på ALLE sider — ikke bare der siden tilfeldigvis har en
   * gruppering. En tom meny ville vært samme feil som et tomt filterpanel.
   */
  display?: DisplayGroup[];
  /** Vises bare når filtreringen faktisk har gjort noe. */
  countLabel?: React.ReactNode;
}) {
  const active = filters.active;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label={searchPlaceholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 w-64 pl-8 pr-8"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch("")}
            aria-label="Tøm søk"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {defs.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <SlidersHorizontal />
              Filter
              {/* Telleren er hele grunnen til at det er forsvarlig å gjemme
                    filtrene: Carbon krever at en lukket filterkontroll viser
                    hvor mange som er aktive. */}
              {active.length > 0 && (
                <span className="tabnum rounded-xs bg-primary px-1.5 text-2xs text-primary-foreground">
                  {active.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-3">
            {defs.map((d) => (
              <div key={d.key} className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <label className="t-eyebrow text-muted-foreground" htmlFor={`filter-${d.key}`}>
                    {d.label}
                  </label>
                  {d.explain ? <Explain label={`Om ${d.label.toLowerCase()}`}>{d.explain}</Explain> : null}
                </div>
                <Select value={filters.value(d.key)} onValueChange={(v) => filters.set(d.key, v)}>
                  {/* `htmlFor` gir ikke pålitelig navn til en role=combobox-knapp,
                        så etiketten gjentas som aria-label. */}
                  <SelectTrigger id={`filter-${d.key}`} aria-label={d.label} className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {d.options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                        {o.count != null ? <span className="tabnum text-muted-foreground"> {o.count}</span> : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      )}

      {/* Brikkene står PÅ linjen, rett etter knappen de hører til — ikke som en
          egen rad under, som kostet en hel linjehøyde på hver side. Tellingen
          henger på dem, aldri løsrevet i et hjørne. */}
      {active.length > 0 && (
        <>
          {active.map((f) => (
            <Chip key={f.key} label={f.valueLabel} onClear={f.clear} />
          ))}
          {countLabel ? <span className="t-small tabnum text-muted-foreground">{countLabel}</span> : null}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground" onClick={filters.clearAll}>
            Tøm alle
          </Button>
        </>
      )}

      {display && display.length > 0 && (
        <div className="ml-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="gap-2 text-muted-foreground">
                <Settings2 />
                Visning
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-3">
              {display.map((g) => (
                <div key={g.label} className="space-y-1">
                  <span className="t-eyebrow text-muted-foreground">{g.label}</span>
                  <div role="radiogroup" aria-label={g.label} className="space-y-0.5 pt-1">
                    {g.options.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={g.value === o.value}
                        onClick={() => g.onChange(o.value)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          g.value === o.value
                            ? "bg-accent text-foreground"
                            : "text-muted-foreground hover:bg-surface-sunken",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn("size-1.5 rounded-full", g.value === o.value ? "bg-primary" : "bg-transparent")}
                        />
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
