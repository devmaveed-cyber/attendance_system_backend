const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { sanitizeUser } = require('../utils/userPresenter');
const groupService = require('./groupService');

const assertDashboardUser = (user) => {
  if (!user || user.accountRole === 'employee') {
    throw new ApiError(
      404,
      'Dashboard user not found. Manage employees from the Employees section.'
    );
  }
};

const getAllUsers = async () => {
  const users = await User.find({ accountRole: { $ne: 'employee' } }).sort({
    createdAt: -1,
  });
  return users.map(sanitizeUser);
};

const createUser = async ({ name, email, password, phone, groupId }) => {
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new ApiError(409, 'A user with this email already exists');
  }

  const group = await groupService.resolveActiveGroup(groupId);

  const user = await User.create({
    name,
    email,
    password,
    phone,
    groupId: group._id,
    groupName: group.name,
    accountRole: 'admin',
  });

  return sanitizeUser(user);
};

const updateUser = async (userId, payload) => {
  const user = await User.findById(userId);
  assertDashboardUser(user);

  if (payload.name !== undefined) {
    user.name = payload.name;
  }

  if (payload.phone !== undefined) {
    user.phone = payload.phone;
  }

  if (payload.isActive !== undefined) {
    user.isActive = payload.isActive;
  }

  if (payload.groupId !== undefined) {
    const group = await groupService.resolveActiveGroup(payload.groupId);
    user.groupId = group._id;
    user.groupName = group.name;
  }

  await user.save();
  return sanitizeUser(user);
};

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
};
