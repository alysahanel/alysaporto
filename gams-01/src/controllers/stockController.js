const { pool } = require('../config/database');

class StockController {
  static async getAllItems(req, res) {
    try {
      const { search } = req.query;
      
      let query = 'SELECT * FROM items WHERE (is_deleted IS NULL OR is_deleted = 0)';
      const params = [];

      if (search) {
        query += ' AND (item_name LIKE ? OR detail LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      query += ' ORDER BY item_name ASC';

      const [items] = await pool.execute(query, params);
      res.json({ success: true, data: items });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
  static async addStock(req, res) {
    try {
      const { item_id, item_name, detail, qty, unit, date } = req.body;
      const user = req.session.user || req.user;
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      
      const userRole = user.role; 
      const createdBy = user.id;

      if (!['admin', 'cs'].includes(userRole)) {
        return res.status(403).json({ success: false, message: 'Only admin and CS can add stock' });
      }

      let itemId = item_id;
      if (!item_id && item_name) {
        const newItemId = 'ITM' + Date.now();
        const [result] = await pool.execute(
          'INSERT INTO items (item_id, item_name, detail, unit, stock, min_stock) VALUES (?, ?, ?, ?, ?, ?)',
          [newItemId, item_name, detail, unit, qty, 10]
        );
        itemId = result.insertId; 
      } else {
        let dbItemId = parseInt(item_id, 10);
        if (isNaN(dbItemId)) {
          const [found] = await pool.execute('SELECT id FROM items WHERE item_id = ?', [item_id]);
          if (!found.length) {
            return res.status(404).json({ success: false, message: 'Item not found' });
          }
          dbItemId = found[0].id;
        }
        itemId = dbItemId;
        await pool.execute(
          'UPDATE items SET stock = stock + ? WHERE id = ?',
          [qty, dbItemId]
        );
      }
      const transactionId = 'TXN' + Date.now();
      const processDate = date || new Date();
      const processDesc = 'Stock Addition';
      await pool.execute(
        'INSERT INTO stock_transactions (transaction_id, item_id, qty, type, process, process_date, department, pic, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [transactionId, itemId, qty, 'in', processDesc, processDate, user.department || null, user.username || null, createdBy]
      );

      res.json({ success: true, message: 'Stock added successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
  static async updateStock(req, res) {
    try {
      const { id } = req.params;
      const { qty, type, process_date, process } = req.body;
      const user = req.session.user || req.user;      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      const userRole = user.role;
      const createdBy = user.id;
      if (!['admin', 'cs'].includes(userRole)) {
        return res.status(403).json({ success: false, message: 'Only admin and CS can update stock' });
      }
      if (!qty || !type) {
        return res.status(400).json({ success: false, message: 'Quantity and type are required' });
      }

      let itemId = parseInt(id, 10);
      if (isNaN(itemId)) {
        const [found] = await pool.execute('SELECT id FROM items WHERE item_id = ?', [id]);
        if (!found.length) {
          return res.status(404).json({ success: false, message: 'Item not found' });
        }
        itemId = found[0].id;
      }
      const quantity = parseInt(qty);
      if (type === 'in') {
        await pool.execute(
          'UPDATE items SET stock = stock + ? WHERE id = ?',
          [quantity, itemId]
        );
      } else if (type === 'out') {
        const [items] = await pool.execute('SELECT stock FROM items WHERE id = ?', [itemId]);
        if (items.length === 0) {
          return res.status(404).json({ success: false, message: 'Item not found' });
        }
        
        if (items[0].stock < quantity) {
          return res.status(400).json({ success: false, message: 'Insufficient stock' });
        }
        
        await pool.execute(
          'UPDATE items SET stock = stock - ? WHERE id = ?',
          [quantity, itemId]
        );
      }
      const transactionId = 'TXN' + Date.now();
      const processDescription = process || (type === 'in' ? 'Stock Addition' : 'Stock Reduction');
      const processDate = process_date || new Date();
      await pool.execute(
        'INSERT INTO stock_transactions (transaction_id, item_id, qty, type, process, process_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [transactionId, itemId, quantity, type, processDescription, processDate, createdBy]
      );
      res.json({ success: true, message: 'Stock updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
  static async getStockReport(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const user = req.session.user || req.user;
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      
      const userRole = user.role; 

      if (!['admin', 'cs'].includes(userRole)) {
        return res.status(403).json({ success: false, message: 'Only admin and CS can view stock report' });
      }

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
          COALESCE(i.stock, 0) as initial,
          COALESCE(st.department, creator.department, 'General Affairs') as dept,
          COALESCE(st.req_department, creator.department, 'General Affairs') as reqDept,
          COALESCE(st.receiver, '') as receiver,
          COALESCE(creator.username, 'Unknown') as pic
        FROM stock_transactions st
        JOIN items i ON st.item_id = i.id
        LEFT JOIN users creator ON st.created_by = creator.id
        WHERE 1=1
      `;
      
      const params = [];

      const dateExpr = 'DATE(COALESCE(st.process_date, st.created_at))';
      if (startDate) {
        query += ` AND ${dateExpr} >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND ${dateExpr} <= ?`;
        params.push(endDate);
      }

      query += ' ORDER BY st.created_at DESC';

      const [transactions] = await pool.execute(query, params);
      res.json({ success: true, data: transactions });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async processStockOut(itemId, qty, requestId, deliveredBy, receiverOverride = null) {
    try {
      let itemPrimaryId = null;
      const isNumericId = typeof itemId === 'number' || /^\d+$/.test(String(itemId));
      if (isNumericId) {
        const [byId] = await pool.execute('SELECT id FROM items WHERE id = ?', [parseInt(itemId, 10)]);
        if (!byId.length) {
          return false;
        }
        itemPrimaryId = byId[0].id;
      } else {
        const [byCode] = await pool.execute('SELECT id FROM items WHERE item_id = ?', [itemId]);
        if (!byCode.length) {

          return false;
        }
        itemPrimaryId = byCode[0].id;
      }
      const [updateResult] = await pool.execute(
        'UPDATE items SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [qty, itemPrimaryId, qty]
      );

      if (updateResult.affectedRows === 0) {
        return false;
      }

      const transactionId = 'TXN' + Date.now();
      let department = null;
      let pic = null;
      try {
        const [userRows] = await pool.execute(
          'SELECT username, department FROM users WHERE id = ?',
          [deliveredBy]
        );
        if (userRows.length) {
          pic = userRows[0].username || null;
          department = userRows[0].department || null;
        }
      } catch (e) {
      }

      let reqDepartment = null;
      let receiverName = receiverOverride || null;
      try {
        const [reqInfo] = await pool.execute(
          'SELECT user_id, receiver FROM requests WHERE id = ?',
          [requestId]
        );
        if (reqInfo.length) {
          if (!receiverName) {
            receiverName = reqInfo[0].receiver || null;
          }
          const requesterId = reqInfo[0].user_id || null;
          if (requesterId) {
            const [reqUser] = await pool.execute(
              'SELECT department FROM users WHERE id = ?',
              [requesterId]
            );
            if (reqUser.length) {
              reqDepartment = reqUser[0].department || null;
            }
          }
        }
      } catch (e) {
      }

      await pool.execute(
        'INSERT INTO stock_transactions (transaction_id, item_id, qty, type, process, process_date, department, pic, req_department, receiver, created_by) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)',
        [transactionId, itemPrimaryId, qty, 'out', 'Request Delivery', department, pic, reqDepartment, receiverName, deliveredBy]
      );

      return true;
    } catch (error) {
      return false;
    }
  }
  static async searchItems(req, res) {
    try {
      const { search } = req.query;
      
      let query = 'SELECT * FROM items WHERE item_name LIKE ? OR detail LIKE ? LIMIT 10';
      const params = [`%${search}%`, `%${search}%`];

      const [items] = await pool.execute(query, params);
      res.json({ success: true, data: items });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

module.exports = StockController;