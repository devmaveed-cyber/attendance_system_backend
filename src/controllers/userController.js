const userService = require('../services/userService');

const getUsers = async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 25;
  const search = req.query.search?.toString() || '';

  const result = await userService.getUsers({ page, limit, search });

  res.status(200).json({
    success: true,
    count: result.users.length,
    data: {
      users: result.users,
      pagination: result.pagination,
    },
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

const deleteUser = async (req, res) => {
  const result = await userService.deleteUser(req.params.id, req.user._id);

  res.status(200).json({
    success: true,
    message: 'User deleted successfully',
    data: result,
  });
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
};
