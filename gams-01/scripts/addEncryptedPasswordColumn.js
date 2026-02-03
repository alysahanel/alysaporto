const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  let connection;
  try {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ga_system',
    };

    connection = await mysql.createConnection(config);
    try {
      await connection.execute(
        'ALTER TABLE users ADD COLUMN encrypted_password TEXT NULL'
      );
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
      } else {
        throw err;
      }
    }
  } catch (error) {
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run();