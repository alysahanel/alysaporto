const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

router.get('/', isAuthenticated, isAdmin, userController.getAllUsers);
router.get('/:id', isAuthenticated, isAdmin, userController.getUserById);
router.post('/', isAuthenticated, isAdmin, userController.createUser);
router.put('/:id/password', isAuthenticated, isAdmin, userController.updatePassword);

router.get('/roles/all', isAuthenticated, isAdmin, userController.getAllRoles);
router.get('/departments/all', isAuthenticated, userController.getAllDepartments);

module.exports = router;