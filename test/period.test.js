// node --test  (ingen rammeverk-avhengighet)
import test from 'node:test';
import assert from 'node:assert/strict';
import { osloToday, claimWindow, claimDeadline, minusYears, validOn } from '../src/period.js';

test('dagen regnes i norsk tid, ikke UTC', () => {
  // vintertid: Oslo er UTC+1 → ny dag kl. 23:00Z
  assert.equal(osloToday(new Date('2026-01-01T23:30:00Z')), '2026-01-02');
  assert.equal(osloToday(new Date('2026-01-01T22:30:00Z')), '2026-01-01');
  // sommertid: Oslo er UTC+2 → ny dag kl. 22:00Z
  assert.equal(osloToday(new Date('2026-06-30T22:30:00Z')), '2026-07-01');
  assert.equal(osloToday(new Date('2026-06-30T21:30:00Z')), '2026-06-30');
});

test('vinduet er nøyaktig 3 år tilbake, grensedagen inkludert', () => {
  const w = claimWindow({ now: new Date('2026-08-19T09:00:00Z') });
  assert.deepEqual([w.from, w.to, w.years], ['2023-08-19', '2026-08-19', 3]);
  assert.equal(claimDeadline('2023-08-19', w).daysLeft, 0);
  assert.equal(claimDeadline('2023-08-18', w).expired, true);
  assert.equal(claimDeadline('2023-08-20', w).expired, false);
});

test('29. februar klemmes til 28. februar (ruller ikke til 1. mars)', () => {
  assert.equal(minusYears('2028-02-29', 3), '2025-02-28');
});

test('gyldig f.o.m./t.o.m. avgjøres av datoen som testes', () => {
  assert.equal(validOn('2023-09-01', '2023-08-23', '2026-08-23'), true);
  assert.equal(validOn('2023-08-01', '2023-08-23', '2026-08-23'), false); // ikke innvilget enda
  assert.equal(validOn('2026-09-01', '2023-08-23', '2026-08-23'), false); // utløpt
  assert.equal(validOn('2026-09-01', '2023-08-23', null), true);          // åpen sluttdato
});
