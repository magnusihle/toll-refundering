// A2: re-nøkle goods_lines.product_key med den felles normaliseringen fra A1
// (src/identity.js via src/pipeline.js sin productKey()). Kun en UPDATE mot
// den lokale SQLite-basen — ingen EMMA-henting. art:-grenen (varer med
// article_number) er urørt; kun desc:-grenen normaliseres på nytt.
//
// Folder også inn F3 (datarens, triviell): sletter den ene av to identiske
// duplikate line_charges-rader (samme goods_line/source/charge_type/base/
// rate/amount/payment_method) — ren duplikat fra innsamling, endrer ingen
// beløp siden `amount` på VAT-raden er NULL i begge (chargeBreakdown/
// productInconsistencies bruker COALESCE(amount,0) hhv. LIMIT 1 per linje).
//
//   node scripts/rekey-products.mjs
import { getDb } from '../src/db.js';
import { productKey } from '../src/pipeline.js';

const db = getDb();

const groupCount = (label) => {
  const { c } = db.prepare(`
    SELECT COUNT(DISTINCT dcl.aktor || '|' || gl.product_key) c
    FROM goods_lines gl JOIN declarations dcl ON dcl.tollnummer = gl.tollnummer
    WHERE gl.product_key IS NOT NULL
  `).get();
  console.log(`${label}: ${c} (aktør, vare)-grupper`);
  return c;
};

const before = groupCount('Før');

const rows = db.prepare('SELECT id, article_number, description, product_key FROM goods_lines').all();
const update = db.prepare('UPDATE goods_lines SET product_key = ? WHERE id = ?');
let changed = 0;
db.exec('BEGIN');
try {
  for (const r of rows) {
    const next = productKey({ article_number: r.article_number, description: r.description });
    if (next !== r.product_key) {
      update.run(next, r.id);
      changed++;
    }
  }
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}
console.log(`Re-nøklet: ${changed} av ${rows.length} goods_lines fikk ny product_key`);

const after = groupCount('Etter');
console.log(`Reduksjon: ${before} -> ${after} (${before - after} grupper slått sammen)`);

// F3: dupliserte line_charges (eksakt duplikat-rad, kun beholdes én)
const dupes = db.prepare(`
  SELECT MIN(id) keep_id, goods_line_id, source, charge_type, base, rate, amount, payment_method, COUNT(*) n
  FROM line_charges
  GROUP BY goods_line_id, source, charge_type, base, rate, amount, payment_method
  HAVING COUNT(*) > 1
`).all();
const delDupe = db.prepare('DELETE FROM line_charges WHERE goods_line_id = ? AND source = ? AND charge_type = ? AND base IS ? AND rate IS ? AND amount IS ? AND payment_method IS ? AND id != ?');
let dupesRemoved = 0;
for (const d of dupes) {
  const before = db.prepare('SELECT COUNT(*) c FROM line_charges WHERE goods_line_id=? AND source=? AND charge_type=? AND base IS ? AND rate IS ? AND amount IS ? AND payment_method IS ?')
    .get(d.goods_line_id, d.source, d.charge_type, d.base, d.rate, d.amount, d.payment_method).c;
  delDupe.run(d.goods_line_id, d.source, d.charge_type, d.base, d.rate, d.amount, d.payment_method, d.keep_id);
  dupesRemoved += before - 1;
}
console.log(`F3: ${dupesRemoved} duplikate line_charges-rader fjernet (${dupes.length} grupper berørt)`);
