const ApiError = require('../utils/ApiError');

const requireAdmin = (req, _res, next) => {
  if (req.user?.accountRole !== 'admin') {
    return next(new ApiError(403, 'Admin access required'));
  }

  next();
};

module.exports = requireAdmin;
