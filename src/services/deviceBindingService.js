const User = require('../models/User');
const ApiError = require('../utils/ApiError');

/**
 * Enforces that an employee can only mark attendance from the single device
 * their account is bound to.
 *
 * Behaviour (soft binding + HR reset):
 *  - First time an employee marks attendance, their current device is bound.
 *  - Afterwards every mark must come from the same device.
 *  - If a different device is used, the mark is rejected (403). Only an admin
 *    can clear the binding from the dashboard so the employee can re-bind on a
 *    new phone.
 *
 * `employee` is a Mongoose user document (already loaded by the caller).
 */
const enforceDeviceBinding = async (
  employee,
  { deviceId, deviceName, platform } = {}
) => {
  const normalizedId = String(deviceId || '').trim();

  if (!normalizedId) {
    throw new ApiError(
      400,
      'Device verification failed. Please update the app to the latest version and try again.'
    );
  }

  const bound = employee.boundDevice;
  const hasBinding = Boolean(bound && bound.deviceId);

  if (!hasBinding) {
    employee.boundDevice = {
      deviceId: normalizedId,
      deviceName: String(deviceName || '').trim(),
      platform: String(platform || '').trim(),
      boundAt: new Date(),
    };
    await employee.save();
    return { bound: true, justRegistered: true };
  }

  if (bound.deviceId !== normalizedId) {
    throw new ApiError(
      403,
      'This phone is not registered for your account. You can only mark attendance from your registered device. Contact HR to reset your device.'
    );
  }

  // Same device — keep metadata fresh (name/platform may change after OS update).
  const nextName = String(deviceName || '').trim();
  const nextPlatform = String(platform || '').trim();
  if (
    (nextName && nextName !== bound.deviceName) ||
    (nextPlatform && nextPlatform !== bound.platform)
  ) {
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
