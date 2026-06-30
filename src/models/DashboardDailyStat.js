const mongoose = require('mongoose');

const dashboardDailyStatSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    dateKey: { type: String, required: true, index: true },
    version: { type: Number, required: true, default: 1 },
    summary: {
      totalRows: { type: Number, default: 0 },
      employeeCount: { type: Number, default: 0 },
      checkedInCount: { type: Number, default: 0 },
      checkedOutCount: { type: Number, default: 0 },
      lateCount: { type: Number, default: 0 },
      earlyLeaveCount: { type: Number, default: 0 },
      onTimeCount: { type: Number, default: 0 },
    },
    byBranch: [
      {
        branchId: { type: String, default: '' },
        branchName: { type: String, default: '' },
        present: { type: Number, default: 0 },
        absent: { type: Number, default: 0 },
        completed: { type: Number, default: 0 },
      },
    ],
    byMethod: [
      {
        method: { type: String, default: 'unknown' },
        count: { type: Number, default: 0 },
      },
    ],
  },
  {
    timestamps: true,
    collection: 'dashboard_daily_stats',
  }
);

module.exports = mongoose.model('DashboardDailyStat', dashboardDailyStatSchema);
