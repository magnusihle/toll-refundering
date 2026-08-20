#!/usr/bin/env tsx
/**
 * Extract ground truth from TVINN SAD PDFs using `pdftotext -layout`.
 *
 * Anchor-based parsing: locate each rubrikk's label row in the layout output,
 * then read the data row immediately under it within the right column band.
 * Handles both the front page and BIS continuation pages, and both import
 * (prosedyre 40/41/50/60/70) and export (prosedyre 10/11/20/30/80) forms.
 *
 * Coverage matches Tolletaten's official rubrikk list — see
 * docs/sad-import-40-norway.md and docs/sad-export-10-norway.md.
 *
 * Usage:
 *   npm run gt:extract                   # extract missing only
 *   npm run gt:extract -- --force        # re-extract all
 *   npm run gt:extract -- --ref 78687    # extract single ref
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Types (inlined; previously _legacy/pilot-assessment/types.ts) ─────

export interface PilotGroundTruth {
  referenceNumber: string;
  sourceDescription: string;
  /** import / export — derived from box1.col2 (4-7 → import; else export). */
  direction: "import" | "export";
  /** e.g. "import_40", "export_10". Matches pipeline declaration-type label. */
  declarationType: string;

  header: {
    box1?: { col1: string; col2: number };
    box2?: string;
    /** Norlines kundenr printed in the box 2 header on the SAD declaration.
     *  Used as a structured comparator target so address-string typos don't
     *  produce false negatives when grading entity resolution. */
    box2Kundenr?: number;
    box3?: string;
    box5?: number;
    box6?: number;
    box7?: string;
    box8?: string;
    /** Norlines kundenr printed in the box 8 header. Same role as box2Kundenr.
     *  May be absent when the broker's PDF does not carry a kundenr (some
     *  foreign consignees on import shipments). */
    box8Kundenr?: number;
    box12?: number;
    box14?: string;
    box15?: string;
    box17?: string;
    box17a?: string;
    box19?: number;
    box20?: string;
    box21?: { identity?: string; nationality?: string };
    box22?: { value: number; currency: string };
    box23?: number;
    box24?: string;
    box25?: number;
    box28?: { invoices: Array<{ invoiceNumber: string; date: string }> };
    box29?: string;
    box30?: string;
    box49?: string;
    /** Aggregated unique container numbers across all lineItems. */
    containers?: string[];
    [key: string]: unknown;
  };

  /** Sums across lineItems for fast shipment-level comparison. */
  totals?: {
    grossWeight: number;
    netWeight: number;
    lineItemValue: number;
    statisticalValue: number;
  };

  /** Parse issues / heuristic flags worth surfacing. */
  warnings?: string[];

  lineItems: PilotGroundTruthLine[];
}

export interface PilotPackagesDescription {
  marks?: string;
  packages?: number;
  packageType?: string;
  description?: string;
  containerNumber?: string;
}

export interface PilotGroundTruthLine {
  itemNumber: number;
  box31: PilotPackagesDescription | string;
  box33: string;
  box34: string;
  box35: number;
  box36?: string;
  box37?: string;
  box38: number;
  box41?: number;
  box42: number;
  box43?: number;
  /** Box 44 references split as {code, reference} (e.g. SER → NL/108/01/500). */
  box44?: Array<{ code: string; reference: string }>;
  box45?: number;
  box46?: number;
  box47?: PilotDutyLine[];
  articleNumber?: string;
  chassisNumber?: string;
  packingListCnCode?: string;
}

export interface PilotDutyLine {
  dutyType: string;
  base: number;
  rate: number;
  amount: number;
  paymentMethod?: string;
}

// ── Paths / CLI ──────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "data", "output");
const GT_DIR = path.join(REPO_ROOT, "data", "ground-truth");

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const refFilter = args.includes("--ref")
    ? args[args.indexOf("--ref") + 1]
    : null;

  await fs.promises.mkdir(GT_DIR, { recursive: true });

  const pdfs = (await fs.promises.readdir(OUTPUT_DIR))
    .filter((f) => f.endsWith(".pdf"))
    .filter((f) => !refFilter || f.replace(".pdf", "") === refFilter)
    .sort();

  console.log(`Found ${pdfs.length} SAD PDF(s) in data/output/\n`);

  let extracted = 0;
  let skipped = 0;

  for (const pdf of pdfs) {
    const ref = pdf.replace(".pdf", "");
    const gtPath = path.join(GT_DIR, `${ref}.json`);

    if (!force && fs.existsSync(gtPath)) {
      skipped++;
      continue;
    }

    const pdfPath = path.join(OUTPUT_DIR, pdf);
    try {
      const gt = extractSadPdf(pdfPath, ref);
      await fs.promises.writeFile(gtPath, JSON.stringify(gt, null, 2));
      const warn =
        gt.warnings && gt.warnings.length > 0
          ? `  [${gt.warnings.length} warning(s)]`
          : "";
      console.log(
        `  ${ref}: ${gt.lineItems.length} line items → ${path.basename(gtPath)}${warn}`,
      );
      extracted++;
    } catch (e) {
      console.error(`  ${ref}: FAILED — ${(e as Error).message}`);
    }
  }

  console.log(
    `\nDone: ${extracted} extracted, ${skipped} skipped (already exist).`,
  );
}

// ── PDF Utilities ────────────────────────────────────────────────

function pdftextLayout(
  pdfPath: string,
  firstPage?: number,
  lastPage?: number,
): string {
  const args = ["-layout"];
  if (firstPage) args.push("-f", String(firstPage));
  if (lastPage) args.push("-l", String(lastPage));
  args.push(`"${pdfPath}"`, "-");
  return execSync(`pdftotext ${args.join(" ")}`, {
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
  });
}

