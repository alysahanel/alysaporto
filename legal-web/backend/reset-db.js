import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

async function run() {
  const DB_HOST = process.env.DB_HOST || 'localhost';
  const DB_USER = process.env.DB_USER || 'root';
  const DB_PASS = process.env.DB_PASS || '';
  const ports = [Number(process.env.DB_PORT || 3307), 3306];

  let conn;
  for (const p of ports) {
    try {
      conn = await mysql.createConnection({
        host: DB_HOST,
        port: p,
        user: DB_USER,
        password: DB_PASS,
        connectTimeout: 10000,
      });
      console.log('Connected to MySQL on port', p);
      break;
    } catch (e) {
      // ignore
    }
  }

  if (!conn) {
    console.error('Could not connect to MySQL');
    process.exit(1);
  }

  try {
    console.log('Dropping database legal_web...');
    await conn.query('DROP DATABASE IF EXISTS legal_web');
    console.log('Database dropped.');
  } catch (e) {
    console.error('Error dropping database:', e.message);
  } finally {
    await conn.end();
  }
}

run();
