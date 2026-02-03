const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const { isAuthenticated, isAdminOrCS } = require('../middleware/authMiddleware');

// Routes untuk admin dan CS
router.get('/', isAuthenticated, isAdminOrCS, calendarController.getAllEvents);
router.get('/today', isAuthenticated, isAdminOrCS, calendarController.getTodayEvents);
router.get('/this-week', isAuthenticated, isAdminOrCS, calendarController.getThisWeekEvents);
router.get('/range', isAuthenticated, isAdminOrCS, calendarController.getEventsByDateRange);
router.get('/date/:date', isAuthenticated, isAdminOrCS, calendarController.getEventsByDate);
router.get('/:id', isAuthenticated, isAdminOrCS, calendarController.getEventById);

// Routes untuk admin dan CS (create, update, delete)
router.post('/', isAuthenticated, isAdminOrCS, calendarController.createEvent);
router.put('/:id', isAuthenticated, isAdminOrCS, calendarController.updateEvent);
router.delete('/:id', isAuthenticated, isAdminOrCS, calendarController.deleteEvent);

module.exports = router;