const { body, param, query } = require('express-validator');
const { ID_PATTERN } = require('../utils/idGenerator');

const announcementIdRule = param('id')
  .trim()
  .matches(ID_PATTERN.ANNOUNCEMENT)
  .withMessage('Invalid announcement id format');

const listAnnouncementsRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),
  query('search').optional().isString().withMessage('search must be a string'),
];

const listMyAnnouncementsRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),
];

const createAnnouncementRules = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('body')
    .trim()
    .notEmpty()
    .withMessage('Message body is required')
    .isLength({ max: 5000 })
    .withMessage('Message cannot exceed 5000 characters'),
];

module.exports = {
  announcementIdRule,
  listAnnouncementsRules,
  listMyAnnouncementsRules,
  createAnnouncementRules,
  deleteAnnouncementRules: [announcementIdRule],
  getMyAnnouncementRules: [announcementIdRule],
  markReadRules: [announcementIdRule],
};
