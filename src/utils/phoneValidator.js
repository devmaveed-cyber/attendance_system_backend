const { body } = require('express-validator');
const { normalizePhone, isValidUaeMobile } = require('./phoneUtils');

const assertValidUaeMobile = (value, { required = true } = {}) => {
  const normalized = normalizePhone(value);

  if (!normalized) {
    if (required) {
      throw new Error('Phone number is required');
    }
    return true;
  }

  if (!isValidUaeMobile(normalized)) {
    throw new Error('Enter a valid UAE mobile number (9715XXXXXXXX)');
  }

  return true;
};

const phoneBodyRule = (field = 'phone', { required = false } = {}) => {
  const chain = body(field).trim();

  if (required) {
    return chain
      .notEmpty()
      .withMessage('Phone number is required')
      .custom((value) => assertValidUaeMobile(value, { required: true }));
  }

  return chain
    .optional({ values: 'falsy' })
    .custom((value) => assertValidUaeMobile(value, { required: false }));
};

module.exports = {
  assertValidUaeMobile,
  phoneBodyRule,
};
