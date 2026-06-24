const authService = require('../services/authService');

const register = async (req, res) => {
  const result = await authService.register(req.body);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: result,
  });
};

const login = async (req, res) => {
  const result = await authService.login(req.body);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: result,
  });
};

const getMe = async (req, res) => {
  const profile = await authService.getProfile(req.user._id);

  res.status(200).json({
    success: true,
    data: profile,
  });
};

module.exports = { register, login, getMe };
