const userModel = require('../models/userModel');
const jwt = require('jsonwebtoken');
require('dotenv').config();

class AuthController {
  async login(req, res) {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username dan password diperlukan' });
      }
      
      const user = await userModel.getUserByUsername(username);
      console.log('Login attempt:', { username, found: !!user });
      if (!user) {
        return res.status(401).json({ success: false, message: 'Username atau password salah' });
      }
      
      const isPasswordValid = await userModel.verifyPassword(password, user.password);
      console.log('Password valid:', isPasswordValid);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: 'Username atau password salah' });
      }
      
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          role: user.role,
          department: user.department
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      req.session.user = {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        department: user.department
      };
      
      res.status(200).json({
        success: true,
        message: 'Login berhasil',
        token,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
          department: user.department
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
  
  async logout(req, res) {
    try {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Gagal logout' });
        }
        res.clearCookie('connect.sid');
        res.status(200).json({ success: true, message: 'Logout berhasil' });
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
  
  async checkAuth(req, res) {
    try {
      if (req.session && req.session.user) {
        return res.status(200).json({
          success: true,
          user: req.session.user
        });
      }
      
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Tidak terautentikasi'
        });
      }
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return res.status(200).json({
          success: true,
          user: {
            id: decoded.id,
            username: decoded.username,
            role: decoded.role,
            department: decoded.department
          }
        });
      } catch (jwtError) {
        return res.status(401).json({
          success: false,
          message: 'Token tidak valid atau kadaluarsa'
        });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
}

module.exports = new AuthController();
