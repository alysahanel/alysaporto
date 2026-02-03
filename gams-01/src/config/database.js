const mysql = require('mysql2/promise');
require('dotenv').config();

// Toggle for Mock Database
const USE_MOCK_DB = process.env.USE_MOCK_DB !== 'false'; // Default to true (Mock), set to 'false' to use Real DB

if (USE_MOCK_DB) {
    console.log('--- RUNNING IN MOCK DATABASE MODE ---');
    const { pool } = require('./mockDatabase');
    async function testConnection() {
        console.log('Mock Database connection successful');
        return true;
    }
    module.exports = { pool, testConnection };
} else {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ga_system',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    async function testConnection() {
      try {
        const connection = await pool.getConnection();
        console.log('Database connection successful');
        connection.release();
        return true;
      } catch (error) {
        console.error('Database connection failed:', error);
        return false;
      }
    }

    module.exports = { pool, testConnection };
}
