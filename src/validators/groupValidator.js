const { body, param } = require('express-validator');
const { ID_PATTERN } = require('../utils/idGenerator');
const { APP_SECTIONS } = require('../constants/appSections');

const groupIdRule = param('id')
  .matches(ID_PATTERN.GROUP)
  .withMessage('Invalid group id format. Expected format: GRP1234567');

const createGroupRules = [
  body('name').trim().notEmpty().withMessage('Group name is required'),
  body('sections')
    .isArray({ min: 1 })
    .withMessage('sections must be a non-empty array'),
  body('sections.*')
    .isIn([...APP_SECTIONS, 'students'])
    .withMessage(`Each section must be one of: ${APP_SECTIONS.join(', ')}`),
];

const updateGroupRules = [
  groupIdRule,
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Group name cannot be empty'),
  body('sections')
    .optional()
    .isArray({ min: 1 })
    .withMessage('sections must be a non-empty array'),
  body('sections.*')
    .optional()
    .isIn([...APP_SECTIONS, 'students'])
    .withMessage(`Each section must be one of: ${APP_SECTIONS.join(', ')}`),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

module.exports = {
  groupIdRule,
  createGroupRules,
  updateGroupRules,
};
