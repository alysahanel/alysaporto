const { pool } = require('../config/database');
const bcrypt = require('bcrypt');

class ProfileController {
  static async getProfile(req, res) {
    try {
      const user = req.session.user || req.user;
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const [users] = await pool.execute(
        'SELECT id, username, email, full_name, role, department, created_at, updated_at FROM users WHERE id = ?',
        [user.id]
      );

      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const userProfile = users[0];
      
      res.json({ 
        success: true, 
        data: userProfile 
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async updateProfile(req, res) {
    try {
      const user = req.session.user || req.user;
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const { email, full_name } = req.body;

      if (!email || !full_name) {
        return res.status(400).json({ success: false, message: 'Email and full name are required' });
      }

      await pool.execute(
        'UPDATE users SET email = ?, full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [email, full_name, user.id]
      );

      const [updatedUsers] = await pool.execute(
        'SELECT id, username, email, full_name, role, department FROM users WHERE id = ?',
        [user.id]
      );

      if (req.session.user) {
        req.session.user = { ...req.session.user, email, full_name };
      }

      res.json({ 
        success: true, 
        message: 'Profile updated successfully',
        data: updatedUsers[0]
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async changePassword(req, res) {
    try {
      const user = req.session.user || req.user;
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Current password and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
      }

      const [users] = await pool.execute(
        'SELECT id, password FROM users WHERE id = ?',
        [user.id]
      );

      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const currentUser = users[0];

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      await pool.execute(
        'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hashedNewPassword, user.id]
      );

      res.json({ 
        success: true, 
        message: 'Password changed successfully' 
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async getUserActivity(req, res) {
    try {
      const user = req.session.user || req.user;
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const userId = user.id;
      let activityData = {};

      const [requestStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_requests,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_requests,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_requests,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_requests
        FROM requests 
        WHERE user_id = ?
      `, [userId]);

      activityData.requestHistory = requestStats[0];

      const [recentRequests] = await pool.execute(`
        SELECT r.*, i.item_name, i.unit,
               DATE_FORMAT(r.created_at, '%Y-%m-%d') as request_date
        FROM requests r 
        JOIN items i ON r.item_id = i.id 
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC 
        LIMIT 5
      `, [userId]);

      activityData.recentRequests = recentRequests;

      const [topItems] = await pool.execute(`
        SELECT i.item_name, COUNT(*) as request_count
        FROM requests r 
        JOIN items i ON r.item_id = i.id 
        WHERE r.user_id = ?
        GROUP BY r.item_id, i.item_name
        ORDER BY request_count DESC 
        LIMIT 5
      `, [userId]);

      activityData.topRequestedItems = topItems;

      res.json({ 
        success: true, 
        data: activityData 
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

module.exports = ProfileController;
