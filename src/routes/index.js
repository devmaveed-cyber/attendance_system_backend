const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const requireEmployee = require('../middleware/requireEmployee');
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
  markAttendanceRules,
  adminMarkEmployeeRules,
  todayAttendanceRules,
  overviewAttendanceRules,
  markNfcAttendanceRules,
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

router
  .route('/groups')
  .get(asyncHandler(groupController.getGroups))
  .post(createGroupRules, validate, asyncHandler(groupController.createGroup));

router.put(
  '/groups/:id',
  updateGroupRules,
  validate,
  asyncHandler(groupController.updateGroup)
);

router.use('/users', protect, requireAdmin);

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

router.get('/branches', asyncHandler(branchController.getBranches));

router.post(
  '/branches',
  requireAdmin,
  createBranchRules,
  validate,
  asyncHandler(branchController.createBranch)
);

router.put(
  '/branches/:id',
  requireAdmin,
  updateBranchRules,
  validate,
  asyncHandler(branchController.updateBranch)
);

router.use('/employees', protect, requireAdmin);

router
  .route('/employees')
  .get(asyncHandler(employeeController.getEmployees))
  .post(createEmployeeRules, validate, asyncHandler(employeeController.createEmployee));

router.put(
  '/employees/:id',
  updateEmployeeRules,
  validate,
  asyncHandler(employeeController.updateEmployee)
);

router.use('/nfc-tags', protect);

router.get(
  '/nfc-tags',
  listNfcTagsRules,
  validate,
  asyncHandler(nfcTagController.getNfcTags)
);

router.post(
  '/nfc-tags',
  requireAdmin,
  createNfcTagRules,
  validate,
  asyncHandler(nfcTagController.createNfcTag)
);

router.put(
  '/nfc-tags/:id',
  requireAdmin,
  updateNfcTagRules,
  validate,
  asyncHandler(nfcTagController.updateNfcTag)
);

router.use('/attendance', protect);

router.get(
  '/attendance/today',
  todayAttendanceRules,
  validate,
  asyncHandler(attendanceController.getTodayRecord)
);

router.get(
  '/attendance/overview',
  overviewAttendanceRules,
  validate,
  asyncHandler(attendanceController.getOverview)
);

router.post(
  '/attendance/mark',
  requireEmployee,
  markAttendanceRules,
  validate,
  asyncHandler(attendanceController.markAttendance)
);

router.post(
  '/attendance/mark-nfc',
  requireEmployee,
  markNfcAttendanceRules,
  validate,
  asyncHandler(attendanceController.markNfcAttendance)
);

router.post(
  '/attendance/mark-employee',
  requireAdmin,
  adminMarkEmployeeRules,
  validate,
  asyncHandler(attendanceController.markEmployeeAttendance)
);

module.exports = router;
