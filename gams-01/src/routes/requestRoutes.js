const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const { isAuthenticated, isAdmin, isCS } = require('../middleware/authMiddleware');

router.get('/', isAuthenticated, requestController.getAllRequests);
router.get('/dashboard', isAuthenticated, requestController.getDashboardData);
router.get('/:id', isAuthenticated, requestController.getRequestById);
router.post('/', isAuthenticated, requestController.createRequest);
router.put('/:id/status', isAuthenticated, isAdmin, requestController.updateRequestStatus);
router.put('/:id/delivery', isAuthenticated, isCS, requestController.updateDeliveryInfo);

module.exports = router;