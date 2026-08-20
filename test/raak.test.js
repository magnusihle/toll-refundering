import test from 'node:test';
import assert from 'node:assert/strict';
import { grantedOn, standardRateOn, landgrupperFor } from '../src/raak.js';

test('nedsettelser filtreres på fortollingsdato', () => {
  const tidlig = grantedOn('21069098', '2023-09-01');
  const senere = grantedOn('21069098', '2026-03-01');
  assert.ok(senere.valid.length > tidlig.valid.length,
    'flere vedtak var gyldige i 2026 enn i 2023');
  for (const r of tidlig.valid) assert.ok(r.gyldig_fom <= '2023-09-01' && '2023-09-01' <= r.gyldig_tom);
  for (const r of tidlig.rejected) assert.ok(['ikke_innvilget_enda', 'utlopt'].includes(r.why));
});

test('landgruppe følger opphavet', () => {
  assert.deepEqual(landgrupperFor('SE'), ['TOES', 'TALL']);
  assert.deepEqual(landgrupperFor('US'), ['TALL']);
});

test('standardsats slås opp per dato og sier fra når uttrekket ikke dekker den', () => {
  const s = standardRateOn('21069098', 'SE', '2026-03-01');
  assert.equal(s.status, 'gyldig');
  assert.ok(s.rate > 0 && s.fom <= '2026-03-01');
  // dato før satsens fom -> ingen sammenligning, kun beskjed om at den er ukjent
  const gammel = standardRateOn('21069098', 'SE', '2000-01-01');
  assert.ok(['kun_nyere_sats', 'ukjent'].includes(gammel.status));
  assert.equal(gammel.rate, null);
});
