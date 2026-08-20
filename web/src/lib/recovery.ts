export const TYPES = ['alle', 'RÅK', 'Preferanse', 'Produkt'];
// Sannsynlighetsvekt: agentens likelihood når den finnes, ellers match-styrke som proxy.
export const weightOf = (r: any) => {
  if (r.likelihood) return r.likelihood === 'høy' ? 0.8 : r.likelihood === 'middels' ? 0.4 : 0.1;
  // Strengere: «possible» = preferanse UTEN opprinnelsesbevis på linjen (må skaffes
  // fra leverandør) → lav vekt. «weak» = usikker match. «info» = produktavvik (nå strengt filtrert).
  return r.confidence === 'strong' ? 0.8 : r.confidence === 'possible' ? 0.35 : r.confidence === 'weak' ? 0.2 : r.confidence === 'info' ? 0.55 : r.confidence === 'review' ? 0.1 : r.confidence === 'raak_grant' ? 0.35 : 0.4;
};
export const rowsFor = (rows: any[], kind: string) => kind === 'alle' ? rows : rows.filter((r) => r.kind === kind);
export function agg(rows: any[]) {
  const total = rows.reduce((s, r) => s + (r.amount_nok || 0), 0);
  const likely = rows.reduce((s, r) => s + (r.amount_nok || 0) * weightOf(r), 0);
  const urgent = rows.filter((r) => r.dager_igjen != null && r.dager_igjen <= 90);
  return { total, likely, urgentAmount: urgent.reduce((s, r) => s + (r.amount_nok || 0), 0), urgentCount: urgent.length, count: rows.length };
}
