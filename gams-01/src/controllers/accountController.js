const { pool } = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here';
const ALGORITHM = 'aes-256-cbc';

function encryptPassword(password) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32)), iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    throw error;
  }
}

function decryptPassword(encryptedPassword) {
  try {
    const textParts = encryptedPassword.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = textParts.join(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32)), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    return null;
  }
}

class AccountController {
  static async getAllAccounts(req, res) {
    try {
      const user = req.session.user || req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      if (user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admin can manage accounts' });
      }
      const [users] = await pool.execute(`
        SELECT u.id, u.username, u.email, u.full_name, u.role, u.department, u.is_active, 
               u.created_at, u.updated_at, creator.full_name as created_by_name
        FROM users u
        LEFT JOIN users creator ON u.created_by = creator.id
        ORDER BY u.created_at DESC
      `);
      res.json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async createAccount(req, res) {
    try {
      const { username, password, email, full_name, role, department } = req.body;
      const user = req.session.user || req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      const createdBy = user.id;
      if (user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admin can create accounts' });
      }
      if (!username || !password || !email || !full_name || !role || !department) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
      }
      if (!['admin', 'cs', 'user'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }
      const [existingUsers] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
      if (existingUsers.length > 0) {
        return res.status(400).json({ success: false, message: 'Username already exists' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = await AccountController.generateUserId(department);
      let encryptedPassword = null;
      try {
        encryptedPassword = encryptPassword(password);
      } catch (encryptError) {}
      await pool.execute(
        'INSERT INTO users (username, password, email, full_name, role, department, is_active, created_by, encrypted_password, user_id) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)',
        [username, hashedPassword, email, full_name, role, department, createdBy, encryptedPassword, userId]
      );
      res.json({ success: true, message: 'Account created successfully', user_id: userId });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async generateUserId(department) {
    try {
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
      const deptCode = departmentCodes[department] || department.substring(0, 2).toUpperCase();
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
      throw error;
    }
  }

  static async updateAccount(req, res) {
    try {
      const { id } = req.params;
      const { username, email, full_name, role, department, is_active } = req.body;
      const user = req.session.user || req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      if (user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admin can update accounts' });
      }
      if (!username || !email || !full_name || !role || !department) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
      }
      const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }
      let activeStatus;
      if (typeof is_active === 'undefined') {
        activeStatus = users[0].is_active ? 1 : 0;
      } else {
        activeStatus = (is_active === true || is_active === 'true' || is_active === 1 || is_active === '1') ? 1 : 0;
      }
      await pool.execute(
        'UPDATE users SET username = ?, email = ?, full_name = ?, role = ?, department = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [username, email, full_name, role, department, activeStatus, id]
      );
      res.json({ success: true, message: 'Account updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async updatePassword(req, res) {
    try {
      const { id } = req.params;
      const { password } = req.body;
      const user = req.session.user || req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      if (user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admin can update passwords' });
      }
      if (!password || password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      }
      const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const encryptedPassword = encryptPassword(password);
      await pool.execute(
        'UPDATE users SET password = ?, encrypted_password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hashedPassword, encryptedPassword, id]
      );
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async deleteAccount(req, res) {
    try {
      const { id } = req.params;
      const user = req.session.user || req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      const currentUserId = user.id;
      if (user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admin can delete accounts' });
      }
      if (parseInt(id) === currentUserId) {
        return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
      }
      const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }
      await pool.execute('DELETE FROM users WHERE id = ?', [id]);
      res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async showPassword(req, res) {
    try {
      const { id } = req.params;
      const user = req.session.user || req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      if (user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admin can view passwords' });
      }
      const [users] = await pool.execute('SELECT username, encrypted_password, created_by FROM users WHERE id = ?', [id]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }
      const account = users[0];
      if (!account.created_by || account.created_by !== user.id) {
        return res.status(403).json({ success: false, message: 'You can only view passwords for accounts you created' });
      }
      let decryptedPassword = null;
      if (account.encrypted_password) {
        decryptedPassword = decryptPassword(account.encrypted_password);
      }
      if (decryptedPassword) {
        res.json({ 
          success: true, 
          data: { 
            username: account.username,
            password: decryptedPassword
          } 
        });
      } else {
        res.json({ 
          success: false, 
          message: 'Password cannot be decrypted. This account may have been created before the show password feature was implemented.'
        });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async getDepartments(req, res) {
    try {
      const departments = [
        'HRGA Legal',
        'CS',
        'HSE',
        'FAT (Finance Accounting Tax)',
        'Production',
        'QA/QC',
        'Purchasing',
        'PPIC Warehouse EXIM (Export Import)',
        'IT',
        'Sales',
        'Maintenance'
      ];
      res.json({ success: true, data: departments });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

module.exports = AccountController;
