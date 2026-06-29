const User = require('../models/User');
const Group = require('../models/Group');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/token');
const { sanitizeUser } = require('../utils/userPresenter');
const { APP_SECTIONS } = require('../constants/appSections');
const { normalizePhone } = require('../utils/phoneUtils');
const { findUsersByPhone, assertPhoneAvailable } = require('../utils/userPhone');
const branchService = require('./branchService');
const { ensureBootstrapGroups } = require('./groupService');

const resolveAllowedSections = async (user) => {
  if (user.accountRole === 'employee') {
    return ['attendance'];
  }

  if (user.accountRole === 'admin' && !user.groupId?.trim()) {
    return [...APP_SECTIONS];
  }

  if (!user.groupId?.trim()) {
    return ['dashboard', 'attendance'];
  }

  await ensureBootstrapGroups();

  const group = await Group.findById(user.groupId);
  if (!group || !group.isActive) {
    return ['dashboard', 'attendance'];
  }

  return group.sections.filter((section) => APP_SECTIONS.includes(section));
};

const resolveAssignedBranch = async (user) => {
  if (user.accountRole !== 'employee' || !user.branchId?.trim()) {
    return null;
  }

  try {
    const branch = await branchService.resolveActiveBranch(user.branchId);
    return {
      branchId: branch._id,
      name: branch.name,
      latitude: branch.latitude,
      longitude: branch.longitude,
      radiusMeters: branch.radiusMeters,
      geofenceType: branch.geofenceType || 'circle',
      boundaryPoints: Array.isArray(branch.boundaryPoints)
        ? branch.boundaryPoints.map((point) => ({
            lat: point.lat,
            lng: point.lng,
          }))
        : [],
    };
  } catch {
    return null;
  }
};

const buildAuthPayload = async (user) => {
  const token = signToken(user._id);
  const allowedSections = await resolveAllowedSections(user);
  const assignedBranch = await resolveAssignedBranch(user);

  return {
    user: sanitizeUser(user),
    token,
    allowedSections,
    assignedBranch,
  };
};

const register = async ({ name, email, password, phone }) => {
  const env = require('../config/env');

  if (!env.allowPublicRegister) {
    throw new ApiError(403, 'Public registration is disabled');
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new ApiError(409, 'Email already registered');
  }

  const normalizedPhone = await assertPhoneAvailable(phone);

  const user = await User.create({
    name,
    email,
    password,
    phone: normalizedPhone,
    accountRole: 'admin',
  });

  return buildAuthPayload(user);
};

const login = async ({ email, phone, password }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (normalizedEmail) {
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      throw new ApiError(401, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new ApiError(403, 'Account is disabled');
    }

    return buildAuthPayload(user);
  }

  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    throw new ApiError(401, 'Invalid phone number or password');
  }

  const users = await findUsersByPhone(normalizedPhone, { includePassword: true });

  if (users.length === 0) {
    throw new ApiError(401, 'Invalid phone number or password');
  }

  if (users.length > 1) {
    throw new ApiError(
      409,
      'Multiple accounts are linked to this phone number. Contact your administrator.'
    );
  }

  const user = users[0];

  if (!(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid phone number or password');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Account is disabled');
  }

  return buildAuthPayload(user);
};

const getProfile = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const allowedSections = await resolveAllowedSections(user);
  const assignedBranch = await resolveAssignedBranch(user);

  return {
    user: sanitizeUser(user),
    allowedSections,
    assignedBranch,
  };
};

module.exports = { register, login, getProfile, resolveAllowedSections };
