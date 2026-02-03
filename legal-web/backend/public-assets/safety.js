import express from 'express';
import { pool } from '../db.js';
import { csvUpload } from '../middleware/csvUpload.js';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { normalizeDate, remindBefore, calcStatus } from '../utils/date.js';

const router = express.Router();
const REMIND_MONTHS = 6;

const toBool01 = (v) =>
  (v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true') ? 1 : 0;

function makeKey(row) {
  const name        = (row.name || '').trim().toLowerCase();
  const document    = (row.document || '').trim().toLowerCase();
  const category    = (row.category || '').trim().toLowerCase();
  const institution = (row.institution || '').trim().toLowerCase();
  const exp         = (row.expired_date || '').trim();
  return [name, document, category, institution, exp].join('|');
}
router.get('/export', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT name, document, type AS category, institution,
             DATE_FORMAT(start_date,'%Y-%m-%d')   AS start_date,
             DATE_FORMAT(expired_date,'%Y-%m-%d') AS expired_date,
             DATE_FORMAT(remind_date,'%Y-%m-%d')  AS remind_date,
             inactive
      FROM safety_licenses ORDER BY id ASC
    `);
    const records = rows.map((r,i)=>({
      'NO.': i+1,
      'NAMA': r.name||'',
      'DOKUMEN': r.document||'',
      'KATEGORI': r.category||'',
      'INSTITUSI': r.institution||'',
      'TANGGAL BERLAKU': r.start_date||'',
      'TANGGAL KEDALUWARSA': r.expired_date||'',
      'TANGGAL PENGINGAT (−6 bln)': r.remind_date||'',
      'STATUS': calcStatus(r),
    }));
    let csv = stringify(records, { header: true });
    csv = '\uFEFF' + csv;
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="safety_licenses.csv"');
    res.status(200).send(csv);
  } catch(e){
    console.error('Export safety error:', e);
    res.status(500).json({ error:'Export failed' });
  }
});

/* ======================= LIST/GET CRUD ======================= */
router.get('/', async (_req,res)=>{
  const [rows] = await pool.query(`
    SELECT id, name, document, type AS category, institution,
           DATE_FORMAT(start_date,'%Y-%m-%d')   AS start_date,
           DATE_FORMAT(expired_date,'%Y-%m-%d') AS expired_date,
           DATE_FORMAT(remind_date,'%Y-%m-%d')  AS remind_date,
           inactive
    FROM safety_licenses ORDER BY id ASC
  `);
  res.json(rows.map(r=>({ ...r, status: calcStatus(r) })));
});

router.get('/:id', async (req,res)=>{
  const [rows] = await pool.query(`
    SELECT id, name, document, type AS category, institution,
           DATE_FORMAT(start_date,'%Y-%m-%d')   AS start_date,
           DATE_FORMAT(expired_date,'%Y-%m-%d') AS expired_date,
           DATE_FORMAT(remind_date,'%Y-%m-%d')  AS remind_date,
           inactive
    FROM safety_licenses WHERE id=?`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error:'Not found' });
  const row = rows[0];
  res.json({ ...row, status: calcStatus(row) });
});

router.post('/', async (req,res)=>{
  try {
    const { name, document, category, institution, start_date, expired_date, inactive } = req.body;
    const start = normalizeDate(start_date);
    const exp   = normalizeDate(expired_date);
    const remind_date = exp ? remindBefore(exp, REMIND_MONTHS) : null;
    const inact = toBool01(inactive);
    const [result] = await pool.query(`
      INSERT INTO safety_licenses
      (name, document, type, institution, start_date, expired_date, remind_date, inactive)
      VALUES (?,?,?,?,?,?,?,?)`,
      [name||'', document||'', category||'', institution||'', start, exp, remind_date, inact]
    );
    const [rows] = await pool.query(`
      SELECT id, name, document, type AS category, institution,
             DATE_FORMAT(start_date,'%Y-%m-%d')   AS start_date,
             DATE_FORMAT(expired_date,'%Y-%m-%d') AS expired_date,
             DATE_FORMAT(remind_date,'%Y-%m-%d')  AS remind_date,
             inactive
      FROM safety_licenses WHERE id=?`, [result.insertId]);
    const row = rows[0];
    res.status(201).json({ ...row, status: calcStatus(row) });
  } catch(e){
    console.error('Create safety error:', e);
    res.status(500).json({ error:'Failed to create record' });
  }
});

router.put('/:id', async (req,res)=>{
  try{
    const { name, document, category, institution, start_date, expired_date, inactive } = req.body;
    const start = normalizeDate(start_date);
    const exp   = normalizeDate(expired_date);
    const remind_date = exp ? remindBefore(exp, REMIND_MONTHS) : null;
    const inact = toBool01(inactive);
    await pool.query(`
      UPDATE safety_licenses
      SET name=?,document=?,type=?,institution=?,start_date=?,expired_date=?,remind_date=?,inactive=?
      WHERE id=?`,
      [name||'', document||'', category||'', institution||'', start, exp, remind_date, inact, req.params.id]
    );
    const [rows] = await pool.query(`
      SELECT id, name, document, type AS category, institution,
             DATE_FORMAT(start_date,'%Y-%m-%d')   AS start_date,
             DATE_FORMAT(expired_date,'%Y-%m-%d') AS expired_date,
             DATE_FORMAT(remind_date,'%Y-%m-%d')  AS remind_date,
             inactive
      FROM safety_licenses WHERE id=?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error:'Not found' });
    const row = rows[0];
    res.json({ ...row, status: calcStatus(row) });
  } catch(e){
    console.error('Update safety error:', e);
    res.status(500).json({ error:'Failed to update record' });
  }
});

