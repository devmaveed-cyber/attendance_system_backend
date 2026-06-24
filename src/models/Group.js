const mongoose = require('mongoose');
const { generateCustomId, ID_PREFIX } = require('../utils/idGenerator');
const { APP_SECTIONS } = require('../constants/appSections');

const groupSchema = new mongoose.Schema(
  {
    _id: { type: String },
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      maxlength: [100, 'Group name cannot exceed 100 characters'],
    },
    sections: {
      type: [String],
      enum: APP_SECTIONS,
      validate: {
        validator: (sections) => Array.isArray(sections) && sections.length > 0,
        message: 'At least one section is required',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

groupSchema.pre('validate', async function assignGroupId(next) {
  if (this.isNew && !this._id) {
    this._id = await generateCustomId(ID_PREFIX.GROUP);
  }

  next();
});

module.exports = mongoose.model('Group', groupSchema);
