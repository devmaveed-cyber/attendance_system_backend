const User = require('../models/User');
const ApiError = require('../utils/ApiError');

const MAX_TOKENS_PER_USER = 5;

const registerDeviceToken = async (userId, { token, platform }) => {
  const normalizedToken = String(token || '').trim();
  const normalizedPlatform = String(platform || 'unknown').trim().toLowerCase();

  if (!normalizedToken) {
    throw new ApiError(400, 'Device token is required');
  }

  const user = await User.findById(userId).select('fcmTokens accountRole');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.accountRole !== 'employee') {
    throw new ApiError(403, 'Only employee accounts can register mobile device tokens');
  }

  const now = new Date();
  const existing = user.fcmTokens.find((entry) => entry.token === normalizedToken);

  if (existing) {
    existing.platform = normalizedPlatform;
    existing.updatedAt = now;
  } else {
    user.fcmTokens.unshift({
      token: normalizedToken,
      platform: normalizedPlatform,
      updatedAt: now,
    });
  }

  user.fcmTokens.sort((a, b) => b.updatedAt - a.updatedAt);
  user.fcmTokens = user.fcmTokens.slice(0, MAX_TOKENS_PER_USER);

  await user.save();

  return {
    registered: true,
    tokenCount: user.fcmTokens.length,
  };
};

const removeDeviceToken = async (userId, token) => {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    throw new ApiError(400, 'Device token is required');
  }

  await User.updateOne(
    { _id: userId },
    { $pull: { fcmTokens: { token: normalizedToken } } }
  );

  return { removed: true };
};

module.exports = {
  registerDeviceToken,
  removeDeviceToken,
};
