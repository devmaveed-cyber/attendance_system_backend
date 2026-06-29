const { body } = require('express-validator');
const { phoneBodyRule } = require('../utils/phoneValidator');

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  phoneBodyRule('phone', { required: true }),
];

const loginRules = [
  phoneBodyRule('phone', { required: true }),
  body('password').notEmpty().withMessage('Password is required'),
];

module.exports = { registerRules, loginRules };
