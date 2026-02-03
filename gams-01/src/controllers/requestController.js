const { pool } = require('../config/database');

class RequestController {
  static async getAllRequests(req, res) {
    try {
      const { start_date, end_date, item, department } = req.query;
      const user = req.session.user || req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }  
      const userId = user.id;
      const userRole = user.role; 
      if (!['admin', 'cs', 'user'].includes(userRole)) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
      const [adminCommentColCheck] = await pool.execute(
        `SELECT COUNT(*) AS cnt
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'requests'
           AND COLUMN_NAME = 'admin_comment'`
      );
      const hasAdminComment = adminCommentColCheck[0]?.cnt > 0;
      const commentSelect = hasAdminComment ? 'r.admin_comment' : 'NULL';
      const [reqDetailColCheck] = await pool.execute(
        `SELECT COLUMN_NAME as col FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'requests'
         AND COLUMN_NAME IN ('detail') LIMIT 1`
      );
      const reqDetailColumn = reqDetailColCheck[0]?.col;
      const [itemDetailColCheck] = await pool.execute(
        `SELECT COLUMN_NAME as col FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items'
         AND COLUMN_NAME IN ('detail','description') LIMIT 1`
      );
      const itemDetailColumn = itemDetailColCheck[0]?.col;
      const detailSelect = reqDetailColumn ? `r.${reqDetailColumn}` : (itemDetailColumn ? `i.${itemDetailColumn}` : `''`);

      let query = `
        SELECT 
               r.*, 
               DATE_FORMAT(r.created_at, '%Y-%m-%d') as req_date,
               u.username as pic, u.department, u.full_name as sender, 
               i.item_name, ${detailSelect} as detail, i.unit, i.item_id,
               r.qty as qty,
               ${commentSelect} as comment,
               r.delivery_notes as cs_notes,
               r.sender, r.receiver,
               DATE_FORMAT(r.created_at, '%Y-%m-%d') as formatted_req_date,
               DATE_FORMAT(r.created_at, '%Y-%m-%d') as formatted_created_at,
               DATE_FORMAT(r.delivery_date, '%Y-%m-%d') as formatted_delivery_date
        FROM requests r
        JOIN users u ON r.user_id = u.id
        JOIN items i ON r.item_id = i.id
        WHERE 1=1
      `;
      
      const params = [];
      if (userRole === 'cs') {
      } else if (userRole === 'user') {
        if (user.department) {
          query += ' AND u.department = ?';
          params.push(user.department);
        }
      } else if (userRole === 'admin') {
      }
      if (start_date) {
        query += ' AND DATE(r.created_at) >= ?';
        params.push(start_date);
      }
      if (end_date) {
        query += ' AND DATE(r.created_at) <= ?';
        params.push(end_date);
      }
      if (item) {
        query += ' AND i.item_name LIKE ?';
        params.push(`%${item}%`);
      }
      if (department) {
        query += ' AND u.department LIKE ?';
        params.push(`%${department}%`);
      }

      query += ' ORDER BY r.created_at DESC';
      const [requests] = await pool.execute(query, params);
      res.json({ success: true, data: requests });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
  static async createRequest(req, res) {
    try {
      const { req_date, item_name, detail, qty, unit, purpose } = req.body;
      const user = req.session.user || req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      const userRole = user.role;
      if (userRole !== 'user') {
        return res.status(403).json({ success: false, message: 'Only users can create requests' });
      }
      if (!item_name || !detail || !qty || !unit) {
        const missing = [];
        if (!item_name) missing.push('item_name');
        if (!detail) missing.push('detail');
        if (!qty) missing.push('qty');
        if (!unit) missing.push('unit');
        return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
      }
      const requestDate = req_date || new Date().toISOString().split('T')[0];
      let itemIdInt;
      const [items] = await pool.execute('SELECT id FROM items WHERE item_name = ?', [item_name]);
      if (items.length === 0) {
        const { generateNextItemId } = require('../utils/itemIdGenerator');
        const newItemCode = await generateNextItemId();
        const [insertItem] = await pool.execute(
          'INSERT INTO items (item_id, item_name, detail, unit, stock) VALUES (?, ?, ?, ?, 0)',
          [newItemCode, item_name, detail, unit]
        );
        itemIdInt = insertItem.insertId; 
      } else {
        itemIdInt = items[0].id;
      }
      const [dateColCheck] = await pool.execute(
        `SELECT COUNT(*) AS cnt
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'requests'
           AND COLUMN_NAME = 'req_date'`
      );
      const [qtyColCheck] = await pool.execute(
        `SELECT COLUMN_NAME as col
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'requests'
           AND COLUMN_NAME IN ('qty','quantity')
         LIMIT 1`
      );
      const qtyColumn = qtyColCheck[0]?.col || 'qty';
      const [reqIdColCheck] = await pool.execute(
        `SELECT COUNT(*) AS cnt
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'requests'
           AND COLUMN_NAME = 'req_id'`
      );

      let reqIdValue = null;
      if (reqIdColCheck[0]?.cnt > 0) {
        const departmentCodes = {
          'IT': 'IT',
          'Finance': 'FIN',
          'HRGA Legal': 'HRG',
          'HR': 'HR',
          'Marketing': 'MKT',
          'Operations': 'OPS',
          'Procurement': 'PRC'
        };
        const deptCode = departmentCodes[user.department] ||
                         (user.department ? user.department.substring(0, 3).toUpperCase() : 'GEN');

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;
        const prefix = `${deptCode}-${dateStr}`;

        const [rows] = await pool.execute(
          'SELECT req_id FROM requests WHERE req_id LIKE ? ORDER BY req_id DESC LIMIT 1',
          [`${prefix}-%`]
        );

        let sequence = 1;
        if (rows.length > 0) {
          const lastId = rows[0].req_id || '';
          const parts = lastId.split('-');
          const lastSequencePart = parts[2];
          const lastSequence = parseInt(lastSequencePart, 10);
          if (!isNaN(lastSequence)) sequence = lastSequence + 1;
        }
        reqIdValue = `${prefix}-${String(sequence).padStart(3, '0')}`;
      }
      const [purposeColCheck] = await pool.execute(
        `SELECT COUNT(*) AS cnt
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'requests'
           AND COLUMN_NAME = 'purpose'`
      );
      const hasReqDate = dateColCheck[0]?.cnt > 0;
      const hasPurpose = purposeColCheck[0]?.cnt > 0;
      const columns = [];
      const placeholders = [];
      const values = [];

      if (reqIdValue) {
        columns.push('req_id');
        placeholders.push('?');
        values.push(reqIdValue);
      }
      columns.push('user_id'); placeholders.push('?'); values.push(user.id);
      columns.push('item_id'); placeholders.push('?'); values.push(itemIdInt);
      columns.push(qtyColumn); placeholders.push('?'); values.push(qty);
      if (hasReqDate) { columns.push('req_date'); placeholders.push('?'); values.push(requestDate); }
      if (hasPurpose) { columns.push('purpose'); placeholders.push('?'); values.push(purpose || null); }

      const insertSql = `INSERT INTO requests (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
      const [insertReq] = await pool.execute(insertSql, values);
      res.json({ success: true, message: 'Request created successfully', id: insertReq.insertId });
    } catch (error) {
      console.error('Error creating request:', error);
      console.error('Error details:', { 
        message: error.message,
        code: error.code,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      });
      res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }


  static async updateRequestStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, comment } = req.body;
      const user = req.session.user || req.user;
      
      console.log('updateRequestStatus called by user:', user); 
      console.log('Request status update:', { id, status, comment }); 
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      
      const userRole = user.role; 
    
    if (!['admin', 'cs'].includes(userRole)) {
        return res.status(403).json({ success: false, message: 'Only admin and CS can update request status' });
      }
      const commentValue = comment === undefined ? null : comment;
      await pool.execute(
         'UPDATE requests SET status = ?, rejected_reason = ? WHERE id = ?',
         [status, commentValue, id]
       );

      res.json({ success: true, message: 'Request status updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
  static async updateComment(req, res) {
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const user = req.session.user || req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      const userRole = user.role; 
      if (!['admin', 'cs'].includes(userRole)) {
        return res.status(403).json({ success: false, message: 'Only admin and CS can update comments' });
      }
      let hasAdminComment = false;
      try {
        const [colCheck] = await pool.execute(
          `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'requests' AND COLUMN_NAME = 'admin_comment'`
        );
        hasAdminComment = colCheck[0]?.cnt > 0;
        if (!hasAdminComment) {
          await pool.execute(`ALTER TABLE requests ADD COLUMN admin_comment TEXT NULL`);
          hasAdminComment = true;
        }
      } catch (e) {
      }
      const selectExistingSql = hasAdminComment ? 'SELECT admin_comment AS comment FROM requests WHERE id = ?' : 'SELECT delivery_notes AS comment FROM requests WHERE id = ?';
      const [existing] = await pool.execute(selectExistingSql, [id]);
      const existingComment = existing[0]?.comment;
      if (existingComment !== null && existingComment !== undefined && String(existingComment).trim().length > 0) {
        return res.status(400).json({ success: false, message: 'Komentar sudah ada dan tidak bisa diubah', current_comment: existingComment });
      }
      const commentValue = comment === undefined ? null : comment;
      if (hasAdminComment) {
        await pool.execute('UPDATE requests SET admin_comment = ? WHERE id = ?', [commentValue, id]);
      } else {
        await pool.execute('UPDATE requests SET delivery_notes = ? WHERE id = ?', [commentValue, id]);
      }

      res.json({ success: true, message: 'Comment updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
  static async updateDelivery(req, res) {
    try {
      const { id } = req.params;
      const { delivery_date, sender, receiver_name, delivery_notes } = req.body;
      const user = req.session.user || req.user;
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      
      const userRole = user.role;
      if (userRole !== 'cs' && userRole !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admin and CS can update delivery info' });
      }
      const [qtyColCheck] = await pool.execute(
        `SELECT COLUMN_NAME as col
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'requests'
           AND COLUMN_NAME IN ('qty','quantity')
         LIMIT 1`
      );
      const qtyColumn = qtyColCheck[0]?.col || 'qty';
      const [reqRows] = await pool.execute(
        `SELECT item_id, ${qtyColumn} AS qty, status, delivery_date, sender FROM requests WHERE id = ?`,
        [id]
      );
      if (reqRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Request not found' });
      }
      const { item_id, qty: reqQty, status: currentStatus } = reqRows[0];
      try {
        const [delConfColCheck] = await pool.execute(
          `SELECT COUNT(*) AS cnt
           FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'requests'
             AND COLUMN_NAME = 'delivery_confirmed'`
        );
        const hasDeliveryConfirmed = delConfColCheck[0]?.cnt > 0;
        if (!hasDeliveryConfirmed) {
          await pool.execute('ALTER TABLE requests ADD COLUMN delivery_confirmed TINYINT(1) DEFAULT 0');
        }
      } catch (e) {
      }
      if (currentStatus !== 'approved') {
        return res.status(400).json({ success: false, message: 'Tidak bisa update pengiriman untuk request non-APPROVED (mis. REJECTED/PENDING).' });
      }
      const StockController = require('./stockController');
      const stockOutSuccess = await StockController.processStockOut(item_id, reqQty, id, user.id, receiver_name);
      if (!stockOutSuccess) {
        return res.status(400).json({ success: false, message: 'Failed to process stock out. Insufficient stock or error occurred.' });
      }
      await pool.execute(
        'UPDATE requests SET delivery_date = ?, sender = ?, receiver = ?, delivery_notes = ?, delivery_confirmed = 1, status = "delivered" WHERE id = ?',
        [delivery_date, sender, receiver_name, delivery_notes, id]
      );

      const message = 'Delivery confirmed, stock reduced, status DELIVERED';

      res.json({ success: true, message });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
  static async getDashboardStats(req, res) {
    try {
      const user = req.session.user || req.user;
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      
      const userRole = user.role; 
      const userId = user.id; 
      let stats = {};
      const [qtyColCheck] = await pool.execute(
        `SELECT COLUMN_NAME as col
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'requests'
           AND COLUMN_NAME IN ('qty','quantity')
         LIMIT 1`
      );
      const qtyColumn = qtyColCheck[0]?.col || 'qty';

      if (userRole === 'admin') {
        const [monthStartRow] = await pool.execute(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-01') AS startOfMonth`);
        const startOfMonth = monthStartRow[0].startOfMonth;
        const [nextMonthStartRow] = await pool.execute(`SELECT DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01') AS nextStartOfMonth`);
        const nextStartOfMonth = nextMonthStartRow[0].nextStartOfMonth;
        const [pendingCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM requests WHERE status = "pending" AND created_at >= ? AND created_at < ?',
          [startOfMonth, nextStartOfMonth]
        );
        stats.totalPendingRequests = pendingCount[0].count;
        const [approvedCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM requests WHERE status = "approved" AND created_at >= ? AND created_at < ?',
          [startOfMonth, nextStartOfMonth]
        );
        stats.totalApprovedRequests = approvedCount[0].count;
        const [deliveredCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM requests WHERE status = "delivered" AND created_at >= ? AND created_at < ?',
          [startOfMonth, nextStartOfMonth]
        );
        stats.totalDeliveredRequests = deliveredCount[0].count;
        const [rejectedCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM requests WHERE status = "rejected" AND created_at >= ? AND created_at < ?',
          [startOfMonth, nextStartOfMonth]
        );
        stats.totalRejectedRequests = rejectedCount[0].count;
        const [totalItems] = await pool.execute(
          'SELECT COUNT(*) as count FROM items'
        );
        stats.totalItems = totalItems[0].count;
        const [lowStockItems] = await pool.execute(
          'SELECT COUNT(*) as count FROM items WHERE stock <= min_stock'
        );
        stats.lowStockItems = lowStockItems[0].count;
        const [totalUsers] = await pool.execute(
          'SELECT COUNT(*) as count FROM users WHERE is_active = 1'
        );
        stats.totalUsers = totalUsers[0].count;
        const [totalDepartments] = await pool.execute(
          'SELECT COUNT(DISTINCT department) as count FROM users WHERE department IS NOT NULL AND department != ""'
        );
        stats.totalDepartments = totalDepartments[0].count;
        const [recentRequests] = await pool.execute(`
          SELECT r.*, u.username as pic, u.full_name, u.department, i.item_name, i.unit,
                 r.${qtyColumn} as qty,
                 DATE_FORMAT(r.created_at, '%Y-%m-%d') as request_date
          FROM requests r 
          JOIN users u ON r.user_id = u.id 
          JOIN items i ON r.item_id = i.id 
          WHERE r.created_at >= ? AND r.created_at < ?
          ORDER BY r.created_at DESC 
          LIMIT 10
        `, [startOfMonth, nextStartOfMonth]);
        stats.recentRequests = recentRequests;
        stats.requestsByStatus = [
          { status: 'pending', count: stats.totalPendingRequests || 0 },
          { status: 'approved', count: stats.totalApprovedRequests || 0 },
          { status: 'rejected', count: stats.totalRejectedRequests || 0 },
          { status: 'delivered', count: stats.totalDeliveredRequests || 0 }
        ];
        const [requestsByDepartment] = await pool.execute(`
          SELECT u.department, COUNT(*) as count 
          FROM requests r 
          JOIN users u ON r.user_id = u.id 
          GROUP BY u.department 
          ORDER BY count DESC 
          LIMIT 5
        `);
        stats.requestsByDepartment = requestsByDepartment;

      } else if (userRole === 'cs') {
        const [pendingDeliveryCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM requests WHERE status = "approved"'
        );
        stats.totalPendingDelivery = pendingDeliveryCount[0].count;
        const [deliveredTodayCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM requests WHERE status = "delivered" AND DATE(updated_at) = CURDATE()'
        );
        stats.totalDeliveredToday = deliveredTodayCount[0].count;
        const [pendingCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM requests WHERE status = "pending"'
        );
        stats.totalPendingRequests = pendingCount[0].count;
        const [lowStockItems] = await pool.execute(
          'SELECT COUNT(*) as count FROM items WHERE (is_deleted IS NULL OR is_deleted = 0) AND stock <= min_stock'
        );
        stats.lowStockItems = lowStockItems[0].count;
        const [recentRequests] = await pool.execute(`
          SELECT r.*, u.username as pic, u.full_name, u.department, i.item_name, i.unit,
                 r.${qtyColumn} as qty,
                 DATE_FORMAT(r.created_at, '%Y-%m-%d') as request_date
          FROM requests r 
          JOIN users u ON r.user_id = u.id 
          JOIN items i ON r.item_id = i.id 
          WHERE r.status IN ('approved', 'delivered')
          ORDER BY r.created_at DESC 
          LIMIT 10
        `);
        stats.recentRequests = recentRequests;
        const [itemsNeedingStock] = await pool.execute(`
          SELECT i.*, 
                 (SELECT SUM(r.${qtyColumn}) FROM requests r WHERE r.item_id = i.id AND r.status = 'approved') as pending_quantity
          FROM items i 
          WHERE i.stock <= i.min_stock 
          ORDER BY i.stock ASC 
          LIMIT 5
        `);
        stats.itemsNeedingStock = itemsNeedingStock;
      } else if (userRole === 'user') {
        const userIdInt = user.id;
        const [pendingCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM requests WHERE user_id = ? AND status = "pending"',
          [userIdInt]
        );
        stats.totalPendingRequests = pendingCount[0].count;
        const [approvedCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM requests WHERE user_id = ? AND status = "approved"',
          [userIdInt]
        );
        stats.totalApprovedRequests = approvedCount[0].count;
        const [deliveredCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM requests WHERE user_id = ? AND status = "delivered"',
          [userIdInt]
        );
        stats.totalDeliveredRequests = deliveredCount[0].count;
        const [recentRequests] = await pool.execute(`
          SELECT r.*, u.username as pic, u.full_name, u.department, i.item_name, i.unit,
                 r.${qtyColumn} as qty,
                 DATE_FORMAT(r.created_at, '%Y-%m-%d') as request_date
          FROM requests r 
          JOIN users u ON r.user_id = u.id 
          JOIN items i ON r.item_id = i.id 
          WHERE r.user_id = ?
          ORDER BY r.created_at DESC 
          LIMIT 10
        `, [userIdInt]);
        stats.recentRequests = recentRequests;
        const [requestHistory] = await pool.execute(`
          SELECT 
            COUNT(*) as total_requests,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
            COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests,
            COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_requests,
            COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_requests
          FROM requests 
          WHERE user_id = ?
        `, [userIdInt]);
        stats.requestHistory = requestHistory[0];
      }

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error in getDashboardStats:', error);
      res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }
}

module.exports = RequestController;