function getPageCount(pdfPath: string): number {
  const info = execSync(`pdfinfo "${pdfPath}"`, { encoding: "utf-8" });
  const match = info.match(/Pages:\s+(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// ── Known ISO-2 country codes (for box34 peel-CC validation) ────
// Subset of ISO 3166-1 alpha-2 — used to gate the "peel CC off description"
// heuristic so we don't strip arbitrary 2-letter tokens (e.g. "BUSINESS").
const KNOWN_ISO2_CODES = new Set([
  "AE", "AR", "AT", "AU", "BD", "BE", "BG", "BR", "CA", "CH", "CL", "CN",
  "CZ", "DE", "DK", "EC", "EE", "EG", "ES", "FI", "FR", "GB", "GE", "GR",
  "HK", "HR", "HU", "ID", "IE", "IL", "IN", "IQ", "IR", "IS", "IT", "JO",
  "JP", "KR", "LB", "LK", "LT", "LV", "MA", "MD", "MK", "MX", "MU", "MY",
  "NL", "NO", "NZ", "OM", "PE", "PH", "PL", "PT", "PY", "RO", "RS", "RU",
  "SA", "SE", "SG", "SI", "SJ", "SK", "SY", "SZ", "TH", "TN", "TR", "TW",
  "UA", "US", "VN", "ZA",
]);

// ── Norwegian country name → ISO-2 ───────────────────────────────
// Used to normalize box17 (Bestemmelsesland text) and to derive box17 from
// box8 for transit-through-Norway imports. Norwegian-language SAD prints
// country names rather than ISO codes in the long-form text columns.
const NORWEGIAN_COUNTRY_NAME_TO_ISO: Record<string, string> = {
  AUSTRALIA: "AU",
  BELGIA: "BE",
  BRASIL: "BR",
  CANADA: "CA",
  CHILE: "CL",
  "DE FORENTE STATER": "US",
  DANMARK: "DK",
  ECUADOR: "EC",
  EGYPT: "EG",
  FINLAND: "FI",
  FRANKRIKE: "FR",
  HONGKONG: "HK",
  INDIA: "IN",
  IRLAND: "IE",
  ISLAND: "IS",
  ITALIA: "IT",
  JAPAN: "JP",
  KINA: "CN",
  MEXICO: "MX",
  NEDERLAND: "NL",
  NORGE: "NO",
  POLEN: "PL",
  PORTUGAL: "PT",
  ROMANIA: "RO",
  RUSSLAND: "RU",
  SPANIA: "ES",
  STORBRITANNIA: "GB",
  SVALBARD: "SJ",
  SVEITS: "CH",
  SVERIGE: "SE",
  SWAZILAND: "SZ",
  TYRKIA: "TR",
  TYSKLAND: "DE",
  UKRAINA: "UA",
  UNGARN: "HU",
  ØSTERRIKE: "AT",
};

function normalizeNorwegianCountry(name: string): string | null {
  const k = name.trim().toUpperCase();
  return NORWEGIAN_COUNTRY_NAME_TO_ISO[k] ?? null;
}

// ── Direction / declarationType derivation ──────────────────────
// Per Tolletaten box1 col2 codes:
//   import  : 4 (Overgang fri disponering), 5 (Midlertidig innførsel),
//             6 (Gjeninnførsel), 7 (Innlegg på tollager)
//   export  : 1 (Ordinær), 2 (Midlertidig), 3 (Gjenutførsel),
//             8 (Direkte transit), 0 (Proviant)
const IMPORT_CODES = new Set([4, 5, 6, 7]);

function deriveDirection(col2: number): "import" | "export" {
  return IMPORT_CODES.has(col2) ? "import" : "export";
}

function deriveDeclarationType(
  direction: "import" | "export",
  col2: number,
): string {
  return `${direction}_${col2}0`;
}

// ── Main Extraction ──────────────────────────────────────────────

export function extractSadPdf(pdfPath: string, ref: string): PilotGroundTruth {
  const pageCount = getPageCount(pdfPath);
  const warnings: string[] = [];

  const page1 = pdftextLayout(pdfPath, 1, 1);
  // Scanned-PDF detection: pdftotext returns near-empty text for image-only
  // PDFs (e.g. Canon copier scans). Flag explicitly so downstream eval can
  // exclude rather than score against placeholder ground truth.
  if (page1.trim().length < 200) {
    warnings.push("pdf_scanned_no_text");
  }

  const header = extractHeader(page1, warnings);

  const lineItems: PilotGroundTruthLine[] = [];
  const box47ByItemNumber = new Map<number, PilotDutyLine[]>();

  let allText = page1;
  for (let p = 1; p <= pageCount; p++) {
    const pageText = p === 1 ? page1 : pdftextLayout(pdfPath, p, p);
    if (p > 1) allText += "\n" + pageText;
    const items = extractLineItemsFromPage(pageText, warnings);
    lineItems.push(...items);

    const slots = extractBox47Slots(pageText);
    const itemNumbers = items.map((it) => it.itemNumber);
    for (let si = 0; si < slots.length && si < itemNumbers.length; si++) {
      if (slots[si].length > 0) {
        box47ByItemNumber.set(itemNumbers[si], slots[si]);
      }
    }
  }

  // FAKTURALISTE fallback for box28
  if (!header.box28 || header.box28.invoices.length === 0) {
    const fakturaliste = extractFakturaliste(allText);
    if (fakturaliste) {
      header.box28 = { invoices: fakturaliste };
    } else if (/Se vedlagt fakturaliste/.test(page1)) {
      header.box28 = {
        invoices: [{ invoiceNumber: "Se vedlagt fakturaliste", date: "" }],
      };
    }
  }

  for (const it of lineItems) {
    const duty = box47ByItemNumber.get(it.itemNumber);
    if (duty && duty.length > 0) it.box47 = duty;
  }

  // Dedup by itemNumber, keeping the most populated record.
  const byItem = new Map<number, PilotGroundTruthLine>();
  for (const item of lineItems) {
    const existing = byItem.get(item.itemNumber);
    if (!existing || score(item) > score(existing)) {
      byItem.set(item.itemNumber, item);
    }
  }
  const deduped = [...byItem.values()].sort(
    (a, b) => a.itemNumber - b.itemNumber,
  );

  // ── Derived header fields ───────────────────────────────────
  // Direction + declarationType from box1.col2 (per Tolletaten code table).
  let direction: "import" | "export" = "import";
  let declarationType = "import_40";
  if (header.box1) {
    direction = deriveDirection(header.box1.col2);
    declarationType = deriveDeclarationType(direction, header.box1.col2);
  } else {
    warnings.push("box1_missing");
  }

  // Box 15 inference: for exports, the avsenderland is Norway by definition.
  // The PDF leaves it blank because it's implied. Pipeline emits "NO" for
  // every export — fill it in here so comparison doesn't flag a false miss.
  if (direction === "export" && !header.box15) {
    header.box15 = "NO";
  }
  // Box 17 inference for imports — derive from box8 (Mottaker) country.
  // Most imports go to a Norwegian recipient → "NO". Transit-through-Norway
  // imports (e.g. 81184 with a SVERIGE recipient) need the recipient's
  // country code, NOT a blanket "NO" default.
  if (direction === "import" && !header.box17) {
    let inferred: string | null = null;
    if (header.box8) {
      const lastSeg = header.box8.split(",").pop()?.trim() ?? "";
      inferred = normalizeNorwegianCountry(lastSeg);
    }
    header.box17 = inferred ?? "NO";
  }

  // Container manifest at shipment level.
  const containerSet = new Set<string>();
  for (const it of deduped) {
    if (
      typeof it.box31 === "object" &&
      it.box31 &&
      it.box31.containerNumber
    ) {
      containerSet.add(it.box31.containerNumber);
    }
  }
  if (containerSet.size > 0) {
    header.containers = [...containerSet].sort();
  }

  // Shipment-level totals — sums across line items for fast comparison.
  const totals = {
    grossWeight: roundTo(
      deduped.reduce((s, it) => s + (it.box35 ?? 0), 0),
      2,
    ),
    netWeight: roundTo(
      deduped.reduce((s, it) => s + (it.box38 ?? 0), 0),
      2,
    ),
    lineItemValue: roundTo(
      deduped.reduce((s, it) => s + (it.box42 ?? 0), 0),
      2,
    ),
    statisticalValue: deduped.reduce((s, it) => s + (it.box46 ?? 0), 0),
  };

  const out: PilotGroundTruth = {
    referenceNumber: ref,
    sourceDescription: `Extracted from ${path.basename(pdfPath)}, ${pageCount} pages, ${deduped.length} line items`,
    direction,
    declarationType,
    header: sortBoxKeys(header) as PilotGroundTruth["header"],
    totals,
    lineItems: deduped.map(
      (it) => sortBoxKeys(it) as PilotGroundTruthLine,
    ),
  };
  if (warnings.length > 0) out.warnings = [...new Set(warnings)].sort();
  return out;
}

function roundTo(n: number, decimals: number): number {
  const m = Math.pow(10, decimals);
  return Math.round(n * m) / m;
}

/**
 * Parse the appended FAKTURALISTE table for multi-invoice shipments where
 * box 28 only says "Se vedlagt fakturaliste".
 */
function extractFakturaliste(
  text: string,
): Array<{ invoiceNumber: string; date: string }> | null {
  const lines = text.split("\n");
  const tableHeaderIdx = lines.findIndex((l) =>
    /Fakturanummer\s+Dato/.test(l),
  );
  if (tableHeaderIdx < 0) return null;

  const rows: Array<{ invoiceNumber: string; date: string }> = [];
  for (let i = tableHeaderIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    const m = t.match(
      /^([A-Za-z0-9._/\-]+)\s+(\d{2}\.\d{2}\.\d{4})\s+[\d\s]+,\d{2}/,
    );
    if (!m) {
      if (/[A-Za-zæøåÆØÅ]/.test(t) && !/\d{2}\.\d{2}\.\d{4}/.test(t)) break;
      continue;
    }
    rows.push({ invoiceNumber: m[1], date: m[2] });
  }

  return rows.length > 0 ? rows : null;
}

function sortBoxKeys<T extends Record<string, unknown>>(obj: T): T {
  const keys = Object.keys(obj);
  keys.sort((a, b) => {
    if (a === "itemNumber") return -1;
    if (b === "itemNumber") return 1;
    const ma = a.match(/^box(\d+)([a-z]*)$/);
    const mb = b.match(/^box(\d+)([a-z]*)$/);
    if (ma && mb) {
      const na = parseInt(ma[1], 10);
      const nb = parseInt(mb[1], 10);
      if (na !== nb) return na - nb;
      return ma[2].localeCompare(mb[2]);
    }
    if (ma) return -1;
    if (mb) return 1;
    return a.localeCompare(b);
  });
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = obj[k];
  return out as T;
}

function extractBox47Slots(pageText: string): PilotDutyLine[][] {
  const lines = pageText.split("\n");
  const headerIdx = lines.findIndex(
    (l) => /47 Beregning/.test(l) && /\bType\b/.test(l),
  );
  if (headerIdx < 0) return [];

  const headerLine = lines[headerIdx];
  const firstType = headerLine.indexOf("Type");
  const secondType = headerLine.indexOf("Type", firstType + 4);
  const splitCol = secondType > 0 ? secondType - 1 : -1;

  const sumIdx = lines.findIndex(
    (l, i) => i > headerIdx && /Sum første varepost/.test(l),
  );
  const tredjeIdx = lines.findIndex(
    (l, i) => i > headerIdx && /Sum tredje varepost/.test(l),
  );
  const guardIdx = lines.findIndex(
    (l, i) =>
      i > headerIdx &&
      (/^31 Kolli\b/.test(l.trim()) ||
        /^A\. AVGANGS/.test(l.trim()) ||
        /^NORGE\s*$/.test(l.trim())),
  );
  const hardEnd = guardIdx > 0 ? guardIdx : lines.length;

  const topEnd =
    sumIdx > 0
      ? sumIdx
      : Math.min(tredjeIdx > 0 ? tredjeIdx : hardEnd, hardEnd);
  const bottomEnd = tredjeIdx > 0 ? tredjeIdx : hardEnd;
  const topLines = lines.slice(headerIdx + 1, topEnd);
  const bottomLines = sumIdx > 0 ? lines.slice(sumIdx + 1, bottomEnd) : [];

  const leftSlot: PilotDutyLine[] = [];
  const rightSlot: PilotDutyLine[] = [];
  const bottomLeftSlot: PilotDutyLine[] = [];

  const splitDuty = (line: string): { left: string; right: string } => {
    if (splitCol < 0) return { left: line, right: "" };
    return {
      left: line.slice(0, splitCol),
      right: line.length > splitCol ? line.slice(splitCol) : "",
    };
  };

  for (const line of topLines) {
    const { left, right } = splitDuty(line);
    parseDutyHalf(left, leftSlot);
    if (right) parseDutyHalf(right, rightSlot);
  }
  for (const line of bottomLines) {
    const { left } = splitDuty(line);
    parseDutyHalf(left, bottomLeftSlot);
  }

  return [leftSlot, rightSlot, bottomLeftSlot];
}

function parseDutyHalf(half: string, out: PilotDutyLine[]): void {
  if (
    /Sum første varepost|Sum andre varepost|Sum tredje varepost|SAMMENDRAG|Eksemplar for|REGNSKAPSMESSIGE|^Sum:$|S\.S\.:/.test(
      half,
    )
  ) {
    return;
  }
  const segs = half
    .split(/\s{4,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segs.length < 4) return;
  if (!/^[A-Z]{2,3}$/.test(segs[0])) return;
  if (
    segs[0] === "BIS" ||
    segs[0] === "EU" ||
    segs[0] === "IM" ||
    segs[0] === "EX" ||
    segs[0] === "NORGE"
  ) {
    return;
  }
  const numPattern = /^[\d\s]+(?:,\d{1,4})?$/;
  if (!numPattern.test(segs[1]) || !numPattern.test(segs[2])) return;

  let belopStr = segs[3];
  let bm = segs[4];
  const glue = belopStr.match(/^([\d\s]+(?:,\d{1,4})?)\s+([A-Z*]+)$/);
  if (glue) {
    belopStr = glue[1];
    bm = glue[2];
  }
  if (!numPattern.test(belopStr)) return;

  const grunnlag = parseNorwegianNumber(segs[1]);
  const sats = parseNorwegianNumber(segs[2]);
  const belop = parseNorwegianNumber(belopStr);
  if (grunnlag <= 0 && sats <= 0 && belop <= 0) return;
  const duty: PilotDutyLine = {
    dutyType: segs[0],
    base: grunnlag,
    rate: sats,
    amount: belop,
  };
  if (bm && /^[A-Z*]+$/.test(bm)) duty.paymentMethod = bm;
  out.push(duty);
}

function score(item: PilotGroundTruthLine): number {
  let s = 0;
  const b31 = item.box31;
  if (typeof b31 === "string") {
    if (b31) s++;
  } else if (b31) {
    if (b31.description) s++;
    if (b31.marks) s++;
    if (b31.packages !== undefined) s++;
    if (b31.packageType) s++;
    if (b31.containerNumber) s++;
  }
  if (item.box33) s++;
  if (item.box34) s++;
  if (item.box35) s++;
  if (item.box38) s++;
  if (item.box42) s++;
  if (item.box46) s++;
  if (item.box36) s++;
  if (item.box37) s++;
  if (item.box41 !== undefined) s++;
  if (item.box45 !== undefined) s++;
  if (item.box47 && item.box47.length > 0) s++;
  if (item.articleNumber) s++;
  if (item.chassisNumber) s++;
  if (item.box43 !== undefined) s++;
  if (item.box44 && item.box44.length) s++;
  return s;
}

// ── Header Extraction ────────────────────────────────────────────

function extractHeader(
  text: string,
  warnings: string[],
): PilotGroundTruth["header"] {
  const header: PilotGroundTruth["header"] = {};
  const lines = text.split("\n");

  // Box 1
  const box1Match = text.match(/\b(EU|IM|EX)\s+(\d)\b/);
  if (box1Match) {
    header.box1 = { col1: box1Match[1], col2: parseInt(box1Match[2], 10) };
  }

  // Box 2
  const box2 = extractBox2(lines);
  if (box2) header.box2 = box2;

  // Box 3
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes("3 Blanketter") &&
      lines[i].includes("4 Lastelister")
    ) {
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const segs = lines[j]
          .split(/\s{4,}/)
          .map((s) => s.trim())
          .filter(Boolean);
        for (let k = 0; k < segs.length - 1; k++) {
          if (/^\d{1,3}$/.test(segs[k]) && /^\d{1,3}$/.test(segs[k + 1])) {
            const n = parseInt(segs[k], 10);
            const N = parseInt(segs[k + 1], 10);
            if (n >= 1 && n <= N && N <= 999) {
              header.box3 = `${n}/${N}`;
              break;
            }
          }
        }
        if (header.box3) break;
      }
      break;
    }
  }

  // Box 5 / 6 / 7 — the data row may be offset 1-8 lines below the label
  // because the rotated "Eksemplar for avsender/eksportør" text inserts
  // blank lines between the label row and the data row.
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes("5 Vareposter") &&
      lines[i].includes("7 Referansenummer")
    ) {
      for (let j = i + 1; j < Math.min(i + 9, lines.length); j++) {
        const next = lines[j] ?? "";
        const segs = next
          .split(/\s{4,}/)
          .map((s) => s.trim())
          .filter(Boolean);
        const numericIdxs: number[] = [];
        segs.forEach((s, idx) => {
          if (/^\d+$/.test(s)) numericIdxs.push(idx);
        });
        if (numericIdxs.length >= 2) {
          header.box5 = parseInt(segs[numericIdxs[0]], 10);
          header.box6 = parseInt(segs[numericIdxs[1]], 10);
          const refParts = segs.slice(numericIdxs[1] + 1);
          if (refParts.length > 0) {
            header.box7 = refParts.join(" ").replace(/\s+/g, " ").trim();
          }
          break;
        }
      }
      break;
    }
  }

  // Box 8
  const box8 = extractBox8(lines);
  if (box8) header.box8 = box8;

  // Box 2 / Box 8 kundenr (Norlines customer number printed next to the
  // party label). Same row carries both kundenr (1-6 digits, ≤ 449887 per
  // the Norlines markedsbase) and a 9-digit orgnr. Column ordering varies
  // between print templates, so we extract by digit-length, not position.
  // 12-digit EORI-style numbers (seen e.g. on 60923 box 8) get filtered out
  // because the kundenr range never reaches that length.
  const box2Kundenr = extractKundenrFromLabelLine(lines, /^\s*2 Avsender\/Eksport(?:ør|or)/);
  if (box2Kundenr !== undefined) header.box2Kundenr = box2Kundenr;
  const box8Kundenr = extractKundenrFromLabelLine(lines, /^\s*8 Mottaker\b/);
  if (box8Kundenr !== undefined) header.box8Kundenr = box8Kundenr;

  // Box 12
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("12 Verdiopplysninger")) {
      const c12 = lines[i].indexOf("12 Verdiopplysninger");
      const c13 = lines[i].includes("13 F.L.P")
        ? lines[i].indexOf("13 F.L.P")
        : c12 + 50;
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const slice = lines[j].slice(c12, c13).trim();
        if (!slice) continue;
        const m = slice.match(/^(\d{1,3}(?:\s\d{3})*(?:,\d{1,2})?)$/);
        if (m) {
          const v = parseNorwegianNumber(m[1]);
          if (v > 0) {
            header.box12 = v;
            break;
          }
        }
      }
      break;
    }
  }

  // Box 14
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("14 Deklarant/Representant")) {
      const orgMatch = lines[i].match(/nr\.\s+(\d{9})/);
      const orgNum = orgMatch ? orgMatch[1] : "";
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const leftContent = leftMostTextSegment(lines[j]);
        if (leftContent && /[A-Za-zæøåÆØÅ]{3,}/.test(leftContent)) {
          header.box14 = orgNum
            ? `${orgNum} ${leftContent}`
            : leftContent;
          break;
        }
      }
      break;
    }
  }

  // Box 15 + Box 17a
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes("15 Kode avs.") ||
      lines[i].includes("Kode avs./utf")
    ) {
      const labelLine = lines[i];
      const col17 = labelLine.indexOf("17 Kode");
      for (let j = i + 1; j < Math.min(i + 9, lines.length); j++) {
        const line = lines[j];
        for (const m of line.matchAll(/\ba\s+([A-Z]{2})?\s+b\b/g)) {
          if (!m[1]) continue;
          const aCol = m.index ?? 0;
          if (col17 > 0 && aCol >= col17) {
            if (!header.box17a) header.box17a = m[1];
          } else {
            if (!header.box15) header.box15 = m[1];
          }
        }
      }
      break;
    }
  }

  // Box 17 — captured as Norwegian country name (e.g. "SVERIGE"), then
  // normalized to ISO-2 ("SE") so downstream comparison matches the
  // pipeline's ISO-coded output.
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes("17 Bestemmelsesland") &&
      !lines[i].includes("Kode best")
    ) {
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const right = sliceRightCol(lines[j]).trim();
        if (
          right.length > 2 &&
          /^[A-ZÆØÅ][A-ZÆØÅa-zæøå\s\-,.]+$/.test(right) &&
          !/^(EU|IM|EX)\b/.test(right)
        ) {
          const iso = normalizeNorwegianCountry(right);
          if (iso) {
            header.box17 = iso;
          } else {
            header.box17 = right;
            warnings.push(`box17_unknown_country:${right}`);
          }
          break;
        }
      }
      break;
    }
  }

  // Box 19 + Box 20
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes("19 Cont.") &&
      lines[i].includes("20 Leveringsvilkår")
    ) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const m = lines[j].match(/^\s*([01])\s+([A-Z]{3}\b.*)/);
        if (m) {
          header.box19 = parseInt(m[1], 10);
          header.box20 = m[2].trim().replace(/\s+/g, " ");
          break;
        }
      }
      break;
    }
  }

  if (!header.box20) {
    const m = text.match(
      /20 Leveringsvilkår\s*\n\s*(?:[01]\s+)?([A-Z]{3}[^\n]*)/,
    );
    if (m) header.box20 = m[1].trim().replace(/\s+/g, " ");
  }

  // Box 21 — with transport-noun denylist for identity
  const transportNouns = new Set([
    "båt",
    "bil",
    "fly",
    "tog",
    "lastebil",
    "container",
    "truck",
    "skip",
  ]);
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes("21 Det aktive transportmiddelets") ||
      lines[i].includes(
        "transportmiddelets identitet og nasjonalitet ved grensepassering",
      )
    ) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const parts = lines[j]
          .split(/\s{5,}/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length === 0) continue;
        if (!parts[0]) continue;

        let nationality = "";
        for (let k = 1; k < parts.length; k++) {
          if (/^[A-Z]{2}$/.test(parts[k])) {
            nationality = parts[k];
            break;
          }
          const m = parts[k].match(
            /^([A-Z]{2})\s+(NOK|EUR|USD|GBP|SEK|DKK|PLN|CHF|CZK|JPY|CNY|AUD|CAD|HKD|NZD|SGD|AED|ZAR|INR|MXN|BRL|ISK|TRY|KRW|RUB)\b/,
          );
          if (m) {
            nationality = m[1];
            break;
          }
        }
        const box21: { identity?: string; nationality?: string } = {};
        const rawId = parts[0];
        if (rawId && !transportNouns.has(rawId.toLowerCase())) {
          box21.identity = rawId;
        }
        if (nationality) box21.nationality = nationality;
        if (box21.identity || box21.nationality) header.box21 = box21;
        break;
      }
      break;
    }
  }

  // Box 22 / 23 / 24 — currency list expanded to cover the full common set
  const knownCurrencies = new Set([
    "NOK",
    "EUR",
    "USD",
    "GBP",
    "SEK",
    "DKK",
    "PLN",
    "CHF",
    "CZK",
    "JPY",
    "CNY",
    "AUD",
    "CAD",
    "HKD",
    "NZD",
    "SGD",
    "AED",
    "ZAR",
    "INR",
    "MXN",
    "BRL",
    "ISK",
    "TRY",
    "KRW",
    "RUB",
  ]);
  let box22Found = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("22 Fakturert valuta")) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        // Accept any 3-letter currency that matches the known list.
        const matches = [
          ...lines[j].matchAll(/\b([A-Z]{3})\s+([\d\s]+,\d{2})/g),
        ];
        let matched: RegExpMatchArray | null = null;
        for (const m of matches) {
          if (knownCurrencies.has(m[1])) {
            matched = m;
            break;
          }
        }
        if (matched) {
          box22Found = true;
          header.box22 = {
            currency: matched[1],
            value: parseNorwegianNumber(matched[2]),
          };
          const tail = lines[j].slice(
            (matched.index ?? 0) + matched[0].length,
          );
          // Rates print with 2–4 decimals depending on the TVINN template:
          // "2,54 0 1" (2026-05 prints) vs "2,780 0 1" (2025-12/2026-07
          // prints). A 2-decimal-only pattern backtracks to the bare-digit
          // alternative on 3-decimal rates and captures "780" — every
          // NorLines 03.08 GT carried a garbage box 23 until this widened.
          const rateMatch = tail.match(
            /([\d\s]+,\d{2,4}|\d+,\d{2,4}|\d+)\s+(\d)\s+(\d)\s*$/,
          );
          if (rateMatch) {
            header.box23 = parseNorwegianNumber(rateMatch[1]);
            header.box24 = `${rateMatch[2]}${rateMatch[3]}`;
          } else {
            const simpleRate = tail.match(/([\d\s]+,\d{2,4})\b/);
            if (simpleRate)
              header.box23 = parseNorwegianNumber(simpleRate[1]);
          }
          break;
        }
        // Warn when an unrecognised 3-letter currency code was visible but
        // didn't pass the known-currency gate.
        if (matches.length > 0 && !matched) {
          warnings.push(`box22_unknown_currency:${matches[0][1]}`);
        }
      }
      break;
    }
  }
  if (!box22Found && header.box1) warnings.push("box22_missing");

  // Box 25
  let in25 = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("25 Transportmåte")) {
      in25 = true;
      continue;
    }
    if (lines[i].includes("29 Utpasserings")) break;
    if (in25) {
      const trimmed = lines[i].trim();
      if (/^\d{1,2}$/.test(trimmed)) {
        header.box25 = parseInt(trimmed, 10);
        break;
      }
      const m2 = trimmed.match(/^(\d{1,2})\s{5,}/);
      if (m2) {
        header.box25 = parseInt(m2[1], 10);
        break;
      }
    }
  }

  // Box 28 — structured as { invoices: [{invoiceNumber, date}, ...] }
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("28 Finansielle opplysninger")) {
      const invoices: Array<{ invoiceNumber: string; date: string }> = [];
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        if (
          lines[j].includes("31 Kolli") ||
          lines[j].includes("Tollager") ||
          /^\s*3\s+8\b/.test(lines[j])
        ) {
          break;
        }
        const m = lines[j].match(
          /([A-Za-z0-9._/\-+]+(?:\s*[-,]\s*[A-Za-z0-9._/\-+]+)*)\s+-\s+(\d{2}\.\d{2}\.\d{4})/,
        );
        if (m) {
          invoices.push({
            invoiceNumber: m[1].trim().replace(/\s+/g, " "),
            date: m[2],
          });
        }
      }
      if (invoices.length > 0) header.box28 = { invoices };
      break;
    }
  }

  // Box 29 + Box 30 — box30 uses longest-match selection (A8 wins over A
  // when both appear as separate segments on the data row).
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes("29 Utpasserings") ||
      lines[i].includes("/innpasseringstollsted")
    ) {
      let dataRow: string | null = null;
      for (let k = i + 1; k < Math.min(i + 6, lines.length); k++) {
        if (/^\s*3\s+8\b/.test(lines[k])) {
          dataRow = lines[k];
          break;
        }
      }
      if (!dataRow) dataRow = lines[i + 1] ?? "";
      const stripped = dataRow.replace(/^\s*3\s+8/, "").trim();
      const parts = stripped
        .split(/\s{5,}/)
        .map((s) => s.trim())
        .filter(Boolean);
      // Box 29 — Tolletaten tollsted codes are 2 or 4 digits.
      const numericCode = parts.find((p) => /^\d{2,4}$/.test(p));
      if (numericCode) {
        header.box29 = numericCode;
      } else {
        const place = parts.find(
          (p) =>
            /^[A-ZÆØÅ][a-zæøå]{2,}$/.test(p) && !/^Tollager/i.test(p),
        );
        if (place) header.box29 = place;
      }
      // Box 30: pick the LONGEST valid lager code segment so "A8" beats "A".
      const lagerCandidates = parts.filter((p) =>
        /^(A8|A|B|C|D|E|X)$/.test(p),
      );
      if (lagerCandidates.length > 0) {
        lagerCandidates.sort((a, b) => b.length - a.length);
        header.box30 = lagerCandidates[0];
      }
      break;
    }
  }

  // Box 49
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("49 Lagerkode/Godsnummer")) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const m = lines[j].match(/(\d{4,}[A-Z0-9/]+)/);
        if (m) {
          header.box49 = m[1];
          break;
        }
      }
      break;
    }
  }

  return header;
}

