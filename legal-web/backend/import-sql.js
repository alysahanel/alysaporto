import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const DB_HOST = process.env.DB_HOST || 'localhost';
  const DB_USER = process.env.DB_USER || 'root';
  const DB_PASS = process.env.DB_PASS || '';
  const DB_NAME = process.env.DB_NAME || 'legal_web';
  const ports = [Number(process.env.DB_PORT || 3307), 3306];

  const sqlPath = path.join(__dirname, '..', 'legal_web.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('File SQL tidak ditemukan:', sqlPath);
    process.exit(1);
  }

  let sqlRaw = fs.readFileSync(sqlPath, 'utf8');
  sqlRaw = sqlRaw.replace(/^\uFEFF/, '');
  sqlRaw = sqlRaw.replace(/\/\*[\s\S]*?\*\//g, '');
  const statements = [];
  {
    const lines = sqlRaw.split(/\r?\n/);
    let buf = '';
    for (let line of lines) {
      const trimmed = String(line).trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('--')) continue;
      if (/^SET\s+/i.test(trimmed)) continue;
      if (/^START\s+TRANSACTION/i.test(trimmed)) continue;
      if (/^COMMIT/i.test(trimmed)) continue;
      buf += line + '\n';
      if (/;\s*$/.test(trimmed)) {
        statements.push(buf);
        buf = '';
      }
    }
    if (buf.trim()) statements.push(buf);
  }

  let conn;
  let usedPort = null;
  let lastErr = null;
  for (const p of ports) {
    try {
      conn = await mysql.createConnection({
        host: DB_HOST,
        port: p,
        user: DB_USER,
        password: DB_PASS,
        multipleStatements: true,
        connectTimeout: 60000,
      });
      usedPort = p;
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!conn) {
    console.error('Tidak bisa konek ke MySQL:', lastErr && lastErr.message);
    process.exit(1);
  }
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    await conn.query(`USE \`${DB_NAME}\``);

    for (let i = 0; i < statements.length; i++) {
      const raw = statements[i];
      const s = String(raw || '').trim();
      if (!s || s === ';') continue;
      try {
        await conn.query(s);
      } catch (e) {
        const preview = s.length > 200 ? s.slice(0,200) + '...' : s;
        console.error('Error eksekusi statement ke-', i+1, ':', e && e.message);
        console.error('Potongan statement:', preview);
        throw e;
      }
    }
    console.log('Import SQL selesai untuk database:', DB_NAME, 'di port', usedPort);
  } catch (e) {
    console.error('Gagal import SQL:', e && e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
