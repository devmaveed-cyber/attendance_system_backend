const ApiError = require('../utils/ApiError');
const { resolveAllowedSections } = require('../services/authService');

const requireAnySection =
  (...sections) =>
  async (req, _res, next) => {
    try {
      const allowed = await resolveAllowedSections(req.user);

      if (sections.some((section) => allowed.includes(section))) {
        return next();
      }

      return next(
        new ApiError(403, 'You do not have permission to access this section')
      );
    } catch (error) {
      return next(error);
    }
  };

module.exports = requireAnySection;
