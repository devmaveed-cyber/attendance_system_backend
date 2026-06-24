const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema(
  {
    _id: { type: String },
    recordId: { type: String, required: true },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    branchId: {
      type: String,
      required: true,
    },
    branchName: {
      type: String,
      required: true,
      trim: true,
    },
    dateKey: {
      type: String,
      required: true,
      index: true,
    },
    checkInAt: Date,
    checkOutAt: Date,
    checkInLat: Number,
    checkInLng: Number,
    checkInAccuracy: Number,
    checkOutLat: Number,
    checkOutLng: Number,
    checkOutAccuracy: Number,
    checkInMethod: {
      type: String,
      enum: ['gps', 'nfc'],
    },
    checkInNfcUid: String,
    checkOutMethod: {
      type: String,
      enum: ['gps', 'nfc'],
    },
    checkOutNfcUid: String,
  },
  { timestamps: true }
);

attendanceRecordSchema.index({ userId: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
