const { body, query } = require('express-validator');
const { ATTENDANCE_MARK_TYPES } = require('../constants/attendanceConstants');
const { ID_PATTERN } = require('../utils/idGenerator');

const EMPLOYEE_ID_PATTERN = new RegExp(
  `^(${ID_PATTERN.EMPLOYEE.source.slice(1, -1)}|${ID_PATTERN.USER.source.slice(1, -1)})$`
);

const todayAttendanceRules = [
  query('employeeId')
    .optional()
    .matches(EMPLOYEE_ID_PATTERN)
    .withMessage(
      'Invalid employeeId format. Expected format: EMP1234567 or USR1234567'
    ),
];

const overviewAttendanceRules = [
  query('date')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('date must be YYYY-MM-DD'),
  query('startDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('startDate must be YYYY-MM-DD'),
  query('endDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('endDate must be YYYY-MM-DD'),
  query('branchId')
    .optional()
    .matches(ID_PATTERN.BRANCH)
    .withMessage('Invalid branchId format. Expected format: BRN1234567'),
  query('search').optional().trim().isLength({ max: 100 }),
  query('includeInactive')
    .optional()
    .isBoolean()
    .withMessage('includeInactive must be a boolean'),
];

const markNfcAttendanceRules = [
  body('type')
    .isIn(ATTENDANCE_MARK_TYPES)
    .withMessage(`type must be one of: ${ATTENDANCE_MARK_TYPES.join(', ')}`),
  body('latitude').isFloat().withMessage('Valid latitude is required'),
  body('longitude').isFloat().withMessage('Valid longitude is required'),
  body('accuracy')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('accuracy must be a positive number'),
  body('dateKey')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('dateKey must be YYYY-MM-DD'),
  body('nfcTagId')
    .optional()
    .matches(ID_PATTERN.NFC)
    .withMessage('Invalid nfcTagId format. Expected format: NFC1234567'),
  body('tagUid')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('tagUid cannot be empty'),
  body().custom((_, { req }) => {
    if (!req.body.nfcTagId && !req.body.tagUid) {
      throw new Error('nfcTagId or tagUid is required');
    }
    return true;
  }),
];

const correctAttendanceRules = [
  body('employeeId')
    .matches(EMPLOYEE_ID_PATTERN)
    .withMessage(
      'Invalid employeeId format. Expected format: EMP1234567 or USR1234567'
    ),
  body('dateKey')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('dateKey must be YYYY-MM-DD'),
  body('checkInAt')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('checkInAt must be a valid ISO date-time'),
  body('checkOutAt')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('checkOutAt must be a valid ISO date-time'),
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Correction reason is required')
    .isLength({ min: 3, max: 500 })
    .withMessage('Reason must be between 3 and 500 characters'),
  body().custom((_, { req }) => {
    if (
      req.body.checkInAt === undefined &&
      req.body.checkOutAt === undefined
    ) {
      throw new Error('Provide at least one of checkInAt or checkOutAt');
    }
    return true;
  }),
];

const clearAttendanceRules = [
  body('employeeId')
    .matches(EMPLOYEE_ID_PATTERN)
    .withMessage(
      'Invalid employeeId format. Expected format: EMP1234567 or USR1234567'
    ),
  body('dateKey')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('dateKey must be YYYY-MM-DD'),
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Reason is required')
    .isLength({ min: 3, max: 500 })
    .withMessage('Reason must be between 3 and 500 characters'),
];

module.exports = {
  todayAttendanceRules,
  overviewAttendanceRules,
  markNfcAttendanceRules,
  correctAttendanceRules,
  clearAttendanceRules,
};
