const mongoose = require('mongoose');

const ATTENDANCE_METHODS = ['gps', 'nfc', 'manual'];

const attendanceSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true },
    branchId: { type: String, required: true },
    branchName: { type: String, required: true, trim: true },
    checkInAt: { type: Date, required: true },
    checkOutAt: Date,
    checkInLat: Number,
    checkInLng: Number,
    checkInAccuracy: Number,
    checkOutLat: Number,
    checkOutLng: Number,
    checkOutAccuracy: Number,
    checkInMethod: { type: String, enum: ATTENDANCE_METHODS },
    checkInNfcUid: String,
    checkOutMethod: { type: String, enum: ATTENDANCE_METHODS },
    checkOutNfcUid: String,
  },
  { _id: false }
);

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
      default: '',
    },
    branchName: {
      type: String,
      trim: true,
      default: '',
    },
    dateKey: {
      type: String,
      required: true,
      index: true,
    },
    // Legacy top-level fields kept for backward compat with old records.
    // New records use the sessions[] array exclusively.
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
      enum: ATTENDANCE_METHODS,
    },
    checkInNfcUid: String,
    checkOutMethod: {
      type: String,
      enum: ATTENDANCE_METHODS,
    },
    checkOutNfcUid: String,
    correctedBy: String,
    correctedByName: String,
    correctionReason: String,
    correctedAt: Date,
    // Multi-session support: each check-in/out pair is a session.
    sessions: {
      type: [attendanceSessionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Non-unique index: still one document per employee per day, enforced in service logic.
attendanceRecordSchema.index({ userId: 1, dateKey: 1 });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
module.exports.ATTENDANCE_METHODS = ATTENDANCE_METHODS;
