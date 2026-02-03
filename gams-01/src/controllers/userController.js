const userModel = require('../models/userModel');

class UserController {
  async getAllUsers(req, res) {
    try {
      const users = await userModel.getAllUsers();
      res.status(200).json({ success: true, data: users });
    } catch (error) {
      console.error('Error getting all users:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await userModel.getUserById(id);
      
      if (!user) {
        return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
      }
      delete user.password;
      
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      console.error('Error getting user by ID:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
  async createUser(req, res) {
    try {
      const { username, password, pic_name, dept_id, role_id } = req.body;
      if (!username || !password || !pic_name || !dept_id || !role_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Semua field harus diisi (username, password, pic_name, dept_id, role_id)' 
        });
      }
      const existingUser = await userModel.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username sudah digunakan' });
      }
      const created_by = req.session.user.id;
      const userId = await userModel.createUser({
        username,
        password,
        pic_name,
        dept_id,
        role_id,
        created_by
      });
      
      res.status(201).json({ 
        success: true, 
        message: 'User berhasil dibuat', 
        data: { id: userId } 
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
  async updatePassword(req, res) {
    try {
      const { id } = req.params;
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ success: false, message: 'Password baru diperlukan' });
      }
      const user = await userModel.getUserById(id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
      }
      const updated = await userModel.updatePassword(id, password);
      
      if (updated) {
        res.status(200).json({ success: true, message: 'Password berhasil diupdate' });
      } else {
        res.status(400).json({ success: false, message: 'Gagal update password' });
      }
    } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
  async getAllRoles(req, res) {
    try {
      const roles = await userModel.getAllRoles();
      res.status(200).json({ success: true, data: roles });
    } catch (error) {
      console.error('Error getting all roles:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
  async getAllDepartments(req, res) {
    try {
      const departments = await userModel.getAllDepartments();
      res.status(200).json({ success: true, data: departments });
    } catch (error) {
      console.error('Error getting all departments:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
}

module.exports = new UserController();