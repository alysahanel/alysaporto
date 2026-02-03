const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ga_system'
};
const realisticUsers = [
  {
    username: 'admin_ga',
    password: 'admin123',
    email: 'admin.ga@company.com',
    full_name: 'Budi Santoso',
    role: 'admin',
    department: 'GA'
  },
  {
    username: 'cs_warehouse',
    password: 'cs123',
    email: 'cs.warehouse@company.com',
    full_name: 'Siti Nurhaliza',
    role: 'cs',
    department: 'WH'
  },
  {
    username: 'cs_ga',
    password: 'cs123',
    email: 'cs.ga@company.com',
    full_name: 'Ahmad Fauzi',
    role: 'cs',
    department: 'GA'
  },

  {
    username: 'user_finance',
    password: 'user123',
    email: 'finance.staff@company.com',
    full_name: 'Dewi Sartika',
    role: 'user',
    department: 'FAT'
  },
  {
    username: 'user_production',
    password: 'user123',
    email: 'production.staff@company.com',
    full_name: 'Joko Widodo',
    role: 'user',
    department: 'PROD'
  },
  {
    username: 'user_hr',
    password: 'user123',
    email: 'hr.staff@company.com',
    full_name: 'Maya Sari',
    role: 'user',
    department: 'HRGA'
  },
  {
    username: 'user_it',
    password: 'user123',
    email: 'it.staff@company.com',
    full_name: 'Rizki Pratama',
    role: 'user',
    department: 'IT'
  },
  {
    username: 'user_maintenance',
    password: 'user123',
    email: 'maintenance.staff@company.com',
    full_name: 'Agus Setiawan',
    role: 'user',
    department: 'MAINT'
  },
  {
    username: 'user_qa',
    password: 'user123',
    email: 'qa.staff@company.com',
    full_name: 'Linda Wijaya',
    role: 'user',
    department: 'QA'
  },
  {
    username: 'user_purchasing',
    password: 'user123',
    email: 'purchasing.staff@company.com',
    full_name: 'Bambang Sutrisno',
    role: 'user',
    department: 'PURCH'
  }
];

const realisticItems = [
  { item_id: 'OFF001', name: 'Kertas HVS A4 75gr', detail: 'Kertas fotokopi putih ukuran A4', unit: 'rim', min_stock: 20, stock: 45 },
  { item_id: 'OFF002', name: 'Pulpen Pilot G2 0.7mm', detail: 'Pulpen gel tinta hitam', unit: 'pcs', min_stock: 50, stock: 120 },
  { item_id: 'OFF003', name: 'Pensil 2B Faber Castell', detail: 'Pensil kayu grade 2B', unit: 'pcs', min_stock: 30, stock: 75 },
  { item_id: 'OFF004', name: 'Stapler Kenko HD-10', detail: 'Stapler kecil untuk kertas', unit: 'pcs', min_stock: 5, stock: 12 },
  { item_id: 'OFF005', name: 'Isi Staples No.10', detail: 'Isi stapler ukuran standar', unit: 'box', min_stock: 10, stock: 25 },
  { item_id: 'IT001', name: 'Mouse Wireless Logitech M240', detail: 'Mouse nirkabel untuk komputer', unit: 'pcs', min_stock: 5, stock: 8 },
  { item_id: 'IT002', name: 'Keyboard USB Standard', detail: 'Keyboard kabel USB standar', unit: 'pcs', min_stock: 3, stock: 6 },
  { item_id: 'IT003', name: 'Kabel HDMI 2m', detail: 'Kabel HDMI panjang 2 meter', unit: 'pcs', min_stock: 5, stock: 10 },
  { item_id: 'IT004', name: 'USB Flash Drive 16GB', detail: 'USB drive kapasitas 16GB', unit: 'pcs', min_stock: 10, stock: 18 },
  { item_id: 'IT005', name: 'Tinta Printer Canon PG-40', detail: 'Cartridge tinta hitam Canon', unit: 'pcs', min_stock: 5, stock: 8 },
  { item_id: 'CLN001', name: 'Tissue Toilet Nice', detail: 'Tissue toilet 2 ply', unit: 'pack', min_stock: 20, stock: 35 },
  { item_id: 'CLN002', name: 'Sabun Cuci Tangan Lifebuoy', detail: 'Sabun cair antibakteri', unit: 'botol', min_stock: 10, stock: 15 },
  { item_id: 'CLN003', name: 'Pembersih Lantai Wipol', detail: 'Cairan pembersih lantai', unit: 'botol', min_stock: 5, stock: 12 },
  { item_id: 'CLN004', name: 'Sapu Ijuk', detail: 'Sapu dari ijuk alami', unit: 'pcs', min_stock: 3, stock: 5 },
  { item_id: 'SAF001', name: 'Masker N95', detail: 'Masker pelindung debu dan partikel', unit: 'box', min_stock: 10, stock: 25 },
  { item_id: 'SAF002', name: 'Sarung Tangan Karet', detail: 'Sarung tangan latex disposable', unit: 'box', min_stock: 5, stock: 15 },
  { item_id: 'SAF003', name: 'Helm Safety Kuning', detail: 'Helm keselamatan kerja', unit: 'pcs', min_stock: 10, stock: 18 },
  { item_id: 'SAF004', name: 'Sepatu Safety', detail: 'Sepatu keselamatan kerja', unit: 'pasang', min_stock: 5, stock: 8 },
  { item_id: 'MNT001', name: 'Obeng Set Phillips', detail: 'Set obeng plus berbagai ukuran', unit: 'set', min_stock: 2, stock: 4 },
  { item_id: 'MNT002', name: 'Tang Kombinasi 8 inch', detail: 'Tang serbaguna ukuran 8 inch', unit: 'pcs', min_stock: 3, stock: 6 },
  { item_id: 'MNT003', name: 'Kunci Pas Set', detail: 'Set kunci pas berbagai ukuran', unit: 'set', min_stock: 2, stock: 3 },
  { item_id: 'MNT004', name: 'WD-40 Spray', detail: 'Pelumas anti karat semprot', unit: 'botol', min_stock: 5, stock: 8 }
];
const realisticCalendarEvents = [
  {
    title: 'Monthly Safety Meeting',
    description: 'Rapat bulanan keselamatan kerja dengan semua departemen',
    event_date: '2024-02-05',
    event_time: '09:00:00'
  },
  {
    title: 'Office Supplies Inventory Check',
    description: 'Pengecekan stok alat tulis kantor',
    event_date: '2024-02-01',
    event_time: '14:00:00'
  },
  {
    title: 'Equipment Maintenance Schedule',
    description: 'Jadwal maintenance peralatan kantor',
    event_date: '2024-02-10',
    event_time: '08:00:00'
  },
  {
    title: 'New Employee Orientation',
    description: 'Orientasi karyawan baru - persiapan supplies',
    event_date: '2024-02-15',
    event_time: '10:00:00'
  },
  {
    title: 'Quarterly Budget Review',
    description: 'Review budget quarterly untuk procurement',
    event_date: '2024-02-28',
    event_time: '13:00:00'
  }
];

