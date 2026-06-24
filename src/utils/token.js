const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signToken = (userId) =>
  jwt.sign({ sub: userId }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });

module.exports = { signToken };
