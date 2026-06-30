const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');
const { normalizePhone, isValidUaeMobile } = require('../utils/phoneUtils');
const { findUsersByPhone } = require('../utils/userPhone');
const PasswordResetOtp = require('../models/PasswordResetOtp');
const smsService = require('./smsService');
const {
  signPasswordResetToken,
  verifyPasswordResetToken,
} = require('../utils/token');

const OTP_VALIDITY_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

const generateOtp = () => String(crypto.randomInt(100000, 999999));

const findActiveEmployeeByPhone = async (phone, { includePassword = false } = {}) => {
  const users = await findUsersByPhone(phone, { includePassword });
  return users.find((user) => user.accountRole === 'employee' && user.isActive) || null;
};

const sendOtp = async (phone) => {
  const normalized = normalizePhone(phone);
  if (!isValidUaeMobile(normalized)) {
    throw new ApiError(400, 'Enter a valid UAE mobile number (9715XXXXXXXX)');
  }

  const employee = await findActiveEmployeeByPhone(normalized);
  if (!employee) {
    throw new ApiError(
      404,
      'No active employee account found for this phone number'
    );
  }

  const existing = await PasswordResetOtp.findOne({ phone: normalized });
  if (existing) {
    const elapsed = Date.now() - existing.lastSentAt.getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS - elapsed) / 1000
      );
      throw new ApiError(
        429,
        `Please wait ${remainingSeconds} seconds before requesting a new OTP`
      );
    }
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);

  await PasswordResetOtp.findOneAndUpdate(
    { phone: normalized },
    {
      phone: normalized,
      otpHash,
      attempts: 0,
      verified: false,
      lastSentAt: new Date(),
      expiresAt: new Date(Date.now() + OTP_VALIDITY_MS),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await smsService.sendOtpSms(normalized, otp);

  return {
    phone: normalized,
    validitySeconds: OTP_VALIDITY_MS / 1000,
  };
};

const verifyOtp = async (phone, otp) => {
  const normalized = normalizePhone(phone);
  const code = String(otp || '').trim();

  if (!/^\d{6}$/.test(code)) {
    throw new ApiError(400, 'Enter the 6-digit OTP');
  }

  const record = await PasswordResetOtp.findOne({ phone: normalized }).select(
    '+otpHash'
  );

  if (!record || record.expiresAt <= new Date()) {
    throw new ApiError(400, 'Invalid or expired OTP');
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new ApiError(429, 'Too many failed attempts. Request a new OTP.');
  }

  const valid = await bcrypt.compare(code, record.otpHash);
  if (!valid) {
    record.attempts += 1;
    await record.save();
    throw new ApiError(400, 'Invalid or expired OTP');
  }

  const resetToken = signPasswordResetToken(normalized);
  record.verified = true;
  record.attempts = 0;
  await record.save();

  return { resetToken };
};

const resetPassword = async (phone, resetToken, newPassword) => {
  const normalized = normalizePhone(phone);
  verifyPasswordResetToken(resetToken, normalized);

  const record = await PasswordResetOtp.findOne({ phone: normalized });
  if (!record || !record.verified) {
    throw new ApiError(400, 'OTP verification required. Please verify OTP first.');
  }

  if (record.expiresAt <= new Date()) {
    throw new ApiError(400, 'Reset session expired. Please start again.');
  }

  const employee = await findActiveEmployeeByPhone(normalized, {
    includePassword: true,
  });
  if (!employee) {
    throw new ApiError(404, 'No active employee account found for this phone number');
  }

  employee.password = newPassword;
  await employee.save();
  await PasswordResetOtp.deleteOne({ phone: normalized });

  return { phone: normalized };
};

module.exports = {
  sendOtp,
  verifyOtp,
  resetPassword,
};
