const authService = require('../services/authService');
const deviceTokenService = require('../services/deviceTokenService');
const deviceBindingService = require('../services/deviceBindingService');
const forgotPasswordService = require('../services/forgotPasswordService');
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

  const result = await deviceBindingService.enforceDeviceBinding(
    employee,
    req.body
  );

  res.status(200).json({
    success: true,
    message: result.justRegistered
      ? 'Device registered successfully'
      : 'Device verified',
    data: result,
  });
};

const sendForgotPasswordOtp = async (req, res) => {
  const result = await forgotPasswordService.sendOtp(req.body.phone);

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully',
    data: result,
  });
};

const verifyForgotPasswordOtp = async (req, res) => {
  const result = await forgotPasswordService.verifyOtp(
    req.body.phone,
    req.body.otp
  );

  res.status(200).json({
    success: true,
    message: 'OTP verified successfully',
    data: result,
  });
};

const resetForgotPassword = async (req, res) => {
  await forgotPasswordService.resetPassword(
    req.body.phone,
    req.body.resetToken,
    req.body.newPassword
  );

  res.status(200).json({
    success: true,
    message: 'Password updated successfully',
  });
};

module.exports = {
  register,
  login,
  getMe,
  registerDeviceToken,
  removeDeviceToken,
  registerDeviceBinding,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetForgotPassword,
};
