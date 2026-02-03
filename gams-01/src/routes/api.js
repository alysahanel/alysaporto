const express = require('express');
const router = express.Router();

const AuthController = require('../controllers/authController');
const RequestController = require('../controllers/requestController');
const StockController = require('../controllers/stockController');
const CalendarController = require('../controllers/calendarController');
const AccountController = require('../controllers/accountController');
const ItemController = require('../controllers/itemController');
const ExportController = require('../controllers/exportController');
const ReportController = require('../controllers/reportController');
const ProfileController = require('../controllers/profileController');
const { isAuthenticated, isAdmin, isAdminOrCS } = require('../middleware/authMiddleware');

router.post('/auth/login', AuthController.login);
router.post('/auth/logout', AuthController.logout);
router.get('/auth/check', AuthController.checkAuth);

router.use((req, res, next) => {
  console.log('Protected routes middleware hit for:', req.path); // Debug log
  next();
});
router.use(isAuthenticated);

// Dashboard routes
router.get('/dashboard/stats', RequestController.getDashboardStats);

// Request routes
router.get('/requests', RequestController.getAllRequests);
router.post('/requests', RequestController.createRequest);
router.put('/requests/:id/status', isAdmin, RequestController.updateRequestStatus);
router.put('/requests/:id/comment', isAdmin, RequestController.updateComment);
router.put('/requests/:id/delivery', isAdminOrCS, RequestController.updateDelivery);

// Stock/Items routes
router.get('/items', ItemController.getAllItems);
router.get('/items/search', ItemController.searchItems);
router.get('/items/low-stock', isAdminOrCS, ItemController.getLowStockItems);
router.get('/items/stock-report', isAdminOrCS, ItemController.getStockReport);
router.get('/items/:id', ItemController.getItemById);
router.post('/items', isAdminOrCS, ItemController.createItem);
router.put('/items/:id', isAdmin, ItemController.updateItem);
router.put('/items/:id/stock', isAdminOrCS, ItemController.updateStock);
router.delete('/items/:id', isAdminOrCS, ItemController.deleteItem);
router.post('/items/stock', isAdminOrCS, StockController.addStock);
router.get('/stock/report', isAdminOrCS, StockController.getStockReport);
router.put('/stock/update/:id', isAdminOrCS, StockController.updateStock);

// Calendar routes (admin and CS access)
router.get('/calendar/events', isAdminOrCS, CalendarController.getAllEvents);
router.get('/calendar/events/today', isAdminOrCS, CalendarController.getTodayEvents);
router.get('/calendar/events/this-week', isAdminOrCS, CalendarController.getThisWeekEvents);
router.get('/calendar/events/range', isAdminOrCS, CalendarController.getEventsByDateRange);
router.get('/calendar/events/date/:date', isAdminOrCS, CalendarController.getEventsByDate);
router.get('/calendar/events/:id', isAdminOrCS, CalendarController.getEventById);
router.post('/calendar/events', isAdminOrCS, CalendarController.createEvent);
router.put('/calendar/events/:id', isAdminOrCS, CalendarController.updateEvent);
router.delete('/calendar/events/:id', isAdminOrCS, CalendarController.deleteEvent);

// Account management routes (admin only)
router.get('/accounts', isAdmin, AccountController.getAllAccounts);
router.get('/accounts/:id/show-password', isAdmin, AccountController.showPassword);
router.post('/accounts', isAdmin, AccountController.createAccount);
router.put('/accounts/:id', isAdmin, AccountController.updateAccount);
router.put('/accounts/:id/password', isAdmin, AccountController.updatePassword);
router.delete('/accounts/:id', isAdmin, AccountController.deleteAccount);
router.get('/departments', isAdmin, AccountController.getDepartments);

// Profile routes (all authenticated users)
router.get('/profile', ProfileController.getProfile);
router.put('/profile', ProfileController.updateProfile);
router.put('/profile/change-password', ProfileController.changePassword);
router.get('/profile/activity', ProfileController.getUserActivity);

// Stock Report routes (admin and CS only)
router.get('/reports/stock', isAdminOrCS, ReportController.getStockReport);
router.post('/reports/stock', isAdminOrCS, ReportController.createStockReport);
router.put('/reports/stock/:id', isAdminOrCS, ReportController.updateStockReport);
router.delete('/reports/stock/:id', isAdminOrCS, ReportController.deleteStockReport);
router.get('/reports/stats', isAdminOrCS, ReportController.getReportStats);

// Export routes
router.get('/export/stock', isAdminOrCS, ExportController.exportStock);
router.get('/export/stock-report', isAdminOrCS, ExportController.exportStockReport);
router.get('/export/requests', isAuthenticated, ExportController.exportRequests);
router.get('/export/accounts', isAdmin, ExportController.exportAccounts);

module.exports = router;