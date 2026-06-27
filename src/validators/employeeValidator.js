const { body, param } = require('express-validator');
const { ID_PATTERN } = require('../utils/idGenerator');
const {
  EMP_NO_PATTERN,
  EMPLOYEE_ROUTE_ID_PATTERN,
} = require('../utils/employeeId');

const employeeIdRule = param('id')
  .matches(EMPLOYEE_ROUTE_ID_PATTERN)
  .withMessage(
    'Invalid employee id format. Expected format: 10250 (EMP No) or legacy EMP1234567'
  );

const createEmployeeRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('empNo')
    .trim()
    .notEmpty()
    .withMessage('EMP number is required')
    .matches(EMP_NO_PATTERN)
    .withMessage('EMP number must be 4 to 10 digits'),
  body('branchId')
    .matches(ID_PATTERN.BRANCH)
    .withMessage('Valid branchId is required (format: BRN1234567)'),
  body('phone').optional().trim(),
  body('department').optional().trim(),
  body('jobPosition').optional().trim(),
  body('workingHours').optional().trim(),
  body('gender').optional().trim(),
  body('nationality').optional().trim(),
  body('instructorPermitNo').optional().trim(),
  body('company').optional().trim(),
  body('gearType').optional().trim(),
  body('instructorLicenseTypes').optional().trim(),
  body('hrCreatedBy').optional().trim(),
  body('manager').optional().trim(),
  body('visaExpiryDate')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') return true;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('visaExpiryDate must be a valid date');
      }
      return true;
    }),
  body('hrCreatedOn')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') return true;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('hrCreatedOn must be a valid date');
      }
      return true;
    }),
];

const updateEmployeeRules = [
  employeeIdRule,
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty'),
  body('phone').optional().trim(),
  body('branchId')
    .optional()
    .matches(ID_PATTERN.BRANCH)
    .withMessage('Invalid branch id format. Expected format: BRN1234567'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('department').optional().trim(),
  body('jobPosition').optional().trim(),
  body('workingHours').optional().trim(),
  body('gender').optional().trim(),
  body('nationality').optional().trim(),
  body('instructorPermitNo').optional().trim(),
  body('company').optional().trim(),
  body('gearType').optional().trim(),
  body('instructorLicenseTypes').optional().trim(),
  body('hrCreatedBy').optional().trim(),
  body('manager').optional().trim(),
  body('visaExpiryDate')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') return true;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('visaExpiryDate must be a valid date');
      }
      return true;
    }),
  body('hrCreatedOn')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') return true;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('hrCreatedOn must be a valid date');
      }
      return true;
    }),
];

module.exports = {
  employeeIdRule,
  createEmployeeRules,
  updateEmployeeRules,
  deleteEmployeeRules: [employeeIdRule],
};
