import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import fs from 'fs';
import mysql from 'mysql2/promise';
import { pathToFileURL } from 'url';
import fetch from 'node-fetch';
import multer from 'multer';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3009;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use((req, res, next) => {
  req.setTimeout(5 * 60 * 1000); // 5 menit
  res.setTimeout(5 * 60 * 1000);
  next();
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
const FRONTEND_BASE = path.join(__dirname, '..', 'frontend');
const FRONTEND_PUBLIC = path.join(FRONTEND_BASE, 'public');
const ASSETS_BACKEND = path.join(__dirname, 'public-assets');
try { if (!fs.existsSync(ASSETS_BACKEND)) fs.mkdirSync(ASSETS_BACKEND); } catch {}

// Export for Vercel
export default app;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

function migrateJsAssets() {
  try {
    const srcDir = path.join(FRONTEND_PUBLIC, 'assets');
    if (!fs.existsSync(srcDir)) return;
    const files = fs.readdirSync(srcDir);
    for (const f of files) {
      const ext = path.extname(f).toLowerCase();
      if (ext === '.js') {
        const from = path.join(srcDir, f);
        const to = path.join(ASSETS_BACKEND, f);
        try {
          fs.copyFileSync(from, to);
          try { fs.unlinkSync(from); } catch {}
        } catch {}
      }
    }
  } catch {}
}
migrateJsAssets();
app.get(/^\/assets\/(.+)/, (req, res) => {
  try {
    const rel = String(req.params[0] || '').replace(/\\/g, '/');
    const fullJs = path.join(ASSETS_BACKEND, rel);
    const fullFront = path.join(FRONTEND_PUBLIC, 'assets', rel);
    const ext = path.extname(rel).toLowerCase();
    if (ext === '.js') {
      const srcPath = fs.existsSync(fullJs) ? fullJs : fullFront;
      if (!fs.existsSync(srcPath)) return res.status(404).send('Not found');
      const src = fs.readFileSync(srcPath, 'utf8');
      const stripped = src.split(/\r?\n/).filter(l => !/^\s*\/\//.test(l)).join('\n');
      res.type('application/javascript').send(stripped);
    } else {
      if (!fs.existsSync(fullFront)) return res.status(404).send('Not found');
      res.sendFile(fullFront);
    }
  } catch (e) {
    res.status(500).send('Asset error');
  }
});

app.use(express.static(FRONTEND_PUBLIC));

const FRONTEND_ASSETS = path.join(FRONTEND_PUBLIC, 'assets');
app.use('/assets', express.static(FRONTEND_ASSETS));


app.get('/', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'dashboard.html')));

app.get('/regulatory.html', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'regulatory.html')));
app.get('/dashboard.html', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'dashboard.html')));
app.get('/elibrary.html', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'elibrary.html')));
app.get('/elibrary-import-review.html', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'elibrary-import-review.html')));
app.get('/import-review.html', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'import-review.html')));
app.get('/operational.html', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'operational.html')));
app.get('/company.html', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'company.html')));
app.get('/safety.html', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'safety.html')));
app.get('/license-permit.html', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'license-permit.html')));
app.get('/regulatory', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'regulatory.html')));
app.get('/elibrary', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'elibrary.html')));
app.get('/elibrary-import-review', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'elibrary-import-review.html')));
app.get('/import-review', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'import-review.html')));
app.get('/operational', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'operational.html')));
app.get('/company', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'company.html')));
app.get('/safety', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'safety.html')));
app.get('/license-permit', (_req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, 'license-permit.html')));
app.get('/monitoring', (_req, res) => sendRcsFile(res, 'monitoring.html'));
app.get('/operational', (_req, res) => sendRcsFile(res, 'operational.html'));
app.get('/company', (_req, res) => sendRcsFile(res, 'company.html'));
app.get('/safety', (_req, res) => sendRcsFile(res, 'safety.html'));

app.use('/api', (req, _res, next) => { next(); });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3307);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || '';
const DB_NAME = process.env.DB_NAME || 'legal_web';

const USE_MOCK_DB = process.env.USE_MOCK_DB !== 'false'; // Toggle for demo (Default: Mock)

let pool;

const UPLOAD_DIR = path.join(__dirname, 'uploads');
try { if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR); } catch {}
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'))
  }),
  limits: { fileSize: 50 * 1024 * 1024 }
});

const ELIBRARY_TABLES = {
  'undang-undang': 'elibrary_uu',
  'peraturan-pemerintah': 'elibrary_pp',
  'peraturan-presiden': 'elibrary_perpres',
  'peraturan-daerah': 'elibrary_perda',
  'peraturan-kawasan': 'elibrary_kawasan',
  'peraturan-lainnya': 'elibrary_lainnya',
};

const REG_DEPT_TABLES = {
  HRGA: 'reg_hrga',
  MAINTENANCE: 'reg_maintenance',
  IT: 'reg_it',
  HSE: 'reg_hse',
  LEGAL_COMPLIANCE: 'reg_legal_compliance',
  PPIC_DMW_WAREHOUSE: 'reg_ppic_dmw_warehouse',
  FAT: 'reg_fat'
};
function getRegTable(dept) {
  const key = String(dept || '').trim().toUpperCase();
  return REG_DEPT_TABLES[key] || null;
}

async function ensureDeptTable(dept) {
  const tbl = getRegTable(dept);
  if (tbl) return tbl;

  const safe = String(dept || 'UNKNOWN').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  const name = `reg_${safe}`;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`${DB_NAME}\`.\`${name}\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        no INT,
        regulasi TEXT,
        lingkup TEXT,
        pasal TEXT,
        deskripsi TEXT,
        kriteria TEXT,
        kepatuhan VARCHAR(50),
        jenisHukuman TEXT,
        warnaHukuman TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Created dynamic department table:', name);
    return name;
  } catch (e) {
    console.warn('Failed to create dynamic department table for', dept, e && e.message);
    return null;
  }
}

async function initDb() {
  if (USE_MOCK_DB) {
    console.log('--- RUNNING IN MOCK DATABASE MODE (Legal Web) ---');
    const { pool: mockPool } = await import('./mockDatabase.js');
    pool = mockPool;
    return;
  }

  pool = await mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
  });

  // Create database if not exists
  await pool.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);

  

  // Buat tabel per-departemen (tanpa kolom department)
  for (const tbl of Object.values(REG_DEPT_TABLES)) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`${DB_NAME}\`.\`${tbl}\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        no INT,
        regulasi TEXT,
        lingkup TEXT,
        pasal TEXT,
        deskripsi TEXT,
        kriteria TEXT,
        kepatuhan VARCHAR(50),
        jenisHukuman TEXT,
        warnaHukuman TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    try {
      const [cols] = await pool.query(`SHOW COLUMNS FROM \`${DB_NAME}\`.\`${tbl}\``);
      const names = new Set((cols || []).map(c => String(c.Field || '')));
      if (!names.has('no')) {
        await pool.query(`ALTER TABLE \`${DB_NAME}\`.\`${tbl}\` ADD COLUMN no INT`);
      }
      // if (names.has('no')) {
      //   await pool.query(`ALTER TABLE \`${DB_NAME}\`.\`${tbl}\` DROP COLUMN no`);
      // }
    } catch (e) { console.warn('Drop no column skipped for', tbl, e && e.message); }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`${DB_NAME}\`.elibrary (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category VARCHAR(64) NOT NULL,
      no INT,
      departemen VARCHAR(128),
      regulasi TEXT,
      lingkup TEXT,
      status VARCHAR(32)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Buat tabel per kategori (tanpa kolom category)
  const tableDefs = [
    'elibrary_uu',
    'elibrary_pp',
    'elibrary_perpres',
    'elibrary_perda',
    'elibrary_kawasan',
    'elibrary_lainnya',
  ];
  for (const t of tableDefs) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`${DB_NAME}\`.\`${t}\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        departemen VARCHAR(128),
        regulasi TEXT,
        lingkup TEXT,
        status VARCHAR(32),
        link TEXT,
        notes TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // Ensure columns exist for older tables (backfill migrations)
    try {
      const [cols] = await pool.query(`SHOW COLUMNS FROM \`${DB_NAME}\`.\`${t}\``);
      const names = new Set((cols || []).map(c => String(c.Field || '')));
      if (names.has('no')) {
        await pool.query(`ALTER TABLE \`${DB_NAME}\`.\`${t}\` DROP COLUMN no`);
      }
      if (!names.has('link')) {
        await pool.query(`ALTER TABLE \`${DB_NAME}\`.\`${t}\` ADD COLUMN link TEXT`);
      }
      if (!names.has('notes')) {
        await pool.query(`ALTER TABLE \`${DB_NAME}\`.\`${t}\` ADD COLUMN notes TEXT`);
      }
    } catch (e) {
      console.warn('elibrary table migration check failed for', t, e && e.message);
    }
  }

  // Seed initial data per-department tables if they are empty (avoid legacy table)
  const departments = ['HRGA','IT','MAINTENANCE','LEGAL_COMPLIANCE','HSE','PPIC_DMW_WAREHOUSE','FAT'];
  for (const dept of departments) {
    const tbl = await ensureDeptTable(dept);
    const [[{ c }]] = await pool.query(`SELECT COUNT(*) AS c FROM \`${DB_NAME}\`.\`${tbl}\``);
    if (Number(c) === 0) {
      await pool.query(
        `INSERT INTO \`${DB_NAME}\`.\`${tbl}\` (no, regulasi, lingkup, pasal, deskripsi, kriteria, kepatuhan, jenisHukuman, warnaHukuman)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [1, '', '', '', '', '', 'dalam-proses', '', '']
      );
    }
  }
  console.log('Seed check completed for department tables');

  // Migrasi penuh: pindahkan SEMUA baris dari legacy ke tabel departemen dan kosongkan legacy
  try {
    const [legacyRows] = await pool.query(
      `SELECT department, no, regulasi, lingkup, pasal, deskripsi, kriteria, kepatuhan, jenisHukuman, warnaHukuman FROM \`${DB_NAME}\`.regulations ORDER BY department ASC, no ASC, id ASC`
    );
    let moved = 0;
    for (const r of legacyRows) {
      const dept = String(r.department || '').trim();
      const tbl = await ensureDeptTable(dept);
      await pool.query(
        `INSERT INTO \`${DB_NAME}\`.\`${tbl}\` (no, regulasi, lingkup, pasal, deskripsi, kriteria, kepatuhan, jenisHukuman, warnaHukuman)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [Number(r.no||null), String(r.regulasi||''), String(r.lingkup||''), String(r.pasal||''), String(r.deskripsi||''), String(r.kriteria||''), String(r.kepatuhan||'dalam-proses'), String(r.jenisHukuman||''), String(r.warnaHukuman||'')]
      );
      moved++;
    }
    if (moved > 0) {
      await pool.query(`TRUNCATE TABLE \`${DB_NAME}\`.regulations`);
      console.log(`Legacy regulations migrated: ${moved} rows moved, legacy table truncated`);
    }
  } catch (e) {
    console.warn('Full legacy migration warning:', e && e.message);
  }

  // Hapus tabel legacy agar tidak ada lagi penulisan yang tidak sengaja
  try {
    await pool.query(`DROP TABLE IF EXISTS \`${DB_NAME}\`.regulations`);
    console.log('Legacy table "regulations" dropped');
  } catch (e) {
    console.warn('Drop legacy regulations failed:', e && e.message);
  }

  // Create tables from legal_web SQL if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`${DB_NAME}\`.company_legal_entities (
      id INT(11) NOT NULL AUTO_INCREMENT,
      doc_name VARCHAR(200) NOT NULL,
      doc_number VARCHAR(120) DEFAULT NULL,
      category VARCHAR(120) NOT NULL,
      institution VARCHAR(120) NOT NULL,
      approval_date DATE DEFAULT NULL,
      inactive TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`${DB_NAME}\`.operational_permits (
      id INT(11) NOT NULL AUTO_INCREMENT,
      doc_name VARCHAR(200) NOT NULL,
      type VARCHAR(120) NOT NULL,
      institution VARCHAR(120) NOT NULL,
      start_date DATE DEFAULT NULL,
      expired_date DATE DEFAULT NULL,
      remind_date DATE DEFAULT NULL,
      inactive TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`${DB_NAME}\`.safety_licenses (
      id INT(11) NOT NULL AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      document VARCHAR(120) NOT NULL,
      type VARCHAR(50) NOT NULL,
      institution VARCHAR(120) NOT NULL,
      start_date DATE DEFAULT NULL,
      expired_date DATE DEFAULT NULL,
      remind_date DATE DEFAULT NULL,
      inactive TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Seed sample data for empty tables to avoid empty UI
  try {
    const [[{ c: cntCompany }]] = await pool.query(`SELECT COUNT(*) AS c FROM \`${DB_NAME}\`.company_legal_entities`);
    if (Number(cntCompany) === 0) {
      await pool.query(
        `INSERT INTO \`${DB_NAME}\`.company_legal_entities (doc_name, doc_number, category, institution, approval_date, inactive)
         VALUES 
         ('Akta Pendirian Perusahaan', 'AHU-001/2021', 'Akta', 'Kemenkumham', '2021-01-15', 0),
         ('NPWP Badan', '77.888.999.0-123.000', 'Perpajakan', 'Direktorat Jenderal Pajak', '2020-05-20', 0)`
      );
      console.log('Seeded sample company_legal_entities');
    }
  } catch (e) {
    console.warn('Seed company_legal_entities skipped:', e && e.message);
  }

  try {
    const [[{ c: cntOperational }]] = await pool.query(`SELECT COUNT(*) AS c FROM \`${DB_NAME}\`.operational_permits`);
    if (Number(cntOperational) === 0) {
      await pool.query(
        `INSERT INTO \`${DB_NAME}\`.operational_permits (doc_name, type, institution, start_date, expired_date, remind_date, inactive)
         VALUES 
         ('Izin Operasional Produksi', 'Operasional', 'Dinas Perindustrian', '2022-07-01', '2025-07-01', '2025-05-01', 0),
         ('Izin Usaha Industri', 'IUI', 'Kementerian Perindustrian', '2023-03-10', '2026-03-10', '2026-01-10', 0)`
      );
      console.log('Seeded sample operational_permits');
    }
  } catch (e) {
    console.warn('Seed operational_permits skipped:', e && e.message);
  }

  try {
    const [[{ c: cntSafety }]] = await pool.query(`SELECT COUNT(*) AS c FROM \`${DB_NAME}\`.safety_licenses`);
    if (Number(cntSafety) === 0) {
      await pool.query(
        `INSERT INTO \`${DB_NAME}\`.safety_licenses (name, document, type, institution, start_date, expired_date, remind_date, inactive)
         VALUES 
         ('Budi Santoso', 'Lisensi K3 Umum', 'K3 Umum', 'Kementerian Ketenagakerjaan', '2022-01-01', '2025-01-01', '2024-07-01', 0),
         ('Siti Aminah', 'Lisensi Operator Forklift', 'Operator', 'Disnaker', '2021-09-15', '2024-09-15', '2024-03-15', 0)`
      );
      console.log('Seeded sample safety_licenses');
    }
  } catch (e) {
    console.warn('Seed safety_licenses skipped:', e && e.message);
  }
}

