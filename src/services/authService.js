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
const deviceBindingService = require('./deviceBindingService');

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

const formatBranchGeofence = (branch) => ({
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
});

// Returns all allowed branches with full geofence data for mobile NFC validation.
const resolveAllowedBranches = async (user) => {
  if (user.accountRole !== 'employee') {
    return [];
  }

  // Collect all branch IDs: allowedBranchIds takes priority, fall back to single branchId.
  const branchIds =
    user.allowedBranchIds && user.allowedBranchIds.length > 0
      ? user.allowedBranchIds
      : user.branchId?.trim()
      ? [user.branchId]
      : [];

  if (branchIds.length === 0) {
    return [];
  }

  const results = [];
  for (const id of branchIds) {
    try {
      const branch = await branchService.resolveActiveBranch(id);
      results.push(formatBranchGeofence(branch));
    } catch {
      // Skip missing/inactive branches silently.
    }
  }

  return results;
};

const buildAuthPayload = async (user) => {
  const token = signToken(user._id);
  const allowedSections = await resolveAllowedSections(user);
  const allowedBranches = await resolveAllowedBranches(user);

  return {
    user: sanitizeUser(user),
    token,
    allowedSections,
    // Keep assignedBranch pointing to first allowed branch for old app versions.
    assignedBranch: allowedBranches[0] || null,
    allowedBranches,
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

const ensureEmployeeDeviceAccess = async (user, deviceContext = {}) => {
  if (user.accountRole !== 'employee') {
    return;
  }

  await deviceBindingService.enforceDeviceBinding(user, deviceContext);
};

const login = async ({
  email,
  phone,
  password,
  deviceId,
  deviceName,
  platform,
}) => {
  const deviceContext = { deviceId, deviceName, platform };
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (normalizedEmail) {
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      throw new ApiError(401, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new ApiError(403, 'Account is disabled');
    }

    await ensureEmployeeDeviceAccess(user, deviceContext);

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

  const employeeUsers = users.filter((user) => user.accountRole === 'employee');
  const loginCandidates =
    employeeUsers.length > 0 ? employeeUsers : users;

  if (loginCandidates.length > 1) {
    throw new ApiError(
      409,
      'Multiple accounts are linked to this phone number. Contact your administrator.'
    );
  }

  const user = loginCandidates[0];

  if (!(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid phone number or password');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Account is disabled');
  }

  await ensureEmployeeDeviceAccess(user, deviceContext);

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