async function clearExistingData() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('🧹 Clearing existing data...');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('DELETE FROM stock_transactions');
    await connection.execute('DELETE FROM calendar_events');
    await connection.execute('DELETE FROM requests');
    await connection.execute('DELETE FROM items');
    await connection.execute('DELETE FROM users WHERE username != "admin" AND username != "cs1" AND username != "user1"');
    await connection.execute('ALTER TABLE stock_transactions AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE calendar_events AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE requests AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE items AUTO_INCREMENT = 1');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
  } catch (error) {
  } finally {
    await connection.end();
  }
}

async function seedRealisticUsers() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('👥 Seeding realistic users...');
    
    for (const user of realisticUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      await connection.execute(
        `INSERT IGNORE INTO users (username, password, email, full_name, role, department, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [user.username, hashedPassword, user.email, user.full_name, user.role, user.department]
      );
    }
    
  } catch (error) {
  } finally {
    await connection.end();
  }
}

async function seedRealisticItems() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    for (const item of realisticItems) {
      await connection.execute(
        `INSERT IGNORE INTO items (item_id, item_name, detail, unit, min_stock, stock) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [item.item_id, item.name, item.detail, item.unit, item.min_stock, item.stock]
      );
    } 
  } catch (error) {
  } finally {
    await connection.end();
  }
}

