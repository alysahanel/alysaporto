const XLSX = require('xlsx');
const { pool } = require('../config/database');

class ExportController {
  static async exportStock(req, res) {
    try {
      const user = req.session.user || req.user;
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const userRole = user.role;

      if (!['admin', 'cs'].includes(userRole)) {
        return res.status(403).json({ success: false, message: 'Only admin and CS can export stock data' });
      }

      const [items] = await pool.execute(`
        SELECT 
          item_id,
          item_name,
          detail,
          stock,
          unit,
          min_stock,
          CASE 
            WHEN stock <= min_stock THEN 'Low Stock'
            ELSE 'Normal'
          END as stock_status,
          created_at,
          updated_at
        FROM items 
        WHERE (is_deleted IS NULL OR is_deleted = 0)
        ORDER BY item_name
      `);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(items.map(item => ({
        'Item ID': item.item_id,
        'Item Name': item.item_name,
        'Detail': item.detail || '',
        'Current Stock': item.stock,
        'Unit': item.unit,
        'Min Stock': item.min_stock,
        'Stock Status': item.stock_status,
        'Created Date': new Date(item.created_at).toLocaleDateString('id-ID'),
        'Last Updated': new Date(item.updated_at).toLocaleDateString('id-ID')
      })));

      XLSX.utils.book_append_sheet(wb, ws, 'Stock Data');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=stock_data_${new Date().toISOString().split('T')[0]}.xlsx`);

      res.send(buffer);
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to export stock data' });
    }
  }

  static async exportStockReport(req, res) {
    try {
      const user = req.session.user || req.user;
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const userRole = user.role;

      if (!['admin', 'cs'].includes(userRole)) {
        return res.status(403).json({ success: false, message: 'Only admin and CS can export stock report' });
      }

      const { startDate, endDate } = req.query;

      let query = `
        SELECT 
          DATE_FORMAT(COALESCE(st.process_date, st.created_at), '%Y-%m-%d') as transactionDate,
          i.item_id as itemId,
          i.item_name as itemName,
          i.detail,
          st.qty as qty,
          i.unit,
          st.type as process,
          DATE_FORMAT(COALESCE(st.process_date, st.created_at), '%Y-%m-%d') as processDate,
          COALESCE(st.department, creator.department, 'General Affairs') as dept,
          COALESCE(st.req_department, creator.department, 'General Affairs') as reqDept,
          COALESCE(st.receiver, '') as receiver,
          COALESCE(st.pic, creator.username, 'Unknown') as pic
        FROM stock_transactions st
        JOIN items i ON st.item_id = i.id
        LEFT JOIN users creator ON st.created_by = creator.id
        WHERE 1=1
      `;

      const params = [];
      if (startDate) {
        query += ' AND DATE(COALESCE(st.process_date, st.created_at)) >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND DATE(COALESCE(st.process_date, st.created_at)) <= ?';
        params.push(endDate);
      }

      query += ' ORDER BY st.created_at DESC';
      
      const [transactions] = await pool.execute(query, params);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(transactions.map(trans => ({
        'Transaction Date': trans.transactionDate,
        'Item ID': trans.itemId,
        'Item Name': trans.itemName,
        'Detail': trans.detail || '',
        'Qty': trans.qty,
        'Unit': trans.unit,
        'Process': trans.process === 'in' ? 'in' : 'out',
        'Process Date': trans.processDate,
        'Department': trans.dept || '',
        'PIC': trans.pic || '',
        'Req Dept': trans.reqDept || '',
        'Receiver': trans.receiver || ''
      })));

      XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const dateRange = startDate && endDate ? `_${startDate}_to_${endDate}` : '';
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=stock_report${dateRange}_${new Date().toISOString().split('T')[0]}.xlsx`);

      res.send(buffer);
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to export stock report' });
    }
  }

  static async exportRequests(req, res) {
    try {
      const user = req.session.user || req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const userRole = user.role;
      
      if (!['admin', 'cs', 'user'].includes(userRole)) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }

      let userWithDepartment = user;
      if (!user.department && user.id) {
        const [userResult] = await pool.execute('SELECT department FROM users WHERE id = ?', [user.id]);
        if (userResult.length > 0) {
          userWithDepartment = { ...user, department: userResult[0].department };
        }
      }

      const { startDate, endDate, item, department } = req.query;

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
      const reqIdSelect = reqIdColCheck[0]?.cnt > 0 ? 'r.req_id' : 'r.id';

      const [purposeColCheck] = await pool.execute(
        `SELECT COUNT(*) AS cnt
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'requests'
           AND COLUMN_NAME = 'purpose'`
      );
      const purposeSelect = purposeColCheck[0]?.cnt > 0 ? 'r.purpose' : 'NULL';

      const [deliveryDateColCheck] = await pool.execute(
        `SELECT COUNT(*) AS cnt
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'requests'
           AND COLUMN_NAME = 'delivery_date'`
      );
      const deliveryDateSelect = deliveryDateColCheck[0]?.cnt > 0 ? 'r.delivery_date' : 'NULL';

      const [detailColCheck] = await pool.execute(
        `SELECT COLUMN_NAME as col
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'requests'
           AND COLUMN_NAME IN ('detail')
         LIMIT 1`
      );
      const detailColumn = detailColCheck[0]?.col;

      const [itemDetailColCheck] = await pool.execute(
        `SELECT COLUMN_NAME as col
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'items'
           AND COLUMN_NAME IN ('detail','description')
         LIMIT 1`
      );
      const itemDetailColumn = itemDetailColCheck[0]?.col;
      const detailSelect = detailColumn
        ? `r.${detailColumn}`
        : (itemDetailColumn ? `i.${itemDetailColumn}` : `''`);

      const [adminCommentColCheck] = await pool.execute(
        `SELECT COUNT(*) AS cnt
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'requests'
           AND COLUMN_NAME = 'admin_comment'`
      );
      const hasAdminComment = adminCommentColCheck[0]?.cnt > 0;
      const commentSelect = hasAdminComment ? 'r.admin_comment' : 'NULL';

      let query = `
        SELECT 
          ${reqIdSelect} as request_id,
          u.username as requester_name,
          u.department as requester_department,
          i.item_id as item_id,
          i.item_name as item_name,
          ${detailSelect} as detail,
          r.${qtyColumn} as quantity,
          i.unit as unit,
          r.status as status,
          ${purposeSelect} as purpose,
          ${commentSelect} as comment,
          r.rejected_reason as rejected_reason,
          r.delivery_notes as cs_notes,
          ${deliveryDateSelect} as delivery_date,
          r.created_at as created_at
        FROM requests r
        JOIN users u ON r.user_id = u.id
        JOIN items i ON r.item_id = i.id
      `;

      const params = [];
      const whereConditions = [];

      if ((userRole === 'user' || userRole === 'cs') && userWithDepartment.department) {
        whereConditions.push('u.department = ?');
        params.push(userWithDepartment.department);
      }

      if (startDate && endDate) {
        whereConditions.push('DATE(r.created_at) BETWEEN ? AND ?');
        params.push(startDate, endDate);
      } else if (startDate) {
        whereConditions.push('DATE(r.created_at) >= ?');
        params.push(startDate);
      } else if (endDate) {
        whereConditions.push('DATE(r.created_at) <= ?');
        params.push(endDate);
      }

      if (item) {
        whereConditions.push('i.item_name LIKE ?');
        params.push(`%${item}%`);
      }

      if (department) {
        whereConditions.push('u.department LIKE ?');
        params.push(`%${department}%`);
      }

      if (whereConditions.length > 0) {
        query += ' WHERE ' + whereConditions.join(' AND ');
      }

      query += ' ORDER BY r.created_at DESC';

      const [requests] = await pool.execute(query, params);

      const wb = XLSX.utils.book_new();
      const worksheetData = [];

      worksheetData.push([
        'Request ID',
        'Requester',
        'Department',
        'Item ID',
        'Item Name',
        'Detail',
        'Quantity',
        'Unit',
        'Status',
        'Purpose',
        'Admin Comment',
        'Rejected Reason',
        'CS Notes',
        'Delivery Date',
        'Created At'
      ]);
      
      requests.forEach(req => {
        const detailValue = (req.detail && String(req.detail).trim()) ? req.detail : '';
        worksheetData.push([
          req.request_id,
          req.requester_name,
          req.requester_department,
          req.item_id,
          req.item_name,
          detailValue,
          req.quantity,
          req.unit,
          req.status.charAt(0).toUpperCase() + req.status.slice(1),
          req.purpose || '',
          req.comment || '',
          req.rejected_reason || '',
          req.cs_notes || '',
          req.delivery_date ? new Date(req.delivery_date).toLocaleDateString('id-ID') : '',
          new Date(req.created_at).toLocaleDateString('id-ID')
        ]);
      });
      
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);

      XLSX.utils.book_append_sheet(wb, ws, 'Requests Data');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const dateRange = startDate && endDate ? `_${startDate}_to_${endDate}` : '';
      const userPrefix = userRole === 'user' ? '_personal' : '';
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=requests${userPrefix}${dateRange}_${new Date().toISOString().split('T')[0]}.xlsx`);

      res.send(buffer);
    } catch (error) {
      res.status(500).json({ success: false, message: 'Export failed', error: error.message });
    }
  }

  static async exportAccounts(req, res) {
    try {
      const user = req.session.user || req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      if (user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const [users] = await pool.execute(`
        SELECT 
          u.id,
          u.username,
          u.email,
          u.full_name,
          u.role,
          u.department,
          u.is_active,
          creator.full_name as created_by_name,
          u.created_at,
          u.updated_at
        FROM users u
        LEFT JOIN users creator ON u.created_by = creator.id
        ORDER BY u.created_at DESC
      `);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(users.map(user => ({
        'User ID': user.id,
        'Username': user.username,
        'Email': user.email || '',
        'Full Name': user.full_name,
        'Role': user.role.charAt(0).toUpperCase() + user.role.slice(1),
        'Department': user.department || '',
        'Status': user.is_active ? 'Active' : 'Inactive',
        'Created By': user.created_by_name || 'System',
        'Created Date': new Date(user.created_at).toLocaleDateString('id-ID'),
        'Last Updated': new Date(user.updated_at).toLocaleDateString('id-ID')
      })));

      XLSX.utils.book_append_sheet(wb, ws, 'User Accounts');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spspreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=user_accounts_${new Date().toISOString().split('T')[0]}.xlsx`);

      res.send(buffer);
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to export accounts data' });
    }
  }
}

module.exports = ExportController;
