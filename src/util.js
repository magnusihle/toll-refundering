// Norwegian formats: "1 385,35" (space/nbsp thousands, comma decimal), "18.08.2026".

export function parseNoNumber(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (s === '' || s === '-') return null;
  // strip currency codes / letters, keep digits, separators, minus
  s = s.replace(/[^\d.,\-  ]/g, '').trim();
  if (s === '' || s === '-') return null;
  // remove thousands separators (space, nbsp, and dots used as thousands)
  s = s.replace(/[  ]/g, '');
  // If both '.' and ',' present, assume '.' thousands and ',' decimal
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '');
  s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseNoDate(raw) {
  if (!raw) return null;
  const m = String(raw).trim().match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`; // ISO yyyy-mm-dd
}

// dd.mm.yyyy for typing back into the app's date fields
export function toNoDate(iso) {
  const m = String(iso).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
