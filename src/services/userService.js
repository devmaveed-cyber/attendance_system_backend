const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { sanitizeUser } = require('../utils/userPresenter');
const { buildPaginationMeta } = require('../utils/paginationUtils');
const groupService = require('./groupService');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildUserSearchFilter = (search = '') => {
  const filter = { accountRole: { $ne: 'employee' } };
  const normalized = search.trim();

  if (!normalized) {
    return filter;
  }

  const regex = new RegExp(escapeRegex(normalized), 'i');
  filter.$or = [
    { _id: regex },
    { name: regex },
    { email: regex },
    { phone: regex },
    { groupId: regex },
    { groupName: regex },
  ];

  return filter;
};

const getUsers = async ({ page = 1, limit = 25, search = '' } = {}) => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;
  const filter = buildUserSearchFilter(search);

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
    User.countDocuments(filter),
  ]);

  return {
    users: users.map(sanitizeUser),
    pagination: buildPaginationMeta({
      page: safePage,
      limit: safeLimit,
      total,
    }),
  };
};

const getAllUsers = async () => {
  const { users } = await getUsers({ page: 1, limit: 100 });
  return users;
};

const assertDashboardUser = (user) => {
  if (!user || user.accountRole === 'employee') {
    throw new ApiError(
      404,
      'Dashboard user not found. Manage employees from the Employees section.'
    );
  }
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

  if (payload.password !== undefined) {
    user.password = payload.password;
  }

  await user.save();
  return sanitizeUser(user);
};

module.exports = {
  getUsers,
  getAllUsers,
  createUser,
  updateUser,
};