// API: get regulations by department
app.get('/api/regulations/:department', async (req, res) => {
  try {
    const dept = String(req.params.department || '').trim();
    const tbl = await ensureDeptTable(dept);
    if (!tbl) return res.json([]);
    const limit = Math.min(Number(req.query.limit || 50), 1000);
    const page = Math.max(Number(req.query.page || 1), 1);
    const offset = (page - 1) * limit;
    let rows = [];
    try {
      const [r] = await pool.query(
        `SELECT id, regulasi, lingkup, pasal, deskripsi, kriteria, kepatuhan, jenisHukuman, warnaHukuman FROM \`${DB_NAME}\`.\`${tbl}\` ORDER BY id ASC LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      rows = r;
      console.log(`[GET regulations] dept=${dept}, table=${tbl}, rows=${rows.length}`);
    } catch (err) {
      console.warn('Query error (dept table):', err && err.message);
      rows = [];
    }
    const data = rows.map((r, idx) => ({
      id: r.id,
      no: offset + idx + 1,
      regulasi: r.regulasi || '',
      lingkup: r.lingkup || '',
      pasal: r.pasal || '',
      deskripsi: r.deskripsi || '',
      kriteria: r.kriteria || '',
      kepatuhan: r.kepatuhan || 'dalam-proses',
      jenisHukuman: r.jenisHukuman || '',
      warnaHukuman: r.warnaHukuman || ''
    }));
    res.json(data);
  } catch (e) {
    console.error('DB error (GET regulations):', e && e.message);
    // Kembalikan array kosong agar UI tidak error dan tetap bisa lanjut impor
    res.json([]);
  }
});

app.get('/api/regulations/:department/count', async (req, res) => {
  try {
    const dept = String(req.params.department || '').trim();
    const tbl = await ensureDeptTable(dept);
    if (!tbl) return res.json({ total: 0, articles: 0 });
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM \`${DB_NAME}\`.\`${tbl}\``);
    const [[{ articles }]] = await pool.query(`SELECT COUNT(*) AS articles FROM \`${DB_NAME}\`.\`${tbl}\` WHERE TRIM(IFNULL(pasal,'')) <> ''`);
    res.json({ total: Number(total || 0), articles: Number(articles || 0) });
  } catch (e) {
    res.json({ total: 0, articles: 0 });
  }
});

app.get('/api/regulations/:department/stats', async (req, res) => {
  try {
    const dept = String(req.params.department || '').trim();
    const tbl = await ensureDeptTable(dept);
    if (!tbl) return res.json({ total: 0, articles: 0 });
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM \`${DB_NAME}\`.\`${tbl}\``);
    const [[{ articles }]] = await pool.query(`SELECT COUNT(*) AS articles FROM \`${DB_NAME}\`.\`${tbl}\` WHERE TRIM(IFNULL(pasal,'')) <> ''`);
    res.json({ total: Number(total||0), articles: Number(articles||0) });
  } catch (e) {
    res.json({ total: 0, articles: 0 });
  }
});


// Debug endpoint: counts per department
app.get('/api/debug/reg-status', async (_req, res) => {
  try {
    const result = {};
    for (const dept of Object.keys(REG_DEPT_TABLES)) {
      const tbl = await ensureDeptTable(dept);
      const [rows] = await pool.query(`SELECT COUNT(*) AS cnt FROM \`${DB_NAME}\`.\`${tbl}\``);
      result[dept] = Number(rows[0]?.cnt || 0);
    }
    res.json(result);
  } catch (e) {
    console.error('Debug reg-status error:', e && e.message);
    res.status(500).json({ error: 'Failed to get reg-status' });
  }
});

// API: replace all regulations for a department
app.post('/api/regulations/:department/save', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const dept = String(req.params.department || '').trim();
    const tbl = await ensureDeptTable(dept);
    const payload = Array.isArray(req.body) ? req.body : [];
    console.log(`[SAVE regulations] dept=${dept}, table=${tbl}, rows=${payload.length}`);

    await conn.beginTransaction();
    if (tbl) {
      await conn.query(`DELETE FROM \`${DB_NAME}\`.\`${tbl}\``);
    }

    // Batch processing untuk data besar
    const batchSize = 100;
    for (let i = 0; i < payload.length; i += batchSize) {
      const batch = payload.slice(i, i + batchSize);
      const values = batch.map((r) => [
        String(r.regulasi || ''),
        String(r.lingkup || ''),
        String(r.pasal || ''),
        String(r.deskripsi || ''),
        String(r.kriteria || ''),
        String(r.kepatuhan || 'dalam-proses'),
        String(r.jenisHukuman || ''),
        String(r.warnaHukuman || '')
      ]);
      const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const flatValues = values.flat();
      if (tbl) {
        await conn.query(
          `INSERT INTO \`${DB_NAME}\`.\`${tbl}\` (regulasi, lingkup, pasal, deskripsi, kriteria, kepatuhan, jenisHukuman, warnaHukuman)
           VALUES ${placeholders}`,
          flatValues
        );
      }
    }

    await conn.commit();
    res.json({ ok: true, count: payload.length });
  } catch (e) {
    await conn.rollback();
    console.error('DB error (SAVE regulations):', e && e.message);
    res.status(500).json({ error: 'Failed to save regulations', detail: e && e.message });
  } finally {
    conn.release();
  }
});

// API: begin replace (delete existing) for a department – to support chunked append
app.post('/api/regulations/:department/replace-start', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const dept = String(req.params.department || '').trim();
    const tbl = await ensureDeptTable(dept);
    await conn.beginTransaction();
    if (!tbl) throw new Error('Department table not resolved');
    await conn.query(`DELETE FROM \`${DB_NAME}\`.\`${tbl}\``);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error('DB error (REPLACE START regulations):', e && e.message);
    res.status(500).json({ error: 'Failed to start replace' });
  } finally { conn.release(); }
});

// API: append chunk rows to a department (no delete)
app.post('/api/regulations/:department/append', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const dept = String(req.params.department || '').trim();
    const tbl = await ensureDeptTable(dept);
    const payload = Array.isArray(req.body) ? req.body : [];
    let lastId = null;
    await conn.beginTransaction();
    if (tbl) {
      for (const r of payload) {
        const vals = [String(r.regulasi||''), String(r.lingkup||''), String(r.pasal||''), String(r.deskripsi||''), String(r.kriteria||''), String(r.kepatuhan||'dalam-proses'), String(r.jenisHukuman||''), String(r.warnaHukuman||'')];
        const [ret] = await conn.query(
          `INSERT INTO \`${DB_NAME}\`.\`${tbl}\` (regulasi, lingkup, pasal, deskripsi, kriteria, kepatuhan, jenisHukuman, warnaHukuman) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          vals
        );
        lastId = ret.insertId || lastId;
      }
    }
    await conn.commit();
    const [[{ c }]] = await pool.query(`SELECT COUNT(*) AS c FROM \`${DB_NAME}\`.\`${tbl}\``);
    res.json({ ok: true, appended: payload.length, lastIndex: Number(c||0), lastId });
  } catch (e) {
    await conn.rollback();
    console.error('DB error (APPEND regulations):', e && e.message);
    res.status(500).json({ error: 'Failed to append regulations' });
  } finally { conn.release(); }
});

// API: delete single regulation by number
app.delete('/api/regulations/:department/:no', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const dept = String(req.params.department || '').trim();
    const no = Number(req.params.no || 0);
    const tbl = await ensureDeptTable(dept);
    if (!tbl || !no) { conn.release(); return res.status(400).json({ error: 'Invalid department or no' }); }
    await conn.beginTransaction();
    const [ret] = await conn.query(`DELETE FROM \`${DB_NAME}\`.\`${tbl}\` WHERE no = ?`, [no]);
    await conn.query(`UPDATE \`${DB_NAME}\`.\`${tbl}\` SET no = no - 1 WHERE no > ?`, [no]);
    await conn.commit();
    res.json({ ok: true, deleted: ret.affectedRows || 0 });
  } catch (e) {
    await conn.rollback();
    console.error('DB error (DELETE regulation):', e && e.message);
    res.status(500).json({ error: 'Failed to delete regulation row' });
  } finally { conn.release(); }
});

// Fallback: jika lingkungan memblokir metode DELETE, gunakan POST dengan body { no }
app.post('/api/regulations/:department/delete', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const dept = String(req.params.department || '').trim();
    const no = Number((req.body && req.body.no) || 0);
    const tbl = await ensureDeptTable(dept);
    if (!tbl || !no) { conn.release(); return res.status(400).json({ error: 'Invalid department or no' }); }
    await conn.beginTransaction();
    const [row] = await conn.query(`SELECT id FROM \`${DB_NAME}\`.\`${tbl}\` ORDER BY id ASC LIMIT 1 OFFSET ?`, [no-1]);
    let ret = { affectedRows: 0 };
    if (row && row[0] && row[0].id) {
      const id = Number(row[0].id);
      const [resDel] = await conn.query(`DELETE FROM \`${DB_NAME}\`.\`${tbl}\` WHERE id = ?`, [id]);
      ret.affectedRows = resDel.affectedRows || 0;
    }
    await conn.commit();
    res.json({ ok: true, deleted: ret.affectedRows || 0 });
  } catch (e) {
    await conn.rollback();
    console.error('DB error (POST DELETE regulation):', e && e.message);
    res.status(500).json({ error: 'Failed to delete regulation row (POST)' });
  } finally { conn.release(); }
});

// Update by ID (preferred)
app.patch('/api/regulations/:department/id/:id', async (req, res) => {
  try {
    const dept = String(req.params.department || '').trim();
    const id = Number(req.params.id || 0);
    const body = req.body || {};
    const allowed = ['regulasi','lingkup','pasal','deskripsi','kriteria','kepatuhan','jenisHukuman','warnaHukuman'];
    const fields = allowed.filter(k => Object.prototype.hasOwnProperty.call(body, k));
    if (!id || fields.length === 0) return res.json({ ok: true, updated: 0 });
    const setClause = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => String(body[k] || ''));
    values.push(id);
    const tbl = await ensureDeptTable(dept);
    if (!tbl) return res.status(400).json({ error: 'Unknown department' });
    const sql = `UPDATE \`${DB_NAME}\`.\`${tbl}\` SET ${setClause} WHERE id = ?`;
    const [result] = await pool.query(sql, values);
    res.json({ ok: true, updated: result.affectedRows || 0 });
  } catch (e) {
    console.error('DB error (PATCH regulation by id):', e && e.message);
    res.status(500).json({ error: 'Failed to update regulation row by id' });
  }
});

// Delete by ID (preferred)
app.delete('/api/regulations/:department/id/:id', async (req, res) => {
  try {
    const dept = String(req.params.department || '').trim();
    const id = Number(req.params.id || 0);
    const tbl = await ensureDeptTable(dept);
    if (!tbl || !id) return res.status(400).json({ error: 'Invalid department or id' });
    const [ret] = await pool.query(`DELETE FROM \`${DB_NAME}\`.\`${tbl}\` WHERE id = ?`, [id]);
    res.json({ ok: true, deleted: ret.affectedRows || 0 });
  } catch (e) {
    console.error('DB error (DELETE regulation by id):', e && e.message);
    res.status(500).json({ error: 'Failed to delete regulation row by id' });
  }
});

// Reindex regulations numbering sequentially from 1
app.post('/api/regulations/:department/reindex', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const dept = String(req.params.department || '').trim();
    const tbl = await ensureDeptTable(dept);
    if (!tbl) { conn.release(); return res.status(400).json({ error: 'Unknown department' }); }
    await conn.beginTransaction();
    const [rows] = await conn.query(`SELECT id FROM \`${DB_NAME}\`.\`${tbl}\` ORDER BY no ASC, id ASC`);
    let i = 1, updated = 0;
    for (const r of rows) {
      const [ret] = await conn.query(`UPDATE \`${DB_NAME}\`.\`${tbl}\` SET no = ? WHERE id = ?`, [i++, r.id]);
      updated += ret.affectedRows || 0;
    }
    await conn.commit();
    res.json({ ok: true, updated });
  } catch (e) {
    await conn.rollback();
    console.error('DB error (REINDEX regulations):', e && e.message);
    res.status(500).json({ error: 'Failed to reindex regulations' });
  } finally { conn.release(); }
});
app.patch('/api/regulations/:department/:no', async (req, res) => {
  try {
    const dept = String(req.params.department || '').trim();
    const no = Number(req.params.no);
    const body = req.body || {};
    const allowed = ['regulasi','lingkup','pasal','deskripsi','kriteria','kepatuhan','jenisHukuman','warnaHukuman'];
    const fields = allowed.filter(k => Object.prototype.hasOwnProperty.call(body, k));
    if (fields.length === 0) return res.json({ ok: true, updated: 0 });
    const setClause = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => String(body[k] || ''));
    values.push(no);
    const tbl = await ensureDeptTable(dept);
    if (!tbl) return res.status(400).json({ error: 'Unknown department' });
    const sql = `UPDATE \`${DB_NAME}\`.\`${tbl}\` SET ${setClause} WHERE no = ?`;
    const [result] = await pool.query(sql, values);
    res.json({ ok: true, updated: result.affectedRows || 0 });
  } catch (e) {
    console.error('DB error (PATCH regulation):', e && e.message);
    res.status(500).json({ error: 'Failed to update regulation row' });
  }
});