/**
 * Pull the Norlines kundenr from the row that starts with the given label
 * regex (box 2 = "2 Avsender/Eksportør", box 8 = "8 Mottaker"). Captures
 * every bare integer token on the same line, then picks the first whose
 * length is 1-6 digits and value < 1_000_000. That filter cleanly
 * separates kundenr from the 9-digit Norwegian orgnr that sits beside it,
 * and from any longer reference numbers (e.g. 12-digit EORI) the print
 * template sometimes carries on the same row.
 */
function extractKundenrFromLabelLine(
  lines: string[],
  labelRegex: RegExp,
): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (!labelRegex.test(lines[i])) continue;
    // Scan the label line itself + up to 2 wrapping lines. Box 8 in
    // particular wraps the orgnr/kundenr to the next line when both are
    // present (Norwegian recipient on imports). The wrap line never
    // contains the next-box label "9 Den økonomisk ansvarlige" before
    // "nr.", so we stop at that boundary.
    for (let j = i; j < Math.min(i + 3, lines.length); j++) {
      const raw = j === i ? lines[j].replace(labelRegex, "") : lines[j];
      const tail = raw.split(/9 Den ø?konomisk/)[0];
      const k = pickKundenrFromTokens(tail);
      if (k !== undefined) return k;
    }
    return undefined;
  }
  return undefined;
}

