const mysql = require('mysql2/promise');
require('dotenv').config();
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ga_system'
};
const additionalUsers = [
  {
    username: 'cs2',
    password: 'cs123',
    email: 'cs2@ga-system.com',
    full_name: 'Customer Service 2',
    role: 'cs',
    department: 'General Affairs'
  },
  {
    username: 'user2',
    password: 'user123',
    email: 'user2@ga-system.com',
    full_name: 'Regular User 2',
    role: 'user',
    department: 'HR'
  },
  {
    username: 'user3',
    password: 'user123',
    email: 'user3@ga-system.com',
    full_name: 'Regular User 3',
    role: 'user',
    department: 'Marketing'
  },
];

const sampleRequests = [
  {
    request_id: 'REQ001',
    user_id: 3,
    item_id: 1, 
    quantity: 5,
    purpose: 'Untuk keperluan printing dokumen',
    status: 'pending',
    delivery_date: '2024-01-15'
  },
  {
    request_id: 'REQ002',
    user_id: 7,
    item_id: 2,
    quantity: 10,
    purpose: 'Untuk remote AC kantor',
    status: 'approved',
    delivery_date: '2024-01-16'
  },
  {
    request_id: 'REQ003',
    user_id: 8,
    item_id: 3,
    quantity: 20,
    purpose: 'Untuk filing dokumen marketing',
    status: 'delivered',
    delivery_date: '2024-01-10'
  },
  {
    request_id: 'REQ004',
    user_id: 9,
    item_id: 8,
    quantity: 1,
    purpose: 'Keyboard lama rusak',
    status: 'pending',
    delivery_date: '2024-01-20'
  },
  {
    request_id: 'REQ005',
    user_id: 3,
    item_id: 9,
    quantity: 1,
    purpose: 'Mouse untuk workstation baru',
    status: 'approved',
    delivery_date: '2024-01-18'
  }
];

async function addUsers() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    const bcrypt = require('bcrypt');
    
    for (const user of additionalUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      await connection.execute(
        `INSERT IGNORE INTO users (username, password, email, full_name, role, department) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [user.username, hashedPassword, user.email, user.full_name, user.role, user.department]
      );
    }

  } catch (error) {
  } finally {
    await connection.end();
  }
}

async function addRequests() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    for (const request of sampleRequests) {
      await connection.execute(
        `INSERT IGNORE INTO requests (request_id, user_id, item_id, quantity, purpose, status, delivery_date) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [request.request_id, request.user_id, request.item_id, request.quantity, request.purpose, request.status, request.delivery_date]
      );
    }
  } catch (error) {
  } finally {
    await connection.end();
  }
}

async function main() {
  try {
    await addUsers();
    await addRequests();
  } catch (error) {
  }
}

main();