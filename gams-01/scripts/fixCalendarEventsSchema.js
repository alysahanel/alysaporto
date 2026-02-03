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

    console.log('🔧 Connecting to DB...', config.database);
    connection = await mysql.createConnection(config);

    // Ensure calendar_events table exists
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        event_date DATE NOT NULL,
        event_time TIME NULL,
        location VARCHAR(255) NULL,
        created_by INT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    console.log('➡️  Ensuring columns on calendar_events...');

    // Add event_time column if missing
    try {
      await connection.execute('ALTER TABLE calendar_events ADD COLUMN event_time TIME NULL');
      console.log('✅ Column event_time added');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  Column event_time already exists');
      } else {
        throw err;
      }
    }

    // Add location column if missing
    try {
      await connection.execute('ALTER TABLE calendar_events ADD COLUMN location VARCHAR(255) NULL');
      console.log('✅ Column location added');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  Column location already exists');
      } else {
        throw err;
      }
    }

    console.log('✅ Calendar events schema fixed.');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run();