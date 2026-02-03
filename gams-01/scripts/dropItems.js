const mysql = require('mysql2/promise');
require('dotenv').config();
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ga_system'
};

async function dropAndRecreateItemsTable() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {

    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('DROP TABLE IF EXISTS items');
    
    await connection.execute(`
      CREATE TABLE items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_id VARCHAR(20) UNIQUE,
        item_name VARCHAR(255) NOT NULL,
        detail TEXT,
        unit VARCHAR(50) DEFAULT 'pcs',
        stock INT DEFAULT 0,
        min_stock INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
  } catch (error) {
  } finally {
    await connection.end();
  }
}

dropAndRecreateItemsTable();