// API: get distinct departments
app.get('/api/departments', async (_req, res) => {
  try {
    // Daftar dari mapping tabel per-departemen
    const depts = Object.keys(REG_DEPT_TABLES);
    res.json(depts);
  } catch (e) {
    console.error('DB error (GET departments):', e && e.message);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// E-Library APIs
app.get('/api/elibrary/:category', async (req, res) => {
  try {
    const category = String(req.params.category || '').trim();
    const table = ELIBRARY_TABLES[category];
    if (!table) return res.status(400).json({ error: 'Unknown category' });
    const limit = Math.min(Number(req.query.limit || 50), 1000);
    const page = Math.max(Number(req.query.page || 1), 1);
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      `SELECT id, departemen, regulasi, lingkup, status, link, notes FROM \`${DB_NAME}\`.\`${table}\` ORDER BY id ASC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const data = rows.map((r, idx) => ({
      id: r.id,
      no: offset + idx + 1,
      departemen: r.departemen || '',
      regulasi: r.regulasi || '',
      lingkup: r.lingkup || '',
      status: r.status && r.status.toLowerCase() === 'tidak berlaku' ? 'Tidak Berlaku' : 'Berlaku',
      link: r.link || '',
      notes: r.notes || ''
    }));
    res.json(data);
  } catch (e) {
    console.error('DB error (GET elibrary):', e && e.message);
    res.status(500).json({ error: 'Failed to fetch elibrary data' });
  }
});

app.post('/api/elibrary/:category/save', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const category = String(req.params.category || '').trim();
    const table = ELIBRARY_TABLES[category];
    if (!table) { conn.release(); return res.status(400).json({ error: 'Unknown category' }); }

    const payload = Array.isArray(req.body) ? req.body : [];
    console.log(`[SAVE elibrary] category=${category}, table=${table}, rows=${payload.length}`);
    if (payload.length) {
      const sample = payload[0];
      console.log('[SAVE elibrary] sample row:', {
        no: sample.no,
        departemen: sample.departemen,
        regulasi: sample.regulasi,
        lingkup: sample.lingkup,
        status: sample.status,
        link: sample.link,
        notes: sample.notes,
      });
    }

    await conn.beginTransaction();
    await conn.query(`DELETE FROM \`${DB_NAME}\`.\`${table}\``);

    for (let i = 0; i < payload.length; i++) {
      const r = payload[i] || {};
      await conn.query(
        `INSERT INTO \`${DB_NAME}\`.\`${table}\` (departemen, regulasi, lingkup, status, link, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          String(r.departemen || ''),
          String(r.regulasi || ''),
          String(r.lingkup || ''),
          String(r.status || ''),
          String(r.link || ''),
          String(r.notes || '')
        ]
      );
    }

    await conn.commit();
    console.log(`[SAVE elibrary] committed ${payload.length} rows to ${table}`);
    res.json({ ok: true, count: payload.length });
  } catch (e) {
    await conn.rollback();
    console.error('DB error (SAVE elibrary):', e && e.message);
    res.status(500).json({ error: 'Failed to save elibrary data' });
  } finally {
    conn.release();
  }
});

// Append rows to E‑Library category without deleting existing
app.post('/api/elibrary/:category/append', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const category = String(req.params.category || '').trim();
    const table = ELIBRARY_TABLES[category];
    if (!table) { conn.release(); return res.status(400).json({ error: 'Unknown category' }); }
    const payload = Array.isArray(req.body) ? req.body : [];
    await conn.beginTransaction();
    let lastId = null;
    for (const r of payload) {
      const [ret] = await conn.query(
        `INSERT INTO \`${DB_NAME}\`.\`${table}\` (departemen, regulasi, lingkup, status, link, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          String(r.departemen || ''),
          String(r.regulasi || ''),
          String(r.lingkup || ''),
          String(r.status || ''),
          String(r.link || ''),
          String(r.notes || '')
        ]
      );
      lastId = ret.insertId || lastId;
    }
    await conn.commit();
    const [[{ c }]] = await pool.query(`SELECT COUNT(*) AS c FROM \`${DB_NAME}\`.\`${table}\``);
    res.json({ ok: true, appended: payload.length, lastId, lastIndex: Number(c || 0) });
  } catch (e) {
    await conn.rollback();
    console.error('DB error (APPEND elibrary):', e && e.message);
    res.status(500).json({ error: 'Failed to append elibrary data', detail: e && e.message });
  } finally {
    conn.release();
  }
});

// Update a single E‑Library row by its `no`
app.patch('/api/elibrary/:category/:no', async (req, res) => {
  try {
    const category = String(req.params.category || '').trim();
    const no = Number(req.params.no || 0);
    const table = ELIBRARY_TABLES[category];
    if (!table || !no) return res.status(400).json({ error: 'Invalid category or no' });
    const body = req.body || {};
    const allowed = ['departemen','regulasi','lingkup','status','link','notes'];
    const fields = allowed.filter(k => Object.prototype.hasOwnProperty.call(body, k));
    if (fields.length === 0) return res.json({ ok: true, updated: 0 });
    const setClause = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => String(body[k] || ''));
    const [row] = await pool.query(`SELECT id FROM \`${DB_NAME}\`.\`${table}\` ORDER BY id ASC LIMIT 1 OFFSET ?`, [no - 1]);
    const id = row && row[0] && row[0].id ? Number(row[0].id) : 0;
    if (!id) return res.json({ ok: true, updated: 0 });
    values.push(id);
    const sql = `UPDATE \`${DB_NAME}\`.\`${table}\` SET ${setClause} WHERE id = ?`;
    const [ret] = await pool.query(sql, values);
    res.json({ ok: true, updated: ret.affectedRows || 0 });
  } catch (e) {
    console.error('DB error (PATCH elibrary):', e && e.message);
    res.status(500).json({ error: 'Failed to update elibrary row' });
  }
});

// Update by row id (preferred)
app.patch('/api/elibrary/:category/id/:id', async (req, res) => {
  try {
    const category = String(req.params.category || '').trim();
    const id = Number(req.params.id || 0);
    const table = ELIBRARY_TABLES[category];
    if (!table || !id) return res.status(400).json({ error: 'Invalid category or id' });
    const body = req.body || {};
    const allowed = ['departemen','regulasi','lingkup','status','link','notes'];
    const fields = allowed.filter(k => Object.prototype.hasOwnProperty.call(body, k));
    if (fields.length === 0) return res.json({ ok: true, updated: 0 });
    const setClause = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => String(body[k] || ''));
    values.push(id);
    const sql = `UPDATE \`${DB_NAME}\`.\`${table}\` SET ${setClause} WHERE id = ?`;
    const [ret] = await pool.query(sql, values);
    res.json({ ok: true, updated: ret.affectedRows || 0 });
  } catch (e) {
    console.error('DB error (PATCH elibrary by id):', e && e.message);
    res.status(500).json({ error: 'Failed to update elibrary row by id' });
  }
});

// Delete a single E‑Library row by its `no`
app.delete('/api/elibrary/:category/:no', async (req, res) => {
  try {
    const category = String(req.params.category || '').trim();
    const no = Number(req.params.no || 0);
    const table = ELIBRARY_TABLES[category];
    if (!table || !no) return res.status(400).json({ error: 'Invalid category or no' });
    const [row] = await pool.query(`SELECT id FROM \`${DB_NAME}\`.\`${table}\` ORDER BY id ASC LIMIT 1 OFFSET ?`, [no - 1]);
    const id = row && row[0] && row[0].id ? Number(row[0].id) : 0;
    if (!id) return res.json({ ok: true, deleted: 0 });
    const [ret] = await pool.query(`DELETE FROM \`${DB_NAME}\`.\`${table}\` WHERE id = ?`, [id]);
    res.json({ ok: true, deleted: ret.affectedRows || 0 });
  } catch (e) {
    console.error('DB error (DELETE elibrary):', e && e.message);
    res.status(500).json({ error: 'Failed to delete elibrary row' });
  }
});

// Delete by row id (preferred)
app.delete('/api/elibrary/:category/id/:id', async (req, res) => {
  try {
    const category = String(req.params.category || '').trim();
    const id = Number(req.params.id || 0);
    const table = ELIBRARY_TABLES[category];
    if (!table || !id) return res.status(400).json({ error: 'Invalid category or id' });
    const [ret] = await pool.query(`DELETE FROM \`${DB_NAME}\`.\`${table}\` WHERE id = ?`, [id]);
    res.json({ ok: true, deleted: ret.affectedRows || 0 });
  } catch (e) {
    console.error('DB error (DELETE elibrary by id):', e && e.message);
    res.status(500).json({ error: 'Failed to delete elibrary row by id' });
  }
});

// Reindex `no` sequentially starting from 1 for a category
app.post('/api/elibrary/:category/reindex', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const category = String(req.params.category || '').trim();
    const table = ELIBRARY_TABLES[category];
    if (!table) { conn.release(); return res.status(400).json({ error: 'Unknown category' }); }
    res.json({ ok: true, updated: 0 });
  } catch (e) {
    console.error('DB error (REINDEX elibrary):', e && e.message);
    res.status(500).json({ error: 'Failed to reindex elibrary' });
  } finally { conn.release(); }
});

// Endpoint baru: jumlah regulasi per kategori (grouped counts)
app.get('/api/elibrary-counts', async (req, res) => {
  try {
    const result = {};
    for (const [cat, table] of Object.entries(ELIBRARY_TABLES)) {
      const [rows] = await pool.query(`SELECT COUNT(*) AS cnt FROM \`${DB_NAME}\`.\`${table}\``);
      result[cat] = Number(rows[0]?.cnt || 0);
    }
    res.json(result);
  } catch (e) {
    console.error('DB error (GET elibrary-counts):', e && e.message);
    res.status(500).json({ error: 'Failed to fetch elibrary counts' });
  }
});

// Company Legal Entities
app.get('/api/company-legal-entities', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, doc_name, doc_number, category, institution,
              DATE_FORMAT(approval_date,'%Y-%m-%d') AS approval_date,
              inactive, created_at
         FROM \`${DB_NAME}\`.company_legal_entities
         ORDER BY id ASC`
    );
    res.json(rows);
  } catch (e) {
    console.error('DB error (GET company_legal_entities):', e && e.message);
    res.status(500).json({ error: 'Failed to fetch company legal entities' });
  }
});
// Company count
app.get('/api/company/count', async (_req, res) => {
  try {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM \`${DB_NAME}\`.company_legal_entities`);
    res.json({ total: Number(total||0) });
  } catch (e) { res.json({ total: 0 }); }
});
// Company CSV preview (for RCS company module)
app.post('/api/company/import/preview', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    let text = '';
    try {
      const buf = fs.readFileSync(file.path);
      if (buf[0] === 0xFF && buf[1] === 0xFE) text = Buffer.from(buf.slice(2)).toString('utf16le');
      else if (buf[0] === 0xFE && buf[1] === 0xFF) text = Buffer.from(buf.slice(2)).toString('utf16be');
      else if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) text = Buffer.from(buf.slice(3)).toString('utf8');
      else { try { text = buf.toString('utf8'); } catch { text = buf.toString('latin1'); } }
    } catch {}
    const rows = [];
    const seen = new Map();
    const pushRow = (r) => {
      const key = `${String(r.doc_name||'').trim().toLowerCase()}|${String(r.doc_number||'').trim().toLowerCase()}|${String(r.institution||'').trim().toLowerCase()}`;
      if (key.replace(/\|/g,'').trim()) seen.set(key,(seen.get(key)||0)+1);
      rows.push({ ...r, _key: key });
    };
    let delimiterOpt = ',';
    try {
      const head = String(text||'').split(/\r?\n/)[0] || '';
      const cntComma = (head.match(/,/g)||[]).length;
      const cntSemi  = (head.match(/;/g)||[]).length;
      const cntTab   = (head.match(/\t/g)||[]).length;
      if (cntSemi > cntComma && cntSemi >= cntTab) delimiterOpt = ';';
      else if (cntTab > cntComma && cntTab >= cntSemi) delimiterOpt = '\t';
      else delimiterOpt = ',';
    } catch {}
    try {
      const result = Papa.parse(text, { header:true, skipEmptyLines:true, delimiter: delimiterOpt });
      for (const r of (result.data||[])) {
        const h = Object.fromEntries(Object.entries(r).map(([k,v])=>[String(k||'').trim().toLowerCase(), v]));
        const doc_name   = r['DOCUMENT NAME'] || r['Document Name'] || r['DOKUMEN'] || r['Nama Dokumen'] || h['document name'] || h['dokumen'] || h['nama dokumen'] || r['doc_name'] || '';
        const doc_number = r['DOCUMENT NUMBER'] || r['Document Number'] || r['NOMOR DOKUMEN'] || r['Nomor Dokumen'] || r['NO'] || r['No'] || r['No.'] || r['NO.'] || h['document number'] || h['nomor dokumen'] || h['no'] || h['no.'] || r['doc_number'] || null;
        const category   = r['CATEGORY'] || r['KATEGORI'] || h['category'] || h['kategori'] || r['category'] || '';
        const institution= r['INSTITUTION'] || r['INSTITUSI'] || h['institution'] || h['institusi'] || r['institution'] || '';
        const approval_date = r['APPROVAL DATE'] || r['PENGESAHAN'] || r['Tanggal Pengesahan'] || r['BERLAKU'] || r['TANGGAL BERLAKU'] || r['Start Date'] || r['START DATE'] || h['approval date'] || h['pengesahan'] || h['tanggal pengesahan'] || h['berlaku'] || h['tanggal berlaku'] || h['start date'] || r['approval_date'] || null;
        const statusLabel = r['STATUS'] || r['Status'] || h['status'] || '';
        const status = String(statusLabel||'').toLowerCase().includes('inactive') ? 'Inactive' : 'Active';
        pushRow({ doc_name, doc_number, category, institution, approval_date, status });
      }
    } catch(parseErr){
      return res.status(500).json({ error:'Failed to parse CSV', detail: parseErr && parseErr.message });
    }
    const [existing] = await pool.query(
      `SELECT LOWER(TRIM(doc_name)) AS doc_name, LOWER(TRIM(COALESCE(doc_number,''))) AS doc_number, LOWER(TRIM(institution)) AS institution FROM \`${DB_NAME}\`.company_legal_entities`
    );
    const existingSet = new Set((existing||[]).map(r=>`${r.doc_name}|${r.doc_number}|${r.institution}`));
    let dupFileTotal=0, dupDbTotal=0;
    const counts = new Map(); rows.forEach(r=>{ if(r._key) counts.set(r._key,(counts.get(r._key)||0)+1); });
    const preview = rows.map(r=>{
      const dup_in_file = r._key ? (counts.get(r._key)||0) > 1 : false;
      const dup_in_db   = r._key ? existingSet.has(r._key) : false;
      if (dup_in_file) dupFileTotal++;
      if (dup_in_db) dupDbTotal++;
      const invalid = !String(r.doc_name||'').trim() || !String(r.category||'').trim() || !String(r.institution||'').trim();
      const { _key, ...rest } = r;
      return { ...rest, dup_in_file, dup_in_db, invalid };
    });
    res.json({ ok:true, total: preview.length, dup_in_file_total: dupFileTotal, dup_in_db_total: dupDbTotal, preview });
  } catch (e) {
    console.error('Company import preview error:', e && e.message);
    res.status(500).json({ error:'Failed to preview import', detail: e && e.message });
  } finally {
    try { if (req.file && req.file.path) fs.unlinkSync(req.file.path); } catch {}
  }
});

