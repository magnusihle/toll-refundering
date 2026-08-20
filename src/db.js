import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Structured store for EMMA declarations + SAD/Linjer-derived goods lines & charges.
// Node built-in node:sqlite (no native build). File: data/emma.db.

let db = null;

export function getDb() {
  if (db) return db;
  fs.mkdirSync(config.dataDir, { recursive: true });
  db = new DatabaseSync(path.join(config.dataDir, 'emma.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 8000;');
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS declarations (
    tollnummer TEXT PRIMARY KEY,
    godkjent TEXT, godkjent_iso TEXT, ie TEXT, prosedyre TEXT, aktor_kode TEXT, aktor TEXT,
    faktura_info TEXT, ordrenr TEXT, faktura_val REAL, valuta TEXT, levvilk TEXT,
    frakt_b REAL, frakt_v TEXT, avg REAL, mva_25 REAL, mva_15 REAL, mva_0 REAL,
    avvik REAL, mva REAL, status TEXT,
    direction TEXT, declaration_type TEXT,
    box20_incoterm TEXT, box22_value REAL, box22_currency TEXT, box23_fx REAL,
    sad_pdf_path TEXT, sad_url TEXT, sad_source TEXT, line_source TEXT,
    extracted_at TEXT, warnings TEXT
  );
  CREATE TABLE IF NOT EXISTS goods_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tollnummer TEXT REFERENCES declarations(tollnummer) ON DELETE CASCADE,
    item_number INTEGER, hs_code TEXT, origin TEXT, description TEXT,
    article_number TEXT, product_key TEXT, preference_code TEXT, origin_proof INTEGER,
    gross_weight REAL, net_weight REAL, procedure TEXT,
    item_value REAL, statistical_value REAL,
    UNIQUE(tollnummer, item_number)
  );
  CREATE TABLE IF NOT EXISTS line_charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goods_line_id INTEGER REFERENCES goods_lines(id) ON DELETE CASCADE,
    source TEXT, charge_type TEXT, base REAL, rate REAL, amount REAL, payment_method TEXT
  );
  CREATE TABLE IF NOT EXISTS line_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goods_line_id INTEGER REFERENCES goods_lines(id) ON DELETE CASCADE,
    code TEXT, reference TEXT
  );
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tollnummer TEXT REFERENCES declarations(tollnummer) ON DELETE CASCADE,
    doc_type TEXT, filename TEXT, path TEXT, url TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_goods_hs ON goods_lines(hs_code);
  CREATE INDEX IF NOT EXISTS idx_goods_pk ON goods_lines(product_key);
  CREATE INDEX IF NOT EXISTS idx_charge_line ON line_charges(goods_line_id);
  CREATE INDEX IF NOT EXISTS idx_docs_line ON line_docs(goods_line_id);
  `);
}

export function existingTollnummers() {
  const d = getDb();
  return new Set(d.prepare('SELECT tollnummer FROM declarations').all().map((r) => r.tollnummer));
}

export function upsertDeclaration(rec) {
  const d = getDb();
  const delChildren = d.prepare('DELETE FROM goods_lines WHERE tollnummer=?');
  const delDocs = d.prepare('DELETE FROM documents WHERE tollnummer=?');
  const upDecl = d.prepare(`INSERT INTO declarations
    (tollnummer,godkjent,godkjent_iso,ie,prosedyre,aktor_kode,aktor,faktura_info,ordrenr,faktura_val,valuta,levvilk,
     frakt_b,frakt_v,avg,mva_25,mva_15,mva_0,avvik,mva,status,direction,declaration_type,
     box20_incoterm,box22_value,box22_currency,box23_fx,sad_pdf_path,sad_url,sad_source,line_source,extracted_at,warnings)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(tollnummer) DO UPDATE SET
     godkjent=excluded.godkjent, godkjent_iso=excluded.godkjent_iso, ie=excluded.ie, prosedyre=excluded.prosedyre,
     aktor_kode=excluded.aktor_kode, aktor=excluded.aktor, faktura_info=excluded.faktura_info, ordrenr=excluded.ordrenr,
     faktura_val=excluded.faktura_val, valuta=excluded.valuta, levvilk=excluded.levvilk, frakt_b=excluded.frakt_b,
     frakt_v=excluded.frakt_v, avg=excluded.avg, mva_25=excluded.mva_25, mva_15=excluded.mva_15, mva_0=excluded.mva_0,
     avvik=excluded.avvik, mva=excluded.mva, status=excluded.status, direction=excluded.direction,
     declaration_type=excluded.declaration_type, box20_incoterm=excluded.box20_incoterm, box22_value=excluded.box22_value,
     box22_currency=excluded.box22_currency, box23_fx=excluded.box23_fx, sad_pdf_path=excluded.sad_pdf_path,
     sad_url=excluded.sad_url, sad_source=excluded.sad_source, line_source=excluded.line_source,
     extracted_at=excluded.extracted_at, warnings=excluded.warnings`);
  const insLine = d.prepare(`INSERT INTO goods_lines
    (tollnummer,item_number,hs_code,origin,description,article_number,product_key,preference_code,origin_proof,
     gross_weight,net_weight,procedure,item_value,statistical_value)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insCharge = d.prepare(`INSERT INTO line_charges
    (goods_line_id,source,charge_type,base,rate,amount,payment_method) VALUES (?,?,?,?,?,?,?)`);
  const insDoc = d.prepare(`INSERT INTO line_docs (goods_line_id,code,reference) VALUES (?,?,?)`);
  const insDocument = d.prepare(`INSERT INTO documents (tollnummer,doc_type,filename,path,url) VALUES (?,?,?,?,?)`);
  const getGid = d.prepare('SELECT id FROM goods_lines WHERE tollnummer=? AND item_number=?');

  const tx = () => {
    delChildren.run(rec.tollnummer); delDocs.run(rec.tollnummer);
    const g = rec.grid || {};
    upDecl.run(
      rec.tollnummer, g.godkjent ?? null, g.godkjent_iso ?? null, g.ie ?? null, g.prosedyre ?? null, g.aktor_kode ?? null,
      g.aktor ?? null, g.faktura_info ?? null, g.ordrenr ?? null, g.faktura_val ?? null, g.valuta ?? null, g.levvilk ?? null,
      g.frakt_b ?? null, g.frakt_v ?? null, g.avg ?? null, g.mva_25 ?? null, g.mva_15 ?? null, g.mva_0 ?? null,
      g.avvik ?? null, g.mva ?? null, g.status ?? null, rec.direction ?? null, rec.declaration_type ?? null,
      rec.box20_incoterm ?? null, rec.box22_value ?? null, rec.box22_currency ?? null, rec.box23_fx ?? null,
      rec.sad_pdf_path ?? null, rec.sad_url ?? null, rec.sad_source ?? null, rec.line_source ?? null,
      rec.extracted_at ?? null, rec.warnings ?? null
    );
    for (const li of rec.lines || []) {
      insLine.run(rec.tollnummer, li.item_number ?? null, li.hs_code ?? null, li.origin ?? null, li.description ?? null,
        li.article_number ?? null, li.product_key ?? null, li.preference_code ?? null, li.origin_proof ? 1 : 0,
        li.gross_weight ?? null, li.net_weight ?? null, li.procedure ?? null, li.item_value ?? null, li.statistical_value ?? null);
      const gid = getGid.get(rec.tollnummer, li.item_number).id;
      for (const c of li.charges || []) insCharge.run(gid, c.source ?? null, c.charge_type ?? null, c.base ?? null, c.rate ?? null, c.amount ?? null, c.payment_method ?? null);
      for (const doc of li.docs || []) insDoc.run(gid, doc.code ?? null, doc.reference ?? null);
    }
    for (const doc of rec.documents || []) insDocument.run(rec.tollnummer, doc.doc_type ?? null, doc.filename ?? null, doc.path ?? null, doc.url ?? null);
  };
  d.exec('BEGIN'); try { tx(); d.exec('COMMIT'); } catch (e) { d.exec('ROLLBACK'); throw e; }
}

