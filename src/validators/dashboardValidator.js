const { query } = require('express-validator');
const { MAX_TREND_DAYS } = require('../services/dashboardStatsService');

const dashboardSummaryRules = [
  query('trendDays')
    .optional()
    .isInt({ min: 1, max: MAX_TREND_DAYS })
    .withMessage(`trendDays must be between 1 and ${MAX_TREND_DAYS}`),
];

module.exports = {
  dashboardSummaryRules,
};
