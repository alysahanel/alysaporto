const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ga_system'
};

async function fixDatabaseSchema() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔨 Adding missing fields to requests table...');
    
    // Add missing fields to requests table one by one
    const requestFields = [
      "ADD COLUMN purpose TEXT AFTER qty",
      "ADD COLUMN priority ENUM('low','medium','high') DEFAULT 'medium' AFTER purpose",
      "ADD COLUMN approved_by INT AFTER status",
      "ADD COLUMN approved_at TIMESTAMP NULL AFTER approved_by",
      "ADD COLUMN rejected_reason TEXT AFTER approved_at",
      "ADD COLUMN delivery_notes TEXT AFTER receiver",
      "ADD COLUMN urgency_level ENUM('normal','urgent','critical') DEFAULT 'normal' AFTER priority"
    ];
    
    for (const field of requestFields) {
      try {
        await connection.execute(`ALTER TABLE requests ${field}`);
        console.log(`✅ Added field: ${field.split(' ')[2]}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠️  Field already exists: ${field.split(' ')[2]}`);
        } else {
          console.error(`❌ Error adding field: ${error.message}`);
        }
      }
    }
    
    // Add foreign key for approved_by
    try {
      await connection.execute(`ALTER TABLE requests ADD FOREIGN KEY fk_approved_by (approved_by) REFERENCES users(id) ON DELETE SET NULL`);
      console.log('✅ Added foreign key for approved_by');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  Foreign key already exists for approved_by');
      } else {
        console.error(`❌ Error adding foreign key: ${error.message}`);
      }
    }
    
    console.log('📊 Creating item_categories table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS item_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('📦 Adding category fields to items table...');
    const itemFields = [
      "ADD COLUMN category_id INT AFTER detail",
      "ADD COLUMN supplier VARCHAR(100) AFTER min_stock",
      "ADD COLUMN price DECIMAL(10,2) DEFAULT 0.00 AFTER supplier",
      "ADD COLUMN location VARCHAR(100) AFTER price",
      "ADD COLUMN is_deleted TINYINT(1) DEFAULT 0 AFTER location",
      "ADD COLUMN deleted_at TIMESTAMP NULL AFTER is_deleted"
    ];
    
    for (const field of itemFields) {
      try {
        await connection.execute(`ALTER TABLE items ${field}`);
        console.log(`✅ Added field: ${field.split(' ')[2]}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠️  Field already exists: ${field.split(' ')[2]}`);
        } else {
          console.error(`❌ Error adding field: ${error.message}`);
        }
      }
    }
    
    // Add foreign key for category_id
    try {
      await connection.execute(`ALTER TABLE items ADD FOREIGN KEY fk_item_category (category_id) REFERENCES item_categories(id) ON DELETE SET NULL`);
      console.log('✅ Added foreign key for category_id');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  Foreign key already exists for category_id');
      } else {
        console.error(`❌ Error adding foreign key: ${error.message}`);
      }
    }
    
    console.log('📝 Inserting item categories...');
    const categories = [
      ['Office Supplies', 'General office supplies and stationery'],
      ['IT Equipment', 'Computer hardware and IT accessories'],
      ['Safety Equipment', 'Personal protective equipment and safety gear'],
      ['Cleaning Supplies', 'Cleaning materials and maintenance supplies'],
      ['Furniture', 'Office furniture and fixtures'],
      ['Electrical', 'Electrical components and tools'],
      ['Maintenance Tools', 'Tools and equipment for maintenance work'],
      ['Medical Supplies', 'First aid and medical equipment'],
      ['Communication', 'Communication devices and accessories'],
      ['Consumables', 'Consumable items and supplies']
    ];
    
    for (const [name, desc] of categories) {
      try {
        await connection.execute(
          'INSERT IGNORE INTO item_categories (category_name, description) VALUES (?, ?)',
          [name, desc]
        );
      } catch (error) {
        console.error(`Error inserting category ${name}:`, error.message);
      }
    }
    
    console.log('🏷️  Updating existing items with categories...');
    const categoryUpdates = [
      [1, ['kertas', 'pulpen', 'spidol', 'stapler', 'amplop', 'kop']],
      [2, ['mouse', 'keyboard', 'kabel', 'tinta', 'hdmi', 'usb']],
      [3, ['helm', 'masker', 'sarung', 'safety', 'pelindung']],
      [4, ['tissue', 'sabun', 'pembersih', 'deterjen']],
      [7, ['obeng', 'tang', 'WD-40', 'kunci', 'palu']]
    ];
    
    for (const [categoryId, keywords] of categoryUpdates) {
      for (const keyword of keywords) {
        try {
          await connection.execute(
            `UPDATE items SET category_id = ? WHERE item_name LIKE ? AND category_id IS NULL`,
            [categoryId, `%${keyword}%`]
          );
        } catch (error) {
          console.error(`Error updating category for ${keyword}:`, error.message);
        }
      }
    }
    
    console.log('📊 Creating notifications table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('info','warning','success','error') DEFAULT 'info',
        is_read TINYINT(1) DEFAULT 0,
        related_table VARCHAR(50),
        related_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log('📈 Creating request approval history table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS request_approval_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        action ENUM('submitted','approved','rejected','delivered','cancelled') NOT NULL,
        performed_by INT NOT NULL,
        notes TEXT,
        previous_status VARCHAR(20),
        new_status VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
        FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log('🚨 Creating stock alerts table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS stock_alerts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_id INT NOT NULL,
        alert_type ENUM('low_stock','out_of_stock','expired') NOT NULL,
        threshold_value INT,
        is_active TINYINT(1) DEFAULT 1,
        last_triggered TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      )
    `);
    
    console.log('🔐 Creating user sessions table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        session_token VARCHAR(255) NOT NULL UNIQUE,
        ip_address VARCHAR(45),
        user_agent TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log('📊 Adding audit fields to stock_transactions...');
    const stockFields = [
      "ADD COLUMN notes TEXT AFTER receiver",
      "ADD COLUMN reference_number VARCHAR(50) AFTER notes",
      "ADD COLUMN approved_by INT AFTER reference_number"
    ];
    
    for (const field of stockFields) {
      try {
        await connection.execute(`ALTER TABLE stock_transactions ${field}`);
        console.log(`✅ Added field: ${field.split(' ')[2]}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠️  Field already exists: ${field.split(' ')[2]}`);
        } else {
          console.error(`❌ Error adding field: ${error.message}`);
        }
      }
    }
    
    // Add foreign key for stock_transactions approved_by
    try {
      await connection.execute(`ALTER TABLE stock_transactions ADD FOREIGN KEY fk_stock_approved_by (approved_by) REFERENCES users(id) ON DELETE SET NULL`);
      console.log('✅ Added foreign key for stock approved_by');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  Foreign key already exists for stock approved_by');
      } else {
        console.error(`❌ Error adding foreign key: ${error.message}`);
      }
    }
    
    console.log('📈 Creating performance indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)',
      'CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_requests_req_date ON requests(req_date)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)',
      'CREATE INDEX IF NOT EXISTS idx_stock_transactions_item_id ON stock_transactions(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_stock_transactions_type ON stock_transactions(type)',
      'CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id)',
      'CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date)'
    ];
    
    for (const index of indexes) {
      try {
        await connection.execute(index);
        console.log(`✅ Created index: ${index.split(' ')[5]}`);
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`⚠️  Index already exists: ${index.split(' ')[5]}`);
        } else {
          console.error(`❌ Error creating index: ${error.message}`);
        }
      }
    }
    
    console.log('\n🎉 Database schema enhancement completed successfully!');
    console.log('\n📊 Enhanced features:');
    console.log('  ✅ Request approval workflow with tracking');
    console.log('  ✅ Notification system for real-time updates');
    console.log('  ✅ Item categorization and better organization');
    console.log('  ✅ Stock alerts and monitoring');
    console.log('  ✅ User session management');
    console.log('  ✅ Audit trails for all transactions');
    console.log('  ✅ Performance indexes for faster queries');
    console.log('  ✅ Enhanced data relationships');
    
  } catch (error) {
    console.error('❌ Database schema enhancement failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixDatabaseSchema();