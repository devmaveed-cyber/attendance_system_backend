const Branch = require('../models/Branch');
const User = require('../models/User');
const NfcTag = require('../models/NfcTag');
const ApiError = require('../utils/ApiError');
const { sanitizeBranch } = require('../utils/userPresenter');

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
}) => {
  const branch = await Branch.create({
    name,
    address,
    latitude,
    longitude,
    radiusMeters,
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