async function seedRealisticRequests() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    const [users] = await connection.execute('SELECT id, username FROM users ORDER BY id');
    const [items] = await connection.execute('SELECT id, item_id FROM items ORDER BY id');
    const userMap = {};
    users.forEach(user => {
      userMap[user.username] = user.id;
    });
    const requests = [
      {
        request_id: 'REQ2024001',
        user_id: userMap['user_finance'],
        item_id: 1,
        quantity: 5,
        purpose: 'Untuk mencetak laporan keuangan bulanan',
        status: 'approved',
        req_date: '2024-01-15',
        delivery_date: '2024-01-16'
      },
      {
        request_id: 'REQ2024002',
        user_id: userMap['user_finance'],
        item_id: 2,
        quantity: 10,
        purpose: 'Kebutuhan alat tulis tim finance',
        status: 'delivered',
        req_date: '2024-01-10',
        delivery_date: '2024-01-12'
      },
      {
        request_id: 'REQ2024003',
        user_id: userMap['user_production'],
        item_id: 17,  
        quantity: 3,
        purpose: 'Penggantian helm safety yang rusak',
        status: 'approved',
        req_date: '2024-01-18',
        delivery_date: '2024-01-20'
      },
      {
        request_id: 'REQ2024004',
        user_id: userMap['user_production'],
        item_id: 15,
        quantity: 2,
        purpose: 'Kebutuhan APD untuk area produksi',
        status: 'pending',
        req_date: '2024-01-22'
      },
      {
        request_id: 'REQ2024005',
        user_id: userMap['user_it'],
        item_id: 6,
        quantity: 2,
        purpose: 'Penggantian mouse yang rusak',
        status: 'approved',
        req_date: '2024-01-20',
        delivery_date: '2024-01-21'
      },
      {
        request_id: 'REQ2024006',
        user_id: userMap['user_it'],
        item_id: 10,
        quantity: 4,
        purpose: 'Stok tinta printer untuk bulan ini',
        status: 'delivered',
        req_date: '2024-01-12',
        delivery_date: '2024-01-14'
      },

      {
        request_id: 'REQ2024007',
        user_id: userMap['user_maintenance'],
        item_id: 19,
        quantity: 1,
        purpose: 'Alat maintenance untuk perbaikan mesin',
        status: 'approved',
        req_date: '2024-01-19',
        delivery_date: '2024-01-22'
      },
      {
        request_id: 'REQ2024008',
        user_id: userMap['user_maintenance'],
        item_id: 22,
        quantity: 3,
        purpose: 'Pelumas untuk maintenance rutin',
        status: 'pending',
        req_date: '2024-01-23'
      },
      {
        request_id: 'REQ2024009',
        user_id: userMap['user_hr'],
        item_id: 11,
        quantity: 10,
        purpose: 'Kebutuhan toilet kantor bulan ini',
        status: 'delivered',
        req_date: '2024-01-08',
        delivery_date: '2024-01-10'
      },
      {
        request_id: 'REQ2024010',
        user_id: userMap['user_hr'],
        item_id: 12,
        quantity: 5,
        purpose: 'Refill sabun untuk area umum',
        status: 'approved',
        req_date: '2024-01-21',
        delivery_date: '2024-01-23'
      }
    ];
    
    for (const request of requests) {
      if (request.user_id) { 
        await connection.execute(
          `INSERT IGNORE INTO requests (request_id, user_id, item_id, quantity, purpose, status, req_date, delivery_date) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [request.request_id, request.user_id, request.item_id, request.quantity, request.purpose, request.status, request.req_date, request.delivery_date]
        );
      }
    }
  } catch (error) {
  } finally {
    await connection.end();
  }
}

async function seedRealisticCalendarEvents() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    const [adminUsers] = await connection.execute(`SELECT id FROM users WHERE role IN ('admin', 'cs') ORDER BY id LIMIT 3`);
    for (let i = 0; i < realisticCalendarEvents.length; i++) {
      const event = realisticCalendarEvents[i];
      const createdBy = adminUsers[i % adminUsers.length].id;
      
      await connection.execute(
        `INSERT IGNORE INTO calendar_events (title, description, event_date, event_time, created_by) 
         VALUES (?, ?, ?, ?, ?)`,
        [event.title, event.description, event.event_date, event.event_time, createdBy]
      );
    }
  } catch (error) {
  } finally {
    await connection.end();
  }
}

async function seedRealisticStockTransactions() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    const [adminUsers] = await connection.execute(`SELECT id FROM users WHERE role IN ('admin', 'cs')`);
    const adminId = adminUsers[0].id;
    const csId = adminUsers[1] ? adminUsers[1].id : adminId;
    
    const stockTransactions = [
      {
        transaction_id: 'TXN2024001',
        item_id: 1,
        qty: 50,
        type: 'in',
        process: 'Purchase Order',
        process_date: '2024-01-05',
        department: 'GA',
        pic: 'Budi Santoso',
        created_by: adminId
      },
      {
        transaction_id: 'TXN2024002',
        item_id: 2,
        qty: 100,
        type: 'in',
        process: 'Purchase Order',
        process_date: '2024-01-05',
        department: 'GA',
        pic: 'Budi Santoso',
        created_by: adminId
      },
      {
        transaction_id: 'TXN2024003',
        item_id: 1,
        qty: 5,
        type: 'out',
        process: 'Request Fulfillment',
        process_date: '2024-01-16',
        department: 'WH',
        pic: 'Siti Nurhaliza',
        req_department: 'FAT',
        receiver: 'Dewi Sartika',
        created_by: csId
      },
      {
        transaction_id: 'TXN2024004',
        item_id: 2,
        qty: 10,
        type: 'out',
        process: 'Request Fulfillment',
        process_date: '2024-01-12',
        department: 'WH',
        pic: 'Siti Nurhaliza',
        req_department: 'FAT',
        receiver: 'Dewi Sartika',
        created_by: csId
      }
    ];
    
    for (const transaction of stockTransactions) {
      await connection.execute(
        `INSERT IGNORE INTO stock_transactions (transaction_id, item_id, qty, type, process, process_date, department, pic, req_department, receiver, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [transaction.transaction_id, transaction.item_id, transaction.qty, transaction.type, transaction.process, transaction.process_date, transaction.department, transaction.pic, transaction.req_department, transaction.receiver, transaction.created_by]
      );
    }
    
  } catch (error) {
  } finally {
    await connection.end();
  }
}

async function main() {
  try {
    await clearExistingData();
    await seedRealisticUsers();
    await seedRealisticItems();
    await seedRealisticRequests();
    await seedRealisticCalendarEvents();
    await seedRealisticStockTransactions();
    
  } catch (error) {
  }
}

main();