// Company CSV commit (for RCS company module)
app.post('/api/company/import/commit', async (req, res) => {
  const rows = (req.body && req.body.rows) || [];
  if (!Array.isArray(rows) || rows.length === 0) return res.json({ ok: true, imported: 0 });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let imported = 0;
    for (const r of rows) {
      const toISO = (v)=>{
        if (v===null || v===undefined || v==='') return null;
        const s = String(v).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
        if (m){ const dd=m[1].padStart(2,'0'); const mm=m[2].padStart(2,'0'); const yyyy=m[3].length===2?('20'+m[3]):m[3]; const dt=new Date(Date.UTC(Number(yyyy),Number(mm)-1,Number(dd))); return dt.toISOString().slice(0,10); }
        m = s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i);
        if (m){ const dd=m[1].padStart(2,'0'); const map={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}; const mm=map[String(m[2]).toLowerCase().slice(0,3)]||'01'; const y=String(m[3]); const yyyy=y.length===2?('20'+y):y; const dt=new Date(Date.UTC(Number(yyyy),Number(mm)-1,Number(dd))); return dt.toISOString().slice(0,10); }
        const n = Number(s); if (!isNaN(n) && s.replace(/\s/g,'')!==''){ const base=new Date(Date.UTC(1899,11,30)); base.setUTCDate(base.getUTCDate()+Math.floor(n)); return base.toISOString().slice(0,10); }
        const d = new Date(s); if(!isNaN(d)) return d.toISOString().slice(0,10);
        return null;
      };
      const payload = [
        String(r.doc_name||''), r.doc_number?String(r.doc_number):null, String(r.category||''), String(r.institution||''), toISO(r.approval_date),
        String(r.status||'Active').toLowerCase() === 'inactive' ? 1 : 0
      ];
      const [ret] = await conn.query(
        `INSERT INTO \`${DB_NAME}\`.company_legal_entities (doc_name, doc_number, category, institution, approval_date, inactive) VALUES (?, ?, ?, ?, ?, ?)`,
        payload
      );
      imported += ret.affectedRows ? 1 : 0;
    }
    await conn.commit();
    res.json({ ok: true, imported });
  } catch (e) {
    await conn.rollback();
    console.error('Company import commit error:', e && e.message);
    res.status(500).json({ error: 'Failed to commit import', detail: e && e.message });
  } finally { conn.release(); }
});

app.post('/api/company/deduplicate', async (_req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [dups] = await conn.query(
      `SELECT a.id
       FROM \`${DB_NAME}\`.company_legal_entities a
       JOIN \`${DB_NAME}\`.company_legal_entities b
         ON LOWER(TRIM(a.doc_name))=LOWER(TRIM(b.doc_name))
        AND LOWER(TRIM(COALESCE(a.doc_number,'')))=LOWER(TRIM(COALESCE(b.doc_number,'')))
        AND LOWER(TRIM(a.institution))=LOWER(TRIM(b.institution))
        AND DATE_FORMAT(a.approval_date,'%Y-%m-%d')=DATE_FORMAT(b.approval_date,'%Y-%m-%d')
        AND a.id>b.id`
    );
    let deleted = 0;
    if (dups.length) {
      const ids = dups.map(r => Number(r.id)).filter(Boolean);
      const chunks = [];
      for (let i=0;i<ids.length;i+=500) chunks.push(ids.slice(i,i+500));
      for (const c of chunks) {
        const placeholders = c.map(()=>'?').join(',');
        const [ret] = await conn.query(`DELETE FROM \`${DB_NAME}\`.company_legal_entities WHERE id IN (${placeholders})`, c);
        deleted += ret.affectedRows || 0;
      }
    }
    await conn.commit();
    res.json({ deleted });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: 'Failed to deduplicate' });
  } finally { conn.release(); }
});
app.post('/api/company-legal-entities', async (req, res) => {
  try {
    const r = req.body || {};
    const toISO = (v)=>{
      if (v===null || v===undefined || v==='') return null;
      const s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
      if (m) { const dd=m[1].padStart(2,'0'); const mm=m[2].padStart(2,'0'); const yyyy=m[3].length===2?('20'+m[3]):m[3]; const dt=new Date(Date.UTC(Number(yyyy),Number(mm)-1,Number(dd))); return dt.toISOString().slice(0,10); }
      m = s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i);
      if (m) { const dd=m[1].padStart(2,'0'); const map={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}; const mm=map[String(m[2]).toLowerCase().slice(0,3)]||'01'; const y=String(m[3]); const yyyy=y.length===2?('20'+y):y; const dt=new Date(Date.UTC(Number(yyyy),Number(mm)-1,Number(dd))); return dt.toISOString().slice(0,10); }
      const n = Number(s); if (!isNaN(n) && s.replace(/\s/g,'')!=='') { const base=new Date(Date.UTC(1899,11,30)); base.setUTCDate(base.getUTCDate()+Math.floor(n)); return base.toISOString().slice(0,10); }
      const d = new Date(s); if (!isNaN(d)) return d.toISOString().slice(0,10);
      return null;
    };
    const [ret] = await pool.query(
      `INSERT INTO \`${DB_NAME}\`.company_legal_entities (doc_name, doc_number, category, institution, approval_date, inactive)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(r.doc_name || ''),
        r.doc_number ? String(r.doc_number) : null,
        String(r.category || ''),
        String(r.institution || ''),
        toISO(r.approval_date),
        r.status === 'Inactive' ? 1 : Number(r.inactive || 0)
      ]
    );
    res.json({ ok: true, id: ret.insertId });
  } catch (e) {
    console.error('DB error (POST company_legal_entities):', e && e.message);
    res.status(500).json({ error: 'Failed to create company entity' });
  }
});
app.put('/api/company-legal-entities/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = req.body || {};
    const toISO = (v)=>{
      if (v===null || v===undefined || v==='') return null;
      const s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
      if (m) { const dd=m[1].padStart(2,'0'); const mm=m[2].padStart(2,'0'); const yyyy=m[3].length===2?('20'+m[3]):m[3]; const dt=new Date(Date.UTC(Number(yyyy),Number(mm)-1,Number(dd))); return dt.toISOString().slice(0,10); }
      m = s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i);
      if (m) { const dd=m[1].padStart(2,'0'); const map={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}; const mm=map[String(m[2]).toLowerCase().slice(0,3)]||'01'; const y=String(m[3]); const yyyy=y.length===2?('20'+y):y; const dt=new Date(Date.UTC(Number(yyyy),Number(mm)-1,Number(dd))); return dt.toISOString().slice(0,10); }
      const n = Number(s); if (!isNaN(n) && s.replace(/\s/g,'')!=='') { const base=new Date(Date.UTC(1899,11,30)); base.setUTCDate(base.getUTCDate()+Math.floor(n)); return base.toISOString().slice(0,10); }
      const d = new Date(s); if (!isNaN(d)) return d.toISOString().slice(0,10);
      return null;
    };
    await pool.query(
      `UPDATE \`${DB_NAME}\`.company_legal_entities
       SET doc_name=?, doc_number=?, category=?, institution=?, approval_date=?, inactive=?
       WHERE id=?`,
      [
        String(r.doc_name || ''),
        r.doc_number ? String(r.doc_number) : null,
        String(r.category || ''),
        String(r.institution || ''),
        toISO(r.approval_date),
        r.status === 'Inactive' ? 1 : Number(r.inactive || 0),
        id
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (PUT company_legal_entities):', e && e.message);
    res.status(500).json({ error: 'Failed to update company entity' });
  }
});
// Minimal status update for direct company_legal_entities route
app.put('/api/company-legal-entities/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const inactive = Number((req.body && req.body.inactive) || 0) ? 1 : 0;
    await pool.query(
      `UPDATE \`${DB_NAME}\`.company_legal_entities SET inactive=? WHERE id=?`,
      [inactive, id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (PUT company_legal_ status):', e && e.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});
app.delete('/api/company-legal-entities/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query(`DELETE FROM \`${DB_NAME}\`.company_legal_entities WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (DELETE company_legal_entities):', e && e.message);
    res.status(500).json({ error: 'Failed to delete company entity' });
  }
});

// Company export (local)
app.get('/api/company/export', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, doc_name, doc_number, category, institution,
              DATE_FORMAT(approval_date,'%Y-%m-%d') AS approval_date,
              inactive
         FROM \`${DB_NAME}\`.company_legal_entities
         ORDER BY id DESC`
    );
    const headers = ['DOCUMENT NAME','DOCUMENT NUMBER','CATEGORY','INSTITUTION','APPROVAL DATE','STATUS'];
    const lines = [headers.join(',')];
    rows.forEach(r => {
      const status = Number(r.inactive||0) === 1 ? 'Inactive' : 'Active';
      const vals = [r.doc_name||'', r.doc_number||'', r.category||'', r.institution||'', r.approval_date||'', status];
      const esc = v => '"' + String(v||'').replace(/"/g,'""') + '"';
      lines.push(vals.map(esc).join(','));
    });
    const csv = lines.join('\r\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="company_export.csv"');
    res.send(csv);
  } catch(e){
    console.error('Export company error:', e && e.message);
    res.status(500).json({ error: 'Failed to export company' });
  }
});

// Company import (local)
app.post('/api/company/import', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  const filePath = file.path;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let imported = 0;
    const batch = [];
    const flush = async () => {
      if (!batch.length) return;
      const values = batch.map(r => [
        String(r.doc_name||''), r.doc_number?String(r.doc_number):null, String(r.category||''), String(r.institution||''), r.approval_date?String(r.approval_date):null, r.inactive
      ]);
      const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const flat = values.flat();
      await conn.query(
        `INSERT INTO \`${DB_NAME}\`.company_legal_entities (doc_name, doc_number, category, institution, approval_date, inactive) VALUES ${placeholders}`,
        flat
      );
      imported += batch.length;
      batch.length = 0;
    };
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      Papa.parse(stream, {
        header: true,
        skipEmptyLines: true,
        chunk: async (results, parser) => {
          parser.pause();
          try {
            for (const r of results.data) {
              const h = Object.fromEntries(Object.entries(r).map(([k,v])=>[String(k||'').trim().toLowerCase(), v]));
              const doc_name = r['DOCUMENT NAME'] || r['Document Name'] || r['DOKUMEN'] || r['Nama Dokumen'] || h['document name'] || h['dokumen'] || h['nama dokumen'] || r['doc_name'] || '';
              const doc_number = r['DOCUMENT NUMBER'] || r['Document Number'] || r['NOMOR DOKUMEN'] || h['document number'] || h['nomor dokumen'] || r['doc_number'] || null;
              const category = r['CATEGORY'] || r['KATEGORI'] || h['category'] || h['kategori'] || r['category'] || '';
              const institution = r['INSTITUTION'] || r['INSTITUSI'] || h['institution'] || h['institusi'] || r['institution'] || '';
              const approval_date = r['APPROVAL DATE'] || r['PENGESAHAN'] || r['Tanggal Pengesahan'] || h['approval date'] || h['pengesahan'] || h['tanggal pengesahan'] || r['approval_date'] || null;
              const statusLabel = r['STATUS'] || r['Status'] || h['status'] || '';
              const inactive = String(statusLabel||'').toLowerCase().includes('inactive') ? 1 : 0;
              batch.push({ doc_name, doc_number, category, institution, approval_date, inactive });
              if (batch.length >= 500) await flush();
            }
            await flush();
            parser.resume();
          } catch (err) { reject(err); }
        },
        complete: () => resolve(),
        error: (err) => reject(err)
      });
    });
    await conn.commit();
    res.json({ ok: true, imported });
  } catch(e){
    await conn.rollback();
    console.error('Import company error:', e && e.message);
    res.status(500).json({ error: 'Failed to import company', detail: e && e.message });
  } finally {
    conn.release();
    try { if (filePath) fs.unlinkSync(filePath); } catch {}
  }
});

