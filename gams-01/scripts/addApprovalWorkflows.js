const mysql = require('mysql2/promise');
require('dotenv').config();
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3307,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ga_system'
};

async function addApprovalWorkflows() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('👥 Getting user IDs for approval workflows...');
    const [users] = await connection.execute('SELECT id, username, role FROM users');
    const userMap = {};
    users.forEach(user => {
      userMap[user.username] = user.id;
    });

    const [requests] = await connection.execute('SELECT id, status, user_id FROM requests');
    
    for (const request of requests) {
      let updateData = {};
      switch (request.status) {
        case 'approved':
          updateData = {
            approved_by: userMap['admin_ga'] || userMap['admin'] || 1,
            approved_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            priority: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
            urgency_level: Math.random() > 0.8 ? 'urgent' : 'normal'
          };
          break;
          
        case 'rejected':
          updateData = {
            approved_by: userMap['admin_ga'] || userMap['admin'] || 1,
            approved_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            rejected_reason: getRandomRejectionReason(),
            priority: Math.random() > 0.5 ? 'low' : 'medium',
            urgency_level: 'normal'
          };
          break;
          
        case 'delivered':
          updateData = {
            approved_by: userMap['admin_ga'] || userMap['admin'] || 1,
            approved_at: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000),
            delivery_notes: getRandomDeliveryNote(),
            priority: Math.random() > 0.6 ? 'medium' : Math.random() > 0.3 ? 'high' : 'low',
            urgency_level: Math.random() > 0.7 ? 'urgent' : 'normal'
          };
          break;
          
        case 'pending':
          updateData = {
            priority: Math.random() > 0.6 ? 'high' : Math.random() > 0.3 ? 'medium' : 'low',
            urgency_level: Math.random() > 0.8 ? 'urgent' : Math.random() > 0.9 ? 'critical' : 'normal'
          };
          break;
      }
      const fields = Object.keys(updateData);
      if (fields.length > 0) {
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const values = fields.map(field => updateData[field]);
        
        await connection.execute(
          `UPDATE requests SET ${setClause} WHERE id = ?`,
          [...values, request.id]
        );
      }
    }
    
    
  
    const [approvedRequests] = await connection.execute(`
      SELECT id, status, approved_by, approved_at, user_id 
      FROM requests 
      WHERE status IN ('approved', 'rejected', 'delivered') AND approved_by IS NOT NULL
    `);
    
    for (const request of approvedRequests) {
      await connection.execute(`
        INSERT IGNORE INTO request_approval_history 
        (request_id, action, performed_by, previous_status, new_status, created_at)
        VALUES (?, 'submitted', ?, 'pending', 'pending', DATE_SUB(?, INTERVAL 1 DAY))
      `, [request.id, request.user_id, request.approved_at]);

      const action = request.status === 'rejected' ? 'rejected' : 'approved';
      await connection.execute(`
        INSERT IGNORE INTO request_approval_history 
        (request_id, action, performed_by, previous_status, new_status, created_at)
        VALUES (?, ?, ?, 'pending', ?, ?)
      `, [request.id, action, request.approved_by, request.status, request.approved_at]);

      if (request.status === 'delivered') {
        const deliveryDate = new Date(request.approved_at);
        deliveryDate.setDate(deliveryDate.getDate() + Math.floor(Math.random() * 3) + 1); // 1-3 days after approval
        
        await connection.execute(`
          INSERT IGNORE INTO request_approval_history 
          (request_id, action, performed_by, previous_status, new_status, created_at)
          VALUES (?, 'delivered', ?, 'approved', 'delivered', ?)
        `, [request.id, userMap['cs_warehouse'] || userMap['cs1'] || 2, deliveryDate]);
      }
    }
    
    const sampleNotifications = [
      {
        user_id: userMap['user_finance'] || userMap['user1'] || 3,
        title: 'Request Approved',
        message: 'Your request for Office Supplies has been approved and is ready for delivery.',
        type: 'success',
        related_table: 'requests',
        related_id: 1
      },
      {
        user_id: userMap['user_production'] || userMap['user1'] || 3,
        title: 'Low Stock Alert',
        message: 'Safety equipment stock is running low. Please consider placing a new order.',
        type: 'warning',
        related_table: 'items',
        related_id: 15
      },
      {
        user_id: userMap['admin_ga'] || userMap['admin'] || 1,
        title: 'New Request Pending',
        message: 'A new request from Production department requires your approval.',
        type: 'info',
        related_table: 'requests',
        related_id: 2
      },
      {
        user_id: userMap['cs_warehouse'] || userMap['cs1'] || 2,
        title: 'Delivery Scheduled',
        message: 'Request REQ2024001 is scheduled for delivery today.',
        type: 'info',
        related_table: 'requests',
        related_id: 1
      }
    ];
    
    for (const notification of sampleNotifications) {
      try {
        await connection.execute(`
          INSERT INTO notifications (user_id, title, message, type, related_table, related_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 24) HOUR))
        `, [notification.user_id, notification.title, notification.message, notification.type, notification.related_table, notification.related_id]);
      } catch (error) {
        console.log(`⚠️  Notification creation skipped: ${error.message}`);
      }
    }
    
    const [lowStockItems] = await connection.execute(`
      SELECT id, item_name, stock, min_stock 
      FROM items 
      WHERE stock <= min_stock
    `);
    
    for (const item of lowStockItems) {
      try {
        await connection.execute(`
          INSERT IGNORE INTO stock_alerts (item_id, alert_type, threshold_value, last_triggered)
          VALUES (?, 'low_stock', ?, NOW())
        `, [item.id, item.min_stock]);
        
        console.log(`🚨 Created low stock alert for: ${item.item_name}`);
      } catch (error) {
        console.log(`⚠️  Stock alert creation skipped for ${item.item_name}: ${error.message}`);
      }
    }
    
    console.log('📈 Adding realistic item management scenarios...');
    const itemUpdates = [
      { pattern: '%kertas%', supplier: 'PT Sinar Dunia Paper', location: 'Gudang A-1', price: 45000 },
      { pattern: '%pulpen%', supplier: 'CV Alat Tulis Jaya', location: 'Gudang A-2', price: 3500 },
      { pattern: '%mouse%', supplier: 'PT Teknologi Maju', location: 'Gudang B-1', price: 125000 },
      { pattern: '%helm%', supplier: 'PT Safety First Indonesia', location: 'Gudang C-1', price: 85000 },
      { pattern: '%tissue%', supplier: 'PT Kebersihan Prima', location: 'Gudang A-3', price: 25000 },
      { pattern: '%obeng%', supplier: 'CV Perkakas Teknik', location: 'Gudang C-2', price: 45000 }
    ];
    
    for (const update of itemUpdates) {
      await connection.execute(`
        UPDATE items 
        SET supplier = ?, location = ?, price = ?
        WHERE item_name LIKE ? AND supplier IS NULL
      `, [update.supplier, update.location, update.price, update.pattern]);
    }
    
    console.log('🎯 Creating realistic request scenarios...');
    
    const additionalRequests = [
      {
        req_id: 'REQ2024011',
        user_id: userMap['user_finance'] || 3,
        item_id: 1, 
        qty: 10,
        purpose: 'Kebutuhan laporan keuangan bulanan',
        priority: 'high',
        urgency_level: 'urgent',
        status: 'pending',
        req_date: new Date().toISOString().split('T')[0]
      },
      {
        req_id: 'REQ2024012',
        user_id: userMap['user_it'] || 3,
        item_id: 6, 
        qty: 3,
        purpose: 'Penggantian mouse yang rusak untuk workstation',
        priority: 'medium',
        urgency_level: 'normal',
        status: 'pending',
        req_date: new Date().toISOString().split('T')[0]
      }
    ];
    
    for (const request of additionalRequests) {
      try {
        await connection.execute(`
          INSERT IGNORE INTO requests 
          (req_id, user_id, item_id, qty, purpose, priority, urgency_level, status, req_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [request.req_id, request.user_id, request.item_id, request.qty, request.purpose, 
            request.priority, request.urgency_level, request.status, request.req_date]);
        
        await connection.execute(`
          INSERT INTO request_approval_history 
          (request_id, action, performed_by, previous_status, new_status)
          VALUES (LAST_INSERT_ID(), 'submitted', ?, NULL, 'pending')
        `, [request.user_id]);
        
      } catch (error) {
        console.log(`⚠️  Request creation skipped: ${error.message}`);
      }
    }

    const [requestStats] = await connection.execute(`
      SELECT 
        status,
        COUNT(*) as count,
        AVG(CASE WHEN priority = 'high' THEN 3 WHEN priority = 'medium' THEN 2 ELSE 1 END) as avg_priority
      FROM requests 
      GROUP BY status
    `);
    
    console.log('\n📈 Current Request Statistics:');
    requestStats.forEach(stat => {
      console.log(`  • ${stat.status.toUpperCase()}: ${stat.count} requests (Avg Priority: ${stat.avg_priority.toFixed(1)})`);
    });
    
  } catch (error) {
    console.error('❌ Approval workflow setup failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

function getRandomRejectionReason() {
  const reasons = [
    'Stok tidak mencukupi untuk permintaan ini',
    'Item tidak tersedia dalam katalog saat ini',
    'Permintaan melebihi batas kuota departemen',
    'Diperlukan justifikasi yang lebih detail',
    'Item serupa sudah tersedia di departemen',
    'Budget departemen sudah habis untuk periode ini'
  ];
  return reasons[Math.floor(Math.random() * reasons.length)];
}

function getRandomDeliveryNote() {
  const notes = [
    'Barang telah dikirim ke lokasi departemen',
    'Diserahkan langsung kepada pemohon',
    'Ditempatkan di meja kerja yang diminta',
    'Barang sudah diterima dan ditandatangani',
    'Pengiriman selesai, mohon konfirmasi penerimaan',
    'Item telah didistribusikan sesuai permintaan'
  ];
  return notes[Math.floor(Math.random() * notes.length)];
}

addApprovalWorkflows();