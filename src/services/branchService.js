const Branch = require('../models/Branch');
const User = require('../models/User');
const NfcTag = require('../models/NfcTag');
const ApiError = require('../utils/ApiError');
const { sanitizeBranch } = require('../utils/userPresenter');
const {
  validateShiftTime,
  validateShiftRange,
} = require('../utils/shiftUtils');
const {
  DEFAULT_SHIFT_START,
  DEFAULT_SHIFT_END,
  DEFAULT_GRACE_MINUTES_LATE,
} = require('../constants/attendanceConstants');

const resolveShiftFields = (payload, existingBranch = null) => {
  const shiftStartTime =
    validateShiftTime(payload.shiftStartTime, 'shiftStartTime') ??
    existingBranch?.shiftStartTime ??
    DEFAULT_SHIFT_START;
  const shiftEndTime =
    validateShiftTime(payload.shiftEndTime, 'shiftEndTime') ??
    existingBranch?.shiftEndTime ??
    DEFAULT_SHIFT_END;

  try {
    validateShiftRange(shiftStartTime, shiftEndTime);
  } catch (error) {
    throw new ApiError(400, error.message);
  }

  const graceMinutesLate =
    payload.graceMinutesLate !== undefined
      ? payload.graceMinutesLate
      : existingBranch?.graceMinutesLate ?? DEFAULT_GRACE_MINUTES_LATE;

  return { shiftStartTime, shiftEndTime, graceMinutesLate };
};

const getAllBranches = async () => {
  const branches = await Branch.find().sort({ createdAt: -1 });
  return branches.map(sanitizeBranch);
};

const resolveActiveBranch = async (branchId) => {
  const branch = await Branch.findById(branchId);

  if (!branch) {
    throw new ApiError(404, 'Selected branch was not found');
  }

  if (!branch.isActive) {
    throw new ApiError(400, 'Selected branch is inactive');
  }

  return branch;
};

const createBranch = async ({
  name,
  address,
  latitude,
  longitude,
  radiusMeters,
  shiftStartTime,
  shiftEndTime,
  graceMinutesLate,
}) => {
  const shiftFields = resolveShiftFields({
    shiftStartTime,
    shiftEndTime,
    graceMinutesLate,
  });

  const branch = await Branch.create({
    name,
    address,
    latitude,
    longitude,
    radiusMeters,
    ...shiftFields,
  });

  return sanitizeBranch(branch);
};

const updateBranch = async (branchId, payload) => {
  const branch = await Branch.findById(branchId);

  if (!branch) {
    throw new ApiError(404, 'Branch not found');
  }

  if (payload.name !== undefined) {
    branch.name = payload.name;
  }

  if (payload.address !== undefined) {
    branch.address = payload.address;
  }

  if (payload.latitude !== undefined) {
    branch.latitude = payload.latitude;
  }

  if (payload.longitude !== undefined) {
    branch.longitude = payload.longitude;
  }

  if (payload.radiusMeters !== undefined) {
    branch.radiusMeters = payload.radiusMeters;
  }

  if (payload.isActive !== undefined) {
    branch.isActive = payload.isActive;
  }

  const shiftFields = resolveShiftFields(payload, branch);
  branch.shiftStartTime = shiftFields.shiftStartTime;
  branch.shiftEndTime = shiftFields.shiftEndTime;
  branch.graceMinutesLate = shiftFields.graceMinutesLate;

  await branch.save();

  if (payload.name !== undefined) {
    await User.updateMany(
      { branchId: branch._id },
      { $set: { branchName: branch.name } }
    );
    await NfcTag.updateMany(
      { branchId: branch._id },
      { $set: { branchName: branch.name } }
    );
  }

  return sanitizeBranch(branch);
};

module.exports = {
  getAllBranches,
  resolveActiveBranch,
  createBranch,
  updateBranch,
};
