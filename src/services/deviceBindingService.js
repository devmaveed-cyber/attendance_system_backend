const User = require('../models/User');
const ApiError = require('../utils/ApiError');

const normalizeDeviceId = (deviceId) => String(deviceId || '').trim().toLowerCase();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findConflictingDeviceOwner = async (deviceId, excludeUserId) => {
  const normalizedId = normalizeDeviceId(deviceId);
  if (!normalizedId) {
    return null;
  }

  return User.findOne({
    accountRole: 'employee',
    _id: { $ne: excludeUserId },
    'boundDevice.deviceId': {
      $regex: new RegExp(`^${escapeRegex(normalizedId)}$`, 'i'),
    },
  }).select('name empNo boundDevice.deviceId');
};

/**
 * Enforces one registered phone per employee AND one employee per phone.
 *
 * Behaviour:
 *  - First login binds the current device to the employee account.
 *  - The same device cannot be bound to a second employee account.
 *  - Afterwards the employee must keep using that same device.
 *  - HR can reset device binding from the dashboard.
 *
 * `employee` is a Mongoose user document (already loaded by the caller).
 */
const enforceDeviceBinding = async (
  employee,
  { deviceId, deviceName, platform } = {}
) => {
  const normalizedId = normalizeDeviceId(deviceId);

  if (!normalizedId) {
    throw new ApiError(
      400,
      'Device verification failed. Please update the app to the latest version and try again.'
    );
  }

  const bound = employee.boundDevice || {};
  const hasBinding = Boolean(bound.deviceId);
  const boundId = normalizeDeviceId(bound.deviceId);

  if (!hasBinding) {
    const conflictingOwner = await findConflictingDeviceOwner(
      normalizedId,
      employee._id
    );

    if (conflictingOwner) {
      const ownerLabel = conflictingOwner.empNo || conflictingOwner._id;
      throw new ApiError(
        403,
        `This phone is already registered to employee ${ownerLabel}. Each device can only be linked to one employee account. Contact HR.`
      );
    }

    employee.boundDevice = {
      deviceId: normalizedId,
      deviceName: String(deviceName || '').trim(),
      platform: String(platform || '').trim(),
      boundAt: new Date(),
    };
    await employee.save();
    return { bound: true, justRegistered: true };
  }

  if (boundId !== normalizedId) {
    throw new ApiError(
      403,
      'This phone is not registered for your account. You can only log in from your registered device. Contact HR to reset your device.'
    );
  }

  // Same device — keep metadata fresh (name/platform may change after OS update).
  const nextName = String(deviceName || '').trim();
  const nextPlatform = String(platform || '').trim();
  if (
    (nextName && nextName !== bound.deviceName) ||
    (nextPlatform && nextPlatform !== bound.platform) ||
    bound.deviceId !== boundId
  ) {
    bound.deviceId = boundId;
    bound.deviceName = nextName || bound.deviceName;
    bound.platform = nextPlatform || bound.platform;
    await employee.save();
  }

  return { bound: true, justRegistered: false };
};

const resetDeviceForEmployee = async (employeeId) => {
  const employee = await User.findOne({
    _id: employeeId,
    accountRole: 'employee',
  });

  if (!employee) {
    throw new ApiError(404, 'Employee not found');
  }

  employee.boundDevice = {
    deviceId: '',
    deviceName: '',
    platform: '',
    boundAt: null,
  };
  await employee.save();

  return {
    employeeId: employee._id,
    name: employee.name,
    reset: true,
  };
};

module.exports = {
  enforceDeviceBinding,
  resetDeviceForEmployee,
};