function pickKundenrFromTokens(text: string): number | undefined {
  for (const m of text.matchAll(/\b(\d+)\b/g)) {
    const tok = m[1];
    if (tok.length >= 1 && tok.length <= 6) {
      const n = parseInt(tok, 10);
      if (n > 0 && n < 1_000_000) return n;
    }
    // pdftotext occasionally drops the inter-column spacing and glues
    // orgnr + kundenr into one 10-15 digit token. Norwegian orgnr is
    // exactly 9 digits, so peel that off the leading edge and treat the
    // 1-6 digit remainder as the kundenr. Verified on 80801
    // (995498278|1562 → ANDENES) and 80379 (971349077|1911 → HAVFORSKN.).
    if (tok.length >= 10 && tok.length <= 15) {
      const remainder = tok.slice(9);
      if (remainder.length >= 1 && remainder.length <= 6) {
        const n = parseInt(remainder, 10);
        if (n > 0 && n < 1_000_000) return n;
      }
    }
  }
  return undefined;
}

function extractBox2(lines: string[]): string | null {
  const collected: string[] = [];
  let started = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s+3\s+8\s+/.test(line) && !started) {
      const after = line.replace(/^\s+3\s+8\s+/, "");
      const cleaned = after.replace(/\s+(EU|IM|EX)\s+\d.*$/, "").trim();
      if (cleaned) collected.push(cleaned);
      started = true;
      continue;
    }
    if (!started) continue;

    const left = leftMostTextSegment(line);
    if (left && !isNoiseAddressSegment(left)) {
      collected.push(left);
    }
    if (/^\s*8 Mottaker/.test(line) || line.includes("8 Mottaker")) break;
  }
  if (collected.length === 0) return null;
  return joinAddress(collected);
}

