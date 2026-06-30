const authService = require('../services/authService');
const deviceTokenService = require('../services/deviceTokenService');
const deviceBindingService = require('../services/deviceBindingService');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

const register = async (req, res) => {
  const result = await authService.register(req.body);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: result,
  });
};

const login = async (req, res) => {
  const result = await authService.login(req.body);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: result,
  });
};

const getMe = async (req, res) => {
  const profile = await authService.getProfile(req.user._id);

  res.status(200).json({
    success: true,
    data: profile,
  });
};

const registerDeviceToken = async (req, res) => {
  const result = await deviceTokenService.registerDeviceToken(req.user._id, req.body);

  res.status(200).json({
    success: true,
    message: 'Device token registered',
    data: result,
  });
};

const removeDeviceToken = async (req, res) => {
  const result = await deviceTokenService.removeDeviceToken(
    req.user._id,
    req.body.token
  );

  res.status(200).json({
    success: true,
    message: 'Device token removed',
    data: result,
  });
};

const registerDeviceBinding = async (req, res) => {
  if (req.user.accountRole !== 'employee') {
    throw new ApiError(403, 'Only employee accounts can register a device');
  }

  const employee = await User.findById(req.user._id);
  if (!employee) {
    throw new ApiError(404, 'User not found');
  }

  const result = await deviceBindingService.registerDeviceBinding(
    employee,
    req.body
  );

  res.status(200).json({
    success: true,
    message: result.mismatch
      ? result.message
      : result.justRegistered
        ? 'Device registered successfully'
        : 'Device verified',
    data: result,
  });
};

module.exports = {
  register,
  login,
  getMe,
  registerDeviceToken,
  removeDeviceToken,
  registerDeviceBinding,
};
