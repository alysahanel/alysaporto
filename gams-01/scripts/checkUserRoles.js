const mysql = require('mysql2/promise');
require('dotenv').config();
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ga_system'
};

async function checkUserRoles() {
  let connection;
  
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
  
    const [users] = await connection.execute(`
      SELECT u.id, u.username, u.full_name, u.role, u.department
      FROM users u 
      ORDER BY u.role, u.username
    `);
    
    console.table(users);
    console.log('\n=== ROLES TABLE ===');
    const [roles] = await connection.execute('SELECT * FROM roles ORDER BY id');
    console.table(roles);

    console.log('\n=== ADMIN_GA USER DETAILS ===');
    const [adminUser] = await connection.execute(`
      SELECT u.* 
      FROM users u 
      WHERE u.username = 'admin_ga'
    `);
    
    if (adminUser.length > 0) {
      console.log('Admin user found:');
      console.log(adminUser[0]);
    } else {
      console.log('Admin user NOT found!');
    }
    console.log('\n=== REQUESTS IN DATABASE ===');
    const [requests] = await connection.execute(`
      SELECT r.*, u.username, u.role, i.item_name
      FROM requests r
      JOIN users u ON r.user_id = u.id
      JOIN items i ON r.item_id = i.id
      ORDER BY r.created_at DESC
    `);
    
    console.log(`Total requests found: ${requests.length}`);
    if (requests.length > 0) {
      console.table(requests);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkUserRoles();