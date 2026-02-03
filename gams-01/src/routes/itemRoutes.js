const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const { isAuthenticated, isAdmin, isAdminOrCS } = require('../middleware/authMiddleware');

// Routes untuk semua user yang sudah login
router.get('/', isAuthenticated, itemController.getAllItems);
router.get('/search', isAuthenticated, itemController.searchItems);
router.get('/low-stock', isAuthenticated, itemController.getLowStockItems);
router.get('/stock-report', isAuthenticated, itemController.getStockReport);
router.get('/:id', isAuthenticated, itemController.getItemById);

// Routes khusus admin dan CS
router.post('/', isAuthenticated, isAdminOrCS, itemController.createItem);
router.put('/:id', isAuthenticated, isAdmin, itemController.updateItem);
router.put('/:id/stock', isAuthenticated, isAdminOrCS, itemController.updateStock);

module.exports = router;