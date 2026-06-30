const dashboardStatsService = require('../services/dashboardStatsService');

const getSummary = async (req, res) => {
  const trendDays = req.query.trendDays;
  const summary = await dashboardStatsService.getSummary(req.user, { trendDays });

  res.status(200).json({
    success: true,
    data: { summary },
  });
};

module.exports = {
  getSummary,
};
