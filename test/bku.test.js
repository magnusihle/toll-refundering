import test from 'node:test';
import assert from 'node:assert/strict';
import { bkuEvidence, normCode, bkuMeta } from '../src/bku.js';

test('normCode normaliserer alle skrivemåter til XX.XX.XXXX', () => {
  assert.equal(normCode('12119000'), '12.11.9000');
  assert.equal(normCode('12.11.9000'), '12.11.9000');
  assert.equal(normCode('1211.90'), '12.11.9000');   // 6-siffer fylles ut
  assert.equal(normCode('12'), null);                 // for kort til å bety noe
  assert.equal(normCode(null), null);
});

test('presedens hentes for BEGGE koder, uten å felle dom', () => {
  if (!bkuMeta().loaded) return; // korpuset er en lokal ressurs (data/ er gitignored)
  const ev = bkuEvidence({
    description: '4618,100 RØDKLØVERBLOMST 100 G',
    declaredCode: '12149019',
    proposedCode: '12.11.9000',
  });
  // Foreslått kode skal gi tørkede plantedeler/urteteer …
  assert.ok(ev.proposed.length > 0, 'forventet uttalelser under foreslått kode');
  assert.ok(ev.proposed.every((e) => e.code === '12.11.9000'));
  // … og den deklarerte koden skal avsløre hva den faktisk brukes til (kålrot).
  assert.ok(ev.declared.length > 0, 'forventet uttalelser under deklarert kode');
  assert.ok(ev.declared.every((e) => e.code === '12.14.9019'));
  assert.ok(/kålrot/i.test(ev.declared.map((e) => e.itemType).join(' ')));
  // Ingen av feltene skal påstå hvem som vinner.
  for (const e of [...ev.proposed, ...ev.declared]) {
    assert.equal('stance' in e, false, 'modulen skal ikke felle dom');
    assert.ok(e.link.startsWith('https://varenummer.toll.no/'));
    assert.equal(typeof e.binding, 'boolean');
  }
});

test('samme foreslått og deklarert kode gir ingen duplisert liste', () => {
  if (!bkuMeta().loaded) return;
  const ev = bkuEvidence({ description: 'kosttilskudd', declaredCode: '21069098', proposedCode: '21.06.9098' });
  assert.equal(ev.declared.length, 0, 'deklarert-lista er ren støy når kodene er like');
});

test('ukjente koder og tomt grunnlag gir tomt svar, aldri kast', () => {
  assert.deepEqual(bkuEvidence({ description: 'x', declaredCode: null, proposedCode: null }), { proposed: [], declared: [] });
  const ev = bkuEvidence({ description: 'x', declaredCode: '99999999', proposedCode: '99.99.9999' });
  assert.deepEqual(ev, { proposed: [], declared: [] });
});
