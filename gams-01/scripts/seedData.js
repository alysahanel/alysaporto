const mysql = require('mysql2/promise');
require('dotenv').config();

// Konfigurasi database
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ga_system'
};

// Sample items data
const itemsData = [
  { name: 'Kertas HVS A4 75 gr', category: 'Kertas', unit: 'rim', min_stock: 10 },
  { name: 'Baterai Alkaline A3', category: 'Elektronik', unit: 'pcs', min_stock: 20 },
  { name: 'PP Pocket Bambi', category: 'Alat Tulis', unit: 'pcs', min_stock: 50 },
  { name: 'Kertas HVS A3', category: 'Kertas', unit: 'rim', min_stock: 5 },
  { name: 'Tatakan Mouse', category: 'Aksesoris', unit: 'pcs', min_stock: 10 },
  { name: 'Container Box', category: 'Penyimpanan', unit: 'pcs', min_stock: 5 },
  { name: 'Lakban Bening Besar', category: 'Alat Tulis', unit: 'roll', min_stock: 10 },
  { name: 'Keyboard Wireless (bluetooth) Logitech', category: 'Elektronik', unit: 'pcs', min_stock: 2 },
  { name: 'Mouse Wireless (bluetooth) Logitech M240', category: 'Elektronik', unit: 'pcs', min_stock: 5 },
  { name: 'Post It Plastic', category: 'Alat Tulis', unit: 'pack', min_stock: 20 },
  { name: 'Tinta Isi Ulang (Tinta Trodat 7081 Blue)', category: 'Alat Tulis', unit: 'botol', min_stock: 5 },
  { name: 'Paper Clips No.2', category: 'Alat Tulis', unit: 'box', min_stock: 10 },
  { name: 'Binder Clip No.105', category: 'Alat Tulis', unit: 'box', min_stock: 10 },
  { name: 'Tinta Stample Permanent (Nobu Ink Biru)', category: 'Alat Tulis', unit: 'botol', min_stock: 5 },
  { name: 'Spidol Merah', category: 'Alat Tulis', unit: 'pcs', min_stock: 10 },
  { name: 'Kenko Pulpen Retrocable Gel Pen', category: 'Alat Tulis', unit: 'pcs', min_stock: 20 },
  { name: 'Pencabut Stapler', category: 'Alat Tulis', unit: 'pcs', min_stock: 5 },
  { name: 'Tempat Pensil Clip Meja', category: 'Alat Tulis', unit: 'pcs', min_stock: 5 },
  { name: 'Cable HDMI 1,5 M Vention', category: 'Elektronik', unit: 'pcs', min_stock: 3 },
  { name: 'Clear Holder', category: 'Alat Tulis', unit: 'pcs', min_stock: 50 },
  { name: 'Kop Surat', category: 'Kertas', unit: 'rim', min_stock: 5 },
  { name: 'Glue Stick Kenko Ukuran 25 gr', category: 'Alat Tulis', unit: 'pcs', min_stock: 10 },
  { name: 'Double Tape Foam 3mm - 18mm', category: 'Alat Tulis', unit: 'roll', min_stock: 5 },
  { name: 'Papan Ujian / Papan Jalan Model Kayu', category: 'Peralatan', unit: 'pcs', min_stock: 2 },
  { name: 'Kalung name tag', category: 'Aksesoris', unit: 'pcs', min_stock: 20 },
  { name: 'Kertas Concorde A4 90 gr', category: 'Kertas', unit: 'rim', min_stock: 10 },
  { name: 'Bambi A4', category: 'Alat Tulis', unit: 'pcs', min_stock: 100 },
  { name: 'Bambi F4', category: 'Alat Tulis', unit: 'pcs', min_stock: 100 },
  { name: 'Roll Kabel Gulung', category: 'Elektronik', unit: 'pcs', min_stock: 3 },
  { name: 'Acco Paper Fastener JENIA Putih', category: 'Alat Tulis', unit: 'box', min_stock: 10 },
  { name: 'Joyko Stamp All Color', category: 'Alat Tulis', unit: 'pcs', min_stock: 5 },
  { name: 'Staples Tembak Banner', category: 'Alat Tulis', unit: 'box', min_stock: 5 },
  { name: 'Map Coklat A4', category: 'Alat Tulis', unit: 'pcs', min_stock: 20 },
  { name: 'Card Case A4', category: 'Alat Tulis', unit: 'pcs', min_stock: 10 },
  { name: 'Punch Blade Heavy Duty Punch (2 Hole) - HDP 260 N', category: 'Peralatan', unit: 'pcs', min_stock: 2 },
  { name: 'Isi Staples Tembak 13/4-6-8 Joyko', category: 'Alat Tulis', unit: 'box', min_stock: 10 },
  { name: 'Pixma Canon (790 = C)', category: 'Elektronik', unit: 'pcs', min_stock: 5 },
  { name: 'Papan Jalan', category: 'Peralatan', unit: 'pcs', min_stock: 2 },
  { name: 'Lakban Anti Slip Tonata 5 cm x 5 meter', category: 'Peralatan', unit: 'roll', min_stock: 3 },
  { name: 'Lakban Vynil Lantai Kuning Hitam 33 meter', category: 'Peralatan', unit: 'roll', min_stock: 2 },
  { name: 'Police Line Safety', category: 'Peralatan', unit: 'roll', min_stock: 2 },
  { name: 'Type C to RJ45 Adapter', category: 'Elektronik', unit: 'pcs', min_stock: 3 },
  { name: 'Paket Alat Lem Tembak Glue Gun Joyko 60 watt', category: 'Peralatan', unit: 'set', min_stock: 2 },
  { name: 'Joyko Tape Cutter TD - 3', category: 'Alat Tulis', unit: 'pcs', min_stock: 5 }
];