app.get('/api/company', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 1000), 100000);
    const page = Math.max(Number(req.query.page || 1), 1);
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      `SELECT id, doc_name, doc_number, category, institution,
              DATE_FORMAT(approval_date,'%Y-%m-%d') AS approval_date,
              inactive, created_at
         FROM \`${DB_NAME}\`.company_legal_entities
         ORDER BY id ASC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json(rows);
  } catch (e) {
    console.error('DB error (GET company alias):', e && e.message);
    res.status(500).json({ error: 'Failed to fetch company entities' });
  }
});
app.post('/api/company', async (req, res) => {
  try {
    const r = req.body || {};
    const toISO = (v)=>{
      if (v===null || v===undefined || v==='') return null;
      const s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
      if (m) { const dd=m[1].padStart(2,'0'); const mm=m[2].padStart(2,'0'); const yyyy=m[3].length===2?('20'+m[3]):m[3]; const dt=new Date(Date.UTC(Number(yyyy),Number(mm)-1,Number(dd))); return dt.toISOString().slice(0,10); }
      m = s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i);
      if (m) { const dd=m[1].padStart(2,'0'); const map={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}; const mm=map[String(m[2]).toLowerCase().slice(0,3)]||'01'; const y=String(m[3]); const yyyy=y.length===2?('20'+y):y; const dt=new Date(Date.UTC(Number(yyyy),Number(mm)-1,Number(dd))); return dt.toISOString().slice(0,10); }
      const n = Number(s); if (!isNaN(n) && s.replace(/\s/g,'')!=='') { const base=new Date(Date.UTC(1899,11,30)); base.setUTCDate(base.getUTCDate()+Math.floor(n)); return base.toISOString().slice(0,10); }
      const d = new Date(s); if (!isNaN(d)) return d.toISOString().slice(0,10);
      return null;
    };
    const [ret] = await pool.query(
      `INSERT INTO \`${DB_NAME}\`.company_legal_entities (doc_name, doc_number, category, institution, approval_date, inactive)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(r.doc_name || ''),
        r.doc_number ? String(r.doc_number) : null,
        String(r.category || ''),
        String(r.institution || ''),
        toISO(r.approval_date),
        r.status === 'Inactive' ? 1 : Number(r.inactive || 0)
      ]
    );
    res.json({ ok: true, id: ret.insertId });
  } catch (e) {
    console.error('DB error (POST company alias):', e && e.message);
    res.status(500).json({ error: 'Failed to create company entity' });
  }
});
app.put('/api/company/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = req.body || {};
    const toISO = (v)=>{
      if (v===null || v===undefined || v==='') return null;
      const s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
      if (m) { const dd=m[1].padStart(2,'0'); const mm=m[2].padStart(2,'0'); const yyyy=m[3].length===2?('20'+m[3]):m[3]; const dt=new Date(Date.UTC(Number(yyyy),Number(mm)-1,Number(dd))); return dt.toISOString().slice(0,10); }
      m = s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i);
      if (m) { const dd=m[1].padStart(2,'0'); const map={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}; const mm=map[String(m[2]).toLowerCase().slice(0,3)]||'01'; const y=String(m[3]); const yyyy=y.length===2?('20'+y):y; const dt=new Date(Date.UTC(Number(yyyy),Number(mm)-1,Number(dd))); return dt.toISOString().slice(0,10); }
      const n = Number(s); if (!isNaN(n) && s.replace(/\s/g,'')!=='') { const base=new Date(Date.UTC(1899,11,30)); base.setUTCDate(base.getUTCDate()+Math.floor(n)); return base.toISOString().slice(0,10); }
      const d = new Date(s); if (!isNaN(d)) return d.toISOString().slice(0,10);
      return null;
    };
    await pool.query(
      `UPDATE \`${DB_NAME}\`.company_legal_entities
       SET doc_name=?, doc_number=?, category=?, institution=?, approval_date=?, inactive=?
       WHERE id=?`,
      [
        String(r.doc_name || ''),
        r.doc_number ? String(r.doc_number) : null,
        String(r.category || ''),
        String(r.institution || ''),
        toISO(r.approval_date),
        r.status === 'Inactive' ? 1 : Number(r.inactive || 0),
        id
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (PUT company alias):', e && e.message);
    res.status(500).json({ error: 'Failed to update company entity' });
  }
});

// Minimal status update (avoid touching approval_date and other fields)
app.put('/api/company/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const inactive = Number((req.body && req.body.inactive) || 0) ? 1 : 0;
    await pool.query(
      `UPDATE \`${DB_NAME}\`.company_legal_entities SET inactive=? WHERE id=?`,
      [inactive, id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (PUT company status):', e && e.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});
app.delete('/api/company/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query(`DELETE FROM \`${DB_NAME}\`.company_legal_entities WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (DELETE company alias):', e && e.message);
    res.status(500).json({ error: 'Failed to delete company entity' });
  }
});

// Operational Permits
  app.get('/api/operational-permits', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, doc_name, type, institution,
              DATE_FORMAT(start_date,'%Y-%m-%d')   AS start_date,
              DATE_FORMAT(expired_date,'%Y-%m-%d') AS expired_date,
              DATE_FORMAT(remind_date,'%Y-%m-%d')  AS remind_date,
              inactive, created_at
         FROM \`${DB_NAME}\`.operational_permits
         ORDER BY id ASC`
    );
    res.json(rows);
  } catch (e) {
    console.error('DB error (GET operational_permits):', e && e.message);
    res.status(500).json({ error: 'Failed to fetch operational permits' });
  }
});
// Operational count
app.get('/api/operational/count', async (_req, res) => {
  try {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM \`${DB_NAME}\`.operational_permits`);
    res.json({ total: Number(total||0) });
  } catch (e) { res.json({ total: 0 }); }
});
app.post('/api/operational-permits', async (req, res) => {
  try {
    const r = req.body || {};
    const toISO = (v)=>{
      if (v===null || v===undefined || v==='') return null;
      const s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
      if (m) {
        const dd = String(m[1]).padStart(2,'0');
        const mm = String(m[2]).padStart(2,'0');
        const yyyy = m[3].length===2 ? ('20'+m[3]) : m[3];
        const dt = new Date(Date.UTC(Number(yyyy), Number(mm)-1, Number(dd)));
        return dt.toISOString().slice(0,10);
      }
      m = s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i);
      if (m) {
        const dd = String(m[1]).padStart(2,'0');
        const mon = String(m[2]).toLowerCase().slice(0,3);
        const map = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
        const mm = map[mon] || '01';
        const y = String(m[3]);
        const yyyy = y.length===2 ? ('20'+y) : y;
        const dt = new Date(Date.UTC(Number(yyyy), Number(mm)-1, Number(dd)));
        return dt.toISOString().slice(0,10);
      }
      const n = Number(s);
      if (!isNaN(n) && s.replace(/\s/g,'')!=='' && n>0) {
        const base = new Date(Date.UTC(1899,11,30));
        base.setUTCDate(base.getUTCDate()+Math.floor(n));
        return base.toISOString().slice(0,10);
      }
      return null;
    };
    const [ret] = await pool.query(
      `INSERT INTO \`${DB_NAME}\`.operational_permits (doc_name, type, institution, start_date, expired_date, remind_date, inactive)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        String(r.doc_name || ''),
        String(r.type || r.category || ''),
        String(r.institution || ''),
        toISO(r.start_date),
        toISO(r.expired_date),
        toISO(r.remind_date),
        Number(r.inactive || (r.status === 'Inactive' ? 1 : 0))
      ]
    );
    res.json({ ok: true, id: ret.insertId });
  } catch (e) {
    console.error('DB error (POST operational_permits):', e && e.message);
    res.status(500).json({ error: 'Failed to create operational permit' });
  }
});
app.put('/api/operational-permits/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = req.body || {};
    const toISO = (v)=>{
      if (v===null || v===undefined || v==='') return null;
      const s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
      if (m) {
        const dd = String(m[1]).padStart(2,'0');
        const mm = String(m[2]).padStart(2,'0');
        const yyyy = m[3].length===2 ? ('20'+m[3]) : m[3];
        const dt = new Date(Date.UTC(Number(yyyy), Number(mm)-1, Number(dd)));
        return dt.toISOString().slice(0,10);
      }
      m = s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i);
      if (m) {
        const dd = String(m[1]).padStart(2,'0');
        const mon = String(m[2]).toLowerCase().slice(0,3);
        const map = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
        const mm = map[mon] || '01';
        const y = String(m[3]);
        const yyyy = y.length===2 ? ('20'+y) : y;
        const dt = new Date(Date.UTC(Number(yyyy), Number(mm)-1, Number(dd)));
        return dt.toISOString().slice(0,10);
      }
      const n = Number(s);
      if (!isNaN(n) && s.replace(/\s/g,'')!=='' && n>0) {
        const base = new Date(Date.UTC(1899,11,30));
        base.setUTCDate(base.getUTCDate()+Math.floor(n));
        return base.toISOString().slice(0,10);
      }
      return null;
    };
    await pool.query(
      `UPDATE \`${DB_NAME}\`.operational_permits
       SET doc_name=?, type=?, institution=?, start_date=?, expired_date=?, remind_date=?, inactive=?
       WHERE id=?`,
      [
        String(r.doc_name || ''),
        String(r.type || r.category || ''),
        String(r.institution || ''),
        toISO(r.start_date),
        toISO(r.expired_date),
        toISO(r.remind_date),
        Number(r.inactive || (r.status === 'Inactive' ? 1 : 0)),
        id
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (PUT operational_permits):', e && e.message);
    res.status(500).json({ error: 'Failed to update operational permit' });
  }
});
app.delete('/api/operational-permits/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query(`DELETE FROM \`${DB_NAME}\`.operational_permits WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (DELETE operational_permits):', e && e.message);
    res.status(500).json({ error: 'Failed to delete operational permit' });
  }
});

// Operational export (local)
app.get('/api/operational/export', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT doc_name, type, institution, start_date, expired_date, remind_date, inactive FROM \`${DB_NAME}\`.operational_permits ORDER BY id DESC`
    );
    const headers = ['DOCUMENT NAME','TYPE','INSTITUTION','START DATE','EXPIRED DATE','REMIND DATE','STATUS'];
    const lines = [headers.join(',')];
    rows.forEach(r => {
      const status = Number(r.inactive||0) === 1 ? 'Inactive' : 'Active';
      const vals = [r.doc_name||'', r.type||'', r.institution||'', r.start_date||'', r.expired_date||'', r.remind_date||'', status];
      const esc = v => '"' + String(v||'').replace(/"/g,'""') + '"';
      lines.push(vals.map(esc).join(','));
    });
    const csv = lines.join('\r\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="operational_export.csv"');
    res.send(csv);
  } catch(e){
    console.error('Export operational error:', e && e.message);
    res.status(500).json({ error: 'Failed to export operational' });
  }
});

// Operational import (local)
app.post('/api/operational/import', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  const filePath = file.path;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let imported = 0;
    const batch = [];
    const flush = async () => {
      if (!batch.length) return;
      const values = batch.map(r => [
        String(r.doc_name||''), String(r.type||''), String(r.institution||''), r.start_date?String(r.start_date):null, r.expired_date?String(r.expired_date):null, r.remind_date?String(r.remind_date):null, r.inactive
      ]);
      const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      const flat = values.flat();
      await conn.query(
        `INSERT INTO \`${DB_NAME}\`.operational_permits (doc_name, type, institution, start_date, expired_date, remind_date, inactive) VALUES ${placeholders}`,
        flat
      );
      imported += batch.length;
      batch.length = 0;
    };
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      Papa.parse(stream, {
        header: true,
        skipEmptyLines: true,
        chunk: async (results, parser) => {
          parser.pause();
          try {
            for (const r of results.data) {
              // Normalize combined header cell for operational import
              const keys0 = Object.keys(r || {});
              const combinedKey0 = keys0.find(k => k && k.includes(',') && /dokumen/i.test(k) && /kategori/i.test(k));
              if (combinedKey0) {
                const val0 = r[combinedKey0];
                if (val0 !== undefined) {
                  r['DOKUMEN'] = val0;
                  r['Document Name'] = val0;
                  r['DOCUMENT NAME'] = val0;
                }
              }
              const h = Object.fromEntries(Object.entries(r).map(([k,v])=>[String(k||'').trim().toLowerCase(), v]));
              const doc_name = r['DOCUMENT NAME'] || r['Document Name'] || r['DOKUMEN'] || r['Nama Dokumen'] || h['document name'] || h['dokumen'] || h['nama dokumen'] || r['doc_name'] || '';
              const type = r['TYPE'] || r['KATEGORI'] || r['Kategori'] || h['type'] || h['kategori'] || r['type'] || '';
              const institution = r['INSTITUTION'] || r['INSTITUSI'] || h['institution'] || h['institusi'] || r['institution'] || '';
              const pDate = (v)=>{
                if (v===null || v===undefined) return null;
                const s = String(v).trim(); if (!s) return null;
                if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
                let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
                if (m){ const dd=m[1].padStart(2,'0'); const mm=m[2].padStart(2,'0'); const yyyy=m[3].length===2?('20'+m[3]):m[3]; const dt=new Date(Date.UTC(Number(yyyy),Number(mm)-1,Number(dd))); return dt.toISOString().slice(0,10); }
                m = s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i);
                if (m){ const dd=m[1].padStart(2,'0'); const map={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}; const mm=map[String(m[2]).toLowerCase().slice(0,3)]||'01'; const y=String(m[3]); const yyyy=y.length===2?('20'+y):y; const dt=new Date(Date.UTC(Number(yyyy),Number(mm)-1,Number(dd))); return dt.toISOString().slice(0,10); }
                const n = Number(s);
                if (!isNaN(n) && s.replace(/\s/g,'')!=='' && n>0) { const base = new Date(Date.UTC(1899,11,30)); base.setUTCDate(base.getUTCDate()+Math.floor(n)); return base.toISOString().slice(0,10); }
                const d = new Date(s); if (!isNaN(d)) return d.toISOString().slice(0,10);
                return null;
              };
              const start_date = pDate(r['START DATE'] || r['TANGGAL BERLAKU'] || h['start date'] || h['tanggal berlaku'] || r['start_date']);
              const expired_date = pDate(
                r['EXPIRED DATE'] || r['TANGGAL KEDALUARSA'] || r['TANGGAL KEDALUWARSA'] || r['TANGGAL KADALUARSA'] ||
                h['expired date'] || h['tanggal kedaluarsa'] || h['tanggal kedaluwarsa'] || h['tanggal kadaluarsa'] ||
                h['kedaluarsa'] || h['kedaluwarsa'] || h['kadaluarsa'] || r['expired_date']
              );
              let remind_date = pDate(r['REMIND DATE'] || r['TANGGAL PENGINGAT'] || r['Pengingat'] || h['remind date'] || h['tanggal pengingat'] || h['pengingat'] || r['remind_date']);
              const statusLabel = r['STATUS'] || r['Status'] || h['status'] || '';
              const inactive = String(statusLabel||'').toLowerCase().includes('inactive') ? 1 : 0;
              if (!remind_date && expired_date) {
                const exp = new Date(String(expired_date));
                if (!isNaN(exp)) {
                  exp.setMonth(exp.getMonth() - 2);
                  remind_date = exp.toISOString().slice(0,10);
                }
              }
              batch.push({ doc_name, type, institution, start_date, expired_date, remind_date, inactive });
              if (batch.length >= 500) await flush();
            }
            await flush();
            parser.resume();
          } catch (err) { reject(err); }
        },
        complete: () => resolve(),
        error: (err) => reject(err)
      });
    });
    await conn.commit();
    res.json({ ok: true, imported });
  } catch(e){
    await conn.rollback();
    console.error('Import operational error:', e && e.message);
    res.status(500).json({ error: 'Failed to import operational', detail: e && e.message });
  } finally {
    conn.release();
    try { if (filePath) fs.unlinkSync(filePath); } catch {}
  }
});

