const { body, param } = require('express-validator');
const { ID_PATTERN } = require('../utils/idGenerator');

const EMPLOYEE_ID_PATTERN = new RegExp(
  `^(${ID_PATTERN.EMPLOYEE.source.slice(1, -1)}|${ID_PATTERN.USER.source.slice(1, -1)})$`
);

const employeeIdRule = param('id')
  .matches(EMPLOYEE_ID_PATTERN)
  .withMessage(
    'Invalid employee id format. Expected format: EMP1234567 or USR1234567'
  );

const createEmployeeRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('branchId')
    .matches(ID_PATTERN.BRANCH)
    .withMessage('Valid branchId is required (format: BRN1234567)'),
  body('phone').optional().trim(),
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
];

module.exports = {
  employeeIdRule,
  createEmployeeRules,
  updateEmployeeRules,
};
