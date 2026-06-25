const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const requireEmployee = require('../middleware/requireEmployee');
const requireAnySection = require('../middleware/requireSection');
const { excelUpload } = require('../middleware/upload');
const authController = require('../controllers/authController');
const groupController = require('../controllers/groupController');
const userController = require('../controllers/userController');
const branchController = require('../controllers/branchController');
const employeeController = require('../controllers/employeeController');
const nfcTagController = require('../controllers/nfcTagController');
const attendanceController = require('../controllers/attendanceController');
const {
  registerRules,
  loginRules,
} = require('../validators/authValidator');
const {
  createGroupRules,
  updateGroupRules,
  deleteGroupRules,
} = require('../validators/groupValidator');
const {
  userIdRule,
  createUserRules,
  updateUserRules,
} = require('../validators/userValidator');
const {
  createBranchRules,
  updateBranchRules,
} = require('../validators/branchValidator');
const {
  createEmployeeRules,
  updateEmployeeRules,
} = require('../validators/employeeValidator');
const {
  listNfcTagsRules,
  createNfcTagRules,
  updateNfcTagRules,
} = require('../validators/nfcTagValidator');
const {
  todayAttendanceRules,
  overviewAttendanceRules,
  markNfcAttendanceRules,
  correctAttendanceRules,
  clearAttendanceRules,
} = require('../validators/attendanceValidator');

const router = express.Router();

router.post(
  '/auth/register',
  registerRules,
  validate,
  asyncHandler(authController.register)
);

router.post(
  '/auth/login',
  loginRules,
  validate,
  asyncHandler(authController.login)
);

router.get('/auth/me', protect, asyncHandler(authController.getMe));

router.use('/groups', protect, requireAdmin);

router.get(
  '/groups',
  requireAnySection('groups', 'users'),
  asyncHandler(groupController.getGroups)
);

router.post(
  '/groups',
  requireAnySection('groups'),
  createGroupRules,
  validate,
  asyncHandler(groupController.createGroup)
);

router.put(
  '/groups/:id',
  requireAnySection('groups'),
  updateGroupRules,
  validate,
  asyncHandler(groupController.updateGroup)
);

router.delete(
  '/groups/:id',
  requireAnySection('groups'),
  deleteGroupRules,
  validate,
  asyncHandler(groupController.deleteGroup)
);

router.use('/users', protect, requireAdmin, requireAnySection('users'));

router
  .route('/users')
  .get(asyncHandler(userController.getUsers))
  .post(createUserRules, validate, asyncHandler(userController.createUser));

router.put(
  '/users/:id',
  updateUserRules,
  validate,
  asyncHandler(userController.updateUser)
);

router.use('/branches', protect);

router.get(
  '/branches',
  requireAnySection('dashboard', 'branches', 'employees', 'nfcTags'),
  asyncHandler(branchController.getBranches)
);

router.post(
  '/branches',
  requireAdmin,
  requireAnySection('branches'),
  createBranchRules,
  validate,
  asyncHandler(branchController.createBranch)
);

router.put(
  '/branches/:id',
  requireAdmin,
  requireAnySection('branches'),
  updateBranchRules,
  validate,
  asyncHandler(branchController.updateBranch)
);

router.use('/employees', protect, requireAdmin, requireAnySection('employees'));

router
  .route('/employees')
  .get(asyncHandler(employeeController.getEmployees))
  .post(createEmployeeRules, validate, asyncHandler(employeeController.createEmployee));

router.post(
  '/employees/bulk-import',
  excelUpload.single('file'),
  asyncHandler(employeeController.bulkImportEmployees)
);

router.put(
  '/employees/:id',
  updateEmployeeRules,
  validate,
  asyncHandler(employeeController.updateEmployee)
);

router.use('/nfc-tags', protect);

router.get(
  '/nfc-tags',
  requireAnySection('nfcTags'),
  listNfcTagsRules,
  validate,
  asyncHandler(nfcTagController.getNfcTags)
);

router.post(
  '/nfc-tags',
  requireAdmin,
  requireAnySection('nfcTags'),
  createNfcTagRules,
  validate,
  asyncHandler(nfcTagController.createNfcTag)
);

router.put(
  '/nfc-tags/:id',
  requireAdmin,
  requireAnySection('nfcTags'),
  updateNfcTagRules,
  validate,
  asyncHandler(nfcTagController.updateNfcTag)
);

router.use('/attendance', protect);

router.get(
  '/attendance/today',
  requireAnySection('attendance'),
  todayAttendanceRules,
  validate,
  asyncHandler(attendanceController.getTodayRecord)
);

router.get(
  '/attendance/overview',
  requireAnySection('attendance'),
  overviewAttendanceRules,
  validate,
  asyncHandler(attendanceController.getOverview)
);

router.post(
  '/attendance/mark-nfc',
  requireEmployee,
  markNfcAttendanceRules,
  validate,
  asyncHandler(attendanceController.markNfcAttendance)
);

router.put(
  '/attendance/correct',
  requireAdmin,
  requireAnySection('attendance'),
  correctAttendanceRules,
  validate,
  asyncHandler(attendanceController.correctAttendance)
);

router.delete(
  '/attendance/correct',
  requireAdmin,
  requireAnySection('attendance'),
  clearAttendanceRules,
  validate,
  asyncHandler(attendanceController.clearAttendance)
);

module.exports = router;