router.delete('/:id', async (req,res)=>{
  try{
    await pool.query('DELETE FROM safety_licenses WHERE id=?',[req.params.id]);
    res.json({ ok:true });
  }catch(e){
    console.error('Delete safety error:', e);
    res.status(500).json({ error:'Failed to delete record' });
  }
});

router.post('/import/preview', csvUpload.single('file'), async (req,res)=>{
  try{
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error:"CSV file is required (field name: 'file')" });
    }
    const raw = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    const firstLine = raw.split(/\r?\n/)[0] || '';
    let delimiter = ',';
    const semi = (firstLine.match(/;/g) || []).length;
    const tab  = (firstLine.match(/\t/g) || []).length;
    if (semi > tab && semi > 0) delimiter = ';';
    else if (tab > semi && tab > 0) delimiter = '\t';

    const records = parse(raw, {
      columns:true, skip_empty_lines:true, relax_column_count:true, trim:true, delimiter, bom:true
    });

    const [existing] = await pool.query(`
      SELECT
        LOWER(TRIM(name))        AS name,
        LOWER(TRIM(document))    AS document,
        LOWER(TRIM(type))        AS category,
        LOWER(TRIM(institution)) AS institution,
        DATE_FORMAT(expired_date,'%Y-%m-%d') AS expired_date
      FROM safety_licenses
    `);
    const existingKeySet = new Set(
      existing.map(r => [r.name||'', r.document||'', r.category||'', r.institution||'', r.expired_date||''].join('|'))
    );

    const preview = [];
    const seenInFile = new Map();

    for (const row of records) {
      const L = Object.fromEntries(Object.entries(row).map(([k,v])=>[String(k).trim().toLowerCase(), v]));
      const name        = L['nama'] ?? L['name'] ?? row.name ?? '';
      const document    = L['dokumen'] ?? L['document'] ?? row.document ?? '';
      const category    = L['kategori'] ?? L['category'] ?? L['tipe'] ?? L['type'] ?? row.category ?? row.type ?? '';
      const institution = L['institusi'] ?? L['institution'] ?? row.institution ?? '';
      const start_raw   = L['tanggal mulai'] ?? L['tanggal berlaku'] ?? L['start date'] ?? row.start_date ?? null;
      const exp_raw     = L['tanggal kedaluwarsa'] ?? L['tanggal kedaluarsa'] ?? L['expired date'] ?? row.expired_date ?? null;
      const remind_raw  = L['tanggal pengingat'] ?? L['remind date'] ?? row.remind_date ?? null;
      const inactive_raw= L['inactive'] ?? row.inactive ?? 0;

      const start = normalizeDate(start_raw);
      const exp   = normalizeDate(exp_raw);
      let remind_date = null;
      if (remind_raw) remind_date = normalizeDate(remind_raw);
      else if (exp) remind_date = remindBefore(exp, REMIND_MONTHS);
      const inactive = toBool01(inactive_raw);

      const normalized = { name, document, category, institution, start_date:start, expired_date:exp, remind_date, inactive };
      const key = makeKey({ ...normalized });

      const inFileCount = (seenInFile.get(key) || 0) + 1;
      seenInFile.set(key, inFileCount);

      const dup_in_file = inFileCount > 1;
      const dup_in_db   = existingKeySet.has(key);

      preview.push({
        key, ...normalized, status: calcStatus({ ...normalized }),
        dup_in_file, dup_in_db
      });
    }

    res.json({
      total: preview.length,
      dup_in_file_total: preview.filter(r=>r.dup_in_file).length,
      dup_in_db_total:   preview.filter(r=>r.dup_in_db).length,
      preview
    });
  }catch(e){
    console.error('Preview safety import error:', e);
    res.status(500).json({ error:'Preview failed' });
  }
});

router.post('/import/commit', async (req,res)=>{
  try{
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error:'No rows to import' });

    let imported = 0;
    const conn = await pool.getConnection();
    try{
      await conn.beginTransaction();
      for (const r of rows) {
        const name        = r.name || '';
        const document    = r.document || '';
        const category    = r.category || '';
        const institution = r.institution || '';
        const start       = normalizeDate(r.start_date);
        const exp         = normalizeDate(r.expired_date);
        const remind_date = r.remind_date ? normalizeDate(r.remind_date) : (exp ? remindBefore(exp, REMIND_MONTHS) : null);
        const inactive    = toBool01(r.inactive);

        const [exists] = await conn.query(
          `SELECT id FROM safety_licenses
           WHERE LOWER(TRIM(name))=? AND LOWER(TRIM(document))=? AND LOWER(TRIM(type))=? AND LOWER(TRIM(institution))=? AND DATE_FORMAT(expired_date,'%Y-%m-%d')=? LIMIT 1`,
          [name.toLowerCase().trim(), document.toLowerCase().trim(), category.toLowerCase().trim(), institution.toLowerCase().trim(), exp || '']
        );
        if (exists.length) continue;

        await conn.query(`
          INSERT INTO safety_licenses
          (name, document, type, institution, start_date, expired_date, remind_date, inactive)
          VALUES (?,?,?,?,?,?,?,?)`,
          [name, document, category, institution, start, exp, remind_date, inactive]
        );
        imported++;
      }
      await conn.commit();
      res.json({ imported });
    }catch(txErr){
      await conn.rollback();
      console.error('Commit safety import tx error:', txErr);
      res.status(400).json({ error:'Commit failed', detail: String(txErr).slice(0,300) });
    }finally{
      conn.release();
    }
  }catch(e){
    console.error('Commit safety import outer error:', e);
    res.status(500).json({ error:'Commit failed' });
  }
});

export default router;
