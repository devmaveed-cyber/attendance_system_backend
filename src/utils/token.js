const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('./ApiError');

const signToken = (userId) =>
  jwt.sign({ sub: userId }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });

const signPasswordResetToken = (phone) =>
  jwt.sign({ sub: phone, purpose: 'password-reset' }, env.jwt.secret, {
    expiresIn: '15m',
  });

const verifyPasswordResetToken = (token, expectedPhone) => {
  try {
    const payload = jwt.verify(token, env.jwt.secret);
    if (payload.purpose !== 'password-reset') {
      throw new ApiError(400, 'Invalid reset token');
    }
    if (payload.sub !== expectedPhone) {
      throw new ApiError(400, 'Invalid reset token');
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(400, 'Invalid or expired reset token');
  }
};

module.exports = {
  signToken,
  signPasswordResetToken,
  verifyPasswordResetToken,
};
