// node --test  (ingen rammeverk-avhengighet)
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProductText } from '../src/identity.js';

test('rødkløver-variantene normaliserer til samme nøkkel', () => {
  const variants = [
    '4618,100 Rødkløverblomst 100 g',
    '4618 Rødkløverblomst 1 kg',
    'Rødkløverblomst 100 g',
    'RØDKLØVERBLOMST',
  ];
  const keys = variants.map(normalizeProductText);
  assert.equal(new Set(keys).size, 1);
  assert.equal(keys[0], 'rødkløverblomst');
});

test('kapsler er en annen vare enn blomst — egen nøkkel', () => {
  const kapsel = normalizeProductText('22983 Rødkløver kap.400 mg 120 stk');
  const blomst = normalizeProductText('4618 Rødkløverblomst 1 kg');
  assert.notEqual(kapsel, blomst);
});

test('leading artikkelnummer med komma fjernes', () => {
  assert.equal(normalizeProductText('16870,16871 OmniX'), 'omnix');
});

test('pakningsstørrelse uten mellomrom fjernes også', () => {
  assert.equal(normalizeProductText('8248 Hvidtjørnblade/blomst 100g Øko'), 'hvidtjørnblade blomst øko');
});

test('tom/manglende beskrivelse gir tom streng', () => {
  assert.equal(normalizeProductText(''), '');
  assert.equal(normalizeProductText(null), '');
  assert.equal(normalizeProductText(undefined), '');
});

test('whitespace kollapses og trimmes', () => {
  assert.equal(normalizeProductText('  Ingefær   knust  '), 'ingefær knust');
});
