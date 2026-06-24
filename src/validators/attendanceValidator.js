const { body, query } = require('express-validator');
const { ATTENDANCE_MARK_TYPES } = require('../constants/attendanceConstants');
const { ID_PATTERN } = require('../utils/idGenerator');

const EMPLOYEE_ID_PATTERN = new RegExp(
  `^(${ID_PATTERN.EMPLOYEE.source.slice(1, -1)}|${ID_PATTERN.USER.source.slice(1, -1)})$`
);

const markAttendanceRules = [
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
];

const adminMarkEmployeeRules = [
  body('employeeId')
    .matches(EMPLOYEE_ID_PATTERN)
    .withMessage('Valid employeeId is required (format: EMP1234567 or USR1234567)'),
  body('type')
    .isIn(ATTENDANCE_MARK_TYPES)
    .withMessage(`type must be one of: ${ATTENDANCE_MARK_TYPES.join(', ')}`),
  body('latitude')
    .optional()
    .isFloat()
    .withMessage('latitude must be a valid number'),
  body('longitude')
    .optional()
    .isFloat()
    .withMessage('longitude must be a valid number'),
  body('accuracy')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('accuracy must be a positive number'),
];

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

module.exports = {
  markAttendanceRules,
  adminMarkEmployeeRules,
  todayAttendanceRules,
  overviewAttendanceRules,
  markNfcAttendanceRules,
};
