const express = require('express');
const router = express.Router();
const ProfileController = require('../controllers/profileController');
const { isAuthenticated } = require('../middleware/authMiddleware');


router.use(isAuthenticated);
router.get('/', ProfileController.getProfile);
router.put('/', ProfileController.updateProfile);
router.put('/change-password', ProfileController.changePassword);
router.get('/activity', ProfileController.getUserActivity);

module.exports = router;