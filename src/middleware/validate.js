const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

const validate = (req, _res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const message = errors
      .array()
      .map((error) => error.msg)
      .join(', ');

    return next(new ApiError(400, message));
  }

  next();
};

module.exports = validate;
