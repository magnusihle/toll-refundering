import test from 'node:test';
import assert from 'node:assert/strict';
import { nedsettelser, standardRateOn, landgrupperFor } from '../src/raak.js';
import { validOn } from '../src/period.js';
import { raakReconciliation } from '../src/analysis.js';

test('nedsettelsene har både gyldig f.o.m. og t.o.m.', () => {
  const rows = Object.values(nedsettelser().byVarenummer || {}).flat();
  assert.ok(rows.length > 0, 'registeret er lastet');
  for (const r of rows) {
    assert.match(r.gyldig_fom, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(r.gyldig_tom, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(r.gyldig_fom <= r.gyldig_tom);
  }
});

test('færre vedtak var gyldige tidlig i vinduet enn i dag', () => {
  const rows = Object.values(nedsettelser().byVarenummer || {}).flat();
  const gyldige = (d) => rows.filter((r) => validOn(d, r.gyldig_fom, r.gyldig_tom)).length;
  assert.ok(gyldige('2023-09-01') < gyldige('2026-03-01'));
});

test('landgruppe følger opphavet', () => {
  assert.deepEqual(landgrupperFor('SE'), ['TOES', 'TALL']);
  assert.deepEqual(landgrupperFor('US'), ['TALL']);
});

test('standardsats slås opp per dato og sier fra når uttrekket ikke dekker den', () => {
  const s = standardRateOn('21069098', 'SE', '2026-03-01');
  assert.equal(s.status, 'gyldig');
  assert.ok(s.rate > 0 && s.fom <= '2026-03-01');
  const gammel = standardRateOn('21069098', 'SE', '2000-01-01');
  assert.ok(['kun_nyere_sats', 'ukjent'].includes(gammel.status));
  assert.equal(gammel.rate, null);
});

// Kjernegarantien: ingen krav får hvile på et vedtak som ikke gjaldt da varen ble fortollet.
test('alle RÅK-krav bygger på vedtak som var gyldige på fortollingsdatoen', () => {
  const r = raakReconciliation();
  for (const i of [...r.items, ...(r.expiredItems || [])]) {
    assert.ok(i.gyldig_fom <= i.godkjent_iso && i.godkjent_iso <= i.gyldig_tom,
      `${i.tollnummer}: fortollet ${i.godkjent_iso}, vedtak gyldig ${i.gyldig_fom}–${i.gyldig_tom}`);
  }
  for (const i of r.notGrantedItems || []) {
    assert.ok(['ikke_innvilget_enda', 'utlopt', 'annen_landgruppe'].includes(i.status));
  }
});
