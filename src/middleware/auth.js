const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const User = require('../models/User');

const protect = async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Authentication required'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    const user = await User.findById(decoded.sub).select('-password');

    if (!user) {
      return next(new ApiError(401, 'User no longer exists'));
    }

    if (!user.isActive) {
      return next(new ApiError(403, 'Account is disabled'));
    }

    req.user = user;
    next();
  } catch {
    return next(new ApiError(401, 'Invalid or expired token'));
  }
};

module.exports = protect;
