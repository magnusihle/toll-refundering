import * as React from 'react';

/**
 * Rullingen på en arbeidsliste — én modell, alle tabeller.
 *
 * En side har tall på toppen og en lang tabell under. Uten en modell blir det to
 * konkurrerende rullesoner: står markøren over tabellen ruller tabellen, står den
 * to centimeter til venstre ruller siden. Samme håndbevegelse gjør to ting, og du
 * må sikte for å komme videre.
 *
 * Modellen har tre faser, og de gjelder likt på alle sider:
 *
 *   1. Siden ruller til tabellens overkant treffer linjen under topplinjen.
 *      Rullingen stoppes NØYAKTIG der — et raskt hjuldrag kan ikke kaste
 *      tabellen forbi og hoppe over innholdet i den.
 *   2. Der tilhører hjulet tabellen, uansett hvor markøren står.
 *   3. Når tabellen er rullet til bunns fortsetter siden — paginering, og det som
 *      står under.
 *
 * Oppover er det samme i revers, så veien ned og veien opp er den samme veien.
 *
 * Vi tar bare over hjulet der nettleseren ville gjort noe annet enn dette. Ruller
 * siden mot en tabell som ligger langt nede, gjør nettleseren allerede det
 * riktige, og da skal den få beholde sin egen glidning. Menyer, paneler og
 * ruteflater med egen rulling rører vi aldri.
 */

const PIN_FALLBACK = 64; // topplinjen er h-16; bare et gulv hvis den ikke finnes ennå

/**
 * Hvor nær linjen vi må styre selv.
 *
 * Nettleseren ruller siden MYKT: et hjuldrag ligger og animerer etter at
 * hendelsen er ferdig behandlet, så avstanden vi måler er alltid litt bakpå.
 * Overlater vi rullingen til nettleseren rett før linjen, lander den forbi —
 * det var derfor tabellen ikke alltid la seg på plass ved rask rulling eller med
 * markøren utenfor tabellen. Med god margin igjen er animasjonen ufarlig og
 * nettleseren får beholde sin egen glidning; nærmere enn dette styrer vi selv,
 * og et absolutt hopp avbryter animasjonen som ligger i luften.
 */
const NATIVE_MARGIN = 800;
const scrollers = new Set<HTMLElement>();
let listening = false;

/** Linjen tabellen legger seg på: underkanten av topplinjen. */
function pinTop() {
  const header = document.querySelector('[data-app-header]');
  return header ? Math.round(header.getBoundingClientRect().bottom) : PIN_FALLBACK;
}

function canScroll(el: HTMLElement, dy: number) {
  return dy > 0 ? el.scrollTop < el.scrollHeight - el.clientHeight - 1 : el.scrollTop > 0;
}

/** Hjulet i piksler, uansett om det kommer som linjer eller sider. */
function pixels(e: WheelEvent) {
  if (e.deltaMode === 1) return e.deltaY * 16;
  if (e.deltaMode === 2) return e.deltaY * document.documentElement.clientHeight;
  return e.deltaY;
}

/**
 * Sonen under markøren: en av våre tabeller, en fremmed rullesone (meny, panel,
 * en kildetabell inne i en utvidet rad), eller ingenting. En fremmed sone som
 * faktisk KAN rulle i den retningen eier hjulet selv.
 */
function under(target: EventTarget | null, dy: number): HTMLElement | null {
  let el = target instanceof Element ? (target as HTMLElement) : null;
  while (el) {
    if (scrollers.has(el)) return el;
    const style = getComputedStyle(el);
    if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && canScroll(el, dy)) return el;
    el = el.parentElement;
  }
  return null;
}

/** Tabellen fasen gjelder: nedover den første som ikke er passert, oppover den siste som er nådd. */
function current(dy: number, pin: number): HTMLElement | null {
  const live = [...scrollers].filter((el) => el.isConnected && el.clientHeight > 0);
  live.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  if (dy > 0) return live.find((el) => el.getBoundingClientRect().bottom > pin + 1) ?? null;
  let last: HTMLElement | null = null;
  for (const el of live) if (el.getBoundingClientRect().top <= pin + 1) last = el;
  return last;
}

/**
 * Flytt siden. Absolutt, ikke relativt: et absolutt hopp avbryter en myk
 * rulling som ligger og animerer, og det er nettopp den som ellers bærer siden
 * forbi linjen.
 */
function page(delta: number) {
  window.scrollTo(0, window.scrollY + delta);
}

/** Kjør resten inn i tabellen, og gi det den ikke får plass til videre til siden. */
function drive(el: HTMLElement, delta: number) {
  const max = el.scrollHeight - el.clientHeight;
  const next = Math.max(0, Math.min(max, el.scrollTop + delta));
  const used = next - el.scrollTop;
  el.scrollTop = next;
  const left = delta - used;
  if (left) page(left);
}

function onWheel(e: WheelEvent) {
  // Ctrl+hjul er zoom, ikke rulling.
  if (e.ctrlKey || e.defaultPrevented || scrollers.size === 0) return;
  const dy = pixels(e);
  if (!dy) return;

  const zone = under(e.target, dy);
  if (zone && !scrollers.has(zone)) return; // fremmed rullesone — dens eget hjul
  const pin = pinTop();
  const table = current(dy, pin);
  if (!table) return;

  const gap = table.getBoundingClientRect().top - pin; // > 0: tabellen står ennå under linjen

  // Fase 1 — siden ruller, men aldri forbi linjen.
  if ((dy > 0 && gap > 1) || (dy < 0 && gap < -1)) {
    const room = Math.abs(gap);
    // Langt fra linjen, og markøren står ikke i en tabell: la nettleseren rulle
    // siden selv, med sin egen glidning. Nær linjen gjør vi det aldri — se
    // NATIVE_MARGIN.
    if (!zone && room > Math.abs(dy) + NATIVE_MARGIN) return;
    const step = Math.sign(dy) * Math.min(Math.abs(dy), room);
    e.preventDefault();
    page(step);
    const rest = dy - step;
    if (rest) drive(table, rest);
    return;
  }

  // Oppover med markøren i en tabell som ennå står under linjen: siden eier
  // hjulet. En tabell ruller aldri før den ligger på linjen.
  if (zone && gap > 1) {
    e.preventDefault();
    page(dy);
    return;
  }

  // Fase 2 — tabellen ligger på linjen, og eier hjulet uansett hvor markøren står.
  if (Math.abs(gap) <= 1 && canScroll(table, dy)) {
    e.preventDefault();
    drive(table, dy);
  }

  // Fase 3 — tabellen er tømt i denne retningen: siden ruller videre, av seg selv.
}

/**
 * Meld rullesonen inn i modellen. Tabellen eier fortsatt sin egen rulling — den
 * får bare vite når den står på linjen.
 */
export function usePinnedScroll<T extends HTMLElement>(ref: React.RefObject<T>) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    scrollers.add(el);
    if (!listening) {
      // Ikke-passiv: fase 1 og 2 finnes bare fordi vi kan stanse siden.
      window.addEventListener('wheel', onWheel, { passive: false });
      listening = true;
    }
    return () => {
      scrollers.delete(el);
      if (scrollers.size === 0 && listening) {
        window.removeEventListener('wheel', onWheel);
        listening = false;
      }
    };
  }, [ref]);
}

