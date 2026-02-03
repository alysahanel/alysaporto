const { pool } = require('../config/database');

class RequestModel {
  async getAllRequests(filters = {}) {
    try {
      let query = `
        SELECT 
          r.id,
          r.req_id,
          r.req_date,
          i.item_id,
          i.item_name,
          i.detail,
          r.qty,
          i.unit,
          d.dept_name as dept,
          u.pic_name as pic,
          r.status,
          r.comment,
          r.delivery_date,
          cs.pic_name as sender,
          r.receiver
        FROM requests r
        JOIN items i ON r.item_id = i.id
        JOIN users u ON r.user_id = u.user_id
        JOIN departments d ON u.dept_id = d.id
        LEFT JOIN users cs ON r.sender_id = cs.id
        WHERE 1=1
      `;
      
      const params = [];
    
      if (filters.startDate && filters.endDate) {
        query += ' AND DATE(r.req_date) BETWEEN ? AND ?';
        params.push(filters.startDate, filters.endDate);
      }
      if (filters.itemSearch) {
        query += ' AND (i.item_name LIKE ? OR i.item_id LIKE ?)';
        params.push(`%${filters.itemSearch}%`, `%${filters.itemSearch}%`);
      }
      if (filters.deptSearch) {
        query += ' AND d.dept_name LIKE ?';
        params.push(`%${filters.deptSearch}%`);
      }
      if (filters.userId) {
        query += ' AND r.user_id = ?';
        params.push(filters.userId);
      }
      
      query += ' ORDER BY r.req_date DESC';
      
      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error getting all requests:', error);
      throw error;
    }
  }
  async getRequestById(id) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          r.*,
          i.item_name,
          i.item_id,
          i.detail as item_detail,
          i.unit,
          u.pic_name,
          d.dept_name
        FROM requests r
        JOIN items i ON r.item_id = i.id
        JOIN users u ON r.user_id = u.user_id
        JOIN departments d ON u.dept_id = d.id
        WHERE r.id = ?
      `, [id]);
      
      return rows[0];
    } catch (error) {
      console.error('Error getting request by ID:', error);
      throw error;
    }
  }
  async createRequest(requestData) {
    try {
      const { request_id, item_id, quantity, user_id } = requestData;
      
      const [result] = await pool.execute(
        'INSERT INTO requests (request_id, item_id, quantity, user_id) VALUES (?, ?, ?, ?)',
        [request_id, item_id, quantity, user_id]
      );
      
      return result.insertId;
    } catch (error) {
      console.error('Error creating request:', error);
      throw error;
    }
  }
  async updateRequestStatus(id, status, comment = null) {
    try {
      const [result] = await pool.execute(
        'UPDATE requests SET status = ?, comment = ? WHERE id = ?',
        [status, comment, id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating request status:', error);
      throw error;
    }
  }
  async updateDeliveryInfo(id, deliveryData) {
    try {
      const { delivery_date, sender_id, receiver } = deliveryData;
      
      const [result] = await pool.execute(
        'UPDATE requests SET delivery_date = ?, sender_id = ?, receiver = ? WHERE id = ?',
        [delivery_date, sender_id, receiver, id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating delivery info:', error);
      throw error;
    }
  }
  async getRequestStats(filters = {}) {
    try {
      let query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered
        FROM requests r
        WHERE 1=1
      `;
      
      const params = [];
      if (filters.userId) {
        query += ' AND r.user_id = ?';
        params.push(filters.userId);
      }
      
      const [rows] = await pool.execute(query, params);
      return rows[0];
    } catch (error) {
      console.error('Error getting request stats:', error);
      throw error;
    }
  }
  async getRecentRequests(limit = 5, filters = {}) {
    try {
      let query = `
        SELECT 
          r.id,
          r.req_id,
          r.req_date,
          i.item_name,
          u.pic_name,
          r.status
        FROM requests r
        JOIN items i ON r.item_id = i.id
        JOIN users u ON r.user_id = u.user_id
        WHERE 1=1
      `;
      
      const params = [];
      if (filters.userId) {
        query += ' AND r.user_id = ?';
        params.push(filters.userId);
      }
      
      query += ' ORDER BY r.req_date DESC LIMIT ?';
      params.push(limit);
      
      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error getting recent requests:', error);
      throw error;
    }
  }
  async getRequestsByStatus(status, filters = {}) {
    try {
      let query = `
        SELECT 
          r.*,
          i.item_name,
          i.item_id,
          u.pic_name,
          d.dept_name
        FROM requests r
        JOIN items i ON r.item_id = i.id
        JOIN users u ON r.user_id = u.user_id
        JOIN departments d ON u.dept_id = d.id
        WHERE r.status = ?
      `;
      
      const params = [status];
      if (filters.userId) {
        query += ' AND r.user_id = ?';
        params.push(filters.userId);
      }
      
      query += ' ORDER BY r.req_date DESC';
      
      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error getting requests by status:', error);
      throw error;
    }
  }
  async generateRequestId(userDepartment) {
    try {
      const departmentCodes = {
        'IT': 'IT',
        'Finance': 'FIN',
        'HRGA Legal': 'HRG',
        'HR': 'HR',
        'Marketing': 'MKT',
        'Operations': 'OPS',
        'Procurement': 'PRC'
      };
      const deptCode = departmentCodes[userDepartment] || 
                      (userDepartment ? userDepartment.substring(0, 3).toUpperCase() : 'GEN');
      
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      
      const dateStr = `${year}${month}${day}`;
      const prefix = `${deptCode}-${dateStr}`;
      const [rows] = await pool.execute(
        'SELECT request_id FROM requests WHERE request_id LIKE ? ORDER BY request_id DESC LIMIT 1',
        [`${prefix}-%`]
      );
      
      let sequence = 1;
      if (rows.length > 0) {
        const lastId = rows[0].request_id;
        const lastSequencePart = lastId.split('-')[2]; 
        if (lastSequencePart) {
          const lastSequence = parseInt(lastSequencePart);
          if (!isNaN(lastSequence)) {
            sequence = lastSequence + 1;
          }
        }
      }
      
      return `${prefix}-${String(sequence).padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating request ID:', error);
      throw error;
    }
  }
}

module.exports = new RequestModel();