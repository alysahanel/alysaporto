const { pool } = require('../config/database');
const bcrypt = require('bcrypt');

class UserModel {
  async getAllUsers() {
    try {
      const [rows] = await pool.execute(`
        SELECT u.id, u.username, u.pic_name, d.dept_name, r.role_name, 
        u.created_at, creator.username as created_by
        FROM users u
        LEFT JOIN departments d ON u.dept_id = d.id
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN users creator ON u.created_by = creator.id
        ORDER BY u.created_at DESC
      `);
      return rows;
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }
  async getUserById(id) {
    try {
      const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
      return rows[0];
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  async getUserByUsername(username) {
    try {
      const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
      return rows[0];
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  async createUser(userData) {
    try {
      const { username, password, pic_name, dept_id, role_id, created_by } = userData;
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = await this.generateUserId(dept_id);
      
      const [result] = await pool.execute(
        'INSERT INTO users (username, password, pic_name, dept_id, role_id, created_by, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [username, hashedPassword, pic_name, dept_id, role_id, created_by, userId]
      );
      
      return result.insertId;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }
  async generateUserId(dept_id) {
    try {
      const [deptRows] = await pool.execute('SELECT dept_name FROM departments WHERE id = ?', [dept_id]);
      const deptName = deptRows[0]?.dept_name || 'HRGA Legal';
      const departmentCodes = {
        'HRGA Legal': 'HRG',
        'IT': 'IT', 
        'Finance': 'FN',
        'HR': 'HR',
        'CS': 'CS',
        'Marketing': 'MK',
        'Operations': 'OP',
        'Sales': 'SL'
      };
      
      const deptCode = departmentCodes[deptName] || deptName.substring(0, 2).toUpperCase();
      const [existingIds] = await pool.execute(`
        SELECT user_id FROM users 
        WHERE user_id LIKE ? 
        ORDER BY user_id DESC 
        LIMIT 1
      `, [`${deptCode}-%`]);

      let nextNumber = 1;
      if (existingIds.length > 0) {
        const lastId = existingIds[0].user_id;
        const lastNumber = parseInt(lastId.split('-')[1]);
        nextNumber = lastNumber + 1;
      }
      const userIdNumber = nextNumber.toString().padStart(3, '0');
      return `${deptCode}-${userIdNumber}`;
      
    } catch (error) {
      console.error('Error generating user ID:', error);
      throw error;
    }
  }
  async updatePassword(userId, newPassword) {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      const [result] = await pool.execute(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, userId]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  }
  async verifyPassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error('Error verifying password:', error);
      throw error;
    }
  }
  async getAllRoles() {
    try {
      const [rows] = await pool.execute('SELECT * FROM roles');
      return rows;
    } catch (error) {
      console.error('Error getting all roles:', error);
      throw error;
    }
  }
  async getAllDepartments() {
    try {
      const [rows] = await pool.execute('SELECT * FROM departments');
      return rows;
    } catch (error) {
      console.error('Error getting all departments:', error);
      throw error;
    }
  }
}

module.exports = new UserModel();