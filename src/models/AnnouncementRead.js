const mongoose = require('mongoose');

const announcementReadSchema = new mongoose.Schema(
  {
    announcementId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

announcementReadSchema.index(
  { announcementId: 1, userId: 1 },
  { unique: true }
);

module.exports = mongoose.model('AnnouncementRead', announcementReadSchema);
