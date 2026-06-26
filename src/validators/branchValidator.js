const { body, param } = require('express-validator');
const { ID_PATTERN } = require('../utils/idGenerator');
const { TIME_PATTERN } = require('../utils/shiftUtils');

const timeFieldRule = (field) =>
  body(field)
    .optional()
    .trim()
    .matches(TIME_PATTERN)
    .withMessage(`${field} must be in HH:mm format`);

const branchIdRule = param('id')
  .matches(ID_PATTERN.BRANCH)
  .withMessage('Invalid branch id format. Expected format: BRN1234567');

const createBranchRules = [
  body('name').trim().notEmpty().withMessage('Branch name is required'),
  body('address').optional().trim(),
  body('latitude').isFloat().withMessage('Valid latitude is required'),
  body('longitude').isFloat().withMessage('Valid longitude is required'),
  body('radiusMeters')
    .optional()
    .isFloat({ min: 10 })
    .withMessage('radiusMeters must be at least 10'),
  timeFieldRule('shiftStartTime'),
  timeFieldRule('shiftEndTime'),
  body('graceMinutesLate')
    .optional()
    .isInt({ min: 0, max: 120 })
    .withMessage('graceMinutesLate must be between 0 and 120'),
];

const updateBranchRules = [
  branchIdRule,
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Branch name cannot be empty'),
  body('address').optional().trim(),
  body('latitude')
    .optional()
    .isFloat()
    .withMessage('latitude must be a valid number'),
  body('longitude')
    .optional()
    .isFloat()
    .withMessage('longitude must be a valid number'),
  body('radiusMeters')
    .optional()
    .isFloat({ min: 10 })
    .withMessage('radiusMeters must be at least 10'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  timeFieldRule('shiftStartTime'),
  timeFieldRule('shiftEndTime'),
  body('graceMinutesLate')
    .optional()
    .isInt({ min: 0, max: 120 })
    .withMessage('graceMinutesLate must be between 0 and 120'),
];

const deleteBranchRules = [branchIdRule];

module.exports = {
  branchIdRule,
  createBranchRules,
  updateBranchRules,
  deleteBranchRules,
};
