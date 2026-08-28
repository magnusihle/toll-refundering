/**
 * Does the payload we were served actually have the fields this build reads?
 *
 * Prod serves one frozen snapshot pushed by `npm run publish`; the frontend
 * deploys separately from git. Nothing keeps the two in step, so the app can be
 * newer than the data it renders — and a missing field is not a crash, it is a
 * wrong number. On 20 Aug the snapshot predated `foreslatt_hs` on claim rows;
 * `causeOf` could never reach the classification branch, and «Hvor pengene
 * lekker» showed two causes instead of three, each with a plausible-looking
 * amount. Nothing on screen said the data was too old to answer the question.
 *
 * Keep this in step with SNAPSHOT_CONTRACT in src/dashboard.js. See that file
 * for what each version added.
 */
export const REQUIRED_CONTRACT = 2;

/** Snapshots published before the stamp existed are contract 1 by definition. */
const contractOf = (meta: any) => Number(meta?.contract ?? 1);

export type SnapshotGap = { found: number; required: number; missing: string };

/** What this build reads that an older payload does not carry. Newest first. */
const ADDED_IN: Record<number, string> = {
  2: 'årsaken bak hvert krav og den faste id-en hvert krav velges på',
};

/**
 * `null` when the snapshot is new enough. A payload NEWER than this build is
 * fine — extra fields are ignored — so only a payload that is behind is a gap.
 */
export function snapshotGap(meta: any): SnapshotGap | null {
  const found = contractOf(meta);
  if (found >= REQUIRED_CONTRACT) return null;
  const missing = Object.keys(ADDED_IN)
    .map(Number)
    .filter((v) => v > found && v <= REQUIRED_CONTRACT)
    .map((v) => ADDED_IN[v])
    .join(', ');
  return { found, required: REQUIRED_CONTRACT, missing };
}
