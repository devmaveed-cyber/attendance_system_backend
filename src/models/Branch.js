const mongoose = require('mongoose');
const { generateCustomId, ID_PREFIX } = require('../utils/idGenerator');
const { DEFAULT_BRANCH_RADIUS_METERS } = require('../constants/attendanceConstants');

const branchSchema = new mongoose.Schema(
  {
    _id: { type: String },
    name: {
      type: String,
      required: [true, 'Branch name is required'],
      trim: true,
      maxlength: [100, 'Branch name cannot exceed 100 characters'],
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
    },
    radiusMeters: {
      type: Number,
      default: DEFAULT_BRANCH_RADIUS_METERS,
      min: [10, 'Radius must be at least 10 meters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

branchSchema.pre('validate', async function assignBranchId(next) {
  if (this.isNew && !this._id) {
    this._id = await generateCustomId(ID_PREFIX.BRANCH);
  }

  next();
});

module.exports = mongoose.model('Branch', branchSchema);
