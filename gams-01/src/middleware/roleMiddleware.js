const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      const userRole = req.user.role;

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.'
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
};

const adminOnly = checkRole(['admin']);
const adminAndCS = checkRole(['admin', 'cs']);
const allRoles = checkRole(['admin', 'cs', 'user']);
const canManageAccounts = checkRole(['admin']);
const canAccessCalendar = checkRole(['admin', 'cs']);
const canManageStock = checkRole(['admin', 'cs']);
const canApproveRequests = checkRole(['admin']);
const canDeliverItems = checkRole(['admin', 'cs']);
const canCreateRequests = checkRole(['admin', 'cs', 'user']);
const canViewAllRequests = checkRole(['admin', 'cs']);
const canExportData = checkRole(['admin', 'cs']);
const canManageItems = checkRole(['admin', 'cs']);

module.exports = {
  checkRole,
  adminOnly,
  adminAndCS,
  allRoles,
  canManageAccounts,
  canAccessCalendar,
  canManageStock,
  canApproveRequests,
  canDeliverItems,
  canCreateRequests,
  canViewAllRequests,
  canExportData,
  canManageItems
};