// Operational import preview
app.post('/api/operational/import/preview', upload.single('file'), async (req, res) => {
  try {
    const file = req.file; if (!file) return res.status(400).json({ error: 'No file uploaded' });
    let text = '';
    try {
      const buf = fs.readFileSync(file.path);
      if (buf[0] === 0xFF && buf[1] === 0xFE) text = Buffer.from(buf.slice(2)).toString('utf16le');
      else if (buf[0] === 0xFE && buf[1] === 0xFF) text = Buffer.from(buf.slice(2)).toString('utf16be');
      else if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) text = Buffer.from(buf.slice(3)).toString('utf8');
      else { try { text = buf.toString('utf8'); } catch { text = buf.toString('latin1'); } }
    } catch {}
    const rows = [];
    const seen = new Map();
    const pushRow = (r) => {
      const nk = [String(r.doc_name||'').trim().toLowerCase(), String(r.type||'').trim().toLowerCase(), String(r.institution||'').trim().toLowerCase()];
      const key = nk.every(s => !s) ? null : `${nk[0]}|${nk[1]}|${nk[2]}`;
      if (key) { seen.set(key, (seen.get(key)||0)+1 ); }
      rows.push({ ...r, _key: key });
    };
    const parseDate = (v)=>{
      if (v===null || v===undefined) return null;
      const s = String(v).trim(); if (!s) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
      if (m){ const dd=m[1].padStart(2,'0'); const mm=m[2].padStart(2,'0'); const yyyy=m[3].length===2?('20'+m[3]):m[3]; return `${yyyy}-${mm}-${dd}`; }
      m = s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i);
      if (m){ const dd=m[1].padStart(2,'0'); const map={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}; const mm=map[String(m[2]).toLowerCase().slice(0,3)]||'01'; const y=String(m[3]); const yyyy=y.length===2?('20'+y):y; return `${yyyy}-${mm}-${dd}`; }
      const n = Number(s);
      if (!isNaN(n) && s.replace(/\s/g,'')!=='' && n>0) { const base = new Date(Date.UTC(1899,11,30)); base.setUTCDate(base.getUTCDate()+Math.floor(n)); return base.toISOString().slice(0,10); }
      const d = new Date(s); if (!isNaN(d)) return d.toISOString().slice(0,10);
      return null;
    };
    let delimiterOpt = ',';
    try {
      const head = String(text||'').split(/\r?\n/)[0] || '';
      const cntComma = (head.match(/,/g)||[]).length;
      const cntSemi  = (head.match(/;/g)||[]).length;
      const cntTab   = (head.match(/\t/g)||[]).length;
      if (cntSemi > cntComma && cntSemi >= cntTab) delimiterOpt = ';';
      else if (cntTab > cntComma && cntTab >= cntSemi) delimiterOpt = '\t';
      else delimiterOpt = ',';
    } catch {}
    try {
      const result = Papa.parse(text, { header:true, skipEmptyLines:true, delimiter: delimiterOpt });
      for (const r of (result.data||[])) {
        const h = Object.fromEntries(Object.entries(r).map(([k,v])=>[String(k||'').trim().toLowerCase(), v]));
        let doc_name    = r['DOCUMENT NAME'] || r['Document Name'] || r['DOKUMEN'] || r['Nama Dokumen'] || h['document name'] || h['dokumen'] || h['nama dokumen'] || r['doc_name'] || r['document'] || '';
        let type        = r['TYPE'] || r['Kategori'] || r['KATEGORI'] || h['type'] || h['kategori'] || r['type'] || '';
        let institution = r['INSTITUTION'] || r['Institusi'] || h['institution'] || h['institusi'] || r['institution'] || '';
        let start_date  = parseDate(r['START DATE'] || r['Berlaku'] || r['TANGGAL BERLAKU'] || h['start date'] || h['berlaku'] || h['tanggal berlaku'] || r['start_date']);
        let expired_date= parseDate(
          r['EXPIRED DATE'] || r['Kedaluwarsa'] || r['TANGGAL KEDALUWARSA'] || r['TANGGAL KEDALUARSA'] || r['TANGGAL KADALUARSA'] ||
          h['expired date'] || h['kedaluwarsa'] || h['kedaluarsa'] || h['kadaluarsa'] || h['tanggal kedaluwarsa'] || h['tanggal kedaluarsa'] || h['tanggal kadaluarsa'] ||
          r['expired_date']
        );
        let remind_date   = parseDate(r['REMIND DATE'] || r['Pengingat'] || r['TANGGAL PENGINGAT'] || h['remind date'] || h['pengingat'] || h['tanggal pengingat'] || r['remind_date']);
        const statusLabel = r['STATUS'] || r['Status'] || h['status'] || '';
        const status      = String(statusLabel||'').toLowerCase().includes('inactive') ? 'Inactive' : 'Active';
        if (!remind_date && expired_date) { const exp=new Date(expired_date); if(!isNaN(exp)){ exp.setUTCMonth(exp.getUTCMonth()-2); remind_date=exp.toISOString().slice(0,10);} }
        pushRow({ doc_name, type, institution, start_date, expired_date, remind_date, status });
      }
    } catch(parseErr){
      return res.status(500).json({ error:'Failed to parse CSV', detail: parseErr && parseErr.message });
    }
    const [existing] = await pool.query(
      `SELECT LOWER(TRIM(doc_name)) AS doc_name, LOWER(TRIM(type)) AS type, LOWER(TRIM(institution)) AS institution FROM \`${DB_NAME}\`.operational_permits`
    );
    const existingSet = new Set((existing||[]).map(r=>`${r.doc_name}|${r.type}|${r.institution}`));
    const counts = new Map(); rows.forEach(r=>{ if(r._key) counts.set(r._key, (counts.get(r._key)||0)+1 ); });
    let dupFileTotal=0, dupDbTotal=0;
    const preview = rows.map(r=>{
      const dup_in_file = r._key ? (counts.get(r._key)||0) > 1 : false;
      const dup_in_db   = r._key ? existingSet.has(r._key) : false;
      if (dup_in_file) dupFileTotal++;
      if (dup_in_db) dupDbTotal++;
      const { _key, ...rest } = r;
      return { ...rest, dup_in_file, dup_in_db };
    });
    res.json({ ok:true, total: preview.length, dup_in_file_total: dupFileTotal, dup_in_db_total: dupDbTotal, preview });
  } catch(e){
    console.error('Operational import preview error:', e && e.message);
    res.status(500).json({ error:'Failed to preview import', detail: e && e.message });
  } finally {
    try{ if (req.file && req.file.path) fs.unlinkSync(req.file.path); } catch{}
  }
});
app.post('/api/operational/import/commit', async (req, res) => {
  const rows = (req.body && req.body.rows) || [];
  if (!Array.isArray(rows) || rows.length === 0) return res.json({ ok:true, imported:0 });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let imported = 0;
    for (const r of rows) {
      const payload = [
        String(r.doc_name||r.name||''), String(r.type||r.category||''), String(r.institution||''), r.start_date?String(r.start_date):null, r.expired_date?String(r.expired_date):null, r.remind_date?String(r.remind_date):null, String(r.status||'Active').toLowerCase()==='inactive'?1:0
      ];
      const [ret] = await conn.query(
        `INSERT INTO \`${DB_NAME}\`.operational_permits (doc_name, type, institution, start_date, expired_date, remind_date, inactive) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        payload
      );
      imported += ret.affectedRows ? 1 : 0;
    }
    await conn.commit();
    res.json({ ok:true, imported });
  } catch(e){
    await conn.rollback();
    console.error('Operational import commit error:', e && e.message);
    res.status(500).json({ error:'Failed to commit import', detail: e && e.message });
  } finally { conn.release(); }
});

app.post('/api/operational/deduplicate', async (_req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [dups] = await conn.query(
      `SELECT a.id
       FROM \`${DB_NAME}\`.operational_permits a
       JOIN \`${DB_NAME}\`.operational_permits b
         ON LOWER(TRIM(a.doc_name))=LOWER(TRIM(b.doc_name))
        AND LOWER(TRIM(a.type))=LOWER(TRIM(b.type))
        AND LOWER(TRIM(a.institution))=LOWER(TRIM(b.institution))
        AND DATE_FORMAT(a.expired_date,'%Y-%m-%d')=DATE_FORMAT(b.expired_date,'%Y-%m-%d')
        AND a.id>b.id`
    );
    let deleted = 0;
    if (dups.length) {
      const ids = dups.map(r => Number(r.id)).filter(Boolean);
      const chunks = [];
      for (let i=0;i<ids.length;i+=500) chunks.push(ids.slice(i,i+500));
      for (const c of chunks) {
        const placeholders = c.map(()=>'?').join(',');
        const [ret] = await conn.query(`DELETE FROM \`${DB_NAME}\`.operational_permits WHERE id IN (${placeholders})`, c);
        deleted += ret.affectedRows || 0;
      }
    }
    await conn.commit();
    res.json({ deleted });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: 'Failed to deduplicate' });
  } finally { conn.release(); }
});

  app.get('/api/operational', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 1000), 100000);
    const page = Math.max(Number(req.query.page || 1), 1);
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      `SELECT id, doc_name, type, institution,
              DATE_FORMAT(start_date,'%Y-%m-%d')   AS start_date,
              DATE_FORMAT(expired_date,'%Y-%m-%d') AS expired_date,
              DATE_FORMAT(remind_date,'%Y-%m-%d')  AS remind_date,
              inactive, created_at
         FROM \`${DB_NAME}\`.operational_permits
         ORDER BY id ASC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json(rows);
  } catch (e) {
    console.error('DB error (GET operational alias):', e && e.message);
    res.status(500).json({ error: 'Failed to fetch operational permits' });
  }
});
app.post('/api/operational', async (req, res) => {
  try {
    const r = req.body || {};
    const toISO = (v)=>{
      if (v===null || v===undefined || v==='') return null;
      const s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
      if (m) {
        const dd = String(m[1]).padStart(2,'0');
        const mm = String(m[2]).padStart(2,'0');
        const yyyy = m[3].length===2 ? ('20'+m[3]) : m[3];
        const dt = new Date(Date.UTC(Number(yyyy), Number(mm)-1, Number(dd)));
        return dt.toISOString().slice(0,10);
      }
      m = s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i);
      if (m) {
        const dd = String(m[1]).padStart(2,'0');
        const mon = String(m[2]).toLowerCase().slice(0,3);
        const map = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
        const mm = map[mon] || '01';
        const y = String(m[3]);
        const yyyy = y.length===2 ? ('20'+y) : y;
        const dt = new Date(Date.UTC(Number(yyyy), Number(mm)-1, Number(dd)));
        return dt.toISOString().slice(0,10);
      }
      const n = Number(s);
      if (!isNaN(n) && s.replace(/\s/g,'')!=='' && n>0) {
        const base = new Date(Date.UTC(1899,11,30));
        base.setUTCDate(base.getUTCDate()+Math.floor(n));
        return base.toISOString().slice(0,10);
      }
      return null;
    };
    const [ret] = await pool.query(
      `INSERT INTO \`${DB_NAME}\`.operational_permits (doc_name, type, institution, start_date, expired_date, remind_date, inactive)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        String(r.doc_name || ''),
        String(r.type || r.category || ''),
        String(r.institution || ''),
        toISO(r.start_date),
        toISO(r.expired_date),
        toISO(r.remind_date),
        Number(r.inactive || (r.status === 'Inactive' ? 1 : 0))
      ]
    );
    res.json({ ok: true, id: ret.insertId });
  } catch (e) {
    console.error('DB error (POST operational alias):', e && e.message);
    res.status(500).json({ error: 'Failed to create operational permit' });
  }
});
app.put('/api/operational/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = req.body || {};
    const toISO = (v)=>{
      if (v===null || v===undefined || v==='') return null;
      const s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
      if (m) {
        const dd = String(m[1]).padStart(2,'0');
        const mm = String(m[2]).padStart(2,'0');
        const yyyy = m[3].length===2 ? ('20'+m[3]) : m[3];
        const dt = new Date(Date.UTC(Number(yyyy), Number(mm)-1, Number(dd)));
        return dt.toISOString().slice(0,10);
      }
      m = s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i);
      if (m) {
        const dd = String(m[1]).padStart(2,'0');
        const mon = String(m[2]).toLowerCase().slice(0,3);
        const map = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
        const mm = map[mon] || '01';
        const y = String(m[3]);
        const yyyy = y.length===2 ? ('20'+y) : y;
        const dt = new Date(Date.UTC(Number(yyyy), Number(mm)-1, Number(dd)));
        return dt.toISOString().slice(0,10);
      }
      const n = Number(s);
      if (!isNaN(n) && s.replace(/\s/g,'')!=='' && n>0) {
        const base = new Date(Date.UTC(1899,11,30));
        base.setUTCDate(base.getUTCDate()+Math.floor(n));
        return base.toISOString().slice(0,10);
      }
      return null;
    };
    await pool.query(
      `UPDATE \`${DB_NAME}\`.operational_permits
       SET doc_name=?, type=?, institution=?, start_date=?, expired_date=?, remind_date=?, inactive=?
       WHERE id=?`,
      [
        String(r.doc_name || ''),
        String(r.type || r.category || ''),
        String(r.institution || ''),
        toISO(r.start_date),
        toISO(r.expired_date),
        toISO(r.remind_date),
        Number(r.inactive || (r.status === 'Inactive' ? 1 : 0)),
        id
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (PUT operational alias):', e && e.message);
    res.status(500).json({ error: 'Failed to update operational permit' });
  }
});

app.put('/api/operational/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const inactive = Number((req.body && req.body.inactive) || 0) ? 1 : 0;
    await pool.query(
      `UPDATE \`${DB_NAME}\`.operational_permits SET inactive=? WHERE id=?`,
      [inactive, id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (PUT operational status):', e && e.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});
app.delete('/api/operational/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query(`DELETE FROM \`${DB_NAME}\`.operational_permits WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (DELETE operational alias):', e && e.message);
    res.status(500).json({ error: 'Failed to delete operational permit' });
  }
});

  app.get('/api/safety-licenses', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, document, type, institution,
              DATE_FORMAT(start_date,'%Y-%m-%d')   AS start_date,
              DATE_FORMAT(expired_date,'%Y-%m-%d') AS expired_date,
              DATE_FORMAT(remind_date,'%Y-%m-%d')  AS remind_date,
              inactive, created_at
         FROM \`${DB_NAME}\`.safety_licenses
         ORDER BY id ASC`
    );
    res.json(rows);
  } catch (e) {
    console.error('DB error (GET safety_licenses):', e && e.message);
    res.status(500).json({ error: 'Failed to fetch safety licenses' });
  }
});
// Safety count
app.get('/api/safety/count', async (_req, res) => {
  try {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM \`${DB_NAME}\`.safety_licenses`);
    res.json({ total: Number(total||0) });
  } catch (e) { res.json({ total: 0 }); }
});
app.post('/api/safety-licenses', async (req, res) => {
  try {
    const r = req.body || {};
    const [ret] = await pool.query(
      `INSERT INTO \`${DB_NAME}\`.safety_licenses (name, document, type, institution, start_date, expired_date, remind_date, inactive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(r.name || ''),
        String(r.document || ''),
        String(r.type || ''),
        String(r.institution || ''),
        r.start_date ? String(r.start_date) : null,
        r.expired_date ? String(r.expired_date) : null,
        r.remind_date ? String(r.remind_date) : null,
        Number(r.inactive || (r.status === 'Inactive' ? 1 : 0))
      ]
    );
    res.json({ ok: true, id: ret.insertId });
  } catch (e) {
    console.error('DB error (POST safety_licenses):', e && e.message);
    res.status(500).json({ error: 'Failed to create safety license' });
  }
});
app.put('/api/safety-licenses/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = req.body || {};
    await pool.query(
      `UPDATE \`${DB_NAME}\`.safety_licenses
       SET name=?, document=?, type=?, institution=?, start_date=?, expired_date=?, remind_date=?, inactive=?
       WHERE id=?`,
      [
        String(r.name || ''),
        String(r.document || ''),
        String(r.type || ''),
        String(r.institution || ''),
        r.start_date ? String(r.start_date) : null,
        r.expired_date ? String(r.expired_date) : null,
        r.remind_date ? String(r.remind_date) : null,
        Number(r.inactive || (r.status === 'Inactive' ? 1 : 0)),
        id
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (PUT safety_licenses):', e && e.message);
    res.status(500).json({ error: 'Failed to update safety license' });
  }
});

app.put('/api/safety-licenses/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const inactive = Number((req.body && req.body.inactive) || 0) ? 1 : 0;
    await pool.query(
      `UPDATE \`${DB_NAME}\`.safety_licenses SET inactive=? WHERE id=?`,
      [inactive, id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (PUT safety_licenses status):', e && e.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});
app.delete('/api/safety-licenses/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query(`DELETE FROM \`${DB_NAME}\`.safety_licenses WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (DELETE safety_licenses):', e && e.message);
    res.status(500).json({ error: 'Failed to delete safety license' });
  }
});

app.get('/api/safety/export', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT name, document, type, institution, start_date, expired_date, remind_date, inactive FROM \`${DB_NAME}\`.safety_licenses ORDER BY id DESC`
    );
    const headers = ['NAME','DOCUMENT','TYPE','INSTITUTION','START DATE','EXPIRED DATE','REMIND DATE','STATUS'];
    const lines = [headers.join(',')];
    rows.forEach(r => {
      const status = Number(r.inactive||0) === 1 ? 'Inactive' : 'Active';
      const vals = [r.name||'', r.document||'', r.type||'', r.institution||'', r.start_date||'', r.expired_date||'', r.remind_date||'', status];
      const esc = v => '"' + String(v||'').replace(/"/g,'""') + '"';
      lines.push(vals.map(esc).join(','));
    });
    const csv = lines.join('\r\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="safety_export.csv"');
    res.send(csv);
  } catch(e){
    console.error('Export safety error:', e && e.message);
    res.status(500).json({ error: 'Failed to export safety' });
  }
});

app.post('/api/safety/import', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  const filePath = file.path;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let imported = 0;
    const batch = [];
    const flush = async () => {
      if (!batch.length) return;
      const values = batch.map(r => [
        String(r.name||''), String(r.document||''), String(r.type||''), String(r.institution||''), r.start_date?String(r.start_date):null, r.expired_date?String(r.expired_date):null, r.remind_date?String(r.remind_date):null, r.inactive
      ]);
      const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const flat = values.flat();
      await conn.query(
        `INSERT INTO \`${DB_NAME}\`.safety_licenses (name, document, type, institution, start_date, expired_date, remind_date, inactive) VALUES ${placeholders}`,
        flat
      );
      imported += batch.length;
      batch.length = 0;
    };
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      Papa.parse(stream, {
        header: true,
        skipEmptyLines: true,
        chunk: async (results, parser) => {
          parser.pause();
          try {
          for (const r of results.data) {
            const h = Object.fromEntries(Object.entries(r).map(([k,v])=>[String(k||'').trim().toLowerCase(), v]));
            const pick = (keys)=>{
              for (const k of keys){ const v = h[k]; if (v!==undefined && String(v).trim()!=='') return v; }
              return '';
            };
            let name = pick(['nama','name']);
            if (/^\d+$/.test(String(name).trim())) name = pick(['nama']);
            const document = pick(['dokumen','document']);
            const type = pick(['tipe','type','kategori','jenis','jenis dokumen','kategori dokumen']);
            const institution = pick(['institusi','institution','instansi','lembaga','penerbit']);
            const parseDate = (v)=>{
              if (v===null || v===undefined) return null;
              const s = String(v).trim(); if (!s) return null;
              if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
              const m1 = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
              if (m1) {
                const dd = String(m1[1]).padStart(2,'0');
                const mm = String(m1[2]).padStart(2,'0');
                const yyyy = m1[3].length===2 ? ('20'+m1[3]) : m1[3];
                return `${yyyy}-${mm}-${dd}`;
              }
              const n = Number(s);
              if (!isNaN(n) && s.replace(/\s/g,'')!=='' && n>0) {
                const base = new Date(Date.UTC(1899,11,30));
                base.setUTCDate(base.getUTCDate()+Math.floor(n));
                return base.toISOString().slice(0,10);
              }
              const d = new Date(s);
              if (!isNaN(d)) return d.toISOString().slice(0,10);
              return null;
            };
            const start_date = parseDate(pick(['start date','tanggal mulai','tanggal berlaku','masa berlaku','mulai berlaku','valid from','berlaku'])||r['start_date']);
            const expired_date = parseDate(pick(['expired date','tanggal kedaluwarsa','masa kedaluwarsa','berakhir','valid until','kedaluwarsa'])||r['expired_date']);
            let remind_date = parseDate(pick(['remind date','tanggal pengingat','pengingat','reminder','reminder date'])||r['remind_date']);
              const statusLabel = r['STATUS'] || r['Status'] || h['status'] || '';
              const inactive = String(statusLabel||'').toLowerCase().includes('inactive') ? 1 : 0;
              if (!remind_date && expired_date) {
                const exp = new Date(String(expired_date));
                if (!isNaN(exp)) {
                  exp.setMonth(exp.getMonth() - 6);
                  remind_date = exp.toISOString().slice(0,10);
                }
              }
              batch.push({ name, document, type, institution, start_date, expired_date, remind_date, inactive });
              if (batch.length >= 500) await flush();
            }
            await flush();
            parser.resume();
          } catch (err) { reject(err); }
        },
        complete: () => resolve(),
        error: (err) => reject(err)
      });
    });
    await conn.commit();
    res.json({ ok: true, imported });
  } catch(e){
    await conn.rollback();
    console.error('Import safety error:', e && e.message);
    res.status(500).json({ error: 'Failed to import safety', detail: e && e.message });
  } finally {
    conn.release();
    try { if (filePath) fs.unlinkSync(filePath); } catch {}
  }
});

  app.get('/api/safety', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 1000), 100000);
    const page = Math.max(Number(req.query.page || 1), 1);
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      `SELECT id, name, document, type, institution,
              DATE_FORMAT(start_date,'%Y-%m-%d')   AS start_date,
              DATE_FORMAT(expired_date,'%Y-%m-%d') AS expired_date,
              DATE_FORMAT(remind_date,'%Y-%m-%d')  AS remind_date,
              inactive, created_at
         FROM \`${DB_NAME}\`.safety_licenses
         ORDER BY id ASC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json(rows);
  } catch (e) {
    console.error('DB error (GET safety alias):', e && e.message);
    res.status(500).json({ error: 'Failed to fetch safety licenses' });
  }
});
app.post('/api/safety', async (req, res) => {
  try {
    const r = req.body || {};
    const toISO = (v)=>{
      if (v===null || v===undefined || v==='') return null;
      const s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
      if (m) {
        const dd = String(m[1]).padStart(2,'0');
        const mm = String(m[2]).padStart(2,'0');
        const yyyy = m[3].length===2 ? ('20'+m[3]) : m[3];
        const dt = new Date(Date.UTC(Number(yyyy), Number(mm)-1, Number(dd)));
        return dt.toISOString().slice(0,10);
      }
      m = s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i);
      if (m) {
        const dd = String(m[1]).padStart(2,'0');
        const mon = String(m[2]).toLowerCase().slice(0,3);
        const map = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
        const mm = map[mon] || '01';
        const y = String(m[3]);
        const yyyy = y.length===2 ? ('20'+y) : y;
        const dt = new Date(Date.UTC(Number(yyyy), Number(mm)-1, Number(dd)));
        return dt.toISOString().slice(0,10);
      }
      const n = Number(s);
      if (!isNaN(n) && s.replace(/\s/g,'')!=='' && n>0) {
        const base = new Date(Date.UTC(1899,11,30));
        base.setUTCDate(base.getUTCDate()+Math.floor(n));
        return base.toISOString().slice(0,10);
      }
      return null;
    };
    const [ret] = await pool.query(
      `INSERT INTO \`${DB_NAME}\`.safety_licenses (name, document, type, institution, start_date, expired_date, remind_date, inactive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(r.name || ''),
        String(r.document || ''),
        String(r.type || ''),
        String(r.institution || ''),
        toISO(r.start_date),
        toISO(r.expired_date),
        toISO(r.remind_date),
        Number(r.inactive || (r.status === 'Inactive' ? 1 : 0))
      ]
    );
    res.json({ ok: true, id: ret.insertId });
  } catch (e) {
    console.error('DB error (POST safety alias):', e && e.message);
    res.status(500).json({ error: 'Failed to create safety license' });
  }
});
app.put('/api/safety/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = req.body || {};
    const toISO = (v)=>{
      if (v===null || v===undefined || v==='') return null;
      const s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
      if (m) {
        const dd = String(m[1]).padStart(2,'0');
        const mm = String(m[2]).padStart(2,'0');
        const yyyy = m[3].length===2 ? ('20'+m[3]) : m[3];
        const dt = new Date(Date.UTC(Number(yyyy), Number(mm)-1, Number(dd)));
        return dt.toISOString().slice(0,10);
      }
      m = s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i);
      if (m) {
        const dd = String(m[1]).padStart(2,'0');
        const mon = String(m[2]).toLowerCase().slice(0,3);
        const map = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
        const mm = map[mon] || '01';
        const y = String(m[3]);
        const yyyy = y.length===2 ? ('20'+y) : y;
        const dt = new Date(Date.UTC(Number(yyyy), Number(mm)-1, Number(dd)));
        return dt.toISOString().slice(0,10);
      }
      const n = Number(s);
      if (!isNaN(n) && s.replace(/\s/g,'')!=='' && n>0) {
        const base = new Date(Date.UTC(1899,11,30));
        base.setUTCDate(base.getUTCDate()+Math.floor(n));
        return base.toISOString().slice(0,10);
      }
      return null;
    };
    await pool.query(
      `UPDATE \`${DB_NAME}\`.safety_licenses
       SET name=?, document=?, type=?, institution=?, start_date=?, expired_date=?, remind_date=?, inactive=?
       WHERE id=?`,
      [
        String(r.name || ''),
        String(r.document || ''),
        String(r.type || ''),
        String(r.institution || ''),
        toISO(r.start_date),
        toISO(r.expired_date),
        toISO(r.remind_date),
        Number(r.inactive || (r.status === 'Inactive' ? 1 : 0)),
        id
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (PUT safety alias):', e && e.message);
    res.status(500).json({ error: 'Failed to update safety license' });
  }
});