export function summary() {
  const d = getDb();
  return {
    declarations: d.prepare('SELECT COUNT(*) c FROM declarations').get().c,
    goods_lines: d.prepare('SELECT COUNT(*) c FROM goods_lines').get().c,
    line_charges: d.prepare('SELECT COUNT(*) c FROM line_charges').get().c,
    processed: d.prepare('SELECT COUNT(DISTINCT tollnummer) c FROM goods_lines').get().c,
    empty: d.prepare('SELECT COUNT(*) c FROM declarations WHERE tollnummer NOT IN (SELECT DISTINCT tollnummer FROM goods_lines)').get().c,
  };
}

// --- charge backfill helpers (attach box47/VAT to already-stored Linjer lines) ---
export function linjerSourced() {
  const d = getDb();
  return d.prepare("SELECT tollnummer, aktor_kode FROM declarations WHERE line_source='linjer'").all();
}
export function clearLineCharges(tollnummer) {
  const d = getDb();
  d.prepare('DELETE FROM line_charges WHERE goods_line_id IN (SELECT id FROM goods_lines WHERE tollnummer=?)').run(tollnummer);
}
export function addLineCharges(tollnummer, itemNumber, charges) {
  const d = getDb();
  const row = d.prepare('SELECT id FROM goods_lines WHERE tollnummer=? AND item_number=?').get(tollnummer, itemNumber);
  if (!row) return 0;
  const ins = d.prepare('INSERT INTO line_charges (goods_line_id,source,charge_type,base,rate,amount,payment_method) VALUES (?,?,?,?,?,?,?)');
  let n = 0;
  for (const c of charges) { ins.run(row.id, c.source ?? null, c.charge_type ?? null, c.base ?? null, c.rate ?? null, c.amount ?? null, c.payment_method ?? null); n++; }
  return n;
}