function isNoiseAddressSegment(s: string): boolean {
  if (
    /^(3 Blanketter|4 Lastelister|5 Vareposter|6 Antall|7 Referanse|8 Mottaker|9 Den|10 Første|11 Handels|12 Verdiopplysninger|13 F\.L\.P|14 Deklarant)/.test(
      s,
    )
  ) {
    return true;
  }
  if (/^\d+\s+\d+$/.test(s)) return true;
  if (/^\d{6,}$/.test(s)) return true;
  if (/^Eksemplar for/.test(s)) return true;
  if (/^[01]\s+(EU|IM|EX)\b/.test(s)) return true;
  if (/^nr\.?$/.test(s)) return true;
  if (/^\d+(\s+\d+)*\s+nr\.?$/.test(s)) return true;
  if (/^[A-Z0-9]+\/[A-Z0-9./-]+/.test(s) && !/\s/.test(s)) return true;
  // Box 7 reference number bleeding into the box2/box8 column band, e.g.
  // "81234 - BEWI/BY619A" or "80826 - MILLSHIP/stålbjelker Sandnes 29/04/".
  // Shape: 4+ digit prefix + " - " + arbitrary tail. Require whitespace on
  // BOTH sides of the dash so foreign postcodes like "3830-552 Gavanha da
  // Nazare" or "20-719 Lublin" are not stripped as noise.
  if (/^\d{4,}\s+-\s+\S/.test(s)) return true;
  return false;
}