app.put('/api/safety/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const inactive = Number((req.body && req.body.inactive) || 0) ? 1 : 0;
    await pool.query(
      `UPDATE \`${DB_NAME}\`.safety_licenses SET inactive=? WHERE id=?`,
      [inactive, id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (PUT safety status):', e && e.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});
app.delete('/api/safety/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query(`DELETE FROM \`${DB_NAME}\`.safety_licenses WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('DB error (DELETE safety alias):', e && e.message);
    res.status(500).json({ error: 'Failed to delete safety license' });
  }
});

app.post('/api/safety/import/preview', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = file.path;
    const rows = [];
    const seen = new Map();
    const pushRow = (r) => {
      const nk = [String(r.name||'').trim().toLowerCase(), String(r.document||'').trim().toLowerCase(), String(r.institution||'').trim().toLowerCase()];
      const key = nk.every(s => !s) ? null : `${nk[0]}|${nk[1]}|${nk[2]}`;
      if (key) { const cnt = (seen.get(key) || 0) + 1; seen.set(key, cnt); }
      rows.push({ ...r, _key: key });
    };
    let text = '';
    try {
      const buf = fs.readFileSync(filePath);
      if (buf[0] === 0xFF && buf[1] === 0xFE) text = Buffer.from(buf.slice(2)).toString('utf16le');
      else if (buf[0] === 0xFE && buf[1] === 0xFF) text = Buffer.from(buf.slice(2)).toString('utf16be');
      else if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) text = Buffer.from(buf.slice(3)).toString('utf8');
      else { try { text = buf.toString('utf8'); } catch { text = buf.toString('latin1'); } }
    } catch {}
    let delimiterOpt = ',';
    try {
      const head = String(text||'').split(/\r?\n/)[0] || '';
      const cntComma = (head.match(/,/g)||[]).length;
      const cntSemi  = (head.match(/;/g)||[]).length;
      const cntTab   = (head.match(/\t/g)||[]).length;
      if (cntSemi > cntComma && cntSemi >= cntTab) delimiterOpt = ';';
      else if (cntTab > cntComma && cntTab >= cntSemi) delimiterOpt = '\t';
      else delimiterOpt = ',';
    } catch {}
    try {
      const result = Papa.parse(text, { header: true, skipEmptyLines: true, delimiter: delimiterOpt });
      const parseDate = (v)=>{
        if (v===null || v===undefined) return null;
        const s = String(v).trim(); if (!s) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const m1 = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
        if (m1) { const dd=m1[1].padStart(2,'0'); const mm=m1[2].padStart(2,'0'); const yyyy=m1[3].length===2?('20'+m1[3]):m1[3]; return `${yyyy}-${mm}-${dd}`; }
        const m2 = s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i);
        if (m2) { const dd=m2[1].padStart(2,'0'); const mon=String(m2[2]).toLowerCase().slice(0,3); const map={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'}; const mm=map[mon]||'01'; const y=String(m2[3]); const yyyy=y.length===2?('20'+y):y; return `${yyyy}-${mm}-${dd}`; }
        const n = Number(s); if (!isNaN(n) && s.replace(/\s/g,'')!=='' && n>0) { const base=new Date(Date.UTC(1899,11,30)); base.setUTCDate(base.getUTCDate()+Math.floor(n)); return base.toISOString().slice(0,10); }
        const d = new Date(s); return isNaN(d)?null:d.toISOString().slice(0,10);
      };
      const pickFrom = (h, keys)=>{ for(const k of keys){ const v=h[k]; if(v!==undefined && String(v).trim()!=='') return v; } return ''; };
      for (const r of (result.data||[])) {
        const h = Object.fromEntries(Object.entries(r).map(([k,v])=>[String(k||'').trim().toLowerCase(), v]));
        let name = pickFrom(h, ['nama','name']);
        if (/^\d+$/.test(String(name||'').trim())) name = pickFrom(h,['nama']);
        const document = pickFrom(h, ['dokumen','document']);
        const type = pickFrom(h, ['tipe','type','kategori','jenis','jenis dokumen','kategori dokumen']);
        const institution = pickFrom(h, ['institusi','institution','instansi','lembaga','penerbit']);
        const start_date = parseDate(pickFrom(h, ['start date','tanggal mulai','tanggal berlaku','masa berlaku','mulai berlaku','valid from','berlaku'])||r['start_date']);
        const expired_date = parseDate(pickFrom(h, ['expired date','tanggal kedaluwarsa','masa kedaluwarsa','berakhir','valid until','kedaluwarsa','kedaluarsa','tanggal kedaluarsa','tanggal kadaluarsa','kadaluarsa','tanggal kedai','tgl kedai'])||r['expired_date']);
        const remind_raw = (
          r['REMIND DATE'] || r['Tanggal Pengingat'] || r['TANGGAL PENGINGAT'] || r['Pengingat'] || r['Tanggal Peringat'] || r['TANGGAL PERINGAT'] ||
          h['remind date'] || h['tanggal pengingat'] || h['pengingat'] || h['reminder'] || h['reminder date'] || h['tanggal peringat'] || h['tgl pengingat'] ||
          r['remind_date']
        );
        let remind_date = parseDate(remind_raw);
        if (!remind_date && expired_date) { const exp=new Date(String(expired_date)); if(!isNaN(exp)){ exp.setUTCMonth(exp.getUTCMonth()-6); remind_date=exp.toISOString().slice(0,10);} }
        const statusLabel = r['STATUS'] || r['Status'] || h['status'] || '';
        const status = String(statusLabel||'').toLowerCase().includes('inactive') ? 'Inactive' : 'Active';
        pushRow({ name, document, type, institution, start_date, expired_date, remind_date, status });
      }
    } catch(parseErr){
      return res.status(500).json({ error: 'Failed to parse CSV', detail: parseErr && parseErr.message });
    }
    const [existing] = await pool.query(
      `SELECT LOWER(TRIM(name)) AS name, LOWER(TRIM(document)) AS document, LOWER(TRIM(institution)) AS institution FROM \`${DB_NAME}\`.safety_licenses`
    );
    const existingSet = new Set((existing||[]).map(r=>`${r.name}|${r.document}|${r.institution}`));
    let dupFileTotal = 0, dupDbTotal = 0;
    const counts = new Map();
    rows.forEach(r=>{ if (r._key) counts.set(r._key, (counts.get(r._key)||0)+1 ); });
    const preview = rows.map(r=>{
      const dup_in_file = r._key ? (counts.get(r._key)||0) > 1 : false;
      const dup_in_db = r._key ? existingSet.has(r._key) : false;
      if (dup_in_file) dupFileTotal++;
      if (dup_in_db) dupDbTotal++;
      const invalid = !String(r.name||'').trim() || !String(r.document||'').trim() || !String(r.institution||'').trim();
      const { _key, ...rest } = r;
      return { ...rest, dup_in_file, dup_in_db, invalid };
    });
    res.json({ ok: true, total: preview.length, dup_in_file_total: dupFileTotal, dup_in_db_total: dupDbTotal, preview });
  } catch (e) {
    console.error('Safety import preview error:', e && e.message);
    res.status(500).json({ error: 'Failed to preview import', detail: e && e.message });
  } finally {
    try { if (req.file && req.file.path) fs.unlinkSync(req.file.path); } catch {}
  }
});

app.post('/api/safety/import/commit', async (req, res) => {
  const rows = (req.body && req.body.rows) || [];
  if (!Array.isArray(rows) || rows.length === 0) return res.json({ ok: true, imported: 0 });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let imported = 0;
    for (const r of rows) {
      const parseDate = (v)=>{
        if (v===null || v===undefined) return null;
        const s = String(v).trim(); if (!s) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const m1 = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
        if (m1) {
          const dd = String(m1[1]).padStart(2,'0');
          const mm = String(m1[2]).padStart(2,'0');
          const yyyy = m1[3].length===2 ? ('20'+m1[3]) : m1[3];
          return `${yyyy}-${mm}-${dd}`;
        }
        const m2 = s.match(/^(\d{1,2})[\s\-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/](\d{2,4})$/i);
        if (m2) {
          const dd = String(m2[1]).padStart(2,'0');
          const mon = String(m2[2]).toLowerCase().slice(0,3);
          const map = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
          const mm = map[mon] || '01';
          const y = String(m2[3]);
          const yyyy = y.length===2 ? ('20'+y) : y;
          return `${yyyy}-${mm}-${dd}`;
        }
        const n = Number(s);
        if (!isNaN(n) && s.replace(/\s/g,'')!=='' && n>0) {
          const base = new Date(Date.UTC(1899,11,30));
          base.setUTCDate(base.getUTCDate()+Math.floor(n));
          return base.toISOString().slice(0,10);
        }
        const d = new Date(s);
        if (!isNaN(d)) return d.toISOString().slice(0,10);
        return null;
      };
      const sd = parseDate(r.start_date);
      const ed = parseDate(r.expired_date);
      let rd = parseDate(r.remind_date);
      if (!rd && ed) {
        const exp = new Date(String(ed));
        if (!isNaN(exp)) { exp.setUTCMonth(exp.getUTCMonth()-6); rd = exp.toISOString().slice(0,10); }
      }
      const payload = [
        String(r.name||''), String(r.document||''), String(r.type||''), String(r.institution||''), sd, ed, rd, String(r.status||'Active').toLowerCase()==='inactive'?1:0
      ];
      const [ret] = await conn.query(
        `INSERT INTO \`${DB_NAME}\`.safety_licenses (name, document, type, institution, start_date, expired_date, remind_date, inactive) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        payload
      );
      imported += ret.affectedRows ? 1 : 0;
    }
    await conn.commit();
    res.json({ ok: true, imported });
  } catch (e) {
    await conn.rollback();
    console.error('Safety import commit error:', e && e.message);
    res.status(500).json({ error: 'Failed to commit import', detail: e && e.message });
  } finally { conn.release(); }
});

app.post('/api/safety/deduplicate', async (_req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [dups] = await conn.query(
      `SELECT a.id
       FROM \`${DB_NAME}\`.safety_licenses a
       JOIN \`${DB_NAME}\`.safety_licenses b
         ON LOWER(TRIM(a.name))=LOWER(TRIM(b.name))
        AND LOWER(TRIM(a.document))=LOWER(TRIM(b.document))
        AND LOWER(TRIM(a.type))=LOWER(TRIM(b.type))
        AND LOWER(TRIM(a.institution))=LOWER(TRIM(b.institution))
        AND DATE_FORMAT(a.expired_date,'%Y-%m-%d')=DATE_FORMAT(b.expired_date,'%Y-%m-%d')
        AND a.id>b.id`
    );
    let deleted = 0;
    if (dups.length) {
      const ids = dups.map(r => Number(r.id)).filter(Boolean);
      const chunks = [];
      for (let i=0;i<ids.length;i+=500) chunks.push(ids.slice(i,i+500));
      for (const c of chunks) {
        const placeholders = c.map(()=>'?').join(',');
        const [ret] = await conn.query(`DELETE FROM \`${DB_NAME}\`.safety_licenses WHERE id IN (${placeholders})`, c);
        deleted += ret.affectedRows || 0;
      }
    }
    await conn.commit();
    res.json({ deleted });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: 'Failed to deduplicate' });
  } finally { conn.release(); }
});

app.post('/api/seed-sample', async (req, res) => {
  try {
    const [[{ c: cntCompany }]] = await pool.query(`SELECT COUNT(*) AS c FROM \`${DB_NAME}\`.company_legal_entities`);
    if (Number(cntCompany) === 0) {
      await pool.query(
        `INSERT INTO \`${DB_NAME}\`.company_legal_entities (doc_name, doc_number, category, institution, approval_date, inactive)
         VALUES 
         ('Akta Pendirian Perusahaan', 'AHU-001/2021', 'Akta', 'Kemenkumham', '2021-01-15', 0),
         ('NPWP Badan', '77.888.999.0-123.000', 'Perpajakan', 'Direktorat Jenderal Pajak', '2020-05-20', 0)`
      );
    }

    const [[{ c: cntOperational }]] = await pool.query(`SELECT COUNT(*) AS c FROM \`${DB_NAME}\`.operational_permits`);
    if (Number(cntOperational) === 0) {
      await pool.query(
        `INSERT INTO \`${DB_NAME}\`.operational_permits (doc_name, type, institution, start_date, expired_date, remind_date, inactive)
         VALUES 
         ('Izin Operasional Produksi', 'Operasional', 'Dinas Perindustrian', '2022-07-01', '2025-07-01', '2025-05-01', 0),
         ('Izin Usaha Industri', 'IUI', 'Kementerian Perindustrian', '2023-03-10', '2026-03-10', '2026-01-10', 0)`
      );
    }

    const [[{ c: cntSafety }]] = await pool.query(`SELECT COUNT(*) AS c FROM \`${DB_NAME}\`.safety_licenses`);
    if (Number(cntSafety) === 0) {
      await pool.query(
        `INSERT INTO \`${DB_NAME}\`.safety_licenses (name, document, type, institution, start_date, expired_date, remind_date, inactive)
         VALUES 
         ('Budi Santoso', 'Lisensi K3 Umum', 'K3 Umum', 'Kementerian Ketenagakerjaan', '2022-01-01', '2025-01-01', '2024-07-01', 0),
         ('Siti Aminah', 'Lisensi Operator Forklift', 'Operator', 'Disnaker', '2021-09-15', '2024-09-15', '2024-03-15', 0)`
      );
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('Seed sample error:', e && e.message);
    res.status(500).json({ error: 'Failed to seed sample data' });
  }
});

let _dbInitStarted = false;
async function startDbWithRetry() {
  if (_dbInitStarted) return;
  _dbInitStarted = true;
  const retryMs = 5000;
  while (true) {
    try {
      await initDb();
      console.log('Database initialized');
      break;
    } catch (e) {
      console.warn('Database init failed:', e && e.message);
      await new Promise(r => setTimeout(r, retryMs));
    }
  }
}
startDbWithRetry();
app.listen(PORT, () => {
  console.log(`Regulatory UI running at http://localhost:${PORT}/`);
});
