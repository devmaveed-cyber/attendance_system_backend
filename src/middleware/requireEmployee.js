const ApiError = require('../utils/ApiError');

const requireEmployee = (req, _res, next) => {
  if (req.user?.accountRole !== 'employee') {
    return next(new ApiError(403, 'Employee access required'));
  }

  next();
};

module.exports = requireEmployee;
