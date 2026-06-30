const mongoose = require('mongoose');
const { generateCustomId, ID_PREFIX } = require('../utils/idGenerator');

const announcementSchema = new mongoose.Schema(
  {
    _id: { type: String },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: [true, 'Message body is required'],
      trim: true,
      maxlength: 5000,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
    },
    createdByName: {
      type: String,
      trim: true,
      default: '',
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    targetType: {
      type: String,
      enum: ['all'],
      default: 'all',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

announcementSchema.index({ publishedAt: -1 });
announcementSchema.index({ isActive: 1, publishedAt: -1 });

announcementSchema.pre('validate', async function assignAnnouncementId(next) {
  if (this.isNew && !this._id) {
    this._id = await generateCustomId(ID_PREFIX.ANNOUNCEMENT);
  }

  next();
});

module.exports = mongoose.model('Announcement', announcementSchema);