// Sample users data
const usersData = [
  {
    username: 'admin',
    password: 'admin123', // Will be hashed
    email: 'admin@ga-system.com',
    full_name: 'System Administrator',
    role: 'admin',
    department: 'IT'
  },
  {
    username: 'cs1',
    password: 'cs123',
    email: 'cs1@ga-system.com',
    full_name: 'Customer Service 1',
    role: 'cs',
    department: 'General Affairs'
  },
  {
    username: 'user1',
    password: 'user123',
    email: 'user1@ga-system.com',
    full_name: 'Regular User 1',
    role: 'user',
    department: 'Finance'
  }
];

async function createTables() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role ENUM('admin', 'cs', 'user') DEFAULT 'user',
        department VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create items table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS items (
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

    // Create requests table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id VARCHAR(50) UNIQUE NOT NULL,
        user_id INT NOT NULL,
        item_id INT NOT NULL,
        quantity INT NOT NULL,
        purpose TEXT,
        status ENUM('pending', 'approved', 'rejected', 'delivered') DEFAULT 'pending',
        approved_by INT NULL,
        approved_at TIMESTAMP NULL,
        delivery_date DATE NULL,
        delivery_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (item_id) REFERENCES items(id),
        FOREIGN KEY (approved_by) REFERENCES users(id)
      )
    `);

    // Create calendar_events table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        event_date DATE NOT NULL,
        start_time TIME,
        end_time TIME,
        location VARCHAR(255),
        created_by INT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Create stock_transactions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS stock_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_id INT NOT NULL,
        transaction_type ENUM('in', 'out') NOT NULL,
        quantity INT NOT NULL,
        reference_type ENUM('purchase', 'request', 'adjustment') NOT NULL,
        reference_id INT,
        notes TEXT,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    console.log('✅ Tables created successfully');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
  } finally {
    await connection.end();
  }
}

async function seedUsers() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    const bcrypt = require('bcrypt');
    
    for (const user of usersData) {
      // Hash password
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      await connection.execute(
        `INSERT IGNORE INTO users (username, password, email, full_name, role, department) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [user.username, hashedPassword, user.email, user.full_name, user.role, user.department]
      );
    }
    
    console.log('✅ Users seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding users:', error);
  } finally {
    await connection.end();
  }
}

async function seedItems() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    for (let i = 0; i < itemsData.length; i++) {
      const item = itemsData[i];
      const itemId = `ITM${String(i + 1).padStart(3, '0')}`;
      await connection.execute(
        `INSERT IGNORE INTO items (item_id, item_name, detail, unit, min_stock, stock) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [itemId, item.name, item.category, item.unit, item.min_stock, Math.floor(Math.random() * 100) + 10]
      );
    }
    
    console.log('✅ Items seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding items:', error);
  } finally {
    await connection.end();
  }
}

async function main() {
  console.log('🚀 Starting database seeding...');
  
  try {
    await createTables();
    await seedUsers();
    await seedItems();
    
    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Default Login Credentials:');
    console.log('Admin: username=admin, password=admin123');
    console.log('CS: username=cs1, password=cs123');
    console.log('User: username=user1, password=user123');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  }
}

main();