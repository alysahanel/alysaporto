import express from 'express';
import { pool } from '../db.js';
import { csvUpload } from '../middleware/csvUpload.js';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { normalizeDate } from '../utils/date.js';

const router = express.Router();

function statusToInactive(status) {
  if (status == null) return 0;
  const s = String(status).trim().toLowerCase();
  return (s === 'inactive' || s === '0' || s === 'false') ? 1 : 0;
}
function inactiveToStatus(inactive) {
  return Number(inactive) === 1 ? 'Inactive' : 'Active';
}
function companyMakeKey(row) {
  const doc_name    = (row.doc_name || '').trim().toLowerCase();
  const doc_number  = (row.doc_number || '').trim().toLowerCase();
  const institution = (row.institution || '').trim().toLowerCase();
  const approval    = (row.approval_date || '').trim();
  return [doc_name, doc_number, institution, approval].join('|');
}

router.get('/export', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT doc_name, doc_number, category, institution,
              DATE_FORMAT(approval_date,'%Y-%m-%d') AS approval_date,
              inactive
       FROM company_legal_entities
       ORDER BY id ASC`
    );

    const records = rows.map((r, idx) => ({
      'NO.': idx + 1,
      'DOKUMEN': r.doc_name || '',
      'NOMOR DOKUMEN': r.doc_number || '',
      'KATEGORI': r.category || '',
      'INSTITUSI': r.institution || '',
      'TANGGAL PENGESAHAN': r.approval_date || '',
      'STATUS': inactiveToStatus(r.inactive),
    }));

    let csv = stringify(records, { header: true });
    csv = '\uFEFF' + csv; 
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="company_legal_entities.csv"');
    return res.status(200).send(csv);
  } catch (e) {
    console.error('Export error:', e);
    return res.status(500).json({ error: 'Export failed' });
  }
});


router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, doc_name, doc_number, category, institution,
              DATE_FORMAT(approval_date,'%Y-%m-%d') AS approval_date,
              inactive
       FROM company_legal_entities
       ORDER BY id ASC`
    );

    const data = rows.map(r => ({
      id: r.id,
      doc_name: r.doc_name,
      doc_number: r.doc_number,
      category: r.category,
      institution: r.institution,
      approval_date: r.approval_date,     
      status: inactiveToStatus(r.inactive) 
    }));

    res.json(data);
  } catch (e) {
    console.error('List error:', e);
    res.status(500).json({ error: 'Failed to load data' });
  }
});

router.post('/import/preview', csvUpload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "CSV file required" });
    }

    const raw = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    const firstLine = raw.split(/\r?\n/)[0] || '';
    let delimiter = ',';
    const semi = (firstLine.match(/;/g) || []).length;
    const tab  = (firstLine.match(/\t/g) || []).length;
    if (semi > tab && semi > 0) delimiter = ';';
    else if (tab > semi && tab > 0) delimiter = '\t';

    const records = parse(raw, {
      columns: true, skip_empty_lines: true, relax_column_count: true, trim: true, bom: true, delimiter
    });

    const [existing] = await pool.query(`
      SELECT
        LOWER(TRIM(doc_name))                       AS doc_name,
        LOWER(TRIM(COALESCE(doc_number,'')))        AS doc_number,
        LOWER(TRIM(institution))                    AS institution,
        DATE_FORMAT(approval_date,'%Y-%m-%d')       AS approval_date
      FROM company_legal_entities
    `);
    const existingKeySet = new Set(
      existing.map(r => companyMakeKey({
        doc_name: r.doc_name || '',
        doc_number: r.doc_number || '',
        institution: r.institution || '',
        approval_date: r.approval_date || ''
      }))
    );

    const preview = [];
    const seenInFile = new Map();

    for (const row of records) {
      const L = Object.fromEntries(Object.entries(row).map(([k,v]) => [String(k).trim().toLowerCase(), v]));

      const doc_name    = L['dokumen'] ?? L['document'] ?? row.doc_name ?? '';
      const doc_number  = L['nomor dokumen'] ?? L['nomor_dokumen'] ?? L['document number'] ?? row.doc_number ?? '';
      const category    = L['kategori'] ?? L['category'] ?? row.category ?? '';
      const institution = L['institusi'] ?? L['institution'] ?? row.institution ?? '';
      const app_raw     = L['tanggal pengesahan'] ?? L['approval date'] ?? row.approval_date ?? '';
      const status      = L['status'] ?? row.status ?? 'Active';

      const approval_date = normalizeDate(app_raw);
      const normalized = { doc_name, doc_number, category, institution, approval_date, status };
      const key = companyMakeKey(normalized);

      const count = (seenInFile.get(key) || 0) + 1;
      seenInFile.set(key, count);

      preview.push({
        ...normalized,
        dup_in_file: count > 1,
        dup_in_db: existingKeySet.has(key),
        invalid: !(doc_name && category && institution)
      });
    }

    res.json({
      total: preview.length,
      dup_in_file_total: preview.filter(r=>r.dup_in_file).length,
      dup_in_db_total:   preview.filter(r=>r.dup_in_db).length,
      preview
    });
  } catch (e) {
    console.error('Company preview failed:', e);
    res.status(500).json({ error: 'Preview failed', detail: String(e).slice(0,300) });
  }
});

router.post('/import/commit', async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error: 'No rows to import' });

    let imported = 0;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const r of rows) {
        const doc_name    = (r.doc_name || '').trim();
        const doc_number  = (r.doc_number || '').trim() || null;
        const category    = (r.category || '').trim();
        const institution = (r.institution || '').trim();
        const approval    = normalizeDate(r.approval_date);
        const inactive    = (String(r.status || 'Active').toLowerCase() === 'inactive') ? 1 : 0;

        if (!doc_name || !category || !institution) continue;

        const [exists] = await conn.query(
          `SELECT id FROM company_legal_entities
           WHERE LOWER(TRIM(doc_name))=? 
             AND LOWER(TRIM(COALESCE(doc_number,'')))=? 
             AND LOWER(TRIM(institution))=? 
             AND DATE_FORMAT(approval_date,'%Y-%m-%d')=? 
           LIMIT 1`,
          [doc_name.toLowerCase(), (doc_number||'').toLowerCase(), institution.toLowerCase(), approval || '']
        );
        if (exists.length) continue;

        await conn.query(
          `INSERT INTO company_legal_entities
           (doc_name, doc_number, category, institution, approval_date, inactive)
           VALUES (?,?,?,?,?,?)`,
          [doc_name, doc_number, category, institution, approval, inactive]
        );
        imported++;
      }

      await conn.commit();
      res.json({ imported });
    } catch (txErr) {
      await conn.rollback();
      console.error('Company commit failed:', txErr);
      res.status(400).json({ error: 'Commit failed', detail: String(txErr).slice(0,300) });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('Company commit outer error:', e);
    res.status(500).json({ error: 'Commit failed', detail: String(e).slice(0,300) });
  }
});

router.get('/:id(\\d+)', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, doc_name, doc_number, category, institution,
            DATE_FORMAT(approval_date,'%Y-%m-%d') AS approval_date,
            inactive
     FROM company_legal_entities WHERE id=?`, [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const row = rows[0];
  res.json({ ...row, status: inactiveToStatus(row.inactive) });
});

router.post('/', async (req, res) => {
  try {
    const { doc_name, doc_number, category, institution, approval_date, status } = req.body;
    if (!doc_name || !category || !institution) {
      return res.status(400).json({ error: 'doc_name, category, and institution are required' });
    }
    const inactive = statusToInactive(status);
    const appDate = normalizeDate(approval_date);

    const [result] = await pool.query(
      `INSERT INTO company_legal_entities
       (doc_name, doc_number, category, institution, approval_date, inactive)
       VALUES (?,?,?,?,?,?)`,
      [doc_name, doc_number || null, category, institution, appDate, inactive]
    );

    const [rows] = await pool.query(
      `SELECT id, doc_name, doc_number, category, institution,
              DATE_FORMAT(approval_date,'%Y-%m-%d') AS approval_date, inactive
       FROM company_legal_entities WHERE id=?`, [result.insertId]
    );
    const row = rows[0];
    res.status(201).json({ ...row, status: inactiveToStatus(row.inactive) });
  } catch (e) {
    console.error('Create error:', e);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

router.put('/:id(\\d+)', async (req, res) => {
  try {
    const { doc_name, doc_number, category, institution, approval_date, status } = req.body;
    if (!doc_name || !category || !institution) {
      return res.status(400).json({ error: 'doc_name, category, and institution are required' });
    }
    const inactive = statusToInactive(status);
    const appDate = normalizeDate(approval_date);

    await pool.query(
      `UPDATE company_legal_entities
       SET doc_name=?, doc_number=?, category=?, institution=?, approval_date=?, inactive=?
       WHERE id=?`,
      [doc_name, doc_number || null, category, institution, appDate, inactive, req.params.id]
    );

    const [rows] = await pool.query(
      `SELECT id, doc_name, doc_number, category, institution,
              DATE_FORMAT(approval_date,'%Y-%m-%d') AS approval_date, inactive
       FROM company_legal_entities WHERE id=?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const row = rows[0];
    res.json({ ...row, status: inactiveToStatus(row.inactive) });
  } catch (e) {
    console.error('Update error:', e);
    res.status(500).json({ error: 'Failed to update record' });
  }
});

router.delete('/:id(\\d+)', async (req, res) => {
  try {
    await pool.query('DELETE FROM company_legal_entities WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('Delete error:', e);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

export default router;