function extractBox8(lines: string[]): string | null {
  const collected: string[] = [];
  let started = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("8 Mottaker") && !started) {
      started = true;
      continue;
    }
    if (!started) continue;

    const left = leftMostTextSegment(line);
    if (left && !isNoiseAddressSegment(left)) {
      collected.push(left);
    }
    if (/^\s*14 Deklarant/.test(line) || line.includes("14 Deklarant")) break;
  }
  if (collected.length === 0) return null;
  return joinAddress(collected);
}

function joinAddress(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(", ")
    .replace(/,+/g, ",")
    .replace(/\s+,/g, ",")
    .trim();
}

function leftMostTextSegment(line: string): string | null {
  const stripped = line.replace(/^\s*3\s+8\s+/, "");
  const segs = stripped
    .split(/\s{5,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segs.length === 0) return null;
  for (const s of segs) {
    if (s.length < 2) continue;
    if (/[A-Za-zÆØÅæøå]/.test(s)) {
      return s;
    }
  }
  return null;
}

const BOX44_CODES = new Set([
  "SER",
  "U1",
  "U2",
  "U3",
  "TXT",
  "UND",
  "FOR",
  "DEL",
  "CIT",
  "HST",
  "GEN",
  "MR",
  "W1",
  "W2",
  "TB",
  "TMS",
  "B3",
  "B4",
  "K5",
  "FD",
  "FS",
  "DA",
  "L3",
  "V1",
  "S1",
  "S2",
  "AFB",
  "USK",
  "KVT",
  "VEC",
  "FLY",
  "MIL",
  "BOK",
  "UNI",
  "I1",
  "I2",
  "M2",
  "VT",
  "V3",
  "V5",
  "S6",
  "S3",
  "N2",
  "P2",
  "P3",
  "CE",
  "TSM",
  "DOK",
]);

function collectBox44Refs(
  pageText: string,
): Array<{ code: string; reference: string }> {
  const refs: Array<{ code: string; reference: string }> = [];
  for (const line of pageText.split("\n")) {
    const segs = line
      .split(/\s{5,}/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const seg of segs) {
      const m = seg.match(/^([A-Z]{1,3}\d?)\s+(.+)$/);
      if (!m) continue;
      if (!BOX44_CODES.has(m[1])) continue;
      const ref = m[2].trim().replace(/\s+/g, " ");
      if (/^Tilleggs|^lysninger/.test(ref)) continue;
      if (ref.length < 2 || ref.length > 80) continue;
      refs.push({ code: m[1], reference: ref });
    }
  }
  return refs;
}

// ── Line Item Extraction ────────────────────────────────────────

// Tolletaten valid 4-digit procedure code combinations (current ## previous).
// Subset of the full table — most common imports/exports. Codes outside this
// set produce a warning, not a hard failure.
const VALID_PROCEDURE_CODES = new Set([
  // imports
  "4000",
  "4050",
  "4051",
  "4052",
  "4070",
  "4071",
  "4072",
  "4099",
  "4100",
  "4170",
  "4171",
  "4172",
  "5000",
  "5010",
  "5011",
  "5071",
  "5072",
  "5100",
  "5110",
  "5111",
  "5171",
  "5172",
  "5200",
  "5210",
  "5211",
  "5271",
  "5272",
  "5700",
  "5710",
  "5711",
  "5771",
  "5772",
  "6000",
  "6010",
  "6011",
  "6020",
  "6021",
  "6022",
  "7000",
  "7040",
  "7100",
  "7171",
  "7172",
  "7200",
  // exports
  "1000",
  "1070",
  "1100",
  "1170",
  "2000",
  "2040",
  "2041",
  "2070",
  "2071",
  "2100",
  "2140",
  "2141",
  "2170",
  "2171",
  "2200",
  "2240",
  "2241",
  "2270",
  "2271",
  "3040",
  "3041",
  "3050",
  "3051",
  "3052",
  "3057",
  "3071",
  "3072",
  "8000",
  "8071",
  "8072",
  "8100",
  "8171",
  "8172",
  "8200",
  // provisions
  "0100",
  "0140",
  "0170",
  "0200",
  "0271",
  "0300",
  "0340",
  "0370",
  "0400",
  "0471",
  "0500",
  "0540",
  "0570",
  "0600",
  "0671",
]);

function extractLineItemsFromPage(
  pageText: string,
  warnings: string[],
): PilotGroundTruthLine[] {
  const items: PilotGroundTruthLine[] = [];
  const lines = pageText.split("\n");

  const blockStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^31 Kolli\b/.test(lines[i].trim())) {
      blockStarts.push(i);
    }
  }

  for (let bi = 0; bi < blockStarts.length; bi++) {
    const start = blockStarts[bi];
    const end =
      bi + 1 < blockStarts.length ? blockStarts[bi + 1] : lines.length;
    const block = lines.slice(start, end);

    const item = parseLineItemBlock(block, warnings);
    if (item && item.itemNumber > 0 && item.box33) {
      items.push(item);
    }
  }

  return items;
}

