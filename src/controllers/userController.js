const userService = require('../services/userService');

const getUsers = async (_req, res) => {
  const users = await userService.getAllUsers();

  res.status(200).json({
    success: true,
    count: users.length,
    data: { users },
  });
};

const createUser = async (req, res) => {
  const user = await userService.createUser(req.body);

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: { user },
  });
};

const updateUser = async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body);

  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: { user },
  });
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
};
