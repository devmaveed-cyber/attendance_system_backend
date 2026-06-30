const { body } = require('express-validator');
const { phoneBodyRule } = require('../utils/phoneValidator');

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  phoneBodyRule('phone', { required: false }),
];

const loginRules = [
  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail()
    .withMessage('Valid email is required'),
  phoneBodyRule('phone', { required: false }),
  body('password').notEmpty().withMessage('Password is required'),
  body('email').custom((_email, { req }) => {
    const hasEmail = String(req.body.email || '').trim();
    const hasPhone = String(req.body.phone || '').trim();

    if (!hasEmail && !hasPhone) {
      throw new Error('Email or phone number is required');
    }

    return true;
  }),
];

const deviceTokenRules = [
  body('token').trim().notEmpty().withMessage('Device token is required'),
  body('platform')
    .optional({ values: 'falsy' })
    .trim()
    .isIn(['ios', 'android', 'unknown'])
    .withMessage('Platform must be ios, android, or unknown'),
];

const removeDeviceTokenRules = [
  body('token').trim().notEmpty().withMessage('Device token is required'),
];

module.exports = {
  registerRules,
  loginRules,
  deviceTokenRules,
  removeDeviceTokenRules,
};
