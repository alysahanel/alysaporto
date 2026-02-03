const jwt = require('jsonwebtoken');
require('dotenv').config();

console.log('JWT_SECRET loaded:', process.env.JWT_SECRET ? 'Yes' : 'No');
const isAuthenticated = (req, res, next) => {
  console.log('isAuthenticated middleware called'); 
  if (req.session && req.session.user) {
    console.log('User found in session:', req.session.user); 
    req.user = req.session.user;
    return next();
  }
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    console.log('No token found'); 
    return res.status(401).json({ success: false, message: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }
  
  try {
    console.log('Verifying token with secret:', process.env.JWT_SECRET);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded successfully:', decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    res.status(401).json({ success: false, message: 'Token tidak valid atau kadaluarsa' });
  }
};
const isAdmin = (req, res, next) => {
  console.log('isAdmin middleware called'); 
  
  const user = req.session.user || req.user;
  
  console.log('isAdmin - User object:', user);
  
  if (!user) {
    console.log('isAdmin - No user found'); 
    return res.status(401).json({ success: false, message: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }
  const isAdminUser = user.role === 'admin';
  
  console.log('isAdmin - Role check:', { 
    userRole: user.role, 
    isAdminUser 
  });
  
  if (!isAdminUser) {
    console.log('isAdmin - Access denied for role:', user.role); 
    return res.status(403).json({ success: false, message: 'Akses ditolak. Anda tidak memiliki izin admin.' });
  }
  
  console.log('isAdmin - Access granted for role:', user.role); 
  next();
};
const isCS = (req, res, next) => {
  console.log('isCS middleware called'); 
  
  const user = req.session.user || req.user;
  
  console.log('isCS - User object:', user);
  
  if (!user) {
    console.log('isCS - No user found');
    return res.status(401).json({ success: false, message: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }
  const isCSUser = user.role === 'cs';
  
  console.log('isCS - Role check:', { 
    userRole: user.role, 
    isCSUser 
  });
  
  if (!isCSUser) {
    console.log('isCS - Access denied for role:', user.role); 
    return res.status(403).json({ success: false, message: 'Akses ditolak. Anda tidak memiliki izin CS.' });
  }
  
  console.log('isCS - Access granted for role:', user.role); 
  next();
};

const isAdminOrCS = (req, res, next) => {
  const user = req.session.user || req.user;
  if (!user) {
    console.log('isAdminOrCS - No user found'); 
    return res.status(401).json({ success: false, message: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }
  
  const isAdminUser = user.role === 'admin';
  const isCSUser = user.role === 'cs';
  
  console.log('isAdminOrCS - Role check:', { 
    userRole: user.role, 
    isAdminUser, 
    isCSUser 
  });
  
  if (!isAdminUser && !isCSUser) {
    return res.status(403).json({ success: false, message: 'Only admin and CS can access this resource' });
  }
  next();
};

module.exports = {
  isAuthenticated,
  isAdmin,
  isCS,
  isAdminOrCS
};