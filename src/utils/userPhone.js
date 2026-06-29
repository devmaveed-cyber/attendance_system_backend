const User = require('../models/User');
const ApiError = require('./ApiError');
const { normalizePhone, phoneLookupVariants } = require('./phoneUtils');

const findUsersByPhone = async (phone, { includePassword = false } = {}) => {
  const variants = phoneLookupVariants(phone);
  if (variants.length === 0) {
    return [];
  }

  let query = User.find({ phone: { $in: variants } });
  if (includePassword) {
    query = query.select('+password');
  }

  return query;
};

const assertPhoneAvailable = async (phone, excludeUserId) => {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return '';
  }

  const variants = phoneLookupVariants(normalized);
  const filter = { phone: { $in: variants } };
  if (excludeUserId) {
    filter._id = { $ne: excludeUserId };
  }

  const existing = await User.findOne(filter).select('_id');
  if (existing) {
    throw new ApiError(409, 'A user with this phone number already exists');
  }

  return normalized;
};

module.exports = {
  findUsersByPhone,
  assertPhoneAvailable,
};