function parseLineItemBlock(
  block: string[],
  warnings: string[],
): PilotGroundTruthLine | null {
  let itemNumber = 0;
  let box31 = "";
  let box31Marks: string | undefined;
  let box31Packages: number | undefined;
  let box31PackageType: string | undefined;
  let box31Container: string | undefined;
  let articleNumber: string | undefined;
  let chassisNumber: string | undefined;
  let box33 = "";
  let box34 = "";
  let box35 = 0;
  let box36: string | undefined;
  let box38 = 0;
  let box41: number | undefined;
  let box42 = 0;
  let box43: number | undefined;
  let box44: Array<{ code: string; reference: string }> = [];
  let box45: number | undefined;
  let box46: number | undefined;

  for (const line of block) {
    if (!box31Marks) {
      const m = line.match(/Merke:\s*(.+?)(?:\s{4,}|$)/);
      if (m) box31Marks = m[1].trim();
    }
    if (box31Packages === undefined) {
      const m = line.match(/Antall:\s*(\d+)\s*([A-Za-z]+)?/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > 0) {
          box31Packages = n;
          if (m[2]) box31PackageType = m[2];
        } else if (m[2]) {
          box31PackageType = m[2];
        }
      }
    }
    if (!articleNumber) {
      const m = line.match(/ArtikkelNr:\s*([A-Za-z0-9._/\-]+)/);
      if (m) articleNumber = m[1];
    }
    if (!box31Container) {
      const m = line.match(/\b([A-Z]{4}\d{7})\b/);
      if (m) box31Container = m[1];
    }
    if (!chassisNumber) {
      const m = line.match(/\bCHASS\s+([A-Z0-9]+)\b/);
      if (m) chassisNumber = m[1];
    }
  }

  // Drop the template placeholder "addr" — it's printed on every form as
  // chrome under the Merke: label, not a real mark value.
  if (box31Marks && /^addr$/i.test(box31Marks)) {
    box31Marks = undefined;
  }

  // Vareslag: <description>
  for (const line of block) {
    const m = line.match(/Vareslag:\s*(.+?)\s*$/);
    if (!m) continue;
    let desc = m[1];

    {
      const allSegs = desc
        .split(/\s{4,}/)
        .map((s) => s.trim())
        .filter(Boolean);
      const descSeg = allSegs[0] ?? "";
      const trail = allSegs.slice(1);

      let i = trail.length - 1;
      if (i >= 0 && /^[A-Z]$/.test(trail[i])) {
        box36 = trail[i];
        i--;
      }
      if (i >= 0 && /^[\d\s,.]+$/.test(trail[i])) {
        box35 = parseNorwegianNumber(trail[i]);
        i--;
      }
      if (
        i >= 1 &&
        /^\d{2}$/.test(trail[i]) &&
        /^([A-Z]{2}|\d{2})$/.test(trail[i - 1])
      ) {
        box34 = trail[i - 1];
        i -= 2;
      } else if (i >= 0 && /^([A-Z]{2}|\d{2})$/.test(trail[i])) {
        box34 = trail[i];
        i--;
      }

      desc = descSeg;
    }
    desc = desc.replace(/\s{4,}\d[\d\s,.]*\s*$/, "");
    box31 = desc.trim();
    break;
  }

  // Box 33 + 32
  let hsLineIdx = -1;
  for (let i = 0; i < block.length; i++) {
    const segs = block[i]
      .split(/\s{4,}/)
      .map((s) => s.trim())
      .filter(Boolean);
    let hsIdx = -1;
    let hsFirst = "";
    for (let k = 0; k < segs.length; k++) {
      const m = segs[k].match(/^(\d{4})\.(\d{2})$/);
      if (m) {
        hsFirst = `${m[1]}${m[2]}`;
        hsIdx = k;
        break;
      }
    }
    if (hsIdx < 0) continue;
    let hsSecond = "";
    for (let k = segs.length - 1; k > hsIdx; k--) {
      if (/^\d{2}$/.test(segs[k])) {
        hsSecond = segs[k];
        break;
      }
    }
    // pdftotext sometimes wraps the 2-digit HS-second onto the next line on
    // long-ArtikkelNr rows. Search the immediate next 1-2 lines for a lone
    // 2-digit segment if not found on the HS-first line.
    if (!hsSecond) {
      for (let nn = i + 1; nn < Math.min(i + 3, block.length); nn++) {
        const nextSegs = block[nn]
          .split(/\s{4,}/)
          .map((s) => s.trim())
          .filter(Boolean);
        const cand = nextSegs.find((s) => /^\d{2}$/.test(s));
        if (cand) {
          hsSecond = cand;
          break;
        }
      }
    }
    // Also handle the glued case "<itemNum>  <hsSecond>" in the trailing
    // segment when the gap between them is <4 spaces (e.g. "419  00").
    let gluedItemNumber = 0;
    if (!hsSecond) {
      for (let k = segs.length - 1; k > hsIdx; k--) {
        const m = segs[k].match(/^(\d{1,3})\s+(\d{2})$/);
        if (m) {
          const candItem = parseInt(m[1], 10);
          if (candItem >= 1 && candItem <= 999) {
            gluedItemNumber = candItem;
            hsSecond = m[2];
            break;
          }
        }
      }
    }
    if (!hsSecond) continue;
    box33 = `${hsFirst}${hsSecond}`;
    if (gluedItemNumber > 0) itemNumber = gluedItemNumber;
    hsLineIdx = i;
    for (const s of segs) {
      if (!/^\d{1,3}$/.test(s)) continue;
      const n = parseInt(s, 10);
      if (n < 1 || n > 999) continue;
      if (segs.indexOf(s) === segs.lastIndexOf(s) && s === hsSecond) continue;
      if (s === hsSecond && segs.filter((x) => x === hsSecond).length === 1)
        continue;
      itemNumber = n;
      break;
    }
    break;
  }
  if (box33 && itemNumber === 0 && hsLineIdx > 0) {
    for (let i = hsLineIdx - 1; i >= Math.max(0, hsLineIdx - 3); i--) {
      const segs = block[i]
        .split(/\s{4,}/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const s of segs) {
        if (/^\d{1,3}$/.test(s)) {
          const n = parseInt(s, 10);
          if (n >= 1 && n <= 999) {
            itemNumber = n;
            break;
          }
        }
      }
      if (itemNumber) break;
    }
  }

  // First try: country code may have been glued onto the description text
  // (pdftotext sometimes joins them with 0 or 1 spaces). Peel a trailing
  // 2-letter all-caps token off box31 if it matches a known ISO-2 code.
  // Gating against KNOWN_ISO2_CODES prevents stripping arbitrary tokens
  // like "...AS" or "...ER". Done BEFORE the broader fallback to avoid
  // picking up duty-row codes like "FA" as the country.
  if (!box34 && box31) {
    // Try with-space first, then no-space ("400GPL"-style).
    let m = box31.match(/\s+([A-Z]{2})\s*$/);
    if (!m) m = box31.match(/([A-Z]{2})\s*$/);
    if (m && KNOWN_ISO2_CODES.has(m[1])) {
      box34 = m[1];
      box31 = box31.replace(/\s*[A-Z]{2}\s*$/, "").trimEnd();
    }
  }

  // Long-form layout fallback: on items where pdftotext lays out the
  // 34/35/36 values as "<COUNTRY_NAME>   <weight>   <preference>" on a row
  // of its own (rather than glued onto Vareslag), pick up box35/box36.
  // Also resolve box34 here when the country name maps to a known ISO code.
  if (box35 === 0) {
    for (const line of block) {
      const segs = line
        .split(/\s{4,}/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (segs.length < 2 || segs.length > 4) continue;
      // First seg must be an all-caps country name (≥3 letters), not a label
      if (!/^[A-ZÆØÅ ]{3,}$/.test(segs[0])) continue;
      if (
        /^(MERKER|VARESLAG|KODE|BRUTTOVEKT|NETTOVEKT|REFERANSE|TILLEGGSOPP|SAMMENDRAG|PROSEDYRE|SUM|TYPE|ANTALL|EKSEMPLAR|NORGE)/.test(
          segs[0],
        )
      ) {
        continue;
      }
      // Second seg: weight (numeric)
      if (!/^[\d\s,.]+$/.test(segs[1])) continue;
      const w = parseNorwegianNumber(segs[1]);
      if (w <= 0 || w >= 10_000_000) continue;
      box35 = w;
      if (segs.length >= 3 && /^[A-Z]$/.test(segs[2])) box36 = segs[2];
      // Resolve box34 from the country name if it's not already set.
      if (!box34) {
        const iso = normalizeNorwegianCountry(segs[0]);
        if (iso) box34 = iso;
      }
      break;
    }
  }

  // Box 34 / 35 / 36 fallback — for layouts where the Vareslag row doesn't
  // carry the box34/35/36 cells at all and they live on a separate row.
  // Excludes box47 duty rows (FA / RT / TL / MA / etc.) which match the
  // `^[A-Z]{2}$` country-code shape and otherwise poison this fallback.
  const DUTY_CODES = new Set([
    "FA",
    "RT",
    "TL",
    "MA",
    "FK",
    "GA",
    "GP",
    "MP",
    "FF",
    "FB",
    "FC",
    "FD",
    "FH",
    "FV",
    "FT",
    "BM",
  ]);
  if (!box34) {
    for (let i = 0; i < block.length; i++) {
      const line = block[i];
      if (!/[A-Z]{2}/.test(line)) continue;
      if (/Vareslag:/.test(line)) continue;
      if (/\d{4}\.\d{2}/.test(line)) continue;
      if (/\bSER\b|\bU\d\b|\bTXT\b|\bCIT\b|\bUND\b/.test(line)) continue;
      if (/Merker og nr/.test(line)) continue;
      // Skip box47 duty-section rows that look like "FA  14 285,00  0,25 ..."
      if (/^\s*(FA|RT|TL|MA|FK|GA|GP|MP|FF)\b/.test(line)) continue;

      const segs = line
        .split(/\s{4,}/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (segs.length < 2) continue;
      const cIdx = segs.findIndex(
        (s) =>
          /^([A-Z]{2}|\d{2})$/.test(s) && !DUTY_CODES.has(s),
      );
      if (cIdx < 0) continue;
      for (let k = cIdx + 1; k < segs.length; k++) {
        const seg = segs[k];
        if (/^[\d\s,.]+$/.test(seg)) {
          const weight = parseNorwegianNumber(seg);
          if (weight > 0 && weight < 10_000_000) {
            box34 = segs[cIdx];
            box35 = weight;
            if (k + 1 < segs.length && /^[A-Z]$/.test(segs[k + 1])) {
              box36 = segs[k + 1];
            }
            break;
          }
        }
      }
      if (box34) break;
    }
  }

  // Box 37 + 38
  let box37: string | undefined;
  for (const line of block) {
    if (/Vareslag:|Merker og nr|^\s*44\s|46 Statistisk/.test(line)) continue;
    if (/SER\b|U\d\b|TXT\b|CIT\b|UND\b/.test(line)) continue;
    const segs = line
      .split(/\s{4,}/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (segs.length < 2) continue;
    let procIdx = -1;
    let procPair: [string, string] | null = null;
    for (let k = 0; k < segs.length; k++) {
      const inner = segs[k].match(/^(\d{2})\s+(\d{2})$/);
      if (inner) {
        procIdx = k;
        procPair = [inner[1], inner[2]];
        break;
      }
      if (
        /^\d{2}$/.test(segs[k]) &&
        k + 1 < segs.length &&
        /^\d{2}$/.test(segs[k + 1])
      ) {
        procIdx = k + 1;
        procPair = [segs[k], segs[k + 1]];
        break;
      }
    }
    if (procIdx < 0 || !procPair) continue;
    for (let k = procIdx + 1; k < segs.length; k++) {
      const seg = segs[k];
      if (/^[\d\s]+$/.test(seg)) {
        const n = parseNorwegianNumber(seg);
        if (n > 0 && n < 10_000_000) {
          box38 = n;
          break;
        }
      }
    }
    if (box38) {
      box37 = `${procPair[0]} ${procPair[1]}`;
      const compact = `${procPair[0]}${procPair[1]}`;
      if (!VALID_PROCEDURE_CODES.has(compact)) {
        warnings.push(`box37_unknown_code:${compact}`);
      }
      break;
    }
  }

  // Box 42 / 43 / 41
  for (const line of block) {
    if (/Vareslag:|Merker og nr|^\s*44\s|46 Statistisk/.test(line)) continue;
    if (!/,\d{2}\b/.test(line)) continue;
    const segs = line
      .split(/\s{4,}/)
      .map((s) => s.trim())
      .filter(Boolean);
    let priceIdx = -1;
    for (let k = 0; k < segs.length; k++) {
      if (/^\d{1,3}(?:\s\d{3})*,\d{2}$/.test(segs[k])) {
        priceIdx = k;
      }
    }
    if (priceIdx < 0) continue;
    const price = parseNorwegianNumber(segs[priceIdx]);
    if (price <= 0) continue;
    box42 = price;
    if (priceIdx + 1 < segs.length && /^\d$/.test(segs[priceIdx + 1])) {
      box43 = parseInt(segs[priceIdx + 1], 10);
    }
    for (let k = 0; k < priceIdx; k++) {
      const seg = segs[k];
      if (/^\d+$/.test(seg) && seg !== "0" && seg.length <= 6) {
        const mengde = parseInt(seg, 10);
        if (mengde > 0 && mengde < 1_000_000) {
          box41 = mengde;
          break;
        }
      }
    }
    break;
  }

  // Box 45
  for (let i = 0; i < block.length; i++) {
    if (
      block[i].includes("T.O. kode 45. Justering") ||
      block[i].includes("45. Justering") ||
      block[i].includes("45 Justering")
    ) {
      const next46 = block.findIndex(
        (l, k) => k > i && l.includes("46 Statistisk verdi"),
      );
      const stop = next46 >= 0 ? next46 : Math.min(i + 6, block.length);
      for (let j = i + 1; j < stop; j++) {
        const segs = block[j]
          .split(/\s{4,}/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (segs.length === 0) continue;
        const last = segs[segs.length - 1];
        const m = last.match(/^(-?[\d\s]+)$/);
        if (!m) continue;
        const v = parseNorwegianNumber(m[1]);
        if (v !== 0) {
          box45 = v;
          break;
        }
      }
      break;
    }
  }

  // Box 46 — value sits below the label, right-aligned in the right column.
  // Layouts with TXT/B3/SER refs in the LEFT column still print the value
  // at the line's far right, so we look at the right column band (col 130+)
  // rather than rejecting any line containing letters.
  for (let i = 0; i < block.length; i++) {
    if (block[i].includes("46 Statistisk verdi")) {
      for (let j = i + 1; j < Math.min(i + 6, block.length); j++) {
        const trimmed = block[j].trim();
        if (trimmed.length === 0) continue;
        // 1) Whole-line pure-numeric (no left-column ref decoration).
        if (/^[\d\s]+$/.test(trimmed)) {
          box46 = Math.round(parseNorwegianNumber(trimmed));
          break;
        }
        // 2) Right column band only (col 130+): a trailing integer there.
        const rightBand = block[j].length > 130 ? block[j].slice(130) : "";
        const rm = rightBand.match(/([\d][\d\s]*)\s*$/);
        if (rm && /\d/.test(rm[1])) {
          const candidate = Math.round(parseNorwegianNumber(rm[1]));
          if (candidate > 0) {
            box46 = candidate;
            break;
          }
        }
      }
      break;
    }
  }

  // Box 44 — dedup by code+reference
  const blockText = block.join("\n");
  const lineRefs = collectBox44Refs(blockText);
  if (lineRefs.length > 0) {
    const seen = new Set<string>();
    box44 = lineRefs.filter((r) => {
      const key = `${r.code}|${r.reference}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (!box33 && !box31) return null;

  const pkgDesc: PilotPackagesDescription = {};
  if (box31Marks) pkgDesc.marks = box31Marks;
  if (box31Packages !== undefined) pkgDesc.packages = box31Packages;
  if (box31PackageType) pkgDesc.packageType = box31PackageType;
  if (box31) pkgDesc.description = box31;
  if (box31Container) pkgDesc.containerNumber = box31Container;

  const item: PilotGroundTruthLine = {
    itemNumber,
    box31: pkgDesc,
    box33,
    box34,
    box35,
    box38,
    box42,
  };
  if (box36) item.box36 = box36;
  if (box37) item.box37 = box37;
  if (box41 !== undefined) item.box41 = box41;
  if (box43 !== undefined) item.box43 = box43;
  if (box44.length > 0) item.box44 = box44;
  if (box45 !== undefined) item.box45 = box45;
  if (box46 !== undefined) item.box46 = box46;
  if (articleNumber) item.articleNumber = articleNumber;
  if (chassisNumber) item.chassisNumber = chassisNumber;
  return item;
}

function sliceRightCol(line: string): string {
  return line.substring(130).trim();
}

function parseNorwegianNumber(str: string): number {
  const cleaned = str.trim().replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return Math.round(num * 100) / 100;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
