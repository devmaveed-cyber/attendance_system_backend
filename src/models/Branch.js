const mongoose = require('mongoose');
const { generateCustomId, ID_PREFIX } = require('../utils/idGenerator');
const {
  DEFAULT_BRANCH_RADIUS_METERS,
  DEFAULT_SHIFT_START,
  DEFAULT_SHIFT_END,
  DEFAULT_GRACE_MINUTES_LATE,
} = require('../constants/attendanceConstants');

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
    geofenceType: {
      type: String,
      enum: ['circle', 'polygon'],
      default: 'circle',
    },
    boundaryPoints: {
      type: [
        {
          lat: { type: Number, required: true },
          lng: { type: Number, required: true },
        },
      ],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    shiftStartTime: {
      type: String,
      default: DEFAULT_SHIFT_START,
      trim: true,
    },
    shiftEndTime: {
      type: String,
      default: DEFAULT_SHIFT_END,
      trim: true,
    },
    graceMinutesLate: {
      type: Number,
      default: DEFAULT_GRACE_MINUTES_LATE,
      min: [0, 'Grace minutes cannot be negative'],
      max: [120, 'Grace minutes cannot exceed 120'],
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
