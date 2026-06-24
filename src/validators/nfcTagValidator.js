const { body, param, query } = require('express-validator');
const { ID_PATTERN } = require('../utils/idGenerator');

const nfcTagIdRule = param('id')
  .matches(ID_PATTERN.NFC)
  .withMessage('Invalid NFC tag id format. Expected format: NFC1234567');

const listNfcTagsRules = [
  query('branchId')
    .optional()
    .matches(ID_PATTERN.BRANCH)
    .withMessage('Invalid branchId format. Expected format: BRN1234567'),
  query('search').optional().trim().isLength({ max: 100 }),
];

const createNfcTagRules = [
  body('branchId')
    .matches(ID_PATTERN.BRANCH)
    .withMessage('Valid branchId is required (format: BRN1234567)'),
  body('tagUid').trim().notEmpty().withMessage('NFC tag UID is required'),
  body('label').optional().trim().isLength({ max: 100 }),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const updateNfcTagRules = [
  nfcTagIdRule,
  body('branchId')
    .optional()
    .matches(ID_PATTERN.BRANCH)
    .withMessage('Invalid branchId format. Expected format: BRN1234567'),
  body('tagUid')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('tagUid cannot be empty'),
  body('label').optional().trim().isLength({ max: 100 }),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

module.exports = {
  nfcTagIdRule,
  listNfcTagsRules,
  createNfcTagRules,
  updateNfcTagRules,
};
