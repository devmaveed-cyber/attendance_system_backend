const mongoose = require('mongoose');

const dashboardMetaSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    version: { type: Number, default: 1 },
    earliestDate: { type: String, default: null },
    latestDate: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'dashboard_meta',
  }
);

module.exports = mongoose.model('DashboardMeta', dashboardMetaSchema);
