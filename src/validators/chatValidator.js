const { body, param, query } = require('express-validator');

const conversationIdRule = param('id')
  .trim()
  .matches(/^support_[^/\\]+$/)
  .withMessage('Invalid conversation id format');

const listMessagesRules = [
  conversationIdRule,
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),
];

const sendMessageRules = [
  conversationIdRule,
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Message text is required')
    .isLength({ max: 4000 })
    .withMessage('Message cannot exceed 4000 characters'),
];

const employeeSendMessageRules = [
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Message text is required')
    .isLength({ max: 4000 })
    .withMessage('Message cannot exceed 4000 characters'),
];

module.exports = {
  conversationIdRule,
  listMessagesRules,
  sendMessageRules,
  employeeSendMessageRules,
  markReadRules: [conversationIdRule],
  getConversationRules: [conversationIdRule],
};
