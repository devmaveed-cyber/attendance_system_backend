const { body, param } = require('express-validator');
const { ID_PATTERN } = require('../utils/idGenerator');

const userIdRule = param('id')
  .matches(ID_PATTERN.USER)
  .withMessage('Invalid user id format. Expected format: USR1234567');

const createUserRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('groupId')
    .matches(ID_PATTERN.GROUP)
    .withMessage('Valid groupId is required (format: GRP1234567)'),
  body('phone').optional().trim(),
];

const updateUserRules = [
  userIdRule,
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty'),
  body('phone').optional().trim(),
  body('groupId')
    .optional()
    .matches(ID_PATTERN.GROUP)
    .withMessage('Invalid group id format. Expected format: GRP1234567'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

module.exports = {
  userIdRule,
  createUserRules,
  updateUserRules,
  deleteUserRules: [userIdRule],